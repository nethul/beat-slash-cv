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

  // Visual effects state (pre-allocated pools to reduce GC pressure)
  const debrisRef = useRef<SliceDebris[]>([]);
  const particlesRef = useRef<SparkParticle[]>([]);
  const floatersRef = useRef<ScoreFloater[]>([]);
  const screenShakeRef = useRef<number>(0);
  const animationFrameId = useRef<number | null>(null);
  const lastFrameTime = useRef<number>(performance.now());

  // Performance: particle density caps based on settings
  const maxParticles = gameSettings.particleDensity === 'high' ? 200 : gameSettings.particleDensity === 'medium' ? 120 : 60;
  const maxDebris = gameSettings.particleDensity === 'high' ? 40 : gameSettings.particleDensity === 'medium' ? 24 : 12;
  const maxFloaters = 15;

  // Performance: cached gradient key to avoid recreating gradients every frame
  const gradientCacheRef = useRef<Map<string, CanvasGradient>>(new Map());
  const lastCanvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

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
    // willReadFrequently: false tells the browser to optimize for write-heavy usage
    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
    if (!ctx) return;

    // Handle canvas resize (invalidate gradient cache on resize)
    const resizeCanvas = () => {
      if (!canvas) return;
      const newW = canvas.parentElement?.clientWidth || window.innerWidth;
      const newH = canvas.parentElement?.clientHeight || window.innerHeight;
      if (canvas.width !== newW || canvas.height !== newH) {
        canvas.width = newW;
        canvas.height = newH;
        // Invalidate gradient cache on size change
        gradientCacheRef.current.clear();
        lastCanvasSizeRef.current = { w: newW, h: newH };
      }
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
      if (screenShakeRef.current > 0.01) {
        const shake = screenShakeRef.current;
        const sx = (Math.random() - 0.5) * shake * 12;
        const sy = (Math.random() - 0.5) * shake * 12;
        ctx.translate(sx, sy);
        screenShakeRef.current *= (1 - dt * 4); // Exponential decay (smoother)
      } else {
        screenShakeRef.current = 0;
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

      saber.base = { x: handData.indexBase.x, y: handData.indexBase.y, z: handData.indexBase.z || 0 };
      saber.tip = { x: handData.indexTip.x, y: handData.indexTip.y, z: handData.indexTip.z || 0 };

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
    // Performance: use cached gradient when canvas size hasn't changed
    let horizGlow = gradientCacheRef.current.get('horizGlow');
    if (!horizGlow) {
      horizGlow = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, width * 0.7);
      horizGlow.addColorStop(0, `rgba(168, 85, 247, 0.40)`);
      horizGlow.addColorStop(0.5, `rgba(6, 182, 212, 0.18)`);
      horizGlow.addColorStop(1, 'rgba(3, 7, 18, 0)');
      gradientCacheRef.current.set('horizGlow', horizGlow);
    }
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

    // Eye / Chest Level 3D Frontal Perspective (Beat Saber Style)
    const horizonY = centerY - 15;
    const floorBottomY = height * 0.90;

    // Helper: 3D perspective X position for 4 wide parallel lanes
    const getLaneXAtZ = (lane: number, zProgress: number) => {
      let targetX = centerX;
      switch (lane) {
        case 0: targetX = centerX - width * 0.36; break; // Outer Left (Red)
        case 1: targetX = centerX - width * 0.13; break; // Inner Left (Red)
        case 2: targetX = centerX + width * 0.13; break; // Inner Right (Blue)
        case 3: targetX = centerX + width * 0.36; break; // Outer Right (Blue)
        default: targetX = centerX;
      }
      // Fanning 3D perspective: horizon converges slightly at center (0.2), expands to full width at player (1.0)
      return centerX + (targetX - centerX) * (0.2 + zProgress * 0.8);
    };

    // 1. Draw 3D Ground Floor Runway
    ctx.beginPath();
    ctx.moveTo(centerX - 40, horizonY);
    ctx.lineTo(centerX + 40, horizonY);
    ctx.lineTo(centerX + width * 0.48, floorBottomY);
    ctx.lineTo(centerX - width * 0.48, floorBottomY);
    ctx.closePath();

    const floorGrad = ctx.createLinearGradient(0, horizonY, 0, floorBottomY);
    floorGrad.addColorStop(0, 'rgba(15, 23, 42, 0.2)');
    floorGrad.addColorStop(1, 'rgba(15, 23, 42, 0.7)');
    ctx.fillStyle = floorGrad;
    ctx.fill();

    // 2. Draw 4 3D Highway Lane Track Lines
    for (let lane = 0; lane < 4; lane++) {
      const topX = getLaneXAtZ(lane, 0);
      const botX = getLaneXAtZ(lane, 1.1);
      const isRed = lane < 2;

      ctx.beginPath();
      ctx.moveTo(topX, horizonY);
      ctx.lineTo(botX, floorBottomY);
      ctx.strokeStyle = isRed ? 'rgba(236, 72, 153, 0.35)' : 'rgba(34, 211, 238, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 3. Moving Horizontal Speed Grid Lines
    const speed = 2.5;
    const numGridLines = 12;
    const offset = (now * 0.001 * speed) % 1;

    for (let i = 0; i < numGridLines; i++) {
      const p = Math.pow((i + offset) / numGridLines, 2);
      const lineY = horizonY + (floorBottomY - horizonY) * p;

      ctx.beginPath();
      ctx.moveTo(centerX - width * 0.45 * p, lineY);
      ctx.lineTo(centerX + width * 0.45 * p, lineY);
      ctx.strokeStyle = `rgba(34, 211, 238, ${0.05 + p * 0.3})`;
      ctx.lineWidth = 1 + p * 2;
      ctx.stroke();
    }

    // 4. Player Frontal Strike Targets (Rendered at Chest / Eye Level in Mid-Screen!)
    const strikeY = centerY + (gameSettings.blockHeightOffset || 0);

    for (let lane = 0; lane < 4; lane++) {
      const laneX = getLaneXAtZ(lane, 1.0);
      const isRed = lane < 2;

      // Frontal Eye-Level Target Crosshair Ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(laneX, strikeY, 28, 0, Math.PI * 2);
      ctx.strokeStyle = isRed ? 'rgba(236, 72, 153, 0.9)' : 'rgba(34, 211, 238, 0.9)';
      ctx.lineWidth = 3;
      ctx.shadowColor = isRed ? '#ec4899' : '#22d3ee';
      ctx.shadowBlur = 12;
      ctx.stroke();

      // Inner target pulse ring
      ctx.beginPath();
      ctx.arc(laneX, strikeY, 12, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

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
    const hitToleranceZ = 2.2; // Generous strike window depth

    // Latency adjustment from settings
    const adjustedTime = songTime + (gameSettings.latencyOffsetMs || 0) / 1000;

    notes.forEach((note) => {
      if (note.sliced) return;

      const timeDiff = note.time - adjustedTime;
      const z = timeDiff * approachSpeed;

      // Check if note was missed (flew past slice line)
      if (z < -hitToleranceZ && !note.missed) {
        note.missed = true;
        if (note.type !== 'bomb') {
          onNoteMissed(note);
          spawnScoreFloater(centerX, centerY, 'MISS', '#94a3b8', 22);
          soundManager.playMissSound();
        }
        return;
      }

      // If note is outside render range, skip drawing
      if (z > spawnZ || z < -3.5) return;

      // Eye-Level Frontal 3D Projection: Notes zoom HEAD-ON at player chest level!
      // z = 16 (horizon) -> zProgress = 0.0, z = 0 (strike plane) -> zProgress = 1.0
      const zProgress = Math.max(0, 1 - z / spawnZ);
      const normScale = Math.pow(zProgress, 1.8);

      // X coordinate: 4 parallel lanes expanding outward in 3D perspective towards player
      let targetX = centerX;
      switch (note.lane) {
        case 0: targetX = centerX - width * 0.36; break;
        case 1: targetX = centerX - width * 0.13; break;
        case 2: targetX = centerX + width * 0.13; break;
        case 3: targetX = centerX + width * 0.36; break;
      }
      const screenX = centerX + (targetX - centerX) * (0.15 + normScale * 0.85);

      // Y coordinate: Eye / Chest Level!
      // Layer 0 = bottom row (centerY + 45), Layer 1 = middle row (centerY - 25), Layer 2 = top row (centerY - 95)
      const layerHeight = 70;
      const targetY = centerY - (note.layer - 1) * layerHeight + (gameSettings.blockHeightOffset || 0);
      const screenY = (centerY - 15) + (targetY - (centerY - 15)) * normScale;

      // Size scales dramatically as block zooms head-on out of the screen towards the player!
      const baseSize = 54;
      const size = baseSize * (0.18 + normScale * 1.22);

      note.currentZ = z;
      note.screenX = screenX;
      note.screenY = screenY;
      note.screenSize = size;

      // Render and check collisions based on NoteType
      if (note.type === 'obstacle') {
        renderObstacleWall(ctx, note, zProgress, centerX, centerY, width, height);
        if (Math.abs(z - sliceZ) <= 1.8 && !note.sliced && !note.missed) {
          checkObstacleWallDodge(note, centerX, centerY, width);
        }
      } else if (note.type === 'bomb') {
        renderBombBlock(ctx, screenX, screenY, size);
        if (Math.abs(z - sliceZ) <= hitToleranceZ && !note.sliced && !note.missed) {
          checkSaberCutCollision(note, screenX, screenY, size);
        }
      } else {
        renderDirectionalBlock(ctx, note, screenX, screenY, size);
        if (Math.abs(z - sliceZ) <= hitToleranceZ && !note.sliced && !note.missed) {
          checkSaberCutCollision(note, screenX, screenY, size);
        }
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

    // Neon Glow & Drop Shadow (reduced blur for performance)
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = Math.min(size * 0.35, 16);

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
    _direction: CutDirection,
    size: number
  ) => {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, size * 0.08);

    // Glowing futuristic crystal core (any-direction cut)
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = Math.max(4, size * 0.1);

    ctx.beginPath();
    ctx.arc(0, 0, size * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, size * 0.30, 0, Math.PI * 2);
    ctx.stroke();

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

  const renderObstacleWall = (
    ctx: CanvasRenderingContext2D,
    note: Note,
    zProgress: number,
    centerX: number,
    centerY: number,
    width: number,
    _height: number
  ) => {
    const normScale = Math.pow(zProgress, 1.8);
    const obstacleLanes = note.obstacleWidth || 2;
    const startLane = note.lane;
    const endLane = startLane + obstacleLanes - 1;

    const getLaneXAtZ = (lane: number, p: number) => {
      let targetX = centerX;
      switch (lane) {
        case 0: targetX = centerX - width * 0.36; break;
        case 1: targetX = centerX - width * 0.13; break;
        case 2: targetX = centerX + width * 0.13; break;
        case 3: targetX = centerX + width * 0.36; break;
        default: targetX = centerX;
      }
      return centerX + (targetX - centerX) * (0.15 + p * 0.85);
    };

    const leftX = getLaneXAtZ(startLane, normScale);
    const rightX = getLaneXAtZ(endLane, normScale);
    const wallCenterX = (leftX + rightX) / 2;
    const wallWidth = Math.max(90, Math.abs(rightX - leftX) + 60 * normScale);
    const wallHeight = 220 * (0.25 + normScale * 0.9);
    const wallY = centerY + (gameSettings.blockHeightOffset || 0);

    ctx.save();
    ctx.translate(wallCenterX, wallY);

    // Semi-transparent glowing glass panel
    const wallGrad = ctx.createLinearGradient(0, -wallHeight / 2, 0, wallHeight / 2);
    wallGrad.addColorStop(0, 'rgba(244, 63, 94, 0.45)');
    wallGrad.addColorStop(0.5, 'rgba(225, 29, 72, 0.7)');
    wallGrad.addColorStop(1, 'rgba(159, 18, 57, 0.55)');

    ctx.fillStyle = wallGrad;
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = Math.min(30, 10 + normScale * 20);

    // Rounded Holographic Barrier Panel
    const halfW = wallWidth / 2;
    const halfH = wallHeight / 2;
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, wallWidth, wallHeight, 14);
    ctx.fill();

    // Bold Neon Hazard Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(3, 2 + normScale * 4);
    ctx.stroke();

    // Animated Hazard Stripes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = Math.max(2, normScale * 3);
    const stripeCount = 6;
    for (let s = -stripeCount; s <= stripeCount; s++) {
      const sx = s * (wallWidth / stripeCount);
      ctx.beginPath();
      ctx.moveTo(sx, -halfH);
      ctx.lineTo(sx + 30, halfH);
      ctx.stroke();
    }

    // Glowing Warning Text: DODGE ⚠️
    if (normScale > 0.35) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(18 * normScale)}px Orbitron, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 8;
      ctx.fillText('⚠️ DODGE ⚠️', 0, 0);
    }

    ctx.restore();
  };

  const checkObstacleWallDodge = (
    note: Note,
    centerX: number,
    centerY: number,
    width: number
  ) => {
    const obstacleLanes = note.obstacleWidth || 2;
    const startLane = note.lane;
    const endLane = startLane + obstacleLanes - 1;

    const getLaneXAtZ = (lane: number, p: number) => {
      let targetX = centerX;
      switch (lane) {
        case 0: targetX = centerX - width * 0.36; break;
        case 1: targetX = centerX - width * 0.13; break;
        case 2: targetX = centerX + width * 0.13; break;
        case 3: targetX = centerX + width * 0.36; break;
        default: targetX = centerX;
      }
      return centerX + (targetX - centerX) * (0.15 + p * 0.85);
    };

    const leftX = getLaneXAtZ(startLane, 1.0);
    const rightX = getLaneXAtZ(endLane, 1.0);
    const minWallX = Math.min(leftX, rightX) - 50;
    const maxWallX = Math.max(leftX, rightX) + 50;

    const leftSaber = leftSaberRef.current;
    const rightSaber = rightSaberRef.current;

    // Check if player's left hand or right hand is inside the obstacle wall's X range
    const leftHit = leftSaber.active && leftSaber.tip.x >= minWallX && leftSaber.tip.x <= maxWallX;
    const rightHit = rightSaber.active && rightSaber.tip.x >= minWallX && rightSaber.tip.x <= maxWallX;

    if (leftHit || rightHit) {
      // Wall Collision Hit!
      note.missed = true;
      onNoteMissed(note);
      soundManager.playWallCollision();
      screenShakeRef.current = 1.5;
      spawnScoreFloater(centerX, centerY - 40, 'WALL HIT! -50', '#ef4444', 30);
    } else {
      // Successful Dodge!
      note.sliced = true;
      soundManager.playSliceSound('blue', 100, 1.2);
      spawnScoreFloater(centerX, centerY - 40, 'DODGE! +50', '#38bdf8', 28);
      onNoteSliced(note, 100, true, true);
    }
  };

  const checkSaberCutCollision = (note: Note, noteX: number, noteY: number, noteSize: number) => {
    const leftSaber = leftSaberRef.current;
    const rightSaber = rightSaberRef.current;
    const noteHalf = noteSize / 2;

    const testSaber = (saber: SaberState) => {
      if (!saber.active) return false;

      // 1. Current blade segment distance to note center
      const distCurrent = distToSegment({ x: noteX, y: noteY }, saber.base, saber.tip);

      // 2. Previous frame blade segment distance (covers fast motion between frames)
      const distPrev = distToSegment({ x: noteX, y: noteY }, saber.prevBase, saber.prevTip);

      // 3. Tip swept path segment
      const distTipSweep = distToSegment({ x: noteX, y: noteY }, saber.prevTip, saber.tip);

      const minDist = Math.min(distCurrent, distPrev, distTipSweep);

      // Generous hit box (1.55x half width) to ensure effortless cuts
      if (minDist > noteHalf * 1.55) return false;

      // Lowered speed requirement so quick slashes cut instantly
      const minSpeed = gameSettings.controlMode === 'camera' ? 2.0 : 4.0;
      if (saber.speed < minSpeed) return false;

      return true;
    };

    const leftHit = testSaber(leftSaber);
    const rightHit = testSaber(rightSaber);

    if (!leftHit && !rightHit) return;

    const activeSaber = rightHit && note.color === 'blue' ? rightSaber : leftHit && note.color === 'red' ? leftSaber : leftHit ? leftSaber : rightSaber;

    // 3D Spatial Forward Reach Detection: Reaching forward into 3D runway (z < -0.1) to cut early
    const is3DReach = (activeSaber.tip.z ?? 0) < -0.12 || (activeSaber.base.z ?? 0) < -0.12;

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

    // Free-Direction Cutting: Any slice angle is 100% valid!
    const cutAngle = Math.atan2(activeSaber.velocity.y, activeSaber.velocity.x);
    const colorMatched =
      (note.color === 'red' && activeSaber.hand === 'left') ||
      (note.color === 'blue' && activeSaber.hand === 'right');

    const directionMatched = true;

    // Calculate Accuracy (0 - 100) based on color match and swing speed
    let accuracy = 100;
    if (!colorMatched) accuracy -= 40;
    accuracy = Math.max(40, Math.min(100, accuracy + Math.min(15, activeSaber.speed)));

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
    if (is3DReach && colorMatched) {
      spawnScoreFloater(noteX, noteY - 25, '3D REACH CUT! +150', '#38bdf8', 26);
    } else if (colorMatched) {
      spawnScoreFloater(noteX, noteY - 20, '+115 PERFECT SLICE', sparkColor, 26);
    } else {
      spawnScoreFloater(noteX, noteY - 20, '+20 WRONG SABER', '#ef4444', 20);
    }

    onNoteSliced(note, accuracy, true, colorMatched);
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
    // Performance: cap total particle count to prevent GC spikes
    const available = maxParticles - particlesRef.current.length;
    const actualCount = Math.min(count, available);
    if (actualCount <= 0) return;

    for (let i = 0; i < actualCount; i++) {
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
      // Performance: skip per-particle shadow for huge speedup
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

    // 3D Depth perspective scaling: reaching forward (z < 0) scales saber up, pulling back scales down
    const tipZ = saber.tip.z || 0;
    const depthScale = Math.max(0.7, Math.min(1.4, 1.0 - tipZ * 0.8));

    // 1. Render 3D Runway Floor Shadow
    const floorY = canvasRef.current ? canvasRef.current.height * 0.74 : 600;
    if (saber.base.y < floorY) {
      ctx.save();
      ctx.fillStyle = isRed ? 'rgba(239, 68, 68, 0.15)' : 'rgba(6, 182, 212, 0.15)';
      ctx.beginPath();
      ctx.ellipse(saber.tip.x, floorY + 15, 18 * depthScale, 6 * depthScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Render Motion Ribbon Trail
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
        ctx.shadowBlur = progress * 15 * depthScale;
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();

    // 3. Saber Outer Neon Halo with 3D Depth Width
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 22 * depthScale;
    ctx.lineCap = 'round';
    ctx.shadowColor = mainColor;
    ctx.shadowBlur = 18 * depthScale;
    ctx.beginPath();
    ctx.moveTo(saber.base.x, saber.base.y);
    ctx.lineTo(saber.tip.x, saber.tip.y);
    ctx.stroke();

    // 4. Saber Mid Energy Layer
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 14 * depthScale;
    ctx.shadowBlur = 10 * depthScale;
    ctx.beginPath();
    ctx.moveTo(saber.base.x, saber.base.y);
    ctx.lineTo(saber.tip.x, saber.tip.y);
    ctx.stroke();

    // 5. White-Hot Energy Core
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6 * depthScale;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(saber.base.x, saber.base.y);
    ctx.lineTo(saber.tip.x, saber.tip.y);
    ctx.stroke();

    // 6. Metallic Futuristic Hilt
    renderSaberHilt(ctx, saber.base, saber.angle, isRed);

    // 7. Tip Plasma Flare
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8 * depthScale;
    ctx.beginPath();
    ctx.arc(saber.tip.x, saber.tip.y, 6 * depthScale, 0, Math.PI * 2);
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
