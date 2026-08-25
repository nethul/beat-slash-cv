import React, { useState, useRef } from 'react';
import { Upload, Music, Zap, X, FileAudio, Check, AlertCircle } from 'lucide-react';
import { DifficultyLevel, SongTrack } from '../types';
import { soundManager } from '../services/audioEngine';
import { generateCustomBeatmap } from '../services/beatmaps';

interface CustomTrackModalProps {
  onCustomSongLoaded: (song: SongTrack, audioBuffer: AudioBuffer) => void;
  onClose: () => void;
}

export const CustomTrackModal: React.FC<CustomTrackModalProps> = ({
  onCustomSongLoaded,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
  const [artist, setArtist] = useState<string>('Custom Artist');
  const [bpm, setBpm] = useState<number>(128);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Tap tempo state
  const tapTimesRef = useRef<number[]>([]);
  const [tapCount, setTapCount] = useState<number>(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      // Auto-extract filename without extension as title
      const rawName = selectedFile.name.replace(/\.[^/.]+$/, '');
      setTitle(rawName);
      setError(null);
    }
  };

  const handleTapTempo = () => {
    const now = performance.now();
    const taps = tapTimesRef.current;

    // Reset if last tap was more than 2 seconds ago
    if (taps.length > 0 && now - taps[taps.length - 1] > 2000) {
      tapTimesRef.current = [];
    }

    tapTimesRef.current.push(now);
    setTapCount(tapTimesRef.current.length);

    if (tapTimesRef.current.length >= 4) {
      // Calculate average interval between consecutive taps
      let totalInterval = 0;
      for (let i = 1; i < tapTimesRef.current.length; i++) {
        totalInterval += tapTimesRef.current[i] - tapTimesRef.current[i - 1];
      }
      const avgInterval = totalInterval / (tapTimesRef.current.length - 1);
      const calculatedBpm = Math.round(60000 / avgInterval);
      if (calculatedBpm >= 60 && calculatedBpm <= 240) {
        setBpm(calculatedBpm);
      }
    }
  };

  const handleGenerateAndPlay = async () => {
    if (!file) {
      setError('Please select an audio file (MP3, WAV, OGG).');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const audioBuffer = await soundManager.loadCustomAudioFile(file);
      const duration = Math.min(audioBuffer.duration, 300); // Cap at 5 mins for map generation

      const customSong = generateCustomBeatmap(
        bpm,
        duration,
        difficulty,
        title || 'My Custom Track'
      );

      onCustomSongLoaded(customSong, audioBuffer);
    } catch (err: unknown) {
      console.error('Failed to decode audio file:', err);
      setError('Could not decode audio file. Please try another MP3 or WAV file.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-black/85 border border-white/20 shadow-2xl shadow-indigo-950/60 text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-pink-500/20 border border-pink-500/40 shadow-[0_0_12px_rgba(236,72,153,0.3)]">
              <Upload className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h3 className="text-xl font-black italic tracking-tighter text-white">IMPORT CUSTOM AUDIO</h3>
              <p className="text-xs text-slate-400">Generate beatmaps for your own music tracks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* File Upload Drop Area */}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mp3,audio/wav,audio/ogg,audio/mpeg"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className={`p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              file
                ? 'bg-cyan-500/10 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                : 'bg-black/50 border-white/20 hover:border-cyan-400/60 text-slate-400'
            }`}
          >
            {file ? (
              <div className="flex flex-col items-center">
                <FileAudio className="w-10 h-10 text-cyan-400 mb-2" />
                <span className="font-cyber font-bold text-white text-sm truncate max-w-xs">{file.name}</span>
                <span className="text-[11px] text-cyan-400 mt-1 font-mono">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB • Click to replace
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Music className="w-10 h-10 text-slate-500 mb-2" />
                <span className="font-cyber font-bold text-slate-200 text-sm">Choose Audio File</span>
                <span className="text-xs text-slate-500 mt-1">Supports MP3, WAV, OGG, AAC</span>
              </div>
            )}
          </div>

          {/* Track Title */}
          <div>
            <label className="block text-xs font-bold tracking-[0.3em] uppercase text-slate-400 mb-1.5">
              TRACK TITLE
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Synthwave Runner"
              className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-cyan-400 text-sm text-white outline-none transition-colors"
            />
          </div>

          {/* BPM Input & Tap Tempo Tool */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold tracking-[0.3em] uppercase text-slate-400 mb-1.5">
                ESTIMATED BPM
              </label>
              <input
                type="number"
                min="60"
                max="240"
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value) || 128)}
                className="w-full px-4 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-cyan-400 text-sm font-mono text-white outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold tracking-[0.3em] uppercase text-slate-400 mb-1.5">
                TAP TEMPO TOOL
              </label>
              <button
                type="button"
                onClick={handleTapTempo}
                className="w-full py-2.5 px-3 rounded-xl bg-black/60 hover:bg-black/90 active:bg-cyan-600 text-white font-cyber text-xs font-bold transition-all border border-white/20 flex items-center justify-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-pink-400" />
                <span>TAP BEAT ({tapCount})</span>
              </button>
            </div>
          </div>

          {/* Difficulty Selection */}
          <div>
            <label className="block text-xs font-bold tracking-[0.3em] uppercase text-slate-400 mb-1.5">
              MAP DIFFICULTY
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['easy', 'medium', 'hard', 'expert'] as DifficultyLevel[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`py-2 px-1 text-center font-cyber font-bold text-xs rounded-xl border transition-all uppercase ${
                    difficulty === d
                      ? 'bg-cyan-400 text-black border-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.6)]'
                      : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Generate & Play Button */}
        <div className="mt-8 pt-4 border-t border-white/10 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-3 rounded-xl bg-black/60 hover:bg-black/80 text-slate-300 border border-white/15 font-cyber font-bold text-xs"
          >
            CANCEL
          </button>

          <button
            id="generate-map-btn"
            disabled={!file || isLoading}
            onClick={handleGenerateAndPlay}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-cyan-400 hover:from-pink-400 hover:to-cyan-300 disabled:opacity-50 text-black font-cyber font-black text-sm shadow-[0_0_20px_rgba(34,211,238,0.5)] transition-all flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>GENERATING MAP...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-black" />
                <span>MAP & PLAY</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
