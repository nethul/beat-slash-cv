import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff, CheckCircle2, AlertCircle, Eye, EyeOff, Wifi, WifiOff, Zap } from 'lucide-react';
import { HandTrackingResult, GameSettings } from '../types';
import { handTracker } from '../services/handTracker';

interface WebcamViewProps {
  onVideoReady: (video: HTMLVideoElement | null) => void;
  onTrackingResult: (result: HandTrackingResult) => void;
  gameSettings: GameSettings;
  isGameActive: boolean;
}

export const WebcamView: React.FC<WebcamViewProps> = ({
  onVideoReady,
  onTrackingResult,
  gameSettings,
  isGameActive,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationLoopRef = useRef<number | null>(null);

  const [cameraState, setCameraState] = useState<'idle' | 'loading' | 'active' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trackingFps, setTrackingFps] = useState<number>(0);
  const [leftDetected, setLeftDetected] = useState<boolean>(false);
  const [rightDetected, setRightDetected] = useState<boolean>(false);
  const [isPipCollapsed, setIsPipCollapsed] = useState<boolean>(false);
  const [isNativeMode, setIsNativeMode] = useState<boolean>(false);
  const [serverInferenceMs, setServerInferenceMs] = useState<number>(0);
  const [previewFrameSrc, setPreviewFrameSrc] = useState<string | null>(null);

  // Initialize hand tracker and camera
  useEffect(() => {
    let isMounted = true;

    async function setup() {
      setCameraState('loading');
      setErrorMessage(null);

      // 1. Initialize hand tracker (tries native CUDA server first, falls back to WASM)
      const trackerReady = await handTracker.init();
      if (!isMounted) return;

      const nativeConnected = handTracker.isNativeConnected();
      setIsNativeMode(nativeConnected);

      if (!trackerReady) {
        setErrorMessage('Could not load AI hand tracking. Switching to pointer control.');
        setCameraState('error');
      }

      // 2. If using native server, Python handles the camera directly
      if (nativeConnected) {
        console.log('[WebcamView] Native CUDA mode – Python handles camera');
        setCameraState('active');
        onVideoReady(null); // No browser video element needed

        // Set up result callback from WebSocket
        handTracker.onResult((result) => {
          if (!isMounted) return;
          onTrackingResult(result);
          setTrackingFps(result.fps);
          setLeftDetected(!!result.leftHand?.detected);
          setRightDetected(!!result.rightHand?.detected);
          if (result.previewFrame) {
            setPreviewFrameSrc(result.previewFrame);
          }

          const diag = handTracker.getDiagnostics();
          setServerInferenceMs(diag.serverInferenceMs);
        });

        return;
      }

      // 3. WASM fallback: need browser camera stream
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
            frameRate: { ideal: 60, min: 30 },
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setCameraState('active');
            onVideoReady(videoRef.current);
          };
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Camera permission denied or unavailable';
        setErrorMessage(msg);
        setCameraState('error');
        onVideoReady(null);
      }
    }

    if (gameSettings.cameraActive) {
      setup();
    } else {
      stopCamera();
    }

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [gameSettings.cameraActive]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationLoopRef.current) {
      cancelAnimationFrame(animationLoopRef.current);
      animationLoopRef.current = null;
    }
    setCameraState('idle');
    onVideoReady(null);
  };

  // Continuous Tracking Loop (WASM fallback only – native mode uses WebSocket callbacks)
  useEffect(() => {
    if (isNativeMode) return; // Native server pushes results via WebSocket
    let isLoopActive = true;

    const runTracking = () => {
      if (!isLoopActive) return;

      const video = videoRef.current;
      if (video && video.readyState >= 2 && cameraState === 'active') {
        const canvasW = window.innerWidth;
        const canvasH = window.innerHeight;

        const result = handTracker.processVideoFrame(
          video,
          canvasW,
          canvasH,
          gameSettings.cameraMirror,
          gameSettings.saberLength || 220,
        );

        onTrackingResult(result);
        setTrackingFps(result.fps);
        setLeftDetected(!!result.leftHand?.detected);
        setRightDetected(!!result.rightHand?.detected);

        // Draw PIP Preview if enabled
        if (gameSettings.showCameraPreview && pipCanvasRef.current && !isPipCollapsed) {
          drawPipPreview(pipCanvasRef.current, video, result);
        }
      }

      animationLoopRef.current = requestAnimationFrame(runTracking);
    };

    if (cameraState === 'active') {
      animationLoopRef.current = requestAnimationFrame(runTracking);
    }

    return () => {
      isLoopActive = false;
      if (animationLoopRef.current) cancelAnimationFrame(animationLoopRef.current);
    };
  }, [cameraState, gameSettings, onTrackingResult, isPipCollapsed, isNativeMode]);

  const drawPipPreview = (
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    result: HandTrackingResult,
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw mirrored video frame
    ctx.save();
    if (gameSettings.cameraMirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Semi-dark gradient overlay
    ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw hand landmark indicators scaled to PIP
    const scaleX = canvas.width / window.innerWidth;
    const scaleY = canvas.height / window.innerHeight;

    const drawHandMarker = (
      hand: HandTrackingResult['leftHand'],
      color: string,
      label: string,
    ) => {
      if (!hand || !hand.detected) return;

      const px = hand.palmCenter.x * scaleX;
      const py = hand.palmCenter.y * scaleY;
      const tx = hand.indexTip.x * scaleX;
      const ty = hand.indexTip.y * scaleY;

      // Saber blade line
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // Palm circle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = color;
      ctx.font = 'bold 10px Orbitron, sans-serif';
      ctx.fillText(label, px - 12, py - 10);
    };

    drawHandMarker(result.leftHand, '#ef4444', 'RED');
    drawHandMarker(result.rightHand, '#06b6d4', 'BLUE');

    ctx.restore();
  };

  return (
    <>
      {/* Hidden processing video element (WASM fallback only) */}
      {!isNativeMode && (
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="hidden"
        />
      )}

      {/* Picture-in-Picture Camera Feedback HUD */}
      {gameSettings.showCameraPreview && (
        <div
          id="camera-pip-widget"
          className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-1.5 transition-all duration-300 pointer-events-auto"
        >
          {/* PIP Header & Status Bar */}
          <div className="flex items-center gap-2 px-3 py-1 bg-black/60 border border-white/20 rounded-lg backdrop-blur-md text-xs shadow-xl">
            <div className="flex items-center gap-1.5">
              {cameraState === 'active' ? (
                isNativeMode ? (
                  <Zap className="w-3 h-3 text-green-400" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
                )
              ) : cameraState === 'loading' ? (
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-pink-500" />
              )}
              <span className="font-cyber font-bold text-[11px] tracking-wider text-slate-300">
                {cameraState === 'active'
                  ? isNativeMode
                    ? `CUDA ${trackingFps} FPS`
                    : `CAM ${trackingFps} FPS`
                  : cameraState === 'loading'
                  ? 'CONNECTING...'
                  : 'CAMERA OFF'}
              </span>
            </div>

            {/* Native mode latency badge */}
            {isNativeMode && cameraState === 'active' && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black tracking-wider bg-green-500/20 text-green-400 border border-green-500/50">
                {serverInferenceMs.toFixed(0)}ms
              </span>
            )}

            {/* Hand Status Badges */}
            {cameraState === 'active' && (
              <div className="flex items-center gap-1.5 ml-1 border-l border-white/20 pl-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest transition-colors ${
                    leftDetected
                      ? 'bg-pink-500/20 text-pink-400 border border-pink-500/50 shadow-[0_0_8px_rgba(236,72,153,0.5)]'
                      : 'bg-white/5 text-slate-500'
                  }`}
                >
                  L: {leftDetected ? 'LOCKED' : 'SEEKING'}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest transition-colors ${
                    rightDetected
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                      : 'bg-white/5 text-slate-500'
                  }`}
                >
                  R: {rightDetected ? 'LOCKED' : 'SEEKING'}
                </span>
              </div>
            )}

            {/* Collapse toggle */}
            <button
              id="pip-toggle-btn"
              onClick={() => setIsPipCollapsed(!isPipCollapsed)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors ml-1"
              title={isPipCollapsed ? 'Show Preview' : 'Hide Preview'}
            >
              {isPipCollapsed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* PIP Canvas / Video Feed */}
          {!isPipCollapsed && (
            <div className="relative w-36 h-24 sm:w-44 sm:h-28 rounded-lg overflow-hidden border border-white/20 bg-black shadow-2xl shadow-indigo-950/60">
              {isNativeMode ? (
                previewFrameSrc ? (
                  <div className="relative w-full h-full">
                    <img
                      src={previewFrameSrc}
                      alt="Camera Preview"
                      className="w-full h-full object-cover opacity-95 scale-x-[-1]"
                    />
                    <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse pointer-events-none" />
                    <div className="absolute bottom-1 left-1.5 px-1.5 py-0.5 bg-black/70 backdrop-blur rounded text-[8px] font-mono text-green-400 border border-green-500/30">
                      LIVE CUDA
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-green-950/80 to-black/90 text-center p-2">
                    <Zap className="w-6 h-6 text-green-400 mb-1 animate-pulse" />
                    <p className="text-[10px] font-cyber text-green-400 tracking-wider">NATIVE CUDA</p>
                    <p className="text-[8px] text-green-300/60 mt-0.5">
                      {serverInferenceMs > 0 ? `${serverInferenceMs.toFixed(1)}ms inference` : 'Initializing...'}
                    </p>
                  </div>
                )
              ) : (
                <>
                  <canvas
                    ref={pipCanvasRef}
                    width={240}
                    height={160}
                    className="w-full h-full object-cover opacity-90"
                  />
                  <div className="absolute inset-0 bg-cyan-400/5 pointer-events-none" />
                  <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse pointer-events-none" />
                </>
              )}

              {cameraState === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 text-center p-2">
                  <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-1" />
                  <p className="text-[10px] text-cyan-400 font-cyber">
                    {isNativeMode ? 'CONNECTING TO GPU...' : 'INITIALIZING AI...'}
                  </p>
                </div>
              )}

              {cameraState === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-center p-2">
                  <AlertCircle className="w-5 h-5 text-pink-500 mb-1" />
                  <p className="text-[10px] text-pink-300 font-mono leading-tight">
                    {errorMessage || 'Camera access error'}
                  </p>
                </div>
              )}

              {/* Real-time Hand Positioning Helper overlay */}
              {cameraState === 'active' && !leftDetected && !rightDetected && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
                  <p className="text-[9px] font-cyber text-cyan-300 tracking-wider text-center px-2 py-0.5 bg-black/70 rounded border border-cyan-500/40">
                    RAISE HANDS
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};
