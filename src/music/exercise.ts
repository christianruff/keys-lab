/**
 * Bridges stored exercises to concrete musical content in a given key.
 * Produces a uniform list of harmonic events consumed by BOTH the keyboard and audio.
 */
import { tonicSpelling, type KeyPrefs } from './keys'
import { spelledName } from './pitch'
import { prettyQuality } from './chords'
import { realizeVoicing, type ChordTone, type RealizedNote } from './voicing'
import { realizeProgression } from './progression'
import type { Exercise } from '../model/types'

export interface MusicEvent {
  label: string
  roman?: string
  notes: RealizedNote[]
  beats: number
  complete: boolean
  openEnded: boolean
  tones: ChordTone[]
}

export interface RealizedExercise {
  keyName: string
  /** Headline symbol, e.g. "E♭m11" or "ii–V–I in E♭" */
  heading: string
  events: MusicEvent[]
  /** True when there is an explicit, playable answer for every event. */
  hasAnswer: boolean
  /** Some content exists but without a fully specified register / voicing. */
  incompleteReason?: string
  melodic: boolean
  errors: string[]
}

export function realizeExercise(ex: Exercise, key: number, prefs: KeyPrefs = {}, variant = 0): RealizedExercise {
  const tonic = tonicSpelling(key, ex.tonality, prefs)
  const keyName = spelledName(tonic)
  if (ex.progression && ex.progression.events.length && ex.kind !== 'voicing') {
    const p = realizeProgression(ex.progression, tonic)
    return {
      keyName,
      heading: `${p.events.map((e) => e.roman).join('–')} in ${keyName}${ex.progression.tonality === 'minor' ? ' minor' : ''}`,
      events: p.events.map((e) => ({
        label: e.symbol, roman: e.roman, notes: e.notes, beats: e.beats, complete: e.complete, openEnded: e.openEnded, tones: e.tones,
      })),
      hasAnswer: p.complete,
      incompleteReason: p.complete
        ? undefined
        : p.openEnded
          ? 'Open-ended: choose your own voicings for these chord functions'
          : 'Some chords lack a specified register',
      melodic: false,
      errors: p.errors,
    }
  }
  const v = ex.voicings[Math.min(variant, ex.voicings.length - 1)]
  if (!v) {
    return { keyName, heading: keyName, events: [], hasAnswer: false, melodic: false, errors: [] }
  }
  const r = realizeVoicing(v, tonic)
  const label = v.style === 'melodic' ? `${keyName} ${v.symbol}`.trim() : keyName + prettyQuality(v.symbol)
  return {
    keyName,
    heading: label,
    events: [{ label, notes: r.notes, beats: 4, complete: r.complete, openEnded: false, tones: r.tones }],
    hasAnswer: r.complete,
    incompleteReason: r.incompleteReason,
    melodic: v.style === 'melodic',
    errors: r.errors,
  }
}
