import React from 'react';
import { Sliders, Camera, Volume2, Shield, Eye, Layers, Zap, X } from 'lucide-react';
import { GameSettings } from '../types';
import { soundManager } from '../services/audioEngine';

interface CalibrationModalProps {
  settings: GameSettings;
  onUpdateSettings: (newSettings: Partial<GameSettings>) => void;
  onClose: () => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
  const handleVolumeChange = (type: 'music' | 'sfx', val: number) => {
    if (type === 'music') {
      onUpdateSettings({ musicVolume: val });
      soundManager.setVolumes(val, settings.sfxVolume);
    } else {
      onUpdateSettings({ sfxVolume: val });
      soundManager.setVolumes(settings.musicVolume, val);
      soundManager.playSliceSound('blue', 100, 1.5);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 rounded-3xl bg-black/85 border border-white/20 shadow-2xl shadow-indigo-950/60 text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.3)]">
              <Sliders className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-xl font-black italic tracking-tighter text-white">SETTINGS & CALIBRATION</h3>
              <p className="text-xs text-slate-400">Configure camera tracking, audio & laser sabers</p>
            </div>
          </div>
          <button
            id="close-settings-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6 text-sm">
          {/* Section 1: Control & Camera Tracking */}
          <div className="space-y-4">
            <h4 className="text-xs font-cyber font-bold tracking-wider text-cyan-400 uppercase flex items-center gap-2">
              <Camera className="w-4 h-4" />
              CAMERA & HAND TRACKING
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onUpdateSettings({ controlMode: 'camera', cameraActive: true })}
                className={`p-3 rounded-2xl border text-left font-cyber text-xs transition-all ${
                  settings.controlMode === 'camera'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-sm mb-0.5 text-white">Hand Gestures</div>
                <div className="text-[11px] text-slate-400">Track hands with webcam</div>
              </button>

              <button
                onClick={() => onUpdateSettings({ controlMode: 'mouse' })}
                className={`p-3 rounded-2xl border text-left font-cyber text-xs transition-all ${
                  settings.controlMode === 'mouse'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-sm mb-0.5 text-white">Mouse / Touch</div>
                <div className="text-[11px] text-slate-400">Play without webcam</div>
              </button>
            </div>

            {/* Camera Overlay Opacity */}
            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs font-cyber">
                <span className="text-slate-300">Camera Background Opacity</span>
                <span className="text-cyan-400 font-bold">{Math.round(settings.cameraOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.cameraOpacity}
                onChange={(e) => onUpdateSettings({ cameraOpacity: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>0% (Cyber Tunnel)</span>
                <span>50% (Mixed Reality)</span>
                <span>100% (Full Camera)</span>
              </div>
            </div>

            {/* Block Target Height Slider */}
            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs font-cyber">
                <span className="text-slate-300">Target Block Elevation (Camera Reach)</span>
                <span className="text-cyan-400 font-bold">
                  {((settings.blockHeightOffset ?? 0) <= 0 ? `+${Math.abs(settings.blockHeightOffset ?? 0)}px Higher` : `-${settings.blockHeightOffset}px Lower`)}
                </span>
              </div>
              <input
                type="range"
                min="-100"
                max="100"
                step="10"
                value={settings.blockHeightOffset ?? 0}
                onChange={(e) => onUpdateSettings({ blockHeightOffset: parseInt(e.target.value) })}
                className="w-full accent-cyan-400"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>Higher (Eye Level)</span>
                <span>Standard (Chest Level)</span>
                <span>Lower (Waist Level)</span>
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800 cursor-pointer">
                <span className="text-xs font-cyber text-slate-300">Mirror Webcam</span>
                <input
                  type="checkbox"
                  checked={settings.cameraMirror}
                  onChange={(e) => onUpdateSettings({ cameraMirror: e.target.checked })}
                  className="w-4 h-4 accent-cyan-400"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800 cursor-pointer">
                <span className="text-xs font-cyber text-slate-300">PIP Camera Widget</span>
                <input
                  type="checkbox"
                  checked={settings.showCameraPreview}
                  onChange={(e) => onUpdateSettings({ showCameraPreview: e.target.checked })}
                  className="w-4 h-4 accent-cyan-400"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800 cursor-pointer col-span-1 sm:col-span-2">
                <span className="text-xs font-cyber text-slate-300">Show Hand Skeleton Dots</span>
                <input
                  type="checkbox"
                  checked={settings.showDebugSkeleton}
                  onChange={(e) => onUpdateSettings({ showDebugSkeleton: e.target.checked })}
                  className="w-4 h-4 accent-cyan-400"
                />
              </label>
            </div>
          </div>

          {/* Section 2: Saber Blade Customization */}
          <div className="space-y-4">
            <h4 className="text-xs font-cyber font-bold tracking-wider text-rose-400 uppercase flex items-center gap-2">
              <Zap className="w-4 h-4" />
              LASER SABER CONFIG
            </h4>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-cyber">
                <span className="text-slate-300">Blade Length</span>
                <span className="text-rose-400 font-bold">{settings.saberLength}px</span>
              </div>
              <input
                type="range"
                min="140"
                max="300"
                step="10"
                value={settings.saberLength}
                onChange={(e) => onUpdateSettings({ saberLength: parseInt(e.target.value) })}
                className="w-full accent-rose-500"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>Short Katana (140px)</span>
                <span>Standard (220px)</span>
                <span>Long Greatsaber (300px)</span>
              </div>
            </div>
          </div>

          {/* Section 3: Audio & Latency Calibration */}
          <div className="space-y-4">
            <h4 className="text-xs font-cyber font-bold tracking-wider text-purple-400 uppercase flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              AUDIO & LATENCY CALIBRATION
            </h4>

            {/* Latency Offset */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-cyber">
                <span className="text-slate-300">Rhythm Timing Offset</span>
                <span className="text-purple-400 font-bold">
                  {settings.latencyOffsetMs > 0 ? `+${settings.latencyOffsetMs}` : settings.latencyOffsetMs} ms
                </span>
              </div>
              <input
                type="range"
                min="-150"
                max="150"
                step="5"
                value={settings.latencyOffsetMs}
                onChange={(e) => onUpdateSettings({ latencyOffsetMs: parseInt(e.target.value) })}
                className="w-full accent-purple-500"
              />
              <p className="text-[11px] text-slate-400 font-sans">
                Adjust if notes appear slightly earlier or later than the audio beat (useful for Bluetooth headphones).
              </p>
            </div>

            {/* Volume Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-cyber">
                  <span className="text-slate-400">Music Volume</span>
                  <span className="text-white font-bold">{Math.round(settings.musicVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.musicVolume}
                  onChange={(e) => handleVolumeChange('music', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-cyber">
                  <span className="text-slate-400">SFX Volume</span>
                  <span className="text-white font-bold">{Math.round(settings.sfxVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.sfxVolume}
                  onChange={(e) => handleVolumeChange('sfx', parseFloat(e.target.value))}
                  className="w-full accent-rose-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save / Close */}
        <div className="mt-8 pt-4 border-t border-white/10 flex justify-end">
          <button
            id="save-settings-btn"
            onClick={onClose}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-cyan-400 hover:from-pink-400 hover:to-cyan-300 text-black font-cyber font-black text-xs transition-all shadow-[0_0_20px_rgba(34,211,238,0.4)]"
          >
            SAVE & CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
