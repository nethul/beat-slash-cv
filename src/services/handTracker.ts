/**
 * Hand Tracking Service – WebSocket Client for Native CUDA Backend
 * ================================================================
 * Connects to the Python hand_tracker_server.py via WebSocket to receive
 * pre-processed hand landmarks at high frame rates with CUDA acceleration.
 * Falls back to browser-based MediaPipe WASM if the native server is unavailable.
 */

import { HandTrackingResult, SaberPoint } from '../types';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'fallback';

export class HandTrackerService {
  // WebSocket connection
  private ws: WebSocket | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private readonly wsUrl: string;

  // Latest tracking data from server
  private latestResult: HandTrackingResult | null = null;
  private onResultCallback: ((result: HandTrackingResult) => void) | null = null;

  // Smoothing buffers (EMA applied client-side for extra responsiveness)
  private prevLeftTip: SaberPoint | null = null;
  private prevLeftBase: SaberPoint | null = null;
  private prevRightTip: SaberPoint | null = null;
  private prevRightBase: SaberPoint | null = null;

  // Frame rate tracking
  private frameCount = 0;
  private lastFpsUpdate = performance.now();
  private currentFps = 0;

  // Server diagnostics
  private serverInferenceMs = 0;
  private serverCaptureFps = 0;
  private serverInferenceFps = 0;

  // Fallback: MediaPipe WASM (loaded lazily only if native server unavailable)
  private wasmFallbackActive = false;
  private wasmHandLandmarker: any = null;
  private lastVideoTime = -1;

  constructor(port: number = 9734) {
    this.wsUrl = `ws://localhost:${port}`;
  }

  /**
   * Initialize: attempt WebSocket connection to native CUDA server.
   * Returns true if connected, false if falling back to WASM.
   */
  public async init(): Promise<boolean> {
    if (this.connectionState === 'connected') return true;

    return new Promise<boolean>((resolve) => {
      this.connectionState = 'connecting';
      console.log(`[HandTracker] Connecting to native server: ${this.wsUrl}`);

      try {
        this.ws = new WebSocket(this.wsUrl);

        const timeout = setTimeout(() => {
          console.warn('[HandTracker] Connection timeout, falling back to WASM');
          this.ws?.close();
          this.initWasmFallback().then(resolve);
        }, 3000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;
          this.wasmFallbackActive = false;
          console.log('[HandTracker] ✓ Connected to native CUDA server');
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          this.handleServerMessage(event.data);
        };

        this.ws.onclose = () => {
          if (this.connectionState === 'connected') {
            console.warn('[HandTracker] Server disconnected');
            this.connectionState = 'disconnected';
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (err) => {
          clearTimeout(timeout);
          console.warn('[HandTracker] WebSocket error, falling back to WASM');
          this.connectionState = 'disconnected';
          this.initWasmFallback().then(resolve);
        };
      } catch (err) {
        console.warn('[HandTracker] Failed to create WebSocket, falling back to WASM');
        this.initWasmFallback().then(resolve);
      }
    });
  }

  /**
   * Handle incoming messages from the Python server.
   */
  private handleServerMessage(data: string) {
    try {
      const msg = JSON.parse(data);

      if (msg.type === 'tracking') {
        this.frameCount++;
        const now = performance.now();

        // Update FPS counter
        if (now - this.lastFpsUpdate >= 1000) {
          this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
          this.frameCount = 0;
          this.lastFpsUpdate = now;
        }

        // Store server diagnostics
        this.serverInferenceMs = msg.inferenceMs || 0;
        this.serverCaptureFps = msg.captureFps || 0;
        this.serverInferenceFps = msg.inferenceFps || 0;

        // Build HandTrackingResult with client-side smoothing
        const result = this.processServerLandmarks(msg, msg.frameWidth, msg.frameHeight);
        this.latestResult = result;

        // Notify listener
        if (this.onResultCallback) {
          this.onResultCallback(result);
        }
      }
    } catch (err) {
      // Ignore parse errors
    }
  }

  /**
   * Process server landmark data and apply client-side EMA smoothing.
   * The server sends normalized [0,1] coordinates; we map to canvas pixels here.
   */
  private processServerLandmarks(
    msg: any,
    frameWidth: number,
    frameHeight: number,
  ): HandTrackingResult {
    const canvasW = window.innerWidth;
    const canvasH = window.innerHeight;

    let leftHandData: HandTrackingResult['leftHand'] = null;
    let rightHandData: HandTrackingResult['rightHand'] = null;

    const processHand = (
      handData: any,
      isLeftHand: boolean,
      mirror: boolean,
      saberLengthPx: number,
    ) => {
      if (!handData || !handData.detected) return null;

      // Natural reach amplification: maps camera central region [0.12, 0.88] to full canvas [0, 1]
      const amplify = (v: number) => Math.max(0, Math.min(1, (v - 0.5) * 1.38 + 0.5));

      const mapCoord = (p: { x: number; y: number; z: number }): SaberPoint => {
        const nx = amplify(p.x);
        const ny = amplify(p.y);
        const x = mirror ? (1 - nx) * canvasW : nx * canvasW;
        const y = ny * canvasH;
        return { x, y, z: p.z || 0 };
      };

      const wrist = mapCoord(handData.wrist);
      const indexMcp = mapCoord(handData.indexBase);
      const indexTip = mapCoord(handData.indexTip);
      const palmCenter = mapCoord(handData.palmCenter);

      // Direction vector from wrist through index tip
      let dirX = indexTip.x - wrist.x;
      let dirY = indexTip.y - wrist.y;
      const mag = Math.hypot(dirX, dirY) || 1;
      dirX /= mag;
      dirY /= mag;

      const rawBase: SaberPoint = { x: palmCenter.x, y: palmCenter.y };
      const rawTip: SaberPoint = {
        x: rawBase.x + dirX * saberLengthPx,
        y: rawBase.y + dirY * saberLengthPx,
      };

      // Near-zero latency response (alpha = 0.94 for native backend)
      const alpha = 0.94;

      if (isLeftHand) {
        const smoothedTip = this.prevLeftTip ? this.lerpPoint(this.prevLeftTip, rawTip, alpha) : rawTip;
        const smoothedBase = this.prevLeftBase ? this.lerpPoint(this.prevLeftBase, rawBase, alpha) : rawBase;
        this.prevLeftTip = smoothedTip;
        this.prevLeftBase = smoothedBase;

        return {
          detected: true,
          wrist,
          indexTip: smoothedTip,
          indexBase: smoothedBase,
          palmCenter,
          rawLandmarks: handData.rawLandmarks?.map((p: any) => mapCoord(p)),
        };
      } else {
        const smoothedTip = this.prevRightTip ? this.lerpPoint(this.prevRightTip, rawTip, alpha) : rawTip;
        const smoothedBase = this.prevRightBase ? this.lerpPoint(this.prevRightBase, rawBase, alpha) : rawBase;
        this.prevRightTip = smoothedTip;
        this.prevRightBase = smoothedBase;

        return {
          detected: true,
          wrist,
          indexTip: smoothedTip,
          indexBase: smoothedBase,
          palmCenter,
          rawLandmarks: handData.rawLandmarks?.map((p: any) => mapCoord(p)),
        };
      }
    };

    // MediaPipe identifies physical user hands ("Left" = Left Hand / Red Saber, "Right" = Right Hand / Blue Saber)
    const mirror = true; // Always mirror webcam view for natural selfie perspective
    const saberLength = 220;

    if (msg.leftHand) {
      leftHandData = processHand(msg.leftHand, true, mirror, saberLength);
    }
    if (msg.rightHand) {
      rightHandData = processHand(msg.rightHand, false, mirror, saberLength);
    }

    // Clear smoothing if hand lost
    if (!leftHandData) {
      this.prevLeftTip = null;
      this.prevLeftBase = null;
    }
    if (!rightHandData) {
      this.prevRightTip = null;
      this.prevRightBase = null;
    }

    return {
      leftHand: leftHandData,
      rightHand: rightHandData,
      fps: this.currentFps,
      isReady: true,
      error: null,
      previewFrame: msg.previewFrame ? `data:image/jpeg;base64,${msg.previewFrame}` : undefined,
    };
  }

  /**
   * Set callback for when new tracking results arrive.
   */
  public onResult(callback: (result: HandTrackingResult) => void) {
    this.onResultCallback = callback;
  }

  /**
   * WASM Fallback: Process a video frame using browser-based MediaPipe.
   * Only used when the native Python server is unavailable.
   */
  public processVideoFrame(
    video: HTMLVideoElement,
    canvasWidth: number,
    canvasHeight: number,
    mirror = true,
    saberLengthPx = 220,
  ): HandTrackingResult {
    // If connected to native server, return latest result
    if (this.connectionState === 'connected' && this.latestResult) {
      return this.latestResult;
    }

    // WASM fallback processing
    if (!this.wasmFallbackActive || !this.wasmHandLandmarker || video.readyState < 2) {
      return {
        leftHand: null,
        rightHand: null,
        fps: this.currentFps,
        isReady: this.wasmFallbackActive,
        error: this.connectionState === 'disconnected' ? 'Connecting to hand tracking server...' : null,
      };
    }

    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsUpdate >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    if (video.currentTime === this.lastVideoTime) {
      return this.latestResult || {
        leftHand: null,
        rightHand: null,
        fps: this.currentFps,
        isReady: true,
      };
    }

    this.lastVideoTime = video.currentTime;

    try {
      const results = this.wasmHandLandmarker.detectForVideo(video, performance.now());

      let leftHandData: HandTrackingResult['leftHand'] = null;
      let rightHandData: HandTrackingResult['rightHand'] = null;

      if (results.landmarks && results.landmarks.length > 0) {
        for (let i = 0; i < results.landmarks.length; i++) {
          const rawLandmarks = results.landmarks[i];
          const handedness = results.handednesses[i]?.[0]?.categoryName;
          const isLeftHand = handedness === 'Left';

          const wristRaw = rawLandmarks[0];
          const indexMcpRaw = rawLandmarks[5];
          const indexTipRaw = rawLandmarks[8];
          const middleMcpRaw = rawLandmarks[9];

          const amplify = (v: number) => Math.max(0, Math.min(1, (v - 0.5) * 1.38 + 0.5));

          const mapCoord = (p: { x: number; y: number; z: number }): SaberPoint => {
            const nx = amplify(p.x);
            const ny = amplify(p.y);
            const x = mirror ? (1 - nx) * canvasWidth : nx * canvasWidth;
            const y = ny * canvasHeight;
            return { x, y, z: p.z };
          };

          const wrist = mapCoord(wristRaw);
          const indexMcp = mapCoord(indexMcpRaw);
          const indexTip = mapCoord(indexTipRaw);
          const middleMcp = mapCoord(middleMcpRaw);

          const palmCenter: SaberPoint = {
            x: (wrist.x + indexMcp.x + middleMcp.x) / 3,
            y: (wrist.y + indexMcp.y + middleMcp.y) / 3,
          };

          let dirX = indexTip.x - wrist.x;
          let dirY = indexTip.y - wrist.y;
          const mag = Math.hypot(dirX, dirY) || 1;
          dirX /= mag;
          dirY /= mag;

          const rawBase: SaberPoint = { x: palmCenter.x, y: palmCenter.y };
          const rawTip: SaberPoint = {
            x: rawBase.x + dirX * saberLengthPx,
            y: rawBase.y + dirY * saberLengthPx,
          };

          const alpha = 0.92;
          if (isLeftHand) {
            const smoothedTip = this.prevLeftTip ? this.lerpPoint(this.prevLeftTip, rawTip, alpha) : rawTip;
            const smoothedBase = this.prevLeftBase ? this.lerpPoint(this.prevLeftBase, rawBase, alpha) : rawBase;
            this.prevLeftTip = smoothedTip;
            this.prevLeftBase = smoothedBase;

            leftHandData = {
              detected: true,
              wrist,
              indexTip: smoothedTip,
              indexBase: smoothedBase,
              palmCenter,
              rawLandmarks: rawLandmarks.map((p: any) => mapCoord(p)),
            };
          } else {
            const smoothedTip = this.prevRightTip ? this.lerpPoint(this.prevRightTip, rawTip, alpha) : rawTip;
            const smoothedBase = this.prevRightBase ? this.lerpPoint(this.prevRightBase, rawBase, alpha) : rawBase;
            this.prevRightTip = smoothedTip;
            this.prevRightBase = smoothedBase;

            rightHandData = {
              detected: true,
              wrist,
              indexTip: smoothedTip,
              indexBase: smoothedBase,
              palmCenter,
              rawLandmarks: rawLandmarks.map((p: any) => mapCoord(p)),
            };
          }
        }
      }

      if (!leftHandData) this.prevLeftTip = null;
      if (!rightHandData) this.prevRightTip = null;

      const result: HandTrackingResult = {
        leftHand: leftHandData,
        rightHand: rightHandData,
        fps: this.currentFps,
        isReady: true,
        error: null,
      };

      this.latestResult = result;
      return result;
    } catch (err: unknown) {
      return {
        leftHand: null,
        rightHand: null,
        fps: this.currentFps,
        isReady: true,
        error: err instanceof Error ? err.message : 'Detection frame error',
      };
    }
  }

  /**
   * Initialize WASM fallback (only when native server is unavailable).
   */
  private async initWasmFallback(): Promise<boolean> {
    console.log('[HandTracker] Initializing WASM fallback...');
    this.connectionState = 'fallback';

    try {
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
      );

      this.wasmHandLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      this.wasmFallbackActive = true;
      console.log('[HandTracker] ✓ WASM fallback ready (GPU delegate)');
      return true;
    } catch (err) {
      console.warn('[HandTracker] GPU WASM failed, trying CPU:', err);
      try {
        const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');

        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
        );

        this.wasmHandLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });

        this.wasmFallbackActive = true;
        console.log('[HandTracker] ✓ WASM fallback ready (CPU delegate)');
        return true;
      } catch (fallbackErr) {
        console.error('[HandTracker] ✗ All tracking methods failed:', fallbackErr);
        return false;
      }
    }
  }

  /**
   * Schedule reconnection attempt to the native server.
   */
  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[HandTracker] Max reconnect attempts reached, staying on WASM fallback');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;

    console.log(`[HandTracker] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.init();
    }, delay);
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

  private lerpPoint(p1: SaberPoint, p2: SaberPoint, alpha: number): SaberPoint {
    return {
      x: p1.x * (1 - alpha) + p2.x * alpha,
      y: p1.y * (1 - alpha) + p2.y * alpha,
      z: (p1.z || 0) * (1 - alpha) + (p2.z || 0) * alpha,
    };
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  public isNativeConnected(): boolean {
    return this.connectionState === 'connected';
  }

  public getDiagnostics() {
    return {
      connectionState: this.connectionState,
      fps: this.currentFps,
      serverInferenceMs: this.serverInferenceMs,
      serverCaptureFps: this.serverCaptureFps,
      serverInferenceFps: this.serverInferenceFps,
      wasmFallback: this.wasmFallbackActive,
    };
  }

  public destroy() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionState = 'disconnected';
    this.onResultCallback = null;
  }
}

export const handTracker = new HandTrackerService();
