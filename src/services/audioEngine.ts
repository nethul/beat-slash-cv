/**
 * Web Audio Procedural Synthwave/EDM Music Engine & Zero-Latency SFX
 */

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Custom audio playback
  private customBufferSource: AudioBufferSourceNode | null = null;
  private customAudioBuffer: AudioBuffer | null = null;

  // Synth sequencer state
  private isPlaying = false;
  private currentBpm = 128;
  private currentTrackId = '';
  private synthTimer: number | null = null;
  private startTime = 0;
  private pauseOffset = 0;
  private currentStep = 0;

  // Volumes
  private sfxVol = 0.8;
  private musicVol = 0.7;

  constructor() {
    // Lazy initialize on first user gesture
  }

  public init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();

      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;

      this.musicGain.gain.value = this.musicVol;
      this.sfxGain.gain.value = this.sfxVol;

      this.musicGain.connect(this.analyser);
      this.analyser.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolumes(music: number, sfx: number) {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (this.musicGain) this.musicGain.gain.value = music;
    if (this.sfxGain) this.sfxGain.gain.value = sfx;
  }

  public getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  public getAnalyserData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(32);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  public getCurrentTime(): number {
    if (!this.isPlaying) return this.pauseOffset;
    if (!this.ctx) return 0;
    return this.ctx.currentTime - this.startTime + this.pauseOffset;
  }

  // --- SOUND EFFECTS ---

  public playSliceSound(color: 'red' | 'blue', accuracy: number = 80, speed: number = 1) {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // 1. High energy laser blade whoosh/chime
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();

    const baseFreq = color === 'red' ? 440 : 587.33; // A4 vs D5
    const pitchOffset = (accuracy / 100) * 200; // Pitch higher for crisp perfect cut
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(baseFreq + pitchOffset, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2 + pitchOffset, now + 0.08);

    // Bandpass filter for laser sharpness
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200 + pitchOffset * 2, now);
    filter.Q.setValueAtTime(3.5, now);

    const gainPeak = Math.min(1.0, 0.4 + speed * 0.2);
    oscGain.gain.setValueAtTime(gainPeak, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.13);

    // 2. High-frequency metallic snap / impact
    const snap = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snap.type = 'triangle';
    snap.frequency.setValueAtTime(800 + pitchOffset * 3, now);
    snap.frequency.exponentialRampToValueAtTime(150, now + 0.05);

    snapGain.gain.setValueAtTime(0.3, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    snap.connect(snapGain);
    snapGain.connect(this.sfxGain);

    snap.start(now);
    snap.stop(now + 0.06);
  }

  public playBombExplosion() {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Noise buffer for explosion
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.08));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.linearRampToValueAtTime(80, now + 0.35);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);

    // Sub-bass drop
    const osc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);

    subGain.gain.setValueAtTime(0.8, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(subGain);
    subGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playMissSound() {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.15);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playWhoosh(speed: number) {
    if (!this.ctx || !this.sfxGain || speed < 1.2) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(250 + Math.min(speed * 80, 500), now);
    osc.frequency.linearRampToValueAtTime(150, now + 0.08);

    gain.gain.setValueAtTime(Math.min(0.15, speed * 0.03), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playComboStreak(combo: number) {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const chords = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    chords.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.25, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.2);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.22);
    });
  }

  // --- PROCEDURAL SYNTH TRACK ENGINE ---

  public playTrack(trackId: string, bpm: number, customAudioBuffer?: AudioBuffer, loopCustom: boolean = false) {
    this.init();
    this.stopTrack();

    this.currentTrackId = trackId;
    this.currentBpm = bpm;
    this.isPlaying = true;
    this.startTime = this.ctx!.currentTime;
    this.pauseOffset = 0;
    this.currentStep = 0;

    if (customAudioBuffer) {
      this.customAudioBuffer = customAudioBuffer;
      this.playCustomBuffer(loopCustom);
    } else {
      this.startSynthLoop();
    }
  }

  public setBpm(newBpm: number) {
    this.currentBpm = Math.max(60, Math.min(220, newBpm));
  }

  public getBpm(): number {
    return this.currentBpm;
  }

  private playCustomBuffer(loop: boolean = false) {
    if (!this.ctx || !this.customAudioBuffer || !this.musicGain) return;
    this.customBufferSource = this.ctx.createBufferSource();
    this.customBufferSource.buffer = this.customAudioBuffer;
    this.customBufferSource.loop = loop;
    this.customBufferSource.connect(this.musicGain);
    this.customBufferSource.start(0, this.pauseOffset);
  }

  public async loadCustomAudioFile(file: File): Promise<AudioBuffer> {
    this.init();
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await this.ctx!.decodeAudioData(arrayBuffer);
    this.customAudioBuffer = decoded;
    return decoded;
  }

  public stopTrack() {
    this.isPlaying = false;
    if (this.synthTimer) {
      window.clearTimeout(this.synthTimer);
      this.synthTimer = null;
    }
    if (this.customBufferSource) {
      try {
        this.customBufferSource.stop();
        this.customBufferSource.disconnect();
      } catch {
        // Already stopped
      }
      this.customBufferSource = null;
    }
  }

  private startSynthLoop() {
    if (!this.isPlaying || !this.ctx) return;

    const scheduleAheadTime = 0.2;
    let nextStepTime = this.ctx.currentTime;

    const scheduleNotes = () => {
      if (!this.isPlaying || !this.ctx) return;
      const stepDuration = 60 / (this.currentBpm * 4); // in seconds

      while (nextStepTime < this.ctx.currentTime + scheduleAheadTime) {
        this.playSynthStep(this.currentStep, nextStepTime, this.currentTrackId);
        this.currentStep = (this.currentStep + 1) % 64; // 4 bar loop pattern
        nextStepTime += stepDuration;
      }

      this.synthTimer = window.setTimeout(scheduleNotes, 40);
    };

    scheduleNotes();
  }

  private playSynthStep(step: number, time: number, trackId: string) {
    if (!this.ctx || !this.musicGain) return;

    // Bass patterns
    const isQuarter = step % 4 === 0;
    const isOffbeat = step % 4 === 2;
    const is16th = step % 2 === 0;

    // Track sound presets
    switch (trackId) {
      case 'neon-overdrive':
        this.synthNeonOverdrive(step, time, isQuarter, isOffbeat, is16th);
        break;
      case 'hyper-velocity':
        this.synthHyperVelocity(step, time, isQuarter, isOffbeat, is16th);
        break;
      case 'cyber-pulse':
        this.synthCyberPulse(step, time, isQuarter, isOffbeat, is16th);
        break;
      case 'quantum-chaos':
        this.synthQuantumChaos(step, time, isQuarter, isOffbeat, is16th);
        break;
      default:
        this.synthNeonOverdrive(step, time, isQuarter, isOffbeat, is16th);
        break;
    }
  }

  // Neon Overdrive: Driving 4-on-floor Cyberpunk Electro
  private synthNeonOverdrive(step: number, time: number, isQuarter: boolean, isOffbeat: boolean, is16th: boolean) {
    if (isQuarter) {
      this.triggerKick(time, 130, 45, 0.16, 0.85);
    }
    if (step % 8 === 4) {
      this.triggerSnare(time, 220, 0.18, 0.6);
    }
    if (isOffbeat || step % 4 === 1 || step % 4 === 3) {
      this.triggerHiHat(time, isOffbeat ? 0.08 : 0.03, isOffbeat ? 0.35 : 0.18);
    }

    // Rolling bassline: Root changes every 16 steps (1 bar)
    // Progression: Am -> F -> C -> G
    const rootNotes = [110, 87.31, 130.81, 98.00]; // A2, F2, C3, G2
    const currentRoot = rootNotes[Math.floor(step / 16) % 4];

    if (is16th) {
      const octaveMod = step % 4 === 2 ? 2 : 1;
      this.triggerSynthBass(time, currentRoot * octaveMod, 0.12, 'sawtooth', 700);
    }

    // Lead Arpeggio
    const arpNotes = [440, 523.25, 659.25, 783.99, 880, 659.25, 587.33, 523.25];
    if (step % 2 === 0) {
      const note = arpNotes[(step / 2) % arpNotes.length];
      this.triggerPluckLead(time, note, 0.1, 0.22);
    }
  }

  // Hyper Velocity: 140 BPM Fast Synthwave
  private synthHyperVelocity(step: number, time: number, isQuarter: boolean, isOffbeat: boolean, is16th: boolean) {
    if (isQuarter) {
      this.triggerKick(time, 145, 50, 0.14, 0.9);
    }
    if (step % 8 === 4) {
      this.triggerSnare(time, 260, 0.15, 0.7);
    }
    if (step % 2 === 1) {
      this.triggerHiHat(time, 0.04, 0.25);
    }

    // D minor synthwave progression: Dm -> Bb -> C -> A
    const bassline = [73.42, 58.27, 65.41, 55.00]; // D2, Bb1, C2, A1
    const currentRoot = bassline[Math.floor(step / 16) % 4];

    if (is16th) {
      const pitch = step % 4 === 0 ? currentRoot : currentRoot * 2;
      this.triggerSynthBass(time, pitch, 0.1, 'square', 900);
    }

    // Laser Stabs every 4 beats
    if (step % 8 === 0 || step % 8 === 3 || step % 8 === 6) {
      const chords = [587.33, 698.46, 880]; // Dm chord
      this.triggerLaserStab(time, chords[(step % 3)], 0.18, 0.3);
    }
  }

  // Cyber Pulse: 110 BPM Chill Melodic Groove
  private synthCyberPulse(step: number, time: number, isQuarter: boolean, isOffbeat: boolean, is16th: boolean) {
    if (isQuarter) {
      this.triggerKick(time, 110, 40, 0.2, 0.75);
    }
    if (step % 8 === 4) {
      this.triggerSnare(time, 190, 0.22, 0.5);
    }
    if (step % 2 === 0) {
      this.triggerHiHat(time, 0.05, 0.2);
    }

    // Chilled progression: Em -> G -> D -> C
    const bassRoots = [82.41, 98.00, 73.42, 65.41];
    const root = bassRoots[Math.floor(step / 16) % 4];

    if (isQuarter || isOffbeat) {
      this.triggerSynthBass(time, root, 0.22, 'triangle', 450);
    }

    // Warm pad / melody
    if (step % 4 === 0) {
      this.triggerPluckLead(time, root * 4, 0.35, 0.25);
    }
  }

  // Quantum Chaos: 160 BPM Drum & Bass / Breakbeat
  private synthQuantumChaos(step: number, time: number, isQuarter: boolean, isOffbeat: boolean, is16th: boolean) {
    // DnB Break rhythm: Kick on 0, 10; Snare on 4, 12
    const isDnbKick = step % 16 === 0 || step % 16 === 10;
    const isDnbSnare = step % 16 === 4 || step % 16 === 12;

    if (isDnbKick) {
      this.triggerKick(time, 160, 55, 0.12, 0.95);
    }
    if (isDnbSnare) {
      this.triggerSnare(time, 320, 0.12, 0.8);
    }
    if (step % 2 === 1) {
      this.triggerHiHat(time, 0.025, 0.3);
    }

    // Reese Bass glide
    if (step % 16 === 0 || step % 16 === 8) {
      this.triggerReeseBass(time, 55, 0.45); // A1 reese
    }

    // Fast acid arpeggio
    const acidNotes = [220, 261.63, 329.63, 392.00, 440, 523.25];
    if (step % 2 === 0) {
      this.triggerPluckLead(time, acidNotes[(step / 2) % acidNotes.length], 0.06, 0.28);
    }
  }

  // --- SYNTH COMPONENTS ---

  private triggerKick(time: number, startFreq: number, endFreq: number, duration: number, gainVal: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + duration);

    gain.gain.setValueAtTime(gainVal, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  private triggerSnare(time: number, noiseFreq: number, duration: number, gainVal: number) {
    if (!this.ctx || !this.musicGain) return;

    // Tone body
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(60, time + duration * 0.7);

    oscGain.gain.setValueAtTime(gainVal * 0.7, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.7);

    osc.connect(oscGain);
    oscGain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + duration * 0.7);

    // Noise snap
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(noiseFreq, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(gainVal * 0.6, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.musicGain);

    noise.start(time);
  }

  private triggerHiHat(time: number, duration: number, gainVal: number) {
    if (!this.ctx || !this.musicGain) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainVal, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    noise.start(time);
  }

  private triggerSynthBass(time: number, freq: number, duration: number, type: OscillatorType, filterCutoff: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterCutoff, time);
    filter.frequency.exponentialRampToValueAtTime(100, time + duration);

    gain.gain.setValueAtTime(0.45, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  private triggerPluckLead(time: number, freq: number, duration: number, gainVal: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, time);
    filter.frequency.exponentialRampToValueAtTime(400, time + duration);

    gain.gain.setValueAtTime(gainVal, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  private triggerLaserStab(time: number, freq: number, duration: number, gainVal: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * 1.5, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.05);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1800, time);
    filter.Q.setValueAtTime(4, time);

    gain.gain.setValueAtTime(gainVal, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  private triggerReeseBass(time: number, freq: number, duration: number) {
    if (!this.ctx || !this.musicGain) return;
    // Detuned dual sawtooth oscillators for fat DnB reese bass
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq + 1.2, time); // detune

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, time);
    filter.frequency.linearRampToValueAtTime(200, time + duration);

    gain.gain.setValueAtTime(0.4, time);
    gain.gain.linearRampToValueAtTime(0.001, time + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration);
    osc2.stop(time + duration);
  }
}

export const soundManager = new AudioEngine();
