import React, { useState } from 'react';
import {
  Play,
  Sliders,
  Upload,
  Trophy,
  Volume2,
  Sparkles,
  Zap,
  Info,
  Camera,
  MousePointer,
  HelpCircle,
  Activity,
  Flame,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { DifficultyLevel, SongTrack, GameSettings } from '../types';

interface SongSelectProps {
  songs: SongTrack[];
  selectedSong: SongTrack;
  onSelectSong: (song: SongTrack) => void;
  onStartGame: (song: SongTrack, difficulty: DifficultyLevel) => void;
  onOpenSettings: () => void;
  onOpenCustomTrack: () => void;
  onOpenTrainMode: () => void;
  gameSettings: GameSettings;
  onToggleControlMode: () => void;
}

export const SongSelect: React.FC<SongSelectProps> = ({
  songs,
  selectedSong,
  onSelectSong,
  onStartGame,
  onOpenSettings,
  onOpenCustomTrack,
  onOpenTrainMode,
  gameSettings,
  onToggleControlMode,
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(selectedSong.difficulty);
  const [showHowToPlay, setShowHowToPlay] = useState<boolean>(false);

  const handleDifficultyChange = (diff: DifficultyLevel) => {
    setSelectedDifficulty(diff);
  };

  const getDifficultyColor = (diff: DifficultyLevel) => {
    switch (diff) {
      case 'easy':
        return 'text-emerald-400 border-emerald-500 bg-emerald-500/10';
      case 'medium':
        return 'text-cyan-400 border-cyan-500 bg-cyan-500/10';
      case 'hard':
        return 'text-amber-400 border-amber-500 bg-amber-500/10';
      case 'expert':
        return 'text-purple-400 border-purple-500 bg-purple-500/10';
    }
  };

  return (
    <div className="relative z-30 min-h-screen flex flex-col justify-between p-4 sm:p-8 max-w-7xl mx-auto">
      {/* Decorative Immersive Ambient Visuals (Pointer-events none) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[20%] left-[8%] w-24 h-24 border-2 border-cyan-400 bg-cyan-500/10 shadow-[0_0_40px_rgba(34,211,238,0.3)] rounded-xl flex items-center justify-center transform -rotate-12 opacity-30">
          <div className="w-10 h-2 bg-white/80 rounded-full shadow-[0_0_10px_#fff]"></div>
        </div>
        <div className="absolute top-[25%] right-[10%] w-24 h-24 border-2 border-pink-500 bg-pink-600/10 shadow-[0_0_40px_rgba(236,72,153,0.3)] rounded-xl flex items-center justify-center transform rotate-12 opacity-30">
          <div className="w-2 h-10 bg-white/80 rounded-full shadow-[0_0_10px_#fff]"></div>
        </div>
        <div className="absolute top-[50%] left-[45%] w-1 h-[250px] bg-gradient-to-t from-cyan-400 to-transparent blur-[1px] transform -rotate-45 opacity-20 shadow-[0_0_20px_#22d3ee]"></div>
        <div className="absolute top-[40%] right-[40%] w-1 h-[220px] bg-gradient-to-t from-pink-500 to-transparent blur-[1px] transform rotate-30 opacity-20 shadow-[0_0_20px_#ec4899]"></div>
      </div>

      {/* Top Navbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Logo & Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 p-0.5 shadow-[0_0_25px_rgba(34,211,238,0.5)]">
            <div className="w-full h-full bg-[#050508] rounded-[14px] flex items-center justify-center">
              <Zap className="w-6 h-6 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              BEAT SLASH
            </h1>
            <p className="text-xs font-bold tracking-[0.25em] text-cyan-400 uppercase">
              VISION MOTION RHYTHM RUNWAY
            </p>
          </div>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Train Mode Button */}
          <button
            id="open-train-mode-nav-btn"
            onClick={onOpenTrainMode}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 border border-cyan-400/60 hover:border-cyan-300 text-xs font-cyber font-bold text-cyan-300 hover:text-white shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all"
          >
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>TRAIN MODE</span>
          </button>

          {/* Mode Switch Button */}
          <button
            id="toggle-control-mode-btn"
            onClick={onToggleControlMode}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-cyber font-bold transition-all ${
              gameSettings.controlMode === 'camera'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)]'
                : 'bg-black/60 text-slate-300 border-white/20 hover:border-white/40'
            }`}
          >
            {gameSettings.controlMode === 'camera' ? (
              <>
                <Camera className="w-4 h-4 text-cyan-400" />
                <span>HAND CAMERA</span>
              </>
            ) : (
              <>
                <MousePointer className="w-4 h-4 text-amber-400" />
                <span>POINTER / MOUSE</span>
              </>
            )}
          </button>

          {/* How to Play Guide Modal Button */}
          <button
            id="how-to-play-btn"
            onClick={() => setShowHowToPlay(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/60 border border-white/20 hover:border-white/40 text-xs font-cyber text-slate-300 hover:text-white transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">TUTORIAL</span>
          </button>

          {/* Custom Song Upload */}
          <button
            id="upload-custom-track-btn"
            onClick={onOpenCustomTrack}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/60 border border-white/20 hover:border-white/40 text-xs font-cyber text-slate-300 hover:text-white transition-colors"
          >
            <Upload className="w-4 h-4 text-pink-400" />
            <span className="hidden sm:inline">IMPORT MP3</span>
          </button>

          {/* Calibration / Settings */}
          <button
            id="open-settings-btn"
            onClick={onOpenSettings}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-black/60 border border-white/20 hover:border-white/40 text-xs font-cyber text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
            title="Settings & Calibration"
          >
            <Sliders className="w-4 h-4 text-purple-400" />
            <span className="hidden sm:inline">SETTINGS</span>
          </button>
        </div>
      </div>

      {/* Main Track Selection & Preview Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-6">
        {/* Left Column: Track List & Endless Card (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* Endless Train Mode Hero Banner Card */}
          <div
            id="train-mode-hero-card"
            onClick={onOpenTrainMode}
            className="group relative p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-purple-950/30 to-black border border-cyan-500/40 hover:border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.2)] hover:shadow-[0_0_35px_rgba(6,182,212,0.4)] transition-all cursor-pointer backdrop-blur-md overflow-hidden"
          >
            <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-cyan-500/10 blur-2xl pointer-events-none group-hover:bg-cyan-500/20 transition-all" />
            
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-400/60 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-transform group-hover:scale-105">
                  <Activity className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-cyber font-bold text-cyan-400 tracking-widest uppercase">
                      UNLIMITED FLOW
                    </span>
                    <span className="px-1.5 py-0.2 text-[9px] font-cyber text-pink-400 bg-pink-500/15 border border-pink-500/30 rounded">
                      ENDLESS
                    </span>
                  </div>
                  <h3 className="text-lg font-black italic tracking-tight text-white group-hover:text-cyan-300 transition-colors">
                    TRAIN MODE (ENDLESS PLAY)
                  </h3>
                  <p className="text-xs text-slate-300/80 font-sans">
                    Play as long as you can • Continuous synth beats • Live workout calorie tracker
                  </p>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenTrainMode();
                }}
                className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-cyber font-bold text-xs shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all shrink-0 flex items-center gap-1.5"
              >
                <span>TRAIN NOW</span>
                <Play className="w-3.5 h-3.5 fill-current" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between px-1 mt-1">
            <span className="text-xs font-bold tracking-[0.3em] text-cyan-400 uppercase">
              STANDARD TRACKS ({songs.length})
            </span>
            <span className="text-xs font-mono text-slate-400">SYNTHWAVE / DNB / CYBERPUNK</span>
          </div>

          <div className="space-y-3 max-h-[42vh] lg:max-h-[48vh] overflow-y-auto pr-1">
            {songs.map((song) => {
              const isSelected = selectedSong.id === song.id;
              return (
                <div
                  key={song.id}
                  id={`song-card-${song.id}`}
                  onClick={() => onSelectSong(song)}
                  className={`group relative p-4 rounded-2xl border transition-all cursor-pointer backdrop-blur-md ${
                    isSelected
                      ? 'bg-black/70 border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.35)] border-l-4'
                      : 'bg-black/40 border-white/10 hover:bg-black/60 hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {/* Song Cover / Pulse Node */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center border font-cyber font-black text-lg transition-transform group-hover:scale-105"
                        style={{
                          backgroundColor: `${song.coverColor}20`,
                          borderColor: `${song.coverColor}80`,
                          color: song.coverColor,
                          boxShadow: isSelected ? `0 0 15px ${song.coverColor}60` : 'none',
                        }}
                      >
                        {song.bpm}
                      </div>

                      {/* Song Metadata */}
                      <div>
                        <h3 className="font-black italic text-lg text-white group-hover:text-cyan-300 transition-colors">
                          {song.title}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {song.artist} • <span className="text-cyan-400">{song.genre}</span>
                        </p>
                      </div>
                    </div>

                    {/* Right side stats: High Score & Duration */}
                    <div className="text-right">
                      {song.highScore ? (
                        <div className="flex items-center justify-end gap-1.5 text-xs font-bold text-pink-400">
                          <Trophy className="w-3.5 h-3.5" />
                          <span className="tabular-nums">{song.highScore.toLocaleString()}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] font-cyber text-slate-500">NO RECORD</span>
                      )}
                      <p className="text-xs font-mono text-slate-400 mt-0.5">
                        {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Track Details & Launch Pad (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between p-6 rounded-3xl bg-black/60 border border-white/15 backdrop-blur-xl shadow-2xl shadow-indigo-950/50">
          <div>
            {/* Header / Artwork Banner */}
            <div className="relative p-6 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-950/40 to-black border border-white/15 mb-6">
              <div
                className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-30 blur-3xl pointer-events-none"
                style={{ backgroundColor: selectedSong.coverColor }}
              />

              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold tracking-[0.3em] text-cyan-400 uppercase">
                  READY TO STRIKE
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black italic tracking-tighter text-white mb-1">
                {selectedSong.title}
              </h2>
              <p className="text-sm text-slate-400 mb-4">
                Artist: <span className="text-white">{selectedSong.artist}</span>
              </p>
              <p className="text-xs text-slate-300/80 leading-relaxed font-sans">{selectedSong.description}</p>
            </div>

            {/* Difficulty Selector */}
            <div className="mb-6">
              <label className="block text-xs font-bold tracking-[0.3em] uppercase text-slate-400 mb-2">
                SELECT DIFFICULTY
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['easy', 'medium', 'hard', 'expert'] as DifficultyLevel[]).map((diff) => {
                  const isCur = selectedDifficulty === diff;
                  return (
                    <button
                      key={diff}
                      id={`diff-btn-${diff}`}
                      onClick={() => handleDifficultyChange(diff)}
                      className={`py-2.5 px-1 text-center font-cyber font-bold text-xs rounded-xl border transition-all uppercase ${
                        isCur
                          ? `${getDifficultyColor(diff)} shadow-[0_0_15px_rgba(34,211,238,0.4)] scale-[1.02]`
                          : 'bg-black/40 border-white/10 text-slate-400 hover:text-white hover:border-white/30'
                      }`}
                    >
                      {diff}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hand Color reminder guide */}
            <div className="grid grid-cols-2 gap-3 mb-6 p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-pink-500 shadow-[0_0_10px_#ec4899]" />
                <div>
                  <span className="font-cyber font-bold text-pink-400">LEFT HAND</span>
                  <p className="text-[10px] text-slate-400">Pink Saber / Pink Blocks</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]" />
                <div>
                  <span className="font-cyber font-bold text-cyan-400">RIGHT HAND</span>
                  <p className="text-[10px] text-slate-400">Cyan Saber / Cyan Blocks</p>
                </div>
              </div>
            </div>
          </div>

          {/* Launch Play Button */}
          <button
            id="start-game-btn"
            onClick={() => onStartGame(selectedSong, selectedDifficulty)}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-cyan-400 hover:from-pink-400 hover:via-purple-500 hover:to-cyan-300 text-black font-cyber font-black text-lg tracking-wider shadow-[0_0_30px_rgba(34,211,238,0.6)] hover:shadow-[0_0_45px_rgba(34,211,238,0.8)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-3"
          >
            <Play className="w-6 h-6 fill-black text-black" />
            <span>START GAME</span>
          </button>
        </div>
      </div>

      {/* How to Play Modal */}
      {showHowToPlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-lg p-6 rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-xl font-cyber font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                HOW TO PLAY
              </h3>
              <button
                onClick={() => setShowHowToPlay(false)}
                className="text-slate-400 hover:text-white text-sm font-cyber font-bold"
              >
                ✕ CLOSE
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-300">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <p className="font-cyber font-bold text-cyan-300">1. Dual Laser Sabers</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Position yourself in front of your camera. Your <strong className="text-rose-400">Left Hand</strong> wields the Red Saber, and your <strong className="text-cyan-400">Right Hand</strong> wields the Blue Saber.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <p className="font-cyber font-bold text-cyan-300">2. Match Color & Direction</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Slice <strong className="text-rose-400">Red Blocks</strong> with Red Saber and <strong className="text-cyan-400">Blue Blocks</strong> with Blue Saber. Follow the arrow on each block (Up, Down, Left, Right) to earn maximum accuracy points (+115)!
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <p className="font-cyber font-bold text-rose-400">3. Avoid Bomb Mines!</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Avoid spiked floating bombs. Slicing a bomb drains your energy matrix and resets your combo multiplier.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                <p className="font-cyber font-bold text-amber-300">4. Fast Slashes</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Make fast, confident slicing motions. High swing speeds generate bonus combo flow and satisfying laser whooshes!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowHowToPlay(false)}
              className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-cyber font-bold text-sm transition-colors"
            >
              GOT IT, LET'S PLAY!
            </button>
          </div>
        </div>
      )}

      {/* Footer / Status Bar */}
      <div className="flex flex-wrap items-center justify-between text-xs font-mono text-slate-500 pt-4 border-t border-slate-800/80">
        <div>BEAT SLASH ENGINE • WebAudio + MediaPipe Vision</div>
        <div>STAND 3-6 FEET FROM WEBCAM • KEEP HANDS VISIBLE</div>
      </div>
    </div>
  );
};
