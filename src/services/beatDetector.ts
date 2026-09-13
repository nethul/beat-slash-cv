import { CutDirection, DifficultyLevel, Note } from '../types';

export interface DetectedBeat {
  timestamp: number; // in seconds
  intensity: number; // 0.0 to 1.0
  band: 'bass' | 'mid' | 'high';
}

/**
 * Web Audio Sub-Band Spectral Energy Onset & Beat Detector
 * Performs offline signal analysis on an AudioBuffer to extract precise beat timestamps.
 */
export class BeatDetector {
  /**
   * Analyzes an AudioBuffer and returns an array of detected beats with millisecond precision.
   */
  public static analyzeAudioBuffer(buffer: AudioBuffer): DetectedBeat[] {
    const channelData = buffer.getChannelData(0); // Mono channel
    const sampleRate = buffer.sampleRate;
    const windowSize = Math.floor(sampleRate * 0.02); // 20ms analysis window
    const hopSize = Math.floor(sampleRate * 0.01); // 10ms hop
    const totalWindows = Math.floor((channelData.length - windowSize) / hopSize);

    // Compute Low Bass Energy (Kick), Mid Energy (Snare/Vocal), and High Energy (Hats)
    const bassEnergies: number[] = new Array(totalWindows);
    const midEnergies: number[] = new Array(totalWindows);

    // Simple IIR Filter Coeffs for Bass (< 250Hz) and Mid (250Hz - 3000Hz)
    let bassPrev = 0;
    let midPrev = 0;

    for (let w = 0; w < totalWindows; w++) {
      const offset = w * hopSize;
      let bassSum = 0;
      let midSum = 0;

      for (let i = 0; i < windowSize; i++) {
        const sample = channelData[offset + i];

        // Low-pass filter approximation for bass
        bassPrev = bassPrev + 0.12 * (sample - bassPrev);
        bassSum += bassPrev * bassPrev;

        // Band-pass filter approximation for mid
        const midSample = sample - bassPrev;
        midPrev = midPrev + 0.25 * (midSample - midPrev);
        midSum += midPrev * midPrev;
      }

      bassEnergies[w] = Math.sqrt(bassSum / windowSize);
      midEnergies[w] = Math.sqrt(midSum / windowSize);
    }

    const detectedBeats: DetectedBeat[] = [];
    const historyWindow = 43; // ~430ms local average window
    const minBeatGap = 0.22; // Minimum gap between consecutive notes (~270 BPM max)
    let lastBeatTime = -1;

    for (let w = historyWindow; w < totalWindows - historyWindow; w++) {
      const timestamp = (w * hopSize) / sampleRate;
      if (timestamp < 2.0) continue; // Lead-in gap for game start

      // Local average energy
      let localBassAvg = 0;
      for (let i = w - historyWindow; i < w + historyWindow; i++) {
        localBassAvg += bassEnergies[i];
      }
      localBassAvg /= (historyWindow * 2);

      const bassEnergy = bassEnergies[w];
      const C_bass = 1.38; // Dynamic threshold multiplier

      // Bass Kick Onset Peak Detection
      if (bassEnergy > C_bass * localBassAvg && bassEnergy > 0.05) {
        if (timestamp - lastBeatTime >= minBeatGap) {
          const intensity = Math.min(1.0, (bassEnergy - localBassAvg) / 0.2);
          detectedBeats.push({
            timestamp,
            intensity,
            band: 'bass',
          });
          lastBeatTime = timestamp;
        }
      }
    }

    return detectedBeats;
  }

  /**
   * Generates a fully synced Beat Slash note map from detected audio beats.
   */
  public static generateBeatmapFromDetectedBeats(
    beats: DetectedBeat[],
    difficulty: DifficultyLevel = 'medium'
  ): Note[] {
    const notes: Note[] = [];
    let noteCounter = 0;
    let isRed = true;

    // Density filter step based on difficulty
    const stepRatio = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 2 : 1;

    beats.forEach((beat, idx) => {
      if (idx % stepRatio !== 0) return;

      const time = beat.timestamp;
      const isDual = (difficulty === 'hard' || difficulty === 'expert') && beat.intensity > 0.7 && (idx % 4 === 0);
      const isObstacleWall = (difficulty === 'medium' || difficulty === 'hard' || difficulty === 'expert') && (idx % 16 === 8);

      if (isObstacleWall) {
        notes.push({
          id: `wall-${noteCounter++}`,
          time,
          lane: isRed ? 0 : 2,
          layer: 0,
          type: 'obstacle',
          color: 'bomb',
          direction: 'any',
          obstacleWidth: 2,
          obstacleHeight: 3,
        });
        return;
      }

      if (isDual) {
        // Dual Saber simultaneous slice
        notes.push({
          id: `note-${noteCounter++}`,
          time,
          lane: 0,
          layer: 1,
          type: 'block',
          color: 'red',
          direction: 'any',
        });
        notes.push({
          id: `note-${noteCounter++}`,
          time,
          lane: 3,
          layer: 1,
          type: 'block',
          color: 'blue',
          direction: 'any',
        });
      } else {
        // Alternating Red / Blue slice
        const lane = isRed ? (idx % 4 === 0 ? 0 : 1) : (idx % 4 === 1 ? 2 : 3);
        const layer = (idx % 3 === 0) ? 0 : (idx % 3 === 1 ? 1 : 2);

        notes.push({
          id: `note-${noteCounter++}`,
          time,
          lane,
          layer,
          type: 'block',
          color: isRed ? 'red' : 'blue',
          direction: 'any',
        });
        isRed = !isRed;
      }
    });

    return notes;
  }
}
