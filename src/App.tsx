import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DifficultyLevel,
  GameMode,
  GameSettings,
  GameStats,
  HandTrackingResult,
  Note,
  SongTrack,
  TrainConfig,
  TrainStats,
} from './types';
import {
  DEFAULT_TRAIN_ROUTINES,
  PRESET_SONGS,
  generateEndlessNotesChunk,
  rebuildNotesForDifficulty,
} from './services/beatmaps';
import { soundManager } from './services/audioEngine';
import { GameCanvas } from './components/GameCanvas';
import { WebcamView } from './components/WebcamView';
import { HUD } from './components/HUD';
import { SongSelect } from './components/SongSelect';
import { GameOverModal } from './components/GameOverModal';
import { CalibrationModal } from './components/CalibrationModal';
import { CustomTrackModal } from './components/CustomTrackModal';
import { TrainModeModal } from './components/TrainModeModal';

const DEFAULT_SETTINGS: GameSettings = {
  cameraActive: true,
  cameraOpacity: 0.15,
  showCameraPreview: true,
  cameraMirror: true,
  saberStyle: 'neon',
  latencyOffsetMs: 0,
  saberLength: 220,
  sfxVolume: 0.8,
  musicVolume: 0.75,
  controlMode: 'camera',
  showDebugSkeleton: false,
  particleDensity: 'high',
  blockHeightOffset: 0,
};

const INITIAL_STATS: GameStats = {
  score: 0,
  combo: 0,
  maxCombo: 0,
  multiplier: 1,
  multiplierProgress: 0,
  energy: 100,
  cuts: {
    perfect: 0,
    good: 0,
    badCut: 0,
    missed: 0,
    bombsHit: 0,
  },
  accuracy: 100,
  totalNotes: 0,
  rank: 'SS',
};

export default function App() {
  // Navigation Screen
  const [screen, setScreen] = useState<'select' | 'playing' | 'gameover'>('select');

  // Game Mode: Standard Song Mode or Endless Train Mode
  const [gameMode, setGameMode] = useState<GameMode>('standard');
  const [trainConfig, setTrainConfig] = useState<TrainConfig>(DEFAULT_TRAIN_ROUTINES[0].config);
  const [trainStats, setTrainStats] = useState<TrainStats>({
    elapsedSeconds: 0,
    totalCuts: 0,
    caloriesBurned: 0,
    peakBpm: 128,
    focus: 'all',
  });
  const [activeBpm, setActiveBpm] = useState<number>(128);

  // Song & Level State
  const [songs, setSongs] = useState<SongTrack[]>(() => {
    const saved = localStorage.getItem('beatsaber_songs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return PRESET_SONGS.map((ps) => {
          const match = parsed.find((p: SongTrack) => p.id === ps.id);
          return match ? { ...ps, highScore: match.highScore, rank: match.rank } : ps;
        });
      } catch {
        return PRESET_SONGS;
      }
    }
    return PRESET_SONGS;
  });

  const [currentSong, setCurrentSong] = useState<SongTrack>(PRESET_SONGS[0]);
  const [currentDifficulty, setCurrentDifficulty] = useState<DifficultyLevel>('medium');
  const [activeNotes, setActiveNotes] = useState<Note[]>([]);
  const [songTime, setSongTime] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isLevelCleared, setIsLevelCleared] = useState<boolean>(false);

  // Gameplay Metrics
  const [stats, setStats] = useState<GameStats>(INITIAL_STATS);

  // Settings State
  const [settings, setSettings] = useState<GameSettings>(() => {
    const saved = localStorage.getItem('beatsaber_settings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Modal Dialogs
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showCustomTrackModal, setShowCustomTrackModal] = useState<boolean>(false);
  const [showTrainModeModal, setShowTrainModeModal] = useState<boolean>(false);

  // Video & Hand Tracking References
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const [handTrackingResult, setHandTrackingResult] = useState<HandTrackingResult | null>(null);
  const customAudioBufferRef = useRef<AudioBuffer | null>(null);

  // Endless Note Generation & Speed Ramp tracking refs
  const nextEndlessBeatRef = useRef<number>(0);
  const endlessNoteCounterRef = useRef<number>(0);
  const lastRampIntervalRef = useRef<number>(0);

  // Save Settings to LocalStorage
  const handleUpdateSettings = (newSettings: Partial<GameSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('beatsaber_settings', JSON.stringify(updated));
      return updated;
    });
  };

  // Start a Standard Song
  const handleStartGame = (song: SongTrack, difficulty: DifficultyLevel, customBuffer?: AudioBuffer) => {
    setGameMode('standard');
    const songWithDiff = rebuildNotesForDifficulty(song, difficulty);
    setCurrentSong(songWithDiff);
    setCurrentDifficulty(difficulty);
    setActiveNotes(songWithDiff.notes.map((n) => ({ ...n, sliced: false, missed: false })));

    setStats({
      ...INITIAL_STATS,
      totalNotes: songWithDiff.notes.filter((n) => n.type !== 'bomb').length,
    });

    setSongTime(0);
    setIsPaused(false);
    setIsLevelCleared(false);
    setScreen('playing');

    if (customBuffer) {
      customAudioBufferRef.current = customBuffer;
    }

    // Play synthesized or custom music track
    soundManager.setVolumes(settings.musicVolume, settings.sfxVolume);
    soundManager.playTrack(songWithDiff.id, songWithDiff.bpm, customAudioBufferRef.current || undefined);
  };

  // Start Endless Train Mode
  const handleStartTrainMode = (config: TrainConfig) => {
    setGameMode('train');
    setTrainConfig(config);
    setActiveBpm(config.bpm);
    lastRampIntervalRef.current = 0;

    setTrainStats({
      elapsedSeconds: 0,
      totalCuts: 0,
      caloriesBurned: 0,
      peakBpm: config.bpm,
      focus: config.focus,
    });

    // Generate initial 32 beats chunk of notes
    const chunk = generateEndlessNotesChunk(
      0,
      32,
      config.bpm,
      config.difficulty,
      config.focus,
      config.bombDensity,
      0
    );

    nextEndlessBeatRef.current = chunk.nextStartBeat;
    endlessNoteCounterRef.current = chunk.nextCounter;

    const trainSongTrack: SongTrack = {
      id: config.synthTheme || 'neon-overdrive',
      title: 'ENDLESS TRAIN WORKOUT',
      artist: 'Procedural Synth Beat Engine',
      genre: 'Continuous Rhythm Stream',
      bpm: config.bpm,
      difficulty: config.difficulty,
      duration: 999999, // Infinite duration
      coverColor: '#06b6d4',
      notes: chunk.notes,
      description: `Endless Workout (${config.focus.toUpperCase()} Focus, ${config.bpm} BPM)`,
    };

    setCurrentSong(trainSongTrack);
    setCurrentDifficulty(config.difficulty);
    setActiveNotes(chunk.notes);

    setStats({
      ...INITIAL_STATS,
      totalNotes: 0,
    });

    setSongTime(0);
    setIsPaused(false);
    setIsLevelCleared(false);
    setShowTrainModeModal(false);
    setScreen('playing');

    // Start continuous procedural synth music loop
    soundManager.setVolumes(settings.musicVolume, settings.sfxVolume);
    soundManager.playTrack(config.synthTheme || 'neon-overdrive', config.bpm, undefined, true);
  };

  // Live BPM adjustment during Train Mode
  const handleChangeBpm = (delta: number) => {
    const newBpm = Math.max(70, Math.min(200, activeBpm + delta));
    setActiveBpm(newBpm);
    soundManager.setBpm(newBpm);
    setTrainStats((prev) => ({ ...prev, peakBpm: Math.max(prev.peakBpm, newBpm) }));
  };

  // Finish Train Mode & Show Summary
  const handleFinishTrain = () => {
    soundManager.stopTrack();
    setIsLevelCleared(true);
    setScreen('gameover');
  };

  // Note Sliced Handler
  const handleNoteSliced = useCallback(
    (note: Note, accuracy: number, directionMatched: boolean, colorMatched: boolean) => {
      setStats((prev) => {
        const isPerfect = accuracy >= 90 && directionMatched && colorMatched;
        const isGood = directionMatched && colorMatched && !isPerfect;
        const isBad = !directionMatched || !colorMatched;

        const basePoints = isPerfect ? 115 : isGood ? 100 : isBad && colorMatched ? 40 : 20;
        const points = basePoints * prev.multiplier;

        const newCombo = !colorMatched ? 0 : prev.combo + 1;
        const newMaxCombo = Math.max(prev.maxCombo, newCombo);

        // Multiplier progression: advance every 8 streak cuts
        let newMultiplier = prev.multiplier;
        let newMultProgress = prev.multiplierProgress;

        if (newCombo >= 30) newMultiplier = 8;
        else if (newCombo >= 14) newMultiplier = 4;
        else if (newCombo >= 6) newMultiplier = 2;
        else newMultiplier = 1;

        const threshold = newMultiplier === 1 ? 6 : newMultiplier === 2 ? 8 : newMultiplier === 4 ? 16 : 30;
        newMultProgress = (newCombo % threshold) / threshold;

        // Combo milestone sounds
        if (newCombo === 10 || newCombo === 50 || newCombo === 100 || newCombo === 200) {
          soundManager.playComboStreak(newCombo);
        }

        // Energy gain
        const newEnergy = Math.min(100, prev.energy + 2.5);

        // Accuracy calculation
        const totalCuts = prev.cuts.perfect + prev.cuts.good + prev.cuts.badCut + prev.cuts.missed + 1;
        const totalScoreRatio =
          (prev.cuts.perfect * 100 +
            prev.cuts.good * 85 +
            prev.cuts.badCut * 40 +
            (isPerfect ? 100 : isGood ? 85 : 40)) /
          totalCuts;

        const acc = Math.max(0, Math.min(100, totalScoreRatio));

        // Rank determination
        let rank: GameStats['rank'] = 'SS';
        if (acc >= 94) rank = 'SS';
        else if (acc >= 88) rank = 'S';
        else if (acc >= 78) rank = 'A';
        else if (acc >= 65) rank = 'B';
        else if (acc >= 50) rank = 'C';
        else rank = 'F';

        return {
          ...prev,
          score: prev.score + points,
          combo: newCombo,
          maxCombo: newMaxCombo,
          multiplier: newMultiplier,
          multiplierProgress: newMultProgress,
          energy: newEnergy,
          accuracy: acc,
          totalNotes: prev.totalNotes + 1,
          rank,
          cuts: {
            ...prev.cuts,
            perfect: prev.cuts.perfect + (isPerfect ? 1 : 0),
            good: prev.cuts.good + (isGood ? 1 : 0),
            badCut: prev.cuts.badCut + (isBad ? 1 : 0),
          },
        };
      });
    },
    []
  );

  // Note Missed Handler
  const handleNoteMissed = useCallback((note: Note) => {
    setStats((prev) => {
      const newEnergy = Math.max(0, prev.energy - 12);
      const totalCuts = prev.cuts.perfect + prev.cuts.good + prev.cuts.badCut + prev.cuts.missed + 1;
      const totalScoreRatio =
        (prev.cuts.perfect * 100 + prev.cuts.good * 85 + prev.cuts.badCut * 40) / totalCuts;
      const acc = Math.max(0, Math.min(100, totalScoreRatio));

      let rank: GameStats['rank'] = 'SS';
      if (acc >= 94) rank = 'SS';
      else if (acc >= 88) rank = 'S';
      else if (acc >= 78) rank = 'A';
      else if (acc >= 65) rank = 'B';
      else if (acc >= 50) rank = 'C';
      else rank = 'F';

      return {
        ...prev,
        combo: 0,
        multiplier: 1,
        multiplierProgress: 0,
        energy: newEnergy,
        accuracy: acc,
        rank,
        cuts: {
          ...prev.cuts,
          missed: prev.cuts.missed + 1,
        },
      };
    });
  }, []);

  // Bomb Hit Handler
  const handleBombHit = useCallback((note: Note) => {
    setStats((prev) => {
      const newEnergy = Math.max(0, prev.energy - 25);
      return {
        ...prev,
        combo: 0,
        multiplier: 1,
        multiplierProgress: 0,
        energy: newEnergy,
        cuts: {
          ...prev.cuts,
          bombsHit: prev.cuts.bombsHit + 1,
        },
      };
    });
  }, []);

  // Check Energy, Song Completion, and Endless Note Buffer Streaming
  useEffect(() => {
    if (screen !== 'playing' || isPaused) return;

    const interval = window.setInterval(() => {
      const curTime = soundManager.getCurrentTime();
      setSongTime(curTime);

      if (gameMode === 'train') {
        // --- TRAIN MODE LOGIC ---
        // 1. Update workout calories and duration telemetry
        const totalCuts = stats.cuts.perfect + stats.cuts.good + stats.cuts.badCut;
        const estimatedCalories =
          stats.cuts.perfect * 0.14 +
          stats.cuts.good * 0.10 +
          stats.cuts.badCut * 0.05 +
          (curTime / 60) * 4.2;

        setTrainStats((prev) => ({
          ...prev,
          elapsedSeconds: curTime,
          totalCuts,
          caloriesBurned: estimatedCalories,
          peakBpm: Math.max(prev.peakBpm, activeBpm),
        }));

        // 2. Auto Speed-Ramp: Increase BPM by +2 every 30 seconds
        if (trainConfig.speedRamp) {
          const current30sInterval = Math.floor(curTime / 30);
          if (current30sInterval > lastRampIntervalRef.current && activeBpm < 185) {
            lastRampIntervalRef.current = current30sInterval;
            const newRampedBpm = activeBpm + 2;
            setActiveBpm(newRampedBpm);
            soundManager.setBpm(newRampedBpm);
          }
        }

        // 3. Endless Note Horizon Streaming: Keep 20 beats buffered ahead of player
        const currentBeat = (curTime * activeBpm) / 60;
        if (nextEndlessBeatRef.current - currentBeat < 16) {
          const nextChunk = generateEndlessNotesChunk(
            nextEndlessBeatRef.current,
            24,
            activeBpm,
            trainConfig.difficulty,
            trainConfig.focus,
            trainConfig.bombDensity,
            endlessNoteCounterRef.current
          );

          nextEndlessBeatRef.current = nextChunk.nextStartBeat;
          endlessNoteCounterRef.current = nextChunk.nextCounter;

          // Append new notes while cleaning old notes that are past 5 seconds behind to prevent memory buildup
          setActiveNotes((prev) => [
            ...prev.filter((n) => (!n.sliced && !n.missed) || curTime - n.time < 3),
            ...nextChunk.notes,
          ]);
        }

        // 4. Energy Management in Train Mode
        if (trainConfig.noFail) {
          // Infinite Shield: if energy drops to 0, regenerate to 30% with visual shield recovery
          if (stats.energy <= 0) {
            setStats((prev) => ({ ...prev, energy: 30 }));
          }
        } else if (stats.energy <= 0) {
          // Regular energy depletion
          soundManager.stopTrack();
          setIsLevelCleared(false);
          setScreen('gameover');
          return;
        }
      } else {
        // --- STANDARD SONG MODE LOGIC ---
        // 1. Check Energy depletion -> Game Over (Defeat)
        if (stats.energy <= 0) {
          soundManager.stopTrack();
          setIsLevelCleared(false);
          setScreen('gameover');
          return;
        }

        // 2. Check Song Completion -> Level Clear (Victory)
        if (curTime >= currentSong.duration) {
          soundManager.stopTrack();
          setIsLevelCleared(true);
          saveHighScore(currentSong.id, stats.score, stats.rank);
          setScreen('gameover');
          return;
        }
      }
    }, 45);

    return () => clearInterval(interval);
  }, [
    screen,
    isPaused,
    gameMode,
    trainConfig,
    activeBpm,
    stats.energy,
    stats.cuts,
    stats.score,
    stats.rank,
    currentSong,
  ]);

  const saveHighScore = (songId: string, newScore: number, rank: GameStats['rank']) => {
    setSongs((prev) => {
      const updated = prev.map((s) => {
        if (s.id === songId) {
          const higher = Math.max(s.highScore || 0, newScore);
          return { ...s, highScore: higher, rank };
        }
        return s;
      });
      localStorage.setItem('beatsaber_songs', JSON.stringify(updated));
      return updated;
    });
  };

  // Keyboard Shortcuts (Space/Esc for pause, R for restart)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (screen === 'playing') {
        if (e.code === 'Space' || e.key === 'Escape') {
          e.preventDefault();
          setIsPaused((p) => !p);
        } else if (e.key === 'r' || e.key === 'R') {
          if (gameMode === 'train') {
            handleStartTrainMode(trainConfig);
          } else {
            handleStartGame(currentSong, currentDifficulty, customAudioBufferRef.current || undefined);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, gameMode, trainConfig, currentSong, currentDifficulty]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050508] text-white select-none">
      {/* Immersive UI Ambient Background Layer */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1e1b4b_0%,#050508_100%)] opacity-60 pointer-events-none" />
      <div className="absolute inset-0 opacity-15 bg-perspective-grid pointer-events-none" />

      {/* Background Hand Tracking / Camera Feed Processor */}
      <WebcamView
        onVideoReady={(video) => {
          videoElementRef.current = video;
        }}
        onTrackingResult={(res) => {
          setHandTrackingResult(res);
        }}
        gameSettings={settings}
        isGameActive={screen === 'playing'}
      />

      {/* Screen 1: Song Selection & Main Menu */}
      {screen === 'select' && (
        <SongSelect
          songs={songs}
          selectedSong={currentSong}
          onSelectSong={(song) => setCurrentSong(song)}
          onStartGame={(song, diff) => handleStartGame(song, diff)}
          onOpenSettings={() => setShowSettingsModal(true)}
          onOpenCustomTrack={() => setShowCustomTrackModal(true)}
          onOpenTrainMode={() => setShowTrainModeModal(true)}
          gameSettings={settings}
          onToggleControlMode={() =>
            handleUpdateSettings({
              controlMode: settings.controlMode === 'camera' ? 'mouse' : 'camera',
            })
          }
        />
      )}

      {/* Screen 2: Active Gameplay Screen */}
      {screen === 'playing' && (
        <>
          {/* Main 3D Canvas Renderer */}
          <GameCanvas
            isPlaying={screen === 'playing'}
            isPaused={isPaused}
            notes={activeNotes}
            songTime={songTime}
            gameSettings={settings}
            handTrackingResult={handTrackingResult}
            videoElement={videoElementRef.current}
            onNoteSliced={handleNoteSliced}
            onNoteMissed={handleNoteMissed}
            onBombHit={handleBombHit}
            stats={stats}
          />

          {/* In-Game HUD Overlay */}
          <HUD
            stats={stats}
            currentSong={currentSong}
            songTime={songTime}
            isPaused={isPaused}
            onTogglePause={() => setIsPaused(!isPaused)}
            onRestart={() => {
              if (gameMode === 'train') {
                handleStartTrainMode(trainConfig);
              } else {
                handleStartGame(
                  currentSong,
                  currentDifficulty,
                  customAudioBufferRef.current || undefined
                );
              }
            }}
            onExit={() => {
              soundManager.stopTrack();
              setScreen('select');
            }}
            gameSettings={settings}
            gameMode={gameMode}
            trainStats={trainStats}
            trainConfig={trainConfig}
            currentBpm={activeBpm}
            onChangeBpm={handleChangeBpm}
            onFinishTrain={handleFinishTrain}
          />

          {/* Pause Modal Overlay */}
          {isPaused && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
              <div className="w-full max-w-sm p-6 rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col items-center gap-4 text-center">
                <h3 className="text-2xl font-cyber font-black text-white">GAME PAUSED</h3>
                <p className="text-xs text-slate-400">Take a breath and get ready to strike!</p>

                <div className="flex flex-col gap-2.5 w-full mt-2">
                  <button
                    onClick={() => setIsPaused(false)}
                    className="py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-cyber font-bold text-sm shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-all"
                  >
                    RESUME
                  </button>

                  <button
                    onClick={() => {
                      if (gameMode === 'train') {
                        handleStartTrainMode(trainConfig);
                      } else {
                        handleStartGame(
                          currentSong,
                          currentDifficulty,
                          customAudioBufferRef.current || undefined
                        );
                      }
                    }}
                    className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-cyber font-bold text-sm border border-slate-700 transition-colors"
                  >
                    RESTART
                  </button>

                  <button
                    onClick={() => {
                      soundManager.stopTrack();
                      setScreen('select');
                    }}
                    className="py-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white font-cyber font-bold text-sm transition-colors"
                  >
                    QUIT TO MENU
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Screen 3: Game Over / Victory / Workout Summary Modal */}
      {screen === 'gameover' && (
        <GameOverModal
          stats={stats}
          song={currentSong}
          isCleared={isLevelCleared}
          onRestart={() => {
            if (gameMode === 'train') {
              handleStartTrainMode(trainConfig);
            } else {
              handleStartGame(
                currentSong,
                currentDifficulty,
                customAudioBufferRef.current || undefined
              );
            }
          }}
          onSelectSong={() => setScreen('select')}
          gameMode={gameMode}
          trainStats={trainStats}
          trainConfig={trainConfig}
        />
      )}

      {/* Train Mode Selector Modal */}
      {showTrainModeModal && (
        <TrainModeModal
          onStartTrainMode={handleStartTrainMode}
          onClose={() => setShowTrainModeModal(false)}
        />
      )}

      {/* Settings & Calibration Modal */}
      {showSettingsModal && (
        <CalibrationModal
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Custom Audio Upload Modal */}
      {showCustomTrackModal && (
        <CustomTrackModal
          onCustomSongLoaded={(customSong, audioBuffer) => {
            setShowCustomTrackModal(false);
            setSongs((prev) => [customSong, ...prev]);
            handleStartGame(customSong, customSong.difficulty, audioBuffer);
          }}
          onClose={() => setShowCustomTrackModal(false)}
        />
      )}
    </div>
  );
}
