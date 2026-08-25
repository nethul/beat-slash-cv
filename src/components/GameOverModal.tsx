import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  RotateCcw,
  ArrowRight,
  Flame,
  Target,
  Zap,
  Clock,
  Activity,
  Heart,
  TrendingUp,
} from 'lucide-react';
import { GameMode, GameStats, SongTrack, TrainConfig, TrainStats } from '../types';

interface GameOverModalProps {
  stats: GameStats;
  song: SongTrack;
  isCleared: boolean;
  onRestart: () => void;
  onSelectSong: () => void;
  gameMode?: GameMode;
  trainStats?: TrainStats;
  trainConfig?: TrainConfig;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  song,
  isCleared,
  onRestart,
  onSelectSong,
  gameMode = 'standard',
  trainStats,
  trainConfig,
}) => {
  const isTrainMode = gameMode === 'train';

  useEffect(() => {
    if (isTrainMode || (isCleared && (stats.rank === 'SS' || stats.rank === 'S' || stats.rank === 'A'))) {
      // Fire celebratory confetti burst
      confetti({
        particleCount: 80,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#22d3ee', '#ec4899', '#a855f7', '#fbbf24', '#ffffff'],
      });
    }
  }, [isCleared, stats.rank, isTrainMode]);

  const getRankColor = (rank: GameStats['rank']) => {
    switch (rank) {
      case 'SS':
        return 'text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-pink-400 to-cyan-300 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.6)]';
      case 'S':
        return 'text-amber-400 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]';
      case 'A':
        return 'text-emerald-400 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]';
      case 'B':
        return 'text-cyan-400 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.5)]';
      case 'C':
        return 'text-purple-400 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.5)]';
      case 'F':
        return 'text-pink-500 border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.5)]';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-black/80 border border-white/20 shadow-2xl shadow-indigo-950/60 flex flex-col items-center text-center">
        {/* Banner Header */}
        <div className="mb-2">
          {isTrainMode ? (
            <span className="px-3 py-1 text-xs font-bold tracking-[0.3em] text-cyan-400 uppercase rounded-full bg-cyan-500/10 border border-cyan-400/50 shadow-[0_0_12px_rgba(34,211,238,0.3)] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>TRAINING COMPLETE</span>
            </span>
          ) : isCleared ? (
            <span className="px-3 py-1 text-xs font-bold tracking-[0.3em] text-cyan-400 uppercase rounded-full bg-cyan-500/10 border border-cyan-400/50 shadow-[0_0_12px_rgba(34,211,238,0.3)]">
              TRACK COMPLETE
            </span>
          ) : (
            <span className="px-3 py-1 text-xs font-bold tracking-[0.3em] text-pink-500 uppercase rounded-full bg-pink-500/10 border border-pink-500/50 shadow-[0_0_12px_rgba(236,72,153,0.3)]">
              ENERGY DEPLETED
            </span>
          )}
        </div>

        <h2 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-white mb-1">
          {isTrainMode ? 'WORKOUT SUMMARY' : isCleared ? 'VICTORY' : 'DEFEAT'}
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          {isTrainMode ? (
            <>
              Routine:{' '}
              <span className="text-white font-semibold">
                {song.title} ({trainConfig?.focus.toUpperCase()} FOCUS)
              </span>
            </>
          ) : (
            <>
              Track: <span className="text-white font-semibold">{song.title}</span> •{' '}
              <span className="text-cyan-400 uppercase font-bold">{song.difficulty}</span>
            </>
          )}
        </p>

        {isTrainMode ? (
          /* Train Mode Primary Metric: Calories & Workout Time */
          <div className="grid grid-cols-2 gap-4 w-full mb-6">
            <div className="p-4 rounded-2xl bg-black/60 border border-pink-500/30 shadow-[0_0_20px_rgba(236,72,153,0.2)] flex flex-col items-center">
              <div className="flex items-center gap-1 text-xs font-cyber font-bold text-pink-400 tracking-widest uppercase mb-1">
                <Flame className="w-4 h-4 text-pink-500" />
                <span>EST. CALORIES</span>
              </div>
              <div className="text-3xl sm:text-4xl font-black tabular-nums text-white text-glow-pink">
                {(trainStats?.caloriesBurned || 0).toFixed(1)}{' '}
                <span className="text-xs text-pink-400 font-sans">kcal</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-black/60 border border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.2)] flex flex-col items-center">
              <div className="flex items-center gap-1 text-xs font-cyber font-bold text-cyan-400 tracking-widest uppercase mb-1">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>DURATION</span>
              </div>
              <div className="text-3xl sm:text-4xl font-black tabular-nums text-white text-glow-cyan font-mono">
                {formatTime(trainStats?.elapsedSeconds || 0)}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Big Rank Badge */}
            <div className="relative mb-6">
              <div
                className={`w-24 h-24 sm:w-28 sm:h-28 rounded-3xl border-2 flex items-center justify-center font-cyber font-black text-5xl sm:text-6xl bg-black/90 ${getRankColor(
                  stats.rank
                )}`}
              >
                {stats.rank}
              </div>
            </div>

            {/* Final Score Stat */}
            <div className="mb-6">
              <p className="text-xs font-bold tracking-[0.3em] text-slate-400 uppercase">FINAL SCORE</p>
              <div className="text-4xl sm:text-5xl font-black tabular-nums text-white text-glow-cyan mt-1">
                {stats.score.toLocaleString()}
              </div>
            </div>
          </>
        )}

        {/* Performance Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full mb-6">
          <div className="p-3.5 rounded-2xl bg-black/60 border-l-4 border-cyan-400 border-white/10">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold tracking-wider text-slate-400 uppercase mb-1">
              <Target className="w-3.5 h-3.5 text-cyan-400" />
              <span>ACCURACY</span>
            </div>
            <div className="text-xl font-bold tabular-nums text-cyan-300">
              {Math.round(stats.accuracy)}%
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/60 border-r-4 border-pink-500 border-white/10">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold tracking-wider text-slate-400 uppercase mb-1">
              <Flame className="w-3.5 h-3.5 text-pink-500" />
              <span>MAX COMBO</span>
            </div>
            <div className="text-xl font-black tabular-nums text-pink-400">
              {stats.maxCombo}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/60 border-t-2 border-emerald-400 border-white/10 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold tracking-wider text-slate-400 uppercase mb-1">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isTrainMode ? 'TOTAL CUTS' : 'PERFECTS'}</span>
            </div>
            <div className="text-xl font-bold tabular-nums text-emerald-400">
              {isTrainMode ? stats.totalNotes : stats.cuts.perfect}
            </div>
          </div>
        </div>

        {/* Cut Quality Breakdown */}
        <div className="w-full flex items-center justify-between text-xs font-mono text-slate-300 p-3 rounded-xl bg-black/50 border border-white/10 mb-8">
          <div>Good: <span className="text-white font-bold">{stats.cuts.good}</span></div>
          <div>Bad Angle: <span className="text-amber-400 font-bold">{stats.cuts.badCut}</span></div>
          <div>Misses: <span className="text-pink-400 font-bold">{stats.cuts.missed}</span></div>
          <div>Bombs: <span className="text-red-500 font-bold">{stats.cuts.bombsHit}</span></div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 w-full">
          <button
            id="modal-restart-btn"
            onClick={onRestart}
            className="py-3.5 px-4 rounded-xl bg-black/60 hover:bg-black/80 text-white font-cyber font-bold text-sm border border-white/20 hover:border-white/40 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4 text-cyan-400" />
            <span>{isTrainMode ? 'TRAIN AGAIN' : 'REPLAY'}</span>
          </button>

          <button
            id="modal-song-select-btn"
            onClick={onSelectSong}
            className="py-3.5 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-cyan-400 hover:from-pink-400 hover:to-cyan-300 text-black font-cyber font-black text-sm transition-all shadow-[0_0_20px_rgba(34,211,238,0.5)] flex items-center justify-center gap-2"
          >
            <span>MAIN MENU</span>
            <ArrowRight className="w-4 h-4 text-black" />
          </button>
        </div>
      </div>
    </div>
  );
};
