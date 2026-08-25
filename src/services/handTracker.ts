/**
 * MediaPipe HandLandmarker Tracking Service with Smoothing and Kinematics
 */

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { HandTrackingResult, SaberPoint } from '../types';

export class HandTrackerService {
  private handLandmarker: HandLandmarker | null = null;
  private isInitializing = false;
  private isReady = false;
  private initError: string | null = null;
  private lastVideoTime = -1;

  // Smoothing buffers (Exponential Moving Average)
  private prevLeftTip: SaberPoint | null = null;
  private prevLeftBase: SaberPoint | null = null;
  private prevRightTip: SaberPoint | null = null;
  private prevRightBase: SaberPoint | null = null;

  // Frame rate counter
  private frameCount = 0;
  private lastFpsUpdate = performance.now();
  private currentFps = 0;

  public async init(): Promise<boolean> {
    if (this.isReady) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    this.initError = null;

    try {
      // Load WASM binaries from CDN
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
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

      this.isReady = true;
      this.isInitializing = false;
      return true;
    } catch (err: unknown) {
      console.warn('Failed to load GPU MediaPipe hand landmarker, falling back to CPU:', err);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        });
        this.isReady = true;
        this.isInitializing = false;
        return true;
      } catch (fallbackErr: unknown) {
        console.error('Fatal error loading HandLandmarker:', fallbackErr);
        this.initError = fallbackErr instanceof Error ? fallbackErr.message : 'MediaPipe vision load failed';
        this.isInitializing = false;
        return false;
      }
    }
  }

  public processVideoFrame(
    video: HTMLVideoElement,
    canvasWidth: number,
    canvasHeight: number,
    mirror = true,
    saberLengthPx = 220
  ): HandTrackingResult {
    // FPS calculation
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsUpdate >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    if (!this.isReady || !this.handLandmarker || video.readyState < 2) {
      return {
        leftHand: null,
        rightHand: null,
        fps: this.currentFps,
        isReady: this.isReady,
        error: this.initError,
      };
    }

    if (video.currentTime === this.lastVideoTime) {
      // Frame hasn't advanced yet
      return {
        leftHand: this.prevLeftTip ? this.buildHandData('left', this.prevLeftTip, this.prevLeftBase!) : null,
        rightHand: this.prevRightTip ? this.buildHandData('right', this.prevRightTip, this.prevRightBase!) : null,
        fps: this.currentFps,
        isReady: true,
      };
    }

    this.lastVideoTime = video.currentTime;

    try {
      const results = this.handLandmarker.detectForVideo(video, performance.now());

      let leftHandData: HandTrackingResult['leftHand'] = null;
      let rightHandData: HandTrackingResult['rightHand'] = null;

      if (results.landmarks && results.landmarks.length > 0) {
        for (let i = 0; i < results.landmarks.length; i++) {
          const rawLandmarks = results.landmarks[i];
          const handedness = results.handednesses[i]?.[0]?.categoryName; // 'Left' or 'Right'
          
          // Note: In mirror mode, MediaPipe's "Left" hand appears on the right side of the screen
          // When mirrored: physical left hand -> user sees on their left
          const isLeftHand = mirror ? handedness === 'Right' : handedness === 'Left';

          // Extract key landmarks:
          // 0: Wrist
          // 5: Index finger MCP (knuckle)
          // 8: Index finger tip
          // 9: Middle finger MCP
          // 12: Middle finger tip
          const wristRaw = rawLandmarks[0];
          const indexMcpRaw = rawLandmarks[5];
          const indexTipRaw = rawLandmarks[8];
          const middleMcpRaw = rawLandmarks[9];

          // Map normalized coords [0, 1] to canvas pixels
          const mapCoord = (p: { x: number; y: number; z: number }): SaberPoint => {
            const x = mirror ? (1 - p.x) * canvasWidth : p.x * canvasWidth;
            const y = p.y * canvasHeight;
            return { x, y, z: p.z };
          };

          const wrist = mapCoord(wristRaw);
          const indexMcp = mapCoord(indexMcpRaw);
          const indexTip = mapCoord(indexTipRaw);
          const middleMcp = mapCoord(middleMcpRaw);

          // Calculate palm center
          const palmCenter: SaberPoint = {
            x: (wrist.x + indexMcp.x + middleMcp.x) / 3,
            y: (wrist.y + indexMcp.y + middleMcp.y) / 3,
          };

          // Direction vector of the hand / saber blade
          // Direction from wrist through index knuckle / tip
          let dirX = indexTip.x - wrist.x;
          let dirY = indexTip.y - wrist.y;
          const mag = Math.hypot(dirX, dirY) || 1;
          dirX /= mag;
          dirY /= mag;

          // Blade base at knuckle / palm, tip extended outward
          const rawBase: SaberPoint = {
            x: palmCenter.x,
            y: palmCenter.y,
          };

          const rawTip: SaberPoint = {
            x: rawBase.x + dirX * saberLengthPx,
            y: rawBase.y + dirY * saberLengthPx,
          };

          // Smooth with EMA filter (alpha: 0.65 for fast response, smooth lines)
          const alpha = 0.68;
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
              rawLandmarks: rawLandmarks.map(p => mapCoord(p)),
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
              rawLandmarks: rawLandmarks.map(p => mapCoord(p)),
            };
          }
        }
      }

      // If a hand wasn't detected in this frame, gradually fade its position
      if (!leftHandData) this.prevLeftTip = null;
      if (!rightHandData) this.prevRightTip = null;

      return {
        leftHand: leftHandData,
        rightHand: rightHandData,
        fps: this.currentFps,
        isReady: true,
        error: null,
      };
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

  private lerpPoint(p1: SaberPoint, p2: SaberPoint, alpha: number): SaberPoint {
    return {
      x: p1.x * (1 - alpha) + p2.x * alpha,
      y: p1.y * (1 - alpha) + p2.y * alpha,
      z: (p1.z || 0) * (1 - alpha) + (p2.z || 0) * alpha,
    };
  }

  private buildHandData(hand: 'left' | 'right', tip: SaberPoint, base: SaberPoint) {
    return {
      detected: true,
      wrist: base,
      indexTip: tip,
      indexBase: base,
      palmCenter: base,
    };
  }
}

export const handTracker = new HandTrackerService();
