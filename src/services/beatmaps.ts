import { BombDensity, CutDirection, DifficultyLevel, Note, SongTrack, TrainConfig, TrainFocus } from '../types';

/**
 * Procedural & Pre-Authored Beatmaps for Beat Slash
 */

function createNote(
  id: string,
  time: number,
  lane: number,
  layer: number,
  color: 'red' | 'blue' | 'bomb',
  direction: CutDirection = 'down',
  type: 'block' | 'bomb' = 'block'
): Note {
  return {
    id,
    time: Math.round(time * 1000) / 1000,
    lane,
    layer,
    type,
    color,
    direction,
  };
}

// Generate structured rhythm patterns for synth tracks
function generateTrackNotes(bpm: number, duration: number, difficulty: DifficultyLevel): Note[] {
  const notes: Note[] = [];
  const beatInterval = 60 / bpm; // duration of 1 quarter beat in seconds
  let noteCounter = 0;

  // Density factor based on difficulty
  const stepRate = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 1 : difficulty === 'hard' ? 0.5 : 0.25;
  const totalBeats = Math.floor(duration / beatInterval);

  // Give a 2.5 second lead-in for player to get ready
  const startBeat = Math.ceil(2.5 / beatInterval);

  // Direction patterns
  const easyDirections: CutDirection[] = ['down', 'up', 'any', 'down'];
  const medDirections: CutDirection[] = ['down', 'up', 'left', 'right', 'any'];
  const hardDirections: CutDirection[] = ['down', 'up', 'left', 'right', 'down-left', 'down-right', 'up-left', 'up-right'];

  const directionsPool = difficulty === 'easy' ? easyDirections : difficulty === 'medium' ? medDirections : hardDirections;

  for (let beat = startBeat; beat < totalBeats - 2; beat += stepRate) {
    const time = beat * beatInterval;
    const bar = Math.floor(beat / 4);
    const beatInBar = beat % 4;

    // Introduce Obstacle Dodge Barriers periodically (every 16 beats)
    const isObstacleWall = (beat % 16 === 8);
    if (isObstacleWall) {
      const isLeftWall = (Math.floor(beat / 16) % 2 === 0);
      notes.push({
        id: `wall-${noteCounter++}`,
        time: Math.round(time * 1000) / 1000,
        lane: isLeftWall ? 0 : 2,
        layer: 0,
        type: 'obstacle',
        color: 'bomb',
        direction: 'any',
        obstacleWidth: 2,
        obstacleHeight: 3,
      });
      continue;
    }

    // Introduce bomb obstacles periodically in hard/expert
    const isBombOpportunity = (difficulty === 'hard' || difficulty === 'expert') && beat % 8 === 6 && Math.random() < 0.35;

    if (isBombOpportunity) {
      const bombLane = Math.floor(Math.random() * 4);
      notes.push(createNote(`bomb-${noteCounter++}`, time, bombLane, 1, 'bomb', 'any', 'bomb'));
      continue;
    }

    // Pattern alternation
    if (difficulty === 'easy') {
      // Alternate red (left) and blue (right) every 2 beats
      const isRed = (Math.floor(beat / 2) % 2 === 0);
      const lane = isRed ? 1 : 2;
      const layer = 1;
      const dir = directionsPool[noteCounter % directionsPool.length];
      notes.push(createNote(`note-${noteCounter++}`, time, lane, layer, isRed ? 'red' : 'blue', dir));
    } else if (difficulty === 'medium') {
      // Quarter beat syncopation
      const isRed = (beat % 2 === 0);
      const lane = isRed ? (beat % 4 === 0 ? 0 : 1) : (beat % 4 === 1 ? 2 : 3);
      const layer = (beat % 3 === 0) ? 0 : (beat % 3 === 1 ? 1 : 2);
      const dir = directionsPool[noteCounter % directionsPool.length];
      notes.push(createNote(`note-${noteCounter++}`, time, lane, layer, isRed ? 'red' : 'blue', dir));

      // Occasional double cut (both hands) on strong drops
      if (bar % 4 === 3 && beatInBar === 0) {
        notes.push(createNote(`note-${noteCounter++}`, time, 0, 1, 'red', 'down'));
        notes.push(createNote(`note-${noteCounter++}`, time, 3, 1, 'blue', 'down'));
      }
    } else if (difficulty === 'hard') {
      // Fast rolling streams & double cuts
      const isRed = Math.random() > 0.5;
      const lane = isRed ? (Math.random() > 0.5 ? 0 : 1) : (Math.random() > 0.5 ? 2 : 3);
      const layer = Math.floor(Math.random() * 3);
      const dir = directionsPool[Math.floor(Math.random() * directionsPool.length)];

      notes.push(createNote(`note-${noteCounter++}`, time, lane, layer, isRed ? 'red' : 'blue', dir));

      // Double slash on downbeats
      if (beatInBar === 0 && Math.random() < 0.6) {
        notes.push(createNote(`note-${noteCounter++}`, time, isRed ? 3 : 0, layer === 0 ? 2 : 0, isRed ? 'blue' : 'red', 'up'));
      }
    } else {
      // Expert: High density cross-overs and rapid cuts
      const laneRed = Math.random() > 0.3 ? 0 : 1;
      const laneBlue = Math.random() > 0.3 ? 3 : 2;
      const dir1 = directionsPool[Math.floor(Math.random() * directionsPool.length)];
      const dir2 = directionsPool[Math.floor(Math.random() * directionsPool.length)];

      if (beat % 1 === 0) {
        // Dual simultaneous notes
        notes.push(createNote(`note-${noteCounter++}`, time, laneRed, Math.floor(Math.random() * 3), 'red', dir1));
        notes.push(createNote(`note-${noteCounter++}`, time, laneBlue, Math.floor(Math.random() * 3), 'blue', dir2));
      } else {
        const isRed = Math.random() > 0.5;
        notes.push(createNote(`note-${noteCounter++}`, time, isRed ? laneRed : laneBlue, 1, isRed ? 'red' : 'blue', dir1));
      }
    }
  }

  return notes;
}

export const PRESET_SONGS: SongTrack[] = [
  {
    id: 'shape-of-you',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    genre: 'Tropical Pop / Dance',
    bpm: 96,
    difficulty: 'medium',
    duration: 65,
    coverColor: '#f59e0b',
    notes: generateTrackNotes(96, 65, 'medium'),
    description: 'Iconic 96 BPM tropical marimba groove with rhythmic saber flows and bounce cuts.',
  },
  {
    id: 'faded',
    title: 'Faded',
    artist: 'Alan Walker',
    genre: 'EDM / Electro Ballad',
    bpm: 90,
    difficulty: 'medium',
    duration: 70,
    coverColor: '#3b82f6',
    notes: generateTrackNotes(90, 70, 'medium'),
    description: 'Haunting 90 BPM F# minor electro ballad with sub-bass drops and precise timing.',
  },
  {
    id: 'believer',
    title: 'Believer',
    artist: 'Imagine Dragons',
    genre: 'Rock / Synth Anthem',
    bpm: 125,
    difficulty: 'hard',
    duration: 60,
    coverColor: '#ef4444',
    notes: generateTrackNotes(125, 60, 'hard'),
    description: 'Pounding 125 BPM march beat featuring intense double cuts and dodge barriers.',
  },
  {
    id: 'blinding-lights',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    genre: 'Synthwave / Retro Pop',
    bpm: 171,
    difficulty: 'expert',
    duration: 60,
    coverColor: '#ec4899',
    notes: generateTrackNotes(171, 60, 'expert'),
    description: 'Ultra fast 171 BPM retro synthwave stream with high-speed cuts and rapid dodge walls.',
  },
  {
    id: 'neon-overdrive',
    title: 'Neon Overdrive',
    artist: 'Cyber Syndicate',
    genre: 'Cyberpunk Electro',
    bpm: 128,
    difficulty: 'medium',
    duration: 65,
    coverColor: '#06b6d4',
    notes: generateTrackNotes(128, 65, 'medium'),
    description: 'Driving 128 BPM electro bass with balanced dual saber flows and neon drops.',
  },
];

export function generateCustomBeatmap(
  bpm: number,
  duration: number,
  difficulty: DifficultyLevel,
  title: string
): SongTrack {
  const notes = generateTrackNotes(bpm, duration, difficulty);
  return {
    id: `custom-${Date.now()}`,
    title,
    artist: 'Custom Upload',
    genre: 'Custom Audio',
    bpm,
    difficulty,
    duration,
    coverColor: '#f59e0b',
    notes,
    isCustom: true,
    description: `Custom uploaded audio map at ${bpm} BPM (${difficulty.toUpperCase()} difficulty)`,
  };
}

export function rebuildNotesForDifficulty(song: SongTrack, difficulty: DifficultyLevel): SongTrack {
  return {
    ...song,
    difficulty,
    notes: generateTrackNotes(song.bpm, song.duration, difficulty),
  };
}

export interface TrainRoutine {
  id: string;
  name: string;
  subtitle: string;
  config: TrainConfig;
  color: string;
  iconType: 'cardio' | 'zen' | 'drill' | 'speed' | 'left' | 'right';
  description: string;
}

export const DEFAULT_TRAIN_ROUTINES: TrainRoutine[] = [
  {
    id: 'endless-cardio',
    name: 'Endless Cardio Marathon',
    subtitle: '128 BPM • Balanced Fitness Flow',
    color: '#06b6d4',
    iconType: 'cardio',
    description: 'Continuous electro groove with full-body dual blade swings. Ideal for high calorie burn and rhythm stamina.',
    config: {
      bpm: 128,
      difficulty: 'medium',
      focus: 'all',
      bombDensity: 'low',
      noFail: true,
      speedRamp: true,
      synthTheme: 'neon-overdrive',
    },
  },
  {
    id: 'zen-rhythm-flow',
    name: 'Zen Flow Meditation',
    subtitle: '110 BPM • Zero-Bomb Chill',
    color: '#10b981',
    iconType: 'zen',
    description: 'Relaxed melodic cuts with zero bomb mines and infinite shield. Get into the zone and practice smooth arm posture.',
    config: {
      bpm: 110,
      difficulty: 'easy',
      focus: 'zen',
      bombDensity: 'none',
      noFail: true,
      speedRamp: false,
      synthTheme: 'cyber-pulse',
    },
  },
  {
    id: 'blade-master-drill',
    name: 'Blade Master Drill',
    subtitle: '140 BPM • High Speed & Angles',
    color: '#ec4899',
    iconType: 'drill',
    description: 'Intense cross-over strikes, rapid 8-way directional cuts, and obstacle dodging for elite precision.',
    config: {
      bpm: 140,
      difficulty: 'hard',
      focus: 'all',
      bombDensity: 'normal',
      noFail: true,
      speedRamp: false,
      synthTheme: 'hyper-velocity',
    },
  },
  {
    id: 'speed-ramp-marathon',
    name: 'Speed Accelerator',
    subtitle: '120-165 BPM • Progressive Ramp',
    color: '#a855f7',
    iconType: 'speed',
    description: 'Begins at a steady 120 BPM and automatically increases tempo every 30 seconds to test your maximum limits.',
    config: {
      bpm: 120,
      difficulty: 'medium',
      focus: 'speed',
      bombDensity: 'low',
      noFail: true,
      speedRamp: true,
      synthTheme: 'quantum-chaos',
    },
  },
  {
    id: 'left-blade-isolator',
    name: 'Left Hand Gym',
    subtitle: '124 BPM • Pink Blade Isolation',
    color: '#f43f5e',
    iconType: 'left',
    description: 'Targets and isolates your left arm and shoulder reflex with 100% left-side pink strike targets.',
    config: {
      bpm: 124,
      difficulty: 'medium',
      focus: 'left',
      bombDensity: 'none',
      noFail: true,
      speedRamp: false,
      synthTheme: 'neon-overdrive',
    },
  },
  {
    id: 'right-blade-isolator',
    name: 'Right Hand Gym',
    subtitle: '124 BPM • Cyan Blade Isolation',
    color: '#38bdf8',
    iconType: 'right',
    description: 'Targets and isolates your right arm and wrist velocity with 100% right-side cyan strike targets.',
    config: {
      bpm: 124,
      difficulty: 'medium',
      focus: 'right',
      bombDensity: 'none',
      noFail: true,
      speedRamp: false,
      synthTheme: 'hyper-velocity',
    },
  },
];

/**
 * Generate a procedural chunk of notes for Endless Train Mode
 */
export function generateEndlessNotesChunk(
  startBeat: number,
  numBeats: number,
  bpm: number,
  difficulty: DifficultyLevel,
  focus: TrainFocus,
  bombDensity: BombDensity,
  noteCounterStart: number = 0
): { notes: Note[]; nextStartBeat: number; nextCounter: number } {
  const notes: Note[] = [];
  const beatInterval = 60 / bpm;
  let counter = noteCounterStart;

  const stepRate = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 1 : difficulty === 'hard' ? 0.5 : 0.25;

  const easyDirections: CutDirection[] = ['down', 'up', 'any', 'down'];
  const medDirections: CutDirection[] = ['down', 'up', 'left', 'right', 'any'];
  const hardDirections: CutDirection[] = ['down', 'up', 'left', 'right', 'down-left', 'down-right', 'up-left', 'up-right'];
  const directionsPool = difficulty === 'easy' ? easyDirections : difficulty === 'medium' ? medDirections : hardDirections;

  const bombChance = bombDensity === 'none' || focus === 'zen' ? 0 : bombDensity === 'low' ? 0.15 : 0.3;

  for (let beat = startBeat; beat < startBeat + numBeats; beat += stepRate) {
    const time = beat * beatInterval;
    const bar = Math.floor(beat / 4);
    const beatInBar = beat % 4;

    // Periodic 3D Obstacle Dodge Barrier placement (every 16 beats)
    // Spawns holographic hazard walls forcing player to physically lean left or right to avoid bumping!
    const isObstacleWall = (Math.floor(beat) % 16 === 8) && (beat - Math.floor(beat) < stepRate / 2);
    if (isObstacleWall) {
      const isLeftWall = (Math.floor(beat / 16) % 2 === 0);
      let wallLane = isLeftWall ? 0 : 2;
      if (focus === 'left') {
        wallLane = 0; // Wall on left side: player must dodge/lean right!
      } else if (focus === 'right') {
        wallLane = 2; // Wall on right side: player must dodge/lean left!
      }

      notes.push({
        id: `train-wall-${counter++}`,
        time: Math.round(time * 1000) / 1000,
        lane: wallLane,
        layer: 0,
        type: 'obstacle',
        color: 'bomb',
        direction: 'any',
        obstacleWidth: 2,
        obstacleHeight: 3,
      });
      continue;
    }

    // Periodic bomb placement
    if (bombChance > 0 && beat % 8 === 6 && Math.random() < bombChance) {
      const bombLane = focus === 'left' ? 0 : focus === 'right' ? 3 : Math.floor(Math.random() * 4);
      notes.push(createNote(`train-bomb-${counter++}`, time, bombLane, 1, 'bomb', 'any', 'bomb'));
      continue;
    }

    if (focus === 'left') {
      // 100% Left/Pink notes (Lanes 0 and 1)
      const lane = beat % 2 === 0 ? 0 : 1;
      const layer = Math.floor((beat / 2) % 3);
      const dir = directionsPool[counter % directionsPool.length];
      notes.push(createNote(`train-note-${counter++}`, time, lane, layer, 'red', dir));
    } else if (focus === 'right') {
      // 100% Right/Cyan notes (Lanes 2 and 3)
      const lane = beat % 2 === 0 ? 3 : 2;
      const layer = Math.floor((beat / 2) % 3);
      const dir = directionsPool[counter % directionsPool.length];
      notes.push(createNote(`train-note-${counter++}`, time, lane, layer, 'blue', dir));
    } else if (focus === 'zen') {
      // Smooth alternating notes
      const isRed = Math.floor(beat / 2) % 2 === 0;
      const lane = isRed ? 1 : 2;
      const layer = 1;
      const dir = directionsPool[counter % directionsPool.length];
      notes.push(createNote(`train-note-${counter++}`, time, lane, layer, isRed ? 'red' : 'blue', dir));
    } else if (focus === 'speed') {
      // Rapid alternating streams
      const isRed = Math.floor(beat / stepRate) % 2 === 0;
      const lane = isRed ? (beat % 2 === 0 ? 1 : 0) : (beat % 2 === 0 ? 2 : 3);
      const layer = (beat % 3 === 0) ? 0 : 1;
      const dir: CutDirection = beat % 2 === 0 ? 'down' : 'up';
      notes.push(createNote(`train-note-${counter++}`, time, lane, layer, isRed ? 'red' : 'blue', dir));
    } else {
      // All-Round balanced dual blade
      if (difficulty === 'easy') {
        const isRed = Math.floor(beat / 2) % 2 === 0;
        const lane = isRed ? 1 : 2;
        const layer = 1;
        const dir = directionsPool[counter % directionsPool.length];
        notes.push(createNote(`train-note-${counter++}`, time, lane, layer, isRed ? 'red' : 'blue', dir));
      } else if (difficulty === 'medium') {
        const isRed = beat % 2 === 0;
        const lane = isRed ? (beat % 4 === 0 ? 0 : 1) : (beat % 4 === 1 ? 2 : 3);
        const layer = (beat % 3 === 0) ? 0 : (beat % 3 === 1 ? 1 : 2);
        const dir = directionsPool[counter % directionsPool.length];
        notes.push(createNote(`train-note-${counter++}`, time, lane, layer, isRed ? 'red' : 'blue', dir));

        if (bar % 4 === 3 && beatInBar === 0) {
          notes.push(createNote(`train-note-${counter++}`, time, 0, 1, 'red', 'down'));
          notes.push(createNote(`train-note-${counter++}`, time, 3, 1, 'blue', 'down'));
        }
      } else {
        const isRed = Math.random() > 0.5;
        const lane = isRed ? (Math.random() > 0.5 ? 0 : 1) : (Math.random() > 0.5 ? 2 : 3);
        const layer = Math.floor(Math.random() * 3);
        const dir = directionsPool[Math.floor(Math.random() * directionsPool.length)];
        notes.push(createNote(`train-note-${counter++}`, time, lane, layer, isRed ? 'red' : 'blue', dir));

        if (beatInBar === 0 && Math.random() < 0.5) {
          notes.push(createNote(`train-note-${counter++}`, time, isRed ? 3 : 0, layer === 0 ? 2 : 0, isRed ? 'blue' : 'red', 'up'));
        }
      }
    }
  }

  return {
    notes,
    nextStartBeat: startBeat + numBeats,
    nextCounter: counter,
  };
}
