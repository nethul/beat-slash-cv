import React, { useState } from 'react';
import {
  Activity,
  Zap,
  Flame,
  Shield,
  Clock,
  Sliders,
  ChevronRight,
  Sparkles,
  Heart,
  TrendingUp,
  Volume2,
  X,
  Play,
  RotateCcw,
} from 'lucide-react';
import { BombDensity, DifficultyLevel, TrainConfig, TrainFocus } from '../types';
import { DEFAULT_TRAIN_ROUTINES, TrainRoutine } from '../services/beatmaps';

interface TrainModeModalProps {
  onStartTrainMode: (config: TrainConfig) => void;
  onClose: () => void;
}

export const TrainModeModal: React.FC<TrainModeModalProps> = ({
  onStartTrainMode,
  onClose,
}) => {
  const [selectedRoutine, setSelectedRoutine] = useState<TrainRoutine>(DEFAULT_TRAIN_ROUTINES[0]);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

  // Custom configuration state
  const [customBpm, setCustomBpm] = useState<number>(128);
  const [customDifficulty, setCustomDifficulty] = useState<DifficultyLevel>('medium');
  const [customFocus, setCustomFocus] = useState<TrainFocus>('all');
  const [customBombDensity, setCustomBombDensity] = useState<BombDensity>('low');
  const [customNoFail, setCustomNoFail] = useState<boolean>(true);
  const [customSpeedRamp, setCustomSpeedRamp] = useState<boolean>(true);
  const [customSynthTheme, setCustomSynthTheme] = useState<string>('neon-overdrive');

  const handleLaunchRoutine = (routine: TrainRoutine) => {
    onStartTrainMode(routine.config);
  };

  const handleLaunchCustom = () => {
    onStartTrainMode({
      bpm: customBpm,
      difficulty: customDifficulty,
      focus: customFocus,
      bombDensity: customBombDensity,
      noFail: customNoFail,
      speedRamp: customSpeedRamp,
      synthTheme: customSynthTheme,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-[#080812] border border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.25)] overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400" />
        <div className="absolute -top-24 -right-24 w-60 h-60 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-7 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.3)]">
              <Activity className="w-6 h-6 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-cyber font-bold tracking-[0.25em] text-cyan-400 uppercase">
                  ENDLESS PRACTICE & FITNESS
                </span>
                <span className="px-2 py-0.5 text-[9px] font-cyber font-black tracking-wider text-pink-400 bg-pink-500/10 border border-pink-500/30 rounded-full">
                  UNLIMITED PLAY
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black italic tracking-tighter text-white">
                TRAIN MODE
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="train-modal-custom-toggle"
              onClick={() => setIsCustomMode(!isCustomMode)}
              className={`px-3 py-2 rounded-xl border text-xs font-cyber font-bold transition-all flex items-center gap-1.5 ${
                isCustomMode
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400'
                  : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{isCustomMode ? 'PRESET ROUTINES' : 'CUSTOM SETUP'}</span>
            </button>

            <button
              id="train-modal-close-btn"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white border border-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {!isCustomMode ? (
            /* PRESET ROUTINES VIEW */
            <div>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                  SELECT A WORKOUT ROUTINE ({DEFAULT_TRAIN_ROUTINES.length})
                </p>
                <span className="text-[11px] font-mono text-cyan-400/80">
                  Plays indefinitely until you choose to finish
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DEFAULT_TRAIN_ROUTINES.map((routine) => {
                  const isSelected = selectedRoutine.id === routine.id;
                  return (
                    <div
                      key={routine.id}
                      id={`train-routine-${routine.id}`}
                      onClick={() => setSelectedRoutine(routine)}
                      className={`group relative p-5 rounded-2xl border transition-all cursor-pointer backdrop-blur-md flex flex-col justify-between ${
                        isSelected
                          ? 'bg-cyan-950/30 border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.25)] border-l-4'
                          : 'bg-black/40 border-white/10 hover:bg-black/60 hover:border-white/25'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center border transition-transform group-hover:scale-105"
                              style={{
                                backgroundColor: `${routine.color}15`,
                                borderColor: `${routine.color}60`,
                                color: routine.color,
                                boxShadow: isSelected ? `0 0 15px ${routine.color}40` : 'none',
                              }}
                            >
                              {routine.iconType === 'cardio' && <Flame className="w-5 h-5" />}
                              {routine.iconType === 'zen' && <Heart className="w-5 h-5" />}
                              {routine.iconType === 'drill' && <Zap className="w-5 h-5" />}
                              {routine.iconType === 'speed' && <TrendingUp className="w-5 h-5" />}
                              {routine.iconType === 'left' && <span className="font-cyber font-black text-xs">L</span>}
                              {routine.iconType === 'right' && <span className="font-cyber font-black text-xs">R</span>}
                            </div>
                            <div>
                              <h3 className="font-black text-base text-white group-hover:text-cyan-300 transition-colors">
                                {routine.name}
                              </h3>
                              <p className="text-xs font-mono" style={{ color: routine.color }}>
                                {routine.subtitle}
                              </p>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-slate-300/80 leading-relaxed mt-2 mb-4 font-sans">
                          {routine.description}
                        </p>
                      </div>

                      {/* Routine Badges */}
                      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/5 text-[10px] font-cyber font-bold">
                        <span className="px-2 py-0.5 rounded bg-white/10 text-slate-300">
                          {routine.config.difficulty.toUpperCase()}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white/10 text-slate-300">
                          FOCUS: {routine.config.focus.toUpperCase()}
                        </span>
                        {routine.config.speedRamp && (
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            AUTO SPEED-RAMP
                          </span>
                        )}
                        {routine.config.noFail && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            NO-FAIL INFINITE
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* CUSTOM WORKOUT CONFIGURATOR */
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20">
                <p className="text-xs text-cyan-300 font-cyber font-bold">CUSTOM TRAIN CONFIGURATION</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tune your preferred tempo, hand isolations, obstacle levels, and endless speed ramping.
                </p>
              </div>

              {/* BPM Tempo Slider */}
              <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs font-cyber">
                  <span className="text-slate-300">Target Tempo / BPM</span>
                  <span className="text-cyan-400 font-bold text-sm">{customBpm} BPM</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="180"
                  step="2"
                  value={customBpm}
                  onChange={(e) => setCustomBpm(parseInt(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>80 (Warmup)</span>
                  <span>128 (Standard Electro)</span>
                  <span>160 (High Breakbeat)</span>
                  <span>180 (Extreme)</span>
                </div>
              </div>

              {/* Focus / Hand Isolation Grid */}
              <div className="space-y-2">
                <label className="block text-xs font-bold tracking-widest text-slate-400 uppercase">
                  TRAINING FOCUS / ISOLATION
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(
                    [
                      { id: 'all', label: 'Dual Hands', desc: 'Balanced 50/50' },
                      { id: 'left', label: 'Left Hand Only', desc: 'Pink blade focus' },
                      { id: 'right', label: 'Right Hand Only', desc: 'Cyan blade focus' },
                      { id: 'speed', label: 'Speed Stream', desc: 'Alternate cuts' },
                      { id: 'zen', label: 'Zen Flow', desc: 'No-bomb relax' },
                    ] as { id: TrainFocus; label: string; desc: string }[]
                  ).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setCustomFocus(f.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        customFocus === f.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                          : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <p className="font-cyber font-bold text-xs">{f.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{f.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty & Bomb Density */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Difficulty */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold tracking-widest text-slate-400 uppercase">
                    PATTERN COMPLEXITY
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['easy', 'medium', 'hard', 'expert'] as DifficultyLevel[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setCustomDifficulty(d)}
                        className={`py-2 px-1 text-center font-cyber font-bold text-xs rounded-xl border transition-all uppercase ${
                          customDifficulty === d
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                            : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bomb Density */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold tracking-widest text-slate-400 uppercase">
                    BOMB MINES OBSTACLES
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'none', label: 'None' },
                        { id: 'low', label: 'Low (15%)' },
                        { id: 'normal', label: 'Normal (30%)' },
                      ] as { id: BombDensity; label: string }[]
                    ).map((b) => (
                      <button
                        key={b.id}
                        onClick={() => setCustomBombDensity(b.id)}
                        className={`py-2 px-1 text-center font-cyber font-bold text-xs rounded-xl border transition-all ${
                          customBombDensity === b.id
                            ? 'bg-pink-500/20 border-pink-400 text-pink-300 shadow-[0_0_10px_rgba(236,72,153,0.3)]'
                            : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-black/60 border border-white/10 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-cyber font-bold text-slate-300">Infinite Shield (No-Fail)</span>
                    <p className="text-[10px] text-slate-400">Keep slicing continuously even if missed</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={customNoFail}
                    onChange={(e) => setCustomNoFail(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-black/60 border border-white/10 cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-cyber font-bold text-slate-300">Auto Speed-Ramp</span>
                    <p className="text-[10px] text-slate-400">+2 BPM tempo increase every 30 seconds</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={customSpeedRamp}
                    onChange={(e) => setCustomSpeedRamp(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400 cursor-pointer"
                  />
                </label>
              </div>

              {/* Synth Music Theme Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold tracking-widest text-slate-400 uppercase">
                  SYNTHWAVE MUSIC THEME
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'neon-overdrive', name: 'Neon Overdrive', color: '#ef4444' },
                    { id: 'hyper-velocity', name: 'Hyper Velocity', color: '#06b6d4' },
                    { id: 'cyber-pulse', name: 'Cyber Pulse', color: '#10b981' },
                    { id: 'quantum-chaos', name: 'Quantum Chaos', color: '#a855f7' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setCustomSynthTheme(t.id)}
                      className={`p-2.5 rounded-xl border text-center font-cyber font-bold text-xs transition-all ${
                        customSynthTheme === t.id
                          ? 'bg-black/80 border-cyan-400 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                          : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="w-2.5 h-2.5 rounded-full mx-auto mb-1" style={{ backgroundColor: t.color }} />
                      <span>{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Launch Action */}
        <div className="p-5 sm:p-7 border-t border-white/10 bg-black/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>ENDLESS DURATION</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-pink-500" />
              <span>LIVE CALORIE & STAMINA TRACKING</span>
            </div>
          </div>

          <button
            id="start-train-mode-btn"
            onClick={() => {
              if (isCustomMode) {
                handleLaunchCustom();
              } else {
                handleLaunchRoutine(selectedRoutine);
              }
            }}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-cyan-400 hover:from-pink-400 hover:via-purple-500 hover:to-cyan-300 text-black font-cyber font-black text-base tracking-wider shadow-[0_0_30px_rgba(34,211,238,0.6)] hover:shadow-[0_0_45px_rgba(34,211,238,0.8)] transition-all flex items-center justify-center gap-3"
          >
            <Play className="w-5 h-5 fill-black text-black" />
            <span>START ENDLESS TRAINING</span>
          </button>
        </div>
      </div>
    </div>
  );
};
