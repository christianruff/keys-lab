/** Core persisted data model for Keys Lab. Pure data, no behaviour. */

export type Hand = 'L' | 'R'
export type Tonality = 'major' | 'minor' | 'dominant'
export type ExerciseKind = 'voicing' | 'progression' | 'drill' | 'technique'
export type Mastery = 'new' | 'learning' | 'comfortable' | 'fluent'
export type Rating = 'again' | 'hard' | 'good' | 'easy'

/**
 * A voicing is written once as degree formulas per hand, relative to a chord root.
 * Register: notes are stacked upward in the order written, starting at the root
 * placed in `anchorOctave` (e.g. 3 => C3 when the root is C). `+`/`-` suffixes on a
 * token move that note (and everything stacked after it) by an octave.
 * `anchorOctave: null` means the register is unspecified: the voicing is only a set
 * of chord tones and is NOT treated as a playable, fully specified performance.
 */
export interface VoicingDef {
  id: string
  name: string
  /** Chord quality suffix shown after the root, e.g. "m11", "maj9", "7(♭9,♯5)". */
  symbol: string
  lh: string
  rh: string
  /** Optional bass degree, placed below the lowest voiced note. */
  bass?: string
  anchorOctave: number | null
  /** Register constraints: whole voicing is shifted by octaves to fit when possible. */
  minMidi?: number
  maxMidi?: number
  /** "melodic" = scales/arpeggios (played as a line by default). */
  style?: 'harmonic' | 'melodic'
  inversion?: string
  context?: string
}

export interface EventVoicing {
  lh: string
  rh: string
  bass?: string
}

export interface ProgressionEvent {
  id: string
  /** Roman numeral / function, e.g. "ii", "V", "bVI", "#i°". Relative to the major scale of the tonic. */
  roman: string
  /** Quality suffix, e.g. "m7", "7", "maj7", "m7b5", "7alt". Empty = infer from numeral. */
  quality: string
  beats?: number
  /** Optional explicit voicing. Without it, the event is open-ended (free voicing). */
  voicing?: EventVoicing
  /** Octave shift of this chord's root relative to its default placement above the tonic. */
  octave?: number
  /** Optional slash-bass degree relative to the chord root (e.g. "3" for I/3). */
  bass?: string
}

export interface ProgressionDef {
  tonality: 'major' | 'minor'
  /** Octave of the tonic reference; null = no register (open-ended only). */
  anchorOctave: number | null
  events: ProgressionEvent[]
  minMidi?: number
  maxMidi?: number
}

export interface Exercise {
  id: string
  title: string
  kind: ExerciseKind
  category: string
  unit: string
  tags: string[]
  instructions: string
  /** Governs key spelling (e.g. D♭ major vs C♯ minor). */
  tonality: Tonality
  voicings: VoicingDef[]
  progression?: ProgressionDef
  archived: boolean
  /** Starter templates that still need the user's own musical content. */
  template?: boolean
  createdAt: number
  updatedAt: number
}

export interface RatingEntry {
  t: number
  r: Rating
}

/** Progress per exercise-key pair. */
export interface Progress {
  id: string
  exerciseId: string
  /** Pitch class of the key / root, 0 = C. */
  key: number
  attempts: number
  lastAttempt: number | null
  due: number
  /** Current review interval in days. */
  interval: number
  ease: number
  streak: number
  lapses: number
  mastery: Mastery
  history: RatingEntry[]
}

export type KeyMode = 'random' | 'smart' | 'manual'
export type ExerciseMode = 'smart' | 'random' | 'manual'
export type OrderMode = 'byExercise' | 'shuffled'

export interface SessionParams {
  keyCount: number
  exerciseCount: number
  keyMode: KeyMode
  manualKeys: number[]
  exerciseMode: ExerciseMode
  manualExercises: string[]
  categories: string[]
  units: string[]
  masteryFilter: Mastery[]
  mix: Record<Mastery, number>
  order: OrderMode
  /** Repeat every exercise-key pair this many times (explicit request only). */
  rounds: number
  timeTargetMin: number | null
}

export interface Task {
  id: string
  exerciseId: string
  key: number
  round: number
}

export interface Session {
  id: string
  seed: number
  createdAt: number
  updatedAt: number
  params: SessionParams
  keys: number[]
  exerciseIds: string[]
  tasks: Task[]
  /** Active queue of task ids; rated tasks move to the back. */
  queue: string[]
  cursor: number
  ratings: Record<string, Rating>
  /** Per-task rating log within this session. */
  log: { taskId: string; r: Rating; t: number }[]
  status: 'active' | 'finished'
  elapsedMs: number
}

export interface Settings {
  theme: 'system' | 'light' | 'dark'
  practiceMode: 'minimal' | 'keyboard'
  showNoteNames: boolean
  showDegrees: boolean
  showRoman: boolean
  autoplayOnReveal: boolean
  tempo: number
  countIn: boolean
  metronome: boolean
  volume: number
  preferGb: boolean
  keyboardOctaves: number
  keyboardStartOctave: number
  lastParams: SessionParams | null
}
