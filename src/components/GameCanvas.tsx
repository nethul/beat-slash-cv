import React, { useEffect, useRef } from 'react';
import {
  CutDirection,
  GameSettings,
  GameStats,
  HandTrackingResult,
  Note,
  SaberPoint,
  SaberState,
  ScoreFloater,
  SliceDebris,
  SparkParticle,
} from '../types';
import { soundManager } from '../services/audioEngine';

interface GameCanvasProps {
  isPlaying: boolean;
  isPaused: boolean;
  notes: Note[];
  songTime: number;
  gameSettings: GameSettings;
  handTrackingResult: HandTrackingResult | null;
  videoElement: HTMLVideoElement | null;
  onNoteSliced: (note: Note, accuracy: number, directionMatched: boolean, colorMatched: boolean) => void;
  onNoteMissed: (note: Note) => void;
  onBombHit: (note: Note) => void;
  stats: GameStats;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  isPlaying,
  isPaused,
  notes,
  songTime,
  gameSettings,
  handTrackingResult,
  videoElement,
  onNoteSliced,
  onNoteMissed,
  onBombHit,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Saber state refs (to avoid re-renders at 60fps)
  const leftSaberRef = useRef<SaberState>({
    hand: 'left',
    color: '#ec4899',
    tip: { x: 0, y: 0 },
    base: { x: 0, y: 0 },
    prevTip: { x: 0, y: 0 },
    prevBase: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    speed: 0,
    angle: 0,
    trail: [],
    active: false,
  });

  const rightSaberRef = useRef<SaberState>({
    hand: 'right',
    color: '#22d3ee',
    tip: { x: 0, y: 0 },
    base: { x: 0, y: 0 },
    prevTip: { x: 0, y: 0 },
    prevBase: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    speed: 0,
    angle: 0,
    trail: [],
    active: false,
  });

  // Mouse fallback position
  const mousePosRef = useRef<{ x: number; y: number; prevX: number; prevY: number }>({
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
  });

  // Visual effects state
  const debrisRef = useRef<SliceDebris[]>([]);
  const particlesRef = useRef<SparkParticle[]>([]);
  const floatersRef = useRef<ScoreFloater[]>([]);
  const screenShakeRef = useRef<number>(0);
  const animationFrameId = useRef<number | null>(null);
  const lastFrameTime = useRef<number>(performance.now());

  // Mouse tracking handler
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    mousePosRef.current.prevX = mousePosRef.current.x;
    mousePosRef.current.prevY = mousePosRef.current.y;
    mousePosRef.current.x = x;
    mousePosRef.current.y = y;

    if (gameSettings.controlMode === 'mouse') {
      // In mouse mode, left mouse / left half controls red, right half controls blue or dual sabers
      const dx = x - mousePosRef.current.prevX;
      const dy = y - mousePosRef.current.prevY;
      const angle = Math.atan2(dy, dx);
      const saberLength = gameSettings.saberLength || 200;

      // Right saber follows pointer
      const right = rightSaberRef.current;
      right.prevTip = { ...right.tip };
      right.prevBase = { ...right.base };
      right.base = { x, y: y + 40 };
      right.tip = { x: x + Math.cos(angle - Math.PI / 2) * saberLength, y: y + Math.sin(angle - Math.PI / 2) * saberLength };
      right.speed = Math.hypot(dx, dy);
      right.velocity = { x: dx, y: dy };
      right.active = true;

      // Left saber sits symmetrically or with left shift
      const left = leftSaberRef.current;
      left.prevTip = { ...left.tip };
      left.prevBase = { ...left.base };
      left.base = { x: x - 120, y: y + 40 };
      left.tip = { x: x - 120 + Math.cos(angle - Math.PI / 2) * saberLength, y: y + Math.sin(angle - Math.PI / 2) * saberLength };
      left.speed = Math.hypot(dx, dy);
      left.velocity = { x: dx, y: dy };
      left.active = true;
    }
  };

  // Main 60fps Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle canvas resize
    const resizeCanvas = () => {
      if (!canvas) return;
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const render = () => {
      const now = performance.now();
      const dt = Math.min((now - lastFrameTime.current) / 1000, 0.1);
      lastFrameTime.current = now;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height * 0.36; // Horizon line comfortably elevated

      // 1. Update Sabers from Hand Tracking Result (if in camera mode)
      if (gameSettings.controlMode === 'camera' && handTrackingResult) {
        updateSabersFromHands(handTrackingResult, gameSettings.saberLength || 220);
      }

      // Update Saber trails and whoosh audio
      updateSaberPhysics(leftSaberRef.current, now);
      updateSaberPhysics(rightSaberRef.current, now);

      // Check saber clash
      checkSaberClash(leftSaberRef.current, rightSaberRef.current);

      // 2. Clear Screen & Apply Screen Shake
      ctx.save();
      if (screenShakeRef.current > 0) {
        const shake = screenShakeRef.current;
        const sx = (Math.random() - 0.5) * shake * 12;
        const sy = (Math.random() - 0.5) * shake * 12;
        ctx.translate(sx, sy);
        screenShakeRef.current = Math.max(0, screenShakeRef.current - dt * 4);
      }

      ctx.fillStyle = '#030712'; // Deep slate-950
      ctx.fillRect(0, 0, width, height);

      // 3. Render Camera Background Video (if enabled)
      if (gameSettings.cameraActive && videoElement && videoElement.readyState >= 2) {
        ctx.save();
        ctx.globalAlpha = gameSettings.cameraOpacity;
        if (gameSettings.cameraMirror) {
          ctx.translate(width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(videoElement, 0, 0, width, height);
        ctx.restore();
      }

      // 4. Render 3D Cyber Runway, Grid & Beat Visualizers
      renderCyberRunway(ctx, width, height, centerX, centerY, now);

      // 5. Update and Render Active Notes
      if (isPlaying && !isPaused) {
        renderAndCheckNotes(ctx, width, height, centerX, centerY);
      }

      // 6. Update and Render Physics Debris (Sliced Halves)
      renderDebris(ctx, dt, centerX, centerY);

      // 7. Update and Render Spark Particles & Floaters
      renderParticles(ctx, dt);
      renderFloaters(ctx, dt);

      // 8. Render Glowing Laser Sabers & Trails
      renderSaber(ctx, leftSaberRef.current, gameSettings.saberStyle);
      renderSaber(ctx, rightSaberRef.current, gameSettings.saberStyle);

      // 9. Render Hand Skeleton Debug overlay if enabled
      if (gameSettings.showDebugSkeleton && handTrackingResult) {
        renderHandSkeleton(ctx, handTrackingResult);
      }

      ctx.restore();

      animationFrameId.current = requestAnimationFrame(render);
    };

    animationFrameId.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isPlaying, isPaused, songTime, gameSettings, handTrackingResult, videoElement, notes]);

  // --- HELPER METHODS ---

  const updateSabersFromHands = (ht: HandTrackingResult, saberLength: number) => {
    const updateHand = (saber: SaberState, handData: HandTrackingResult['leftHand']) => {
      if (!handData || !handData.detected) {
        saber.active = false;
        return;
      }

      saber.prevTip = { ...saber.tip };
      saber.prevBase = { ...saber.base };

      saber.base = { x: handData.indexBase.x, y: handData.indexBase.y };
      saber.tip = { x: handData.indexTip.x, y: handData.indexTip.y };

      const dx = saber.tip.x - saber.prevTip.x;
      const dy = saber.tip.y - saber.prevTip.y;
      saber.velocity = { x: dx, y: dy };
      saber.speed = Math.hypot(dx, dy);
      saber.angle = Math.atan2(saber.tip.y - saber.base.y, saber.tip.x - saber.base.x);
      saber.active = true;
    };

    updateHand(leftSaberRef.current, ht.leftHand);
    updateHand(rightSaberRef.current, ht.rightHand);
  };

  const updateSaberPhysics = (saber: SaberState, now: number) => {
    if (!saber.active) return;

    // Push to motion ribbon trail
    saber.trail.push({
      tip: { ...saber.tip },
      base: { ...saber.base },
      time: now,
    });

    // Keep trail ~120ms long
    saber.trail = saber.trail.filter((t) => now - t.time <= 140);

    // Dynamic whoosh sound
    if (saber.speed > 25) {
      soundManager.playWhoosh(saber.speed / 30);
    }
  };

  const checkSaberClash = (left: SaberState, right: SaberState) => {
    if (!left.active || !right.active) return;

    // Check intersection between left saber segment and right saber segment
    const intersect = getLineIntersection(left.base, left.tip, right.base, right.tip);
    if (intersect) {
      // Spawn clash sparks
      spawnSparks(intersect.x, intersect.y, '#ffffff', 4, 8);
      spawnSparks(intersect.x, intersect.y, '#fbbf24', 4, 6);
    }
  };

  const renderCyberRunway = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    centerX: number,
    centerY: number,
    now: number
  ) => {
    // Audio beat analyser data
    const freqData = soundManager.getAnalyserData();
    const bassEnergy = (freqData[1] || 0) / 255;
    const midEnergy = (freqData[6] || 0) / 255;

    // Horizon Glow
    const horizGlow = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, width * 0.7);
    horizGlow.addColorStop(0, `rgba(168, 85, 247, ${0.25 + bassEnergy * 0.3})`);
    horizGlow.addColorStop(0.5, `rgba(6, 182, 212, ${0.1 + midEnergy * 0.15})`);
    horizGlow.addColorStop(1, 'rgba(3, 7, 18, 0)');
    ctx.fillStyle = horizGlow;
    ctx.fillRect(0, 0, width, height);

    // Distant Synthwave Sun / Core
    ctx.beginPath();
    ctx.arc(centerX, centerY - 20, 60 + bassEnergy * 15, 0, Math.PI * 2);
    const sunGrad = ctx.createLinearGradient(centerX, centerY - 80, centerX, centerY + 40);
    sunGrad.addColorStop(0, 'rgba(244, 63, 94, 0.8)');
    sunGrad.addColorStop(1, 'rgba(234, 179, 8, 0.2)');
    ctx.fillStyle = sunGrad;
    ctx.fill();

    // Perspective Runway Floor (Trapezoid from horizon to lower screen)
    const runwayTopWidth = 140;
    const runwayBottomWidth = width * 0.88;
    const runwayBottomY = height * 0.84;

    // Grid Floor
    ctx.beginPath();
    ctx.moveTo(centerX - runwayTopWidth / 2, centerY);
    ctx.lineTo(centerX + runwayTopWidth / 2, centerY);
    ctx.lineTo(centerX + runwayBottomWidth / 2, runwayBottomY);
    ctx.lineTo(centerX - runwayBottomWidth / 2, runwayBottomY);
    ctx.closePath();

    const floorGrad = ctx.createLinearGradient(0, centerY, 0, runwayBottomY);
    floorGrad.addColorStop(0, 'rgba(15, 23, 42, 0.3)');
    floorGrad.addColorStop(1, 'rgba(30, 41, 59, 0.75)');
    ctx.fillStyle = floorGrad;
    ctx.fill();

    // Outer Runway Laser Borders
    ctx.lineWidth = 3 + bassEnergy * 3;
    ctx.strokeStyle = `rgba(236, 72, 153, ${0.7 + bassEnergy * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(centerX - runwayTopWidth / 2, centerY);
    ctx.lineTo(centerX - runwayBottomWidth / 2, runwayBottomY);
    ctx.stroke();

    ctx.strokeStyle = `rgba(34, 211, 238, ${0.7 + bassEnergy * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(centerX + runwayTopWidth / 2, centerY);
    ctx.lineTo(centerX + runwayBottomWidth / 2, runwayBottomY);
    ctx.stroke();

    // 4 Slicing Lane Guides
    const numLanes = 4;
    for (let i = 0; i <= numLanes; i++) {
      const topX = centerX - runwayTopWidth / 2 + (runwayTopWidth / numLanes) * i;
      const botX = centerX - runwayBottomWidth / 2 + (runwayBottomWidth / numLanes) * i;

      ctx.beginPath();
      ctx.moveTo(topX, centerY);
      ctx.lineTo(botX, runwayBottomY);
      ctx.strokeStyle = i === 2 ? 'rgba(255, 255, 255, 0.4)' : 'rgba(148, 163, 184, 0.15)';
      ctx.lineWidth = i === 2 ? 2 : 1;
      ctx.stroke();
    }

    // Moving horizontal grid lines (flow towards player)
    const speed = 2.5;
    const numGridLines = 14;
    const offset = (now * 0.001 * speed) % 1;

    for (let i = 0; i < numGridLines; i++) {
      const p = (i + offset) / numGridLines;
      const curve = Math.pow(p, 2.2); // Perspective exponential scaling
      const lineY = centerY + (runwayBottomY - centerY) * curve;
      const curWidth = runwayTopWidth + (runwayBottomWidth - runwayTopWidth) * curve;

      ctx.beginPath();
      ctx.moveTo(centerX - curWidth / 2, lineY);
      ctx.lineTo(centerX + curWidth / 2, lineY);
      ctx.strokeStyle = `rgba(34, 211, 238, ${0.1 + curve * 0.4})`;
      ctx.lineWidth = 1 + curve * 2;
      ctx.stroke();
    }

    // Player Slice Line (The target strike zone, elevated at comfortable mid-chest reach)
    const sliceLineProgress = 0.72;
    const sliceLineY = centerY + (runwayBottomY - centerY) * sliceLineProgress;
    const sliceLineWidth = runwayTopWidth + (runwayBottomWidth - runwayTopWidth) * sliceLineProgress;

    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5 + bassEnergy * 3.5;
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(centerX - sliceLineWidth / 2, sliceLineY);
    ctx.lineTo(centerX + sliceLineWidth / 2, sliceLineY);
    ctx.stroke();

    // Lane Strike Target Markers & Holographic Strike Columns
    for (let lane = 0; lane < 4; lane++) {
      const laneOffset = (lane - 1.5) * (sliceLineWidth / 4);
      const laneX = centerX + laneOffset;
      const isRed = lane < 2;

      // Floor ring marker
      ctx.beginPath();
      ctx.arc(laneX, sliceLineY, 15, 0, Math.PI * 2);
      ctx.strokeStyle = isRed ? 'rgba(236, 72, 153, 0.7)' : 'rgba(34, 211, 238, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Elevated holographic vertical beam showing strike zone
      const colHeight = 150;
      const colGrad = ctx.createLinearGradient(laneX, sliceLineY, laneX, sliceLineY - colHeight);
      colGrad.addColorStop(0, isRed ? 'rgba(236, 72, 153, 0.25)' : 'rgba(34, 211, 238, 0.25)');
      colGrad.addColorStop(1, isRed ? 'rgba(236, 72, 153, 0)' : 'rgba(34, 211, 238, 0)');
      ctx.fillStyle = colGrad;
      ctx.fillRect(laneX - 16, sliceLineY - colHeight, 32, colHeight);
    }
    ctx.restore();

    // Beat Audio Towers / Equalizer Pillars on sides
    const pillarCount = 8;
    for (let p = 0; p < pillarCount; p++) {
      const barH = ((freqData[p * 2] || 20) / 255) * 140;
      const leftPillarX = 30 + p * 24;
      const rightPillarX = width - 30 - p * 24;
      const pY = centerY + 40;

      // Left tower (Pink)
      ctx.fillStyle = `rgba(236, 72, 153, ${0.4 + (p === 0 ? bassEnergy * 0.6 : 0)})`;
      ctx.fillRect(leftPillarX, pY - barH, 14, barH);

      // Right tower (Cyan)
      ctx.fillStyle = `rgba(34, 211, 238, ${0.4 + (p === 0 ? bassEnergy * 0.6 : 0)})`;
      ctx.fillRect(rightPillarX - 14, pY - barH, 14, barH);
    }
  };

  const renderAndCheckNotes = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    centerX: number,
    centerY: number
  ) => {
    const approachSpeed = 12.0; // Units per second
    const spawnZ = 16.0; // Distance where notes appear
    const sliceZ = 0.0; // Strike zone Z position
    const hitToleranceZ = 1.6; // Strike window depth

    const runwayTopWidth = 140;
    const runwayBottomWidth = width * 0.88;
    const runwayBottomY = height * 0.84;
    const sliceLineProgress = 0.72;

    // Latency adjustment from settings
    const adjustedTime = songTime + (gameSettings.latencyOffsetMs || 0) / 1000;

    notes.forEach((note) => {
      if (note.sliced) return;

      // Z distance calculation: Z = 0 when time === adjustedTime
      // Approaching when adjustedTime < note.time (Z > 0)
      const timeDiff = note.time - adjustedTime;
      const z = timeDiff * approachSpeed;

      // Check if note was missed (flew past slice line)
      if (z < -hitToleranceZ && !note.missed) {
        note.missed = true;
        if (note.type !== 'bomb') {
          onNoteMissed(note);
          spawnScoreFloater(centerX, centerY + 80, 'MISS', '#94a3b8', 22);
          soundManager.playMissSound();
        }
        return;
      }

      // If note is outside render range, skip drawing
      if (z > spawnZ || z < -3.0) return;

      // Compute 3D perspective projection with slice line aligned at z = 0
      const progress = Math.max(0, 1 - z / spawnZ);
      const curve = Math.pow(progress, 2.2) * sliceLineProgress;

      const runwayWidthAtZ = runwayTopWidth + (runwayBottomWidth - runwayTopWidth) * curve;
      const runwayYAtZ = centerY + (runwayBottomY - centerY) * curve;

      // Lane mapping (-1.5, -0.5, +0.5, +1.5)
      const laneOffset = (note.lane - 1.5) * (runwayWidthAtZ / 4);
      const screenX = centerX + laneOffset;

      // Layer vertical elevation (0 = bottom, 1 = mid, 2 = top)
      // Raised significantly so notes reach player at comfortable chest & eye level (in webcam view)
      const normCurve = Math.min(1.2, curve / sliceLineProgress); // 0 at spawn, 1 at slice line
      const layerHeight = 70 * (0.35 + normCurve * 0.65);
      const baseElevation = 50 + 85 * normCurve;
      const userHeightOffset = (gameSettings.blockHeightOffset || 0);
      const screenY = runwayYAtZ - baseElevation - note.layer * layerHeight + userHeightOffset;

      // Size scales as note gets closer
      const baseSize = 42;
      const size = baseSize * (0.28 + normCurve * 1.5);

      note.currentZ = z;
      note.screenX = screenX;
      note.screenY = screenY;
      note.screenSize = size;

      // Check collisions if note is inside the hit window
      if (Math.abs(z - sliceZ) <= hitToleranceZ && !note.sliced && !note.missed) {
        checkSaberCutCollision(note, screenX, screenY, size);
      }

      // Draw the block or bomb
      if (note.type === 'bomb') {
        renderBombBlock(ctx, screenX, screenY, size);
      } else {
        renderDirectionalBlock(ctx, note, screenX, screenY, size);
      }
    });
  };

  const renderDirectionalBlock = (
    ctx: CanvasRenderingContext2D,
    note: Note,
    x: number,
    y: number,
    size: number
  ) => {
    const isRed = note.color === 'red';
    const mainColor = isRed ? '#ec4899' : '#22d3ee';
    const darkColor = isRed ? '#831843' : '#164e63';
    const glowColor = isRed ? 'rgba(236, 72, 153, 0.9)' : 'rgba(34, 211, 238, 0.9)';

    ctx.save();
    ctx.translate(x, y);

    // Neon Glow & Drop Shadow
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = Math.min(size * 0.5, 25);

    // Cube Outer Bevel
    const half = size / 2;
    const cornerR = Math.min(8, size * 0.15);

    // Front Face
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.roundRect(-half, -half, size, size, cornerR);
    ctx.fill();

    // Inner Core gradient
    const coreGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, half);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.35, mainColor);
    coreGrad.addColorStop(1, darkColor);
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.roundRect(-half * 0.85, -half * 0.85, size * 0.85, size * 0.85, cornerR * 0.8);
    ctx.fill();

    // Crisp neon edge stroke
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.5, size * 0.06);
    ctx.stroke();

    // Direction Indicator / Arrow
    renderCutDirectionIndicator(ctx, note.direction, size);

    ctx.restore();
  };

  const renderCutDirectionIndicator = (
    ctx: CanvasRenderingContext2D,
    direction: CutDirection,
    size: number
  ) => {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, size * 0.08);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (direction === 'any') {
      // White glowing center dot / bullseye
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Determine arrow rotation
    let angle = 0;
    switch (direction) {
      case 'up':
        angle = -Math.PI / 2;
        break;
      case 'down':
        angle = Math.PI / 2;
        break;
      case 'left':
        angle = Math.PI;
        break;
      case 'right':
        angle = 0;
        break;
      case 'up-left':
        angle = -Math.PI * 0.75;
        break;
      case 'up-right':
        angle = -Math.PI * 0.25;
        break;
      case 'down-left':
        angle = Math.PI * 0.75;
        break;
      case 'down-right':
        angle = Math.PI * 0.25;
        break;
    }

    ctx.rotate(angle);

    // Draw bold neon triangle arrow
    const arrowLen = size * 0.32;
    const arrowW = size * 0.24;

    ctx.beginPath();
    ctx.moveTo(arrowLen, 0);
    ctx.lineTo(-arrowLen * 0.6, -arrowW);
    ctx.lineTo(-arrowLen * 0.2, 0);
    ctx.lineTo(-arrowLen * 0.6, arrowW);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  const renderBombBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.save();
    ctx.translate(x, y);

    const radius = size * 0.45;
    const now = performance.now() * 0.005;

    // Spikes around orb
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;

    const numSpikes = 8;
    for (let i = 0; i < numSpikes; i++) {
      const a = (i / numSpikes) * Math.PI * 2 + now;
      const spikeX = Math.cos(a) * (radius * 1.35);
      const spikeY = Math.sin(a) * (radius * 1.35);

      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.2) * radius, Math.sin(a - 0.2) * radius);
      ctx.lineTo(spikeX, spikeY);
      ctx.lineTo(Math.cos(a + 0.2) * radius, Math.sin(a + 0.2) * radius);
      ctx.fill();
      ctx.stroke();
    }

    // Glowing Pulsing Orb Core
    const pulse = (Math.sin(now * 3) + 1) * 0.5;
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#ef4444');
    grad.addColorStop(1, '#0f172a');

    ctx.fillStyle = grad;
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 15 + pulse * 15;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Red warning X mark
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    const xSize = radius * 0.5;
    ctx.beginPath();
    ctx.moveTo(-xSize, -xSize);
    ctx.lineTo(xSize, xSize);
    ctx.moveTo(xSize, -xSize);
    ctx.lineTo(-xSize, xSize);
    ctx.stroke();

    ctx.restore();
  };

  const checkSaberCutCollision = (note: Note, noteX: number, noteY: number, noteSize: number) => {
    const leftSaber = leftSaberRef.current;
    const rightSaber = rightSaberRef.current;
    const noteHalf = noteSize / 2;

    const testSaber = (saber: SaberState) => {
      if (!saber.active) return false;

      // 1. Check distance from Saber segment to Note center
      const dist = distToSegment({ x: noteX, y: noteY }, saber.base, saber.tip);
      if (dist > noteHalf * 1.3) return false;

      // 2. Minimum swing speed check to register a cut (prevents resting saber on block)
      const minSpeed = gameSettings.controlMode === 'camera' ? 6 : 8;
      if (saber.speed < minSpeed) return false;

      return true;
    };

    const leftHit = testSaber(leftSaber);
    const rightHit = testSaber(rightSaber);

    if (!leftHit && !rightHit) return;

    const activeSaber = rightHit && note.color === 'blue' ? rightSaber : leftHit && note.color === 'red' ? leftSaber : leftHit ? leftSaber : rightSaber;

    // Trigger Bomb Explosion
    if (note.type === 'bomb') {
      note.sliced = true;
      onBombHit(note);
      soundManager.playBombExplosion();
      screenShakeRef.current = 1.2;
      spawnSparks(noteX, noteY, '#ef4444', 35, 15);
      spawnSparks(noteX, noteY, '#f97316', 20, 12);
      spawnScoreFloater(noteX, noteY, 'BOMB!', '#ef4444', 32);
      return;
    }

    // Calculate Slice Velocity & Direction match
    const cutAngle = Math.atan2(activeSaber.velocity.y, activeSaber.velocity.x);
    const colorMatched =
      (note.color === 'red' && activeSaber.hand === 'left') ||
      (note.color === 'blue' && activeSaber.hand === 'right');

    const directionMatched = checkDirectionMatch(cutAngle, note.direction);

    // Calculate Accuracy (0 - 100)
    let accuracy = 100;
    if (!directionMatched) accuracy -= 35;
    if (!colorMatched) accuracy -= 40;
    accuracy = Math.max(20, Math.min(100, accuracy + Math.min(15, activeSaber.speed)));

    note.sliced = true;
    note.sliceAccuracy = accuracy;

    // Audio SFX
    const sliceColor = note.color === 'red' ? 'red' : 'blue';
    soundManager.playSliceSound(sliceColor, accuracy, activeSaber.speed / 15);

    // Spawn 3D debris halves
    spawnSliceDebris(note, noteX, noteY, noteSize, cutAngle);

    // Spawn neon sparks
    const sparkColor = note.color === 'red' ? '#ef4444' : '#06b6d4';
    spawnSparks(noteX, noteY, sparkColor, 24, 10);
    spawnSparks(noteX, noteY, '#ffffff', 12, 12);

    // Feedback Floater
    if (accuracy >= 90 && directionMatched && colorMatched) {
      spawnScoreFloater(noteX, noteY - 20, '+115 PERFECT', sparkColor, 26);
    } else if (directionMatched && colorMatched) {
      spawnScoreFloater(noteX, noteY - 20, '+100 GOOD', sparkColor, 22);
    } else if (!directionMatched && colorMatched) {
      spawnScoreFloater(noteX, noteY - 20, '+40 WRONG DIR', '#f59e0b', 20);
    } else {
      spawnScoreFloater(noteX, noteY - 20, '+20 WRONG SABER', '#ef4444', 20);
    }

    onNoteSliced(note, accuracy, directionMatched, colorMatched);
  };

  const checkDirectionMatch = (cutAngle: number, targetDir: CutDirection): boolean => {
    if (targetDir === 'any') return true;

    // Map target direction to expected angle
    let targetAngle = 0;
    switch (targetDir) {
      case 'up':
        targetAngle = -Math.PI / 2;
        break;
      case 'down':
        targetAngle = Math.PI / 2;
        break;
      case 'left':
        targetAngle = Math.PI;
        break;
      case 'right':
        targetAngle = 0;
        break;
      case 'up-left':
        targetAngle = -Math.PI * 0.75;
        break;
      case 'up-right':
        targetAngle = -Math.PI * 0.25;
        break;
      case 'down-left':
        targetAngle = Math.PI * 0.75;
        break;
      case 'down-right':
        targetAngle = Math.PI * 0.25;
        break;
    }

    // Angular difference within 60 degrees tolerance (PI / 3)
    let diff = Math.abs(cutAngle - targetAngle);
    while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

    return diff <= Math.PI / 2.8;
  };

  const spawnSliceDebris = (
    note: Note,
    x: number,
    y: number,
    size: number,
    cutAngle: number
  ) => {
    const spreadSpeed = 180;
    const perpAngle = cutAngle + Math.PI / 2;
    const now = performance.now();

    debrisRef.current.push({
      id: `${note.id}-half1`,
      color: note.color,
      half: 'left',
      x,
      y,
      z: 0,
      vx: Math.cos(perpAngle) * spreadSpeed + (Math.random() - 0.5) * 40,
      vy: Math.sin(perpAngle) * spreadSpeed + (Math.random() - 0.5) * 40 - 60,
      vz: -2,
      rotX: 0,
      rotY: 0,
      rotZ: cutAngle,
      vRotX: (Math.random() - 0.5) * 8,
      vRotY: (Math.random() - 0.5) * 8,
      vRotZ: (Math.random() - 0.5) * 10,
      size,
      alpha: 1.0,
      createdAt: now,
    });

    debrisRef.current.push({
      id: `${note.id}-half2`,
      color: note.color,
      half: 'right',
      x,
      y,
      z: 0,
      vx: -Math.cos(perpAngle) * spreadSpeed + (Math.random() - 0.5) * 40,
      vy: -Math.sin(perpAngle) * spreadSpeed + (Math.random() - 0.5) * 40 - 60,
      vz: -2,
      rotX: 0,
      rotY: 0,
      rotZ: cutAngle,
      vRotX: (Math.random() - 0.5) * 8,
      vRotY: (Math.random() - 0.5) * 8,
      vRotZ: (Math.random() - 0.5) * 10,
      size,
      alpha: 1.0,
      createdAt: now,
    });
  };

  const renderDebris = (
    ctx: CanvasRenderingContext2D,
    dt: number,
    centerX: number,
    centerY: number
  ) => {
    const now = performance.now();
    debrisRef.current = debrisRef.current.filter((d) => {
      const age = (now - d.createdAt) / 1000;
      if (age > 0.8) return false;

      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 350 * dt; // Gravity
      d.rotZ += d.vRotZ * dt;
      d.alpha = Math.max(0, 1 - age / 0.8);

      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rotZ);
      ctx.globalAlpha = d.alpha;

      const mainColor = d.color === 'red' ? '#ef4444' : '#06b6d4';
      ctx.fillStyle = mainColor;
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = 10;

      const h = d.size / 2;
      const w = d.size / 4;
      ctx.fillRect(-w, -h, w * 2, h * 2);

      // Sliced white hot edge
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-w, 0, w * 2, 3);

      ctx.restore();
      return true;
    });
  };

  const spawnSparks = (
    x: number,
    y: number,
    color: string,
    count: number,
    speedMax: number
  ) => {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (Math.random() * 0.7 + 0.3) * speedMax * 25;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 30,
        color,
        size: Math.random() * 4 + 2,
        alpha: 1.0,
        life: 0,
        maxLife: Math.random() * 0.35 + 0.25,
      });
    }
  };

  const renderParticles = (ctx: CanvasRenderingContext2D, dt: number) => {
    particlesRef.current = particlesRef.current.filter((p) => {
      p.life += dt;
      if (p.life >= p.maxLife) return false;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 250 * dt; // Gravity
      p.alpha = 1 - p.life / p.maxLife;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return true;
    });
  };

  const spawnScoreFloater = (
    x: number,
    y: number,
    text: string,
    color: string,
    size: number
  ) => {
    floatersRef.current.push({
      id: `floater-${Date.now()}-${Math.random()}`,
      text,
      x,
      y,
      color,
      size,
      alpha: 1.0,
      vy: -60,
      scale: 1.3,
      createdAt: performance.now(),
    });
  };

  const renderFloaters = (ctx: CanvasRenderingContext2D, dt: number) => {
    const now = performance.now();
    floatersRef.current = floatersRef.current.filter((f) => {
      const age = (now - f.createdAt) / 1000;
      if (age > 0.9) return false;

      f.y += f.vy * dt;
      f.alpha = Math.max(0, 1 - age / 0.9);
      f.scale = Math.max(1.0, 1.3 - age * 0.6);

      ctx.save();
      ctx.globalAlpha = f.alpha;
      ctx.font = `bold ${Math.round(f.size * f.scale)}px Orbitron, sans-serif`;
      ctx.fillStyle = f.color;
      ctx.textAlign = 'center';
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 12;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
      return true;
    });
  };

  // --- SABER RENDERING ---

  const renderSaber = (
    ctx: CanvasRenderingContext2D,
    saber: SaberState,
    style: GameSettings['saberStyle']
  ) => {
    if (!saber.active) return;

    const isRed = saber.hand === 'left';
    const mainColor = isRed ? '#ef4444' : '#06b6d4';
    const glowColor = isRed ? 'rgba(239, 68, 68, 0.85)' : 'rgba(6, 182, 212, 0.85)';

    // 1. Render Motion Ribbon Trail
    if (saber.trail.length > 2) {
      ctx.save();
      for (let i = 1; i < saber.trail.length; i++) {
        const p1 = saber.trail[i - 1];
        const p2 = saber.trail[i];
        const progress = i / saber.trail.length; // 0 (old) to 1 (new)

        ctx.beginPath();
        ctx.moveTo(p1.base.x, p1.base.y);
        ctx.lineTo(p1.tip.x, p1.tip.y);
        ctx.lineTo(p2.tip.x, p2.tip.y);
        ctx.lineTo(p2.base.x, p2.base.y);
        ctx.closePath();

        ctx.fillStyle = isRed
          ? `rgba(239, 68, 68, ${progress * 0.45})`
          : `rgba(6, 182, 212, ${progress * 0.45})`;
        ctx.shadowColor = mainColor;
        ctx.shadowBlur = progress * 15;
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();

    // 2. Saber Outer Neon Halo
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 30;
    ctx.beginPath();
    ctx.moveTo(saber.base.x, saber.base.y);
    ctx.lineTo(saber.tip.x, saber.tip.y);
    ctx.stroke();

    // 3. Saber Mid Energy Layer
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 14;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(saber.base.x, saber.base.y);
    ctx.lineTo(saber.tip.x, saber.tip.y);
    ctx.stroke();

    // 4. White-Hot Energy Core
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(saber.base.x, saber.base.y);
    ctx.lineTo(saber.tip.x, saber.tip.y);
    ctx.stroke();

    // 5. Metallic Futuristic Hilt
    renderSaberHilt(ctx, saber.base, saber.angle, isRed);

    // 6. Tip Plasma Flare
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(saber.tip.x, saber.tip.y, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const renderSaberHilt = (
    ctx: CanvasRenderingContext2D,
    base: SaberPoint,
    angle: number,
    isRed: boolean
  ) => {
    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.rotate(angle);

    // Hilt body extends backwards
    const hiltLen = 42;
    const hiltW = 10;

    // Hilt shadow & body
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-hiltLen, -hiltW / 2, hiltLen, hiltW, 3);
    ctx.fill();
    ctx.stroke();

    // Emitter guard ring (neon accent)
    ctx.fillStyle = isRed ? '#ef4444' : '#06b6d4';
    ctx.shadowColor = isRed ? '#ef4444' : '#06b6d4';
    ctx.shadowBlur = 10;
    ctx.fillRect(-6, -hiltW * 0.8, 6, hiltW * 1.6);

    // Grip lines
    ctx.strokeStyle = '#334155';
    for (let g = 1; g <= 4; g++) {
      ctx.beginPath();
      ctx.moveTo(-10 - g * 6, -hiltW / 2 + 1);
      ctx.lineTo(-10 - g * 6, hiltW / 2 - 1);
      ctx.stroke();
    }

    ctx.restore();
  };

  const renderHandSkeleton = (ctx: CanvasRenderingContext2D, ht: HandTrackingResult) => {
    const drawHand = (raw: SaberPoint[] | undefined, color: string) => {
      if (!raw || raw.length === 0) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;

      raw.forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    };

    if (ht.leftHand?.rawLandmarks) drawHand(ht.leftHand.rawLandmarks, '#ef4444');
    if (ht.rightHand?.rawLandmarks) drawHand(ht.rightHand.rawLandmarks, '#06b6d4');
  };

  // Math helper for point-to-segment distance
  const distToSegment = (p: SaberPoint, v: SaberPoint, w: SaberPoint): number => {
    const l2 = Math.pow(w.x - v.x, 2) + Math.pow(w.y - v.y, 2);
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  };

  // Line intersection helper
  const getLineIntersection = (
    p0: SaberPoint,
    p1: SaberPoint,
    p2: SaberPoint,
    p3: SaberPoint
  ): SaberPoint | null => {
    const s1_x = p1.x - p0.x;
    const s1_y = p1.y - p0.y;
    const s2_x = p3.x - p2.x;
    const s2_y = p3.y - p2.y;

    const s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / (-s2_x * s1_y + s1_x * s2_y);
    const t = (s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / (-s2_x * s1_y + s1_x * s2_y);

    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
      return {
        x: p0.x + t * s1_x,
        y: p0.y + t * s1_y,
      };
    }
    return null;
  };

  return (
    <canvas
      ref={canvasRef}
      id="game-canvas"
      onMouseMove={handleMouseMove}
      className="absolute inset-0 w-full h-full cursor-crosshair z-10"
    />
  );
};
