import React from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Flame,
  LogOut,
  Activity,
  Plus,
  Minus,
  CheckCircle,
  Heart,
  Shield,
} from 'lucide-react';
import { GameStats, SongTrack, GameSettings, GameMode, TrainStats, TrainConfig } from '../types';

interface HUDProps {
  stats: GameStats;
  currentSong: SongTrack;
  songTime: number;
  isPaused: boolean;
  onTogglePause: () => void;
  onRestart: () => void;
  onExit: () => void;
  gameSettings: GameSettings;
  gameMode?: GameMode;
  trainStats?: TrainStats;
  trainConfig?: TrainConfig;
  currentBpm?: number;
  onChangeBpm?: (delta: number) => void;
  onFinishTrain?: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  stats,
  currentSong,
  songTime,
  isPaused,
  onTogglePause,
  onRestart,
  onExit,
  gameSettings,
  gameMode = 'standard',
  trainStats,
  trainConfig,
  currentBpm,
  onChangeBpm,
  onFinishTrain,
}) => {
  const isTrainMode = gameMode === 'train';
  const progressPercent = isTrainMode
    ? ((songTime % 10) / 10) * 100 // pulsing rhythmic loop in train mode
    : Math.min(100, Math.max(0, (songTime / currentSong.duration) * 100));

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const activeBpm = currentBpm || currentSong.bpm;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-6 sm:p-8 select-none">
      {/* Top Header: Track / Workout Info & Controls */}
      <div className="flex justify-between items-start">
        {/* Left: Track Information or Train Mode Banner */}
        <div className="space-y-1 max-w-md">
          {isTrainMode ? (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 text-[10px] font-cyber font-black tracking-widest text-black bg-cyan-400 rounded shadow-[0_0_12px_#22d3ee] uppercase">
                  ENDLESS TRAIN MODE
                </span>
                {trainConfig?.noFail && (
                  <span className="px-2 py-0.5 text-[10px] font-cyber font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 rounded flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    INFINITE SHIELD
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-4xl font-black italic tracking-tighter text-white drop-shadow-[0_0_20px_rgba(34,211,238,0.5)] truncate">
                {currentSong.title.toUpperCase()}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-2 mt-0.5">
                <span className="text-cyan-400 font-mono font-bold">{activeBpm} BPM</span>
                <span>•</span>
                <span className="text-pink-400 font-cyber font-bold uppercase">
                  FOCUS: {trainConfig?.focus.toUpperCase() || 'ALL'}
                </span>
                {trainConfig?.speedRamp && (
                  <span className="text-[10px] font-mono text-purple-400 bg-purple-500/15 px-1.5 py-0.2 rounded border border-purple-500/30">
                    RAMP ON
                  </span>
                )}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold tracking-[0.3em] text-cyan-400 uppercase flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                Currently Playing
              </p>
              <h1 className="text-2xl sm:text-4xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] truncate">
                {currentSong.title.toUpperCase()}
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Artist: <span className="text-white font-medium">{currentSong.artist}</span> •{' '}
                <span className="text-cyan-400 font-mono">{currentSong.bpm} BPM</span> •{' '}
                <span className="text-pink-400 uppercase font-bold">{currentSong.difficulty}</span>
              </p>
            </div>
          )}
        </div>

        {/* Right: High Score / Train Telemetry & Controls */}
        <div className="flex items-start gap-4 pointer-events-auto">
          {isTrainMode ? (
            <div className="text-right flex items-center gap-4">
              {/* Live Workout Calories */}
              <div className="bg-black/60 backdrop-blur-md border border-pink-500/30 px-3 py-1.5 rounded-xl shadow-[0_0_15px_rgba(236,72,153,0.2)]">
                <div className="flex items-center justify-end gap-1 text-[10px] font-cyber font-bold text-pink-400 tracking-wider uppercase">
                  <Flame className="w-3 h-3 text-pink-500" />
                  <span>CALORIES</span>
                </div>
                <p className="text-xl sm:text-2xl font-black tabular-nums text-white text-glow-pink">
                  {(trainStats?.caloriesBurned || 0).toFixed(1)}{' '}
                  <span className="text-xs text-pink-400 font-sans">kcal</span>
                </p>
              </div>

              {/* Finish Workout Button */}
              <button
                id="finish-train-workout-btn"
                onClick={onFinishTrain || onExit}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-cyan-400 hover:from-pink-400 hover:to-cyan-300 text-black font-cyber font-black text-xs tracking-wider shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all flex items-center gap-1.5"
                title="Finish training and view summary"
              >
                <CheckCircle className="w-4 h-4 fill-black text-cyan-300" />
                <span className="hidden sm:inline">FINISH WORKOUT</span>
              </button>
            </div>
          ) : (
            <div className="text-right">
              <p className="text-xs font-bold tracking-[0.3em] text-pink-500 uppercase">High Score</p>
              <p className="text-2xl sm:text-4xl font-black tabular-nums text-white text-glow-pink">
                {(currentSong.highScore || 0).toLocaleString()}
              </p>
            </div>
          )}

          {/* Quick Toolbar */}
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md border border-white/15 p-1.5 rounded-xl ml-2 shadow-lg">
            {/* Live BPM quick controller in train mode */}
            {isTrainMode && onChangeBpm && (
              <div className="flex items-center gap-1 mr-1 pr-1 border-r border-white/15">
                <button
                  id="hud-bpm-minus-btn"
                  onClick={() => onChangeBpm(-5)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
                  title="Slow down -5 BPM"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-[10px] font-mono text-cyan-300 font-bold px-1">{activeBpm}</span>
                <button
                  id="hud-bpm-plus-btn"
                  onClick={() => onChangeBpm(5)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
                  title="Speed up +5 BPM"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}

            <button
              id="pause-game-btn"
              onClick={onTogglePause}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 hover:text-white transition-colors"
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? <Play className="w-4 h-4 text-cyan-400" /> : <Pause className="w-4 h-4 text-white" />}
            </button>
            <button
              id="restart-game-btn"
              onClick={onRestart}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 hover:text-white transition-colors"
              title="Restart"
            >
              <RotateCcw className="w-4 h-4 text-white" />
            </button>
            <button
              id="exit-game-btn"
              onClick={onExit}
              className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-colors"
              title="Exit to menu"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Left Lateral Stat Cards: Score / Slashes & Accuracy */}
      <div className="absolute left-6 sm:left-8 top-1/2 -translate-y-1/2 space-y-5 sm:space-y-6">
        <div className="bg-black/50 backdrop-blur-md border-l-4 border-cyan-500 p-4 sm:p-6 w-36 sm:w-48 shadow-[0_0_25px_rgba(6,182,212,0.15)] rounded-r-xl">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
            {isTrainMode ? 'TOTAL CUTS' : 'SCORE'}
          </p>
          <p className="text-2xl sm:text-4xl font-black tabular-nums text-white tracking-tight">
            {isTrainMode ? stats.totalNotes : stats.score.toLocaleString()}
          </p>
        </div>

        <div className="bg-black/50 backdrop-blur-md border-l-4 border-white/30 p-4 sm:p-6 w-36 sm:w-48 shadow-lg rounded-r-xl">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Accuracy</p>
          <p className="text-2xl sm:text-3xl font-bold tabular-nums text-cyan-300">
            {Math.round(stats.accuracy)}%
          </p>
          <div className="mt-1 flex items-center justify-between text-[11px] font-cyber text-slate-400">
            <span>RANK</span>
            <span className="font-bold text-white px-1.5 py-0.2 bg-white/10 rounded">{stats.rank}</span>
          </div>
        </div>

        {/* Energy Bar Indicator */}
        <div className="bg-black/50 backdrop-blur-md border-l-4 border-emerald-400 p-3 sm:p-4 w-36 sm:w-48 rounded-r-xl">
          <div className="flex justify-between text-[11px] font-bold tracking-wider text-slate-300 uppercase mb-1">
            <span>{isTrainMode && trainConfig?.noFail ? 'SHIELD' : 'ENERGY'}</span>
            <span className={stats.energy > 30 ? 'text-emerald-400' : 'text-rose-400 animate-pulse'}>
              {Math.round(stats.energy)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${
                stats.energy > 30
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-400 shadow-[0_0_8px_#22d3ee]'
                  : 'bg-rose-500 shadow-[0_0_8px_#ef4444]'
              }`}
              style={{ width: `${stats.energy}%` }}
            />
          </div>
        </div>
      </div>

      {/* Right Lateral Stat Cards: Multiplier & Combo */}
      <div className="absolute right-6 sm:right-8 top-1/2 -translate-y-1/2 space-y-5 sm:space-y-6 flex flex-col items-end">
        <div className="bg-black/50 backdrop-blur-md border-r-4 border-pink-500 p-4 sm:p-6 w-36 sm:w-48 text-right shadow-[0_0_25px_rgba(236,72,153,0.15)] rounded-l-xl">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Multiplier</p>
          <p className="text-4xl sm:text-6xl font-black italic text-pink-500 text-glow-pink">
            {stats.multiplier}X
          </p>
          <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-pink-500 shadow-[0_0_8px_#ec4899] transition-all duration-100"
              style={{ width: `${stats.multiplierProgress * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-black/50 backdrop-blur-md border-r-4 border-white/30 p-4 sm:p-6 w-36 sm:w-48 text-right shadow-lg rounded-l-xl">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Combo</p>
          <p className="text-2xl sm:text-3xl font-bold tabular-nums text-white">
            {stats.combo}
          </p>
          {stats.combo >= 20 && (
            <p className="text-[10px] font-cyber text-amber-400 tracking-widest uppercase mt-0.5 animate-pulse">
              HOT STREAK!
            </p>
          )}
        </div>
      </div>

      {/* Center Dynamic Combo Streak Prompt */}
      {stats.combo > 8 && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center animate-pulse">
          <span className="text-3xl sm:text-5xl font-black italic tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 drop-shadow-[0_0_20px_rgba(236,72,153,0.8)]">
            {stats.combo} HITS
          </span>
        </div>
      )}

      {/* Bottom Footer: Track Timeline / Workout Stopwatch & Active Hand Indicators */}
      <div className="mt-auto flex flex-col items-center gap-4 sm:gap-6 pb-2">
        {/* Progress Bar with timestamps / Endless Stopwatch */}
        <div className="flex items-center gap-3 w-full max-w-xl">
          <div className="flex items-center gap-1.5">
            {isTrainMode && <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />}
            <span className="text-xs font-mono font-bold text-cyan-300">
              {isTrainMode ? `WORKOUT: ${formatTime(songTime)}` : formatTime(songTime)}
            </span>
          </div>

          <div className="flex-1 h-3 bg-slate-900/90 rounded-full overflow-hidden border border-white/10 p-0.5 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <div
              className={`h-full rounded-full transition-all duration-100 ${
                isTrainMode
                  ? 'bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 shadow-[0_0_15px_#22d3ee] animate-pulse'
                  : 'bg-gradient-to-r from-cyan-600 via-cyan-400 to-pink-500 shadow-[0_0_15px_#22d3ee]'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <span className="text-xs font-mono text-slate-400">
            {isTrainMode ? '∞ ENDLESS' : formatTime(currentSong.duration)}
          </span>
        </div>

        {/* Hand Status Icons */}
        <div className="flex gap-8 sm:gap-12">
          {/* Left Hand Indicator */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-pink-500 flex items-center justify-center bg-pink-500/10 shadow-[0_0_20px_rgba(236,72,153,0.4)]">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v2.5m-9 6.5h3m4 0h3"
                />
              </svg>
            </div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-pink-500">
              Left Hand (Pink/Red)
            </p>
          </div>

          {/* Right Hand Indicator */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-cyan-400 flex items-center justify-center bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.4)]">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v2.5m-9 6.5h3m4 0h3"
                />
              </svg>
            </div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-cyan-400">
              Right Hand (Cyan)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
