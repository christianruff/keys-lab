/**
 * Pure playback planning. Converts the same MusicEvent/RealizedNote data the keyboard
 * displays into timed note-on events. The audio engine only ever plays these plans.
 */
import type { MusicEvent } from '../music/exercise'
import type { RealizedNote } from '../music/voicing'

export interface PlayNote {
  midi: number
  /** seconds from plan start */
  time: number
  duration: number
  velocity: number
  /** index of the source event (for keyboard sync) */
  event: number
}

export interface Click {
  time: number
  accent: boolean
}

export interface PlaybackPlan {
  notes: PlayNote[]
  clicks: Click[]
  /** start time (s) of each source event, for highlighting the current chord */
  eventTimes: number[]
  length: number
}

export type PlayMode = 'chord' | 'lh' | 'rh' | 'arpUp' | 'arpDown'

export function selectNotes(notes: RealizedNote[], mode: PlayMode): RealizedNote[] {
  const sorted = [...notes].sort((a, b) => a.midi - b.midi)
  if (mode === 'lh') return sorted.filter((n) => n.hand === 'L')
  if (mode === 'rh') return sorted.filter((n) => n.hand === 'R')
  if (mode === 'arpDown') return sorted.reverse()
  return sorted
}

const beat = (tempo: number) => 60 / Math.max(20, tempo)

/** Plan a single event (chord / one hand / arpeggio). */
export function planEvent(ev: MusicEvent, mode: PlayMode, tempo: number, eventIndex = 0, offset = 0): PlaybackPlan {
  const sel = selectNotes(ev.notes, mode)
  const b = beat(tempo)
  if (mode === 'arpUp' || mode === 'arpDown') {
    const step = b / 2
    const notes = sel.map((n, i) => ({
      midi: n.midi, time: offset + i * step, duration: (sel.length - i) * step + b * 2, velocity: 0.7, event: eventIndex,
    }))
    return { notes, clicks: [], eventTimes: [offset], length: sel.length * step + b * 2 }
  }
  const dur = Math.max(1, ev.beats) * b
  const notes = sel.map((n) => ({ midi: n.midi, time: offset, duration: dur, velocity: n.isBass ? 0.75 : 0.65, event: eventIndex }))
  return { notes, clicks: [], eventTimes: [offset], length: dur }
}

/** Plan a melodic line (scale / arpeggio exercises): up, or up then down. */
export function planLine(ev: MusicEvent, tempo: number, direction: 'up' | 'down' | 'upDown' = 'upDown'): PlaybackPlan {
  const up = [...ev.notes].sort((a, b) => a.midi - b.midi)
  const seq = direction === 'up' ? up : direction === 'down' ? [...up].reverse() : [...up, ...up.slice(0, -1).reverse()]
  const step = beat(tempo) / 2
  const notes = seq.map((n, i) => ({ midi: n.midi, time: i * step, duration: step * 1.6, velocity: 0.65, event: 0 }))
  return { notes, clicks: [], eventTimes: [0], length: seq.length * step + 1 }
}

/** Plan a whole progression with optional count-in and metronome. */
export function planProgression(
  events: MusicEvent[],
  tempo: number,
  opts: { countIn?: boolean; metronome?: boolean; beatsPerBar?: number } = {},
): PlaybackPlan {
  const b = beat(tempo)
  const bpb = opts.beatsPerBar ?? 4
  const clicks: Click[] = []
  let t = 0
  if (opts.countIn) {
    for (let i = 0; i < bpb; i++) clicks.push({ time: i * b, accent: i === 0 })
    t = bpb * b
  }
  const notes: PlayNote[] = []
  const eventTimes: number[] = []
  let beatCount = 0
  events.forEach((ev, i) => {
    eventTimes.push(t)
    const p = planEvent(ev, 'chord', tempo, i, t)
    notes.push(...p.notes)
    if (opts.metronome) {
      for (let k = 0; k < Math.max(1, ev.beats); k++) clicks.push({ time: t + k * b, accent: (beatCount + k) % bpb === 0 })
    }
    beatCount += Math.max(1, ev.beats)
    t += Math.max(1, ev.beats) * b
  })
  return { notes, clicks, eventTimes, length: t + 1.5 }
}

/** MIDI pitches the keyboard highlights for an event. Same source as planEvent. */
export function highlightedMidis(ev: MusicEvent | undefined): number[] {
  return ev ? [...ev.notes].map((n) => n.midi).sort((a, b) => a - b) : []
}
