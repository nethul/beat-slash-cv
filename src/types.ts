export type CutDirection = 
  | 'up' 
  | 'down' 
  | 'left' 
  | 'right' 
  | 'up-left' 
  | 'up-right' 
  | 'down-left' 
  | 'down-right' 
  | 'any';

export type BlockColor = 'red' | 'blue' | 'bomb';

export type NoteType = 'block' | 'bomb' | 'obstacle';

export interface Note {
  id: string;
  time: number; // Time in seconds when the note hits the player slice line
  lane: number; // 0 (far left), 1 (mid left), 2 (mid right), 3 (far right)
  layer: number; // 0 (bottom), 1 (middle), 2 (top)
  type: NoteType;
  color: BlockColor;
  direction: CutDirection;
  sliced?: boolean;
  missed?: boolean;
  sliceAccuracy?: number; // 0 - 100
  sliceSpeed?: number;
  sliceDirectionMatch?: boolean;
  scoreAwarded?: number;
  // 3D/Screen computed position during frame rendering
  currentZ?: number;
  screenX?: number;
  screenY?: number;
  screenSize?: number;
}

export interface SaberPoint {
  x: number;
  y: number;
  z?: number;
}

export interface SaberState {
  hand: 'left' | 'right';
  color: 'red' | 'blue' | string;
  tip: SaberPoint;
  base: SaberPoint;
  prevTip: SaberPoint;
  prevBase: SaberPoint;
  velocity: { x: number; y: number };
  speed: number;
  angle: number;
  trail: Array<{ tip: SaberPoint; base: SaberPoint; time: number }>;
  active: boolean;
}

export interface HandTrackingResult {
  leftHand: {
    detected: boolean;
    wrist: SaberPoint;
    indexTip: SaberPoint;
    indexBase: SaberPoint;
    palmCenter: SaberPoint;
    rawLandmarks?: Array<SaberPoint>;
  } | null;
  rightHand: {
    detected: boolean;
    wrist: SaberPoint;
    indexTip: SaberPoint;
    indexBase: SaberPoint;
    palmCenter: SaberPoint;
    rawLandmarks?: Array<SaberPoint>;
  } | null;
  fps: number;
  isReady: boolean;
  error?: string | null;
}

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'expert';

export interface SongTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  difficulty: DifficultyLevel;
  duration: number; // in seconds
  coverColor: string;
  previewAudioSynth?: string;
  notes: Note[];
  highScore?: number;
  maxCombo?: number;
  rank?: 'SS' | 'S' | 'A' | 'B' | 'C' | 'F';
  isCustom?: boolean;
  description?: string;
}

export interface SliceDebris {
  id: string;
  color: BlockColor;
  half: 'left' | 'right' | 'top' | 'bottom';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  vRotX: number;
  vRotY: number;
  vRotZ: number;
  size: number;
  alpha: number;
  createdAt: number;
}

export interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface ScoreFloater {
  id: string;
  text: string;
  subText?: string;
  x: number;
  y: number;
  color: string;
  size: number;
  alpha: number;
  vy: number;
  scale: number;
  createdAt: number;
}

export interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
  multiplier: 1 | 2 | 4 | 8;
  multiplierProgress: number; // 0 to 1
  energy: number; // 0 to 100
  cuts: {
    perfect: number;
    good: number;
    badCut: number;
    missed: number;
    bombsHit: number;
  };
  accuracy: number;
  totalNotes: number;
  rank: 'SS' | 'S' | 'A' | 'B' | 'C' | 'F';
}

export type GameMode = 'standard' | 'train';

export type TrainFocus = 'all' | 'left' | 'right' | 'speed' | 'zen';

export type BombDensity = 'none' | 'low' | 'normal';

export interface TrainConfig {
  bpm: number;
  difficulty: DifficultyLevel;
  focus: TrainFocus;
  bombDensity: BombDensity;
  noFail: boolean;
  speedRamp: boolean;
  synthTheme: string;
}

export interface TrainStats {
  elapsedSeconds: number;
  totalCuts: number;
  caloriesBurned: number;
  peakBpm: number;
  focus: TrainFocus;
}

export interface GameSettings {
  cameraActive: boolean;
  cameraOpacity: number; // 0.1 to 1
  showCameraPreview: boolean;
  cameraMirror: boolean;
  saberStyle: 'neon' | 'plasma' | 'laser' | 'cyber';
  latencyOffsetMs: number;
  saberLength: number; // default ~180px
  sfxVolume: number;
  musicVolume: number;
  controlMode: 'camera' | 'mouse';
  showDebugSkeleton: boolean;
  particleDensity: 'low' | 'medium' | 'high';
  blockHeightOffset?: number; // Target block height elevation adjustment (-120 to +120 px)
}
