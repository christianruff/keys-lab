/** The twelve keys and their context-dependent tonic spellings. */
import { parseSpelled, spelledName, type Spelled } from './pitch'
import type { Tonality } from '../model/types'

const MAJOR = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const MINOR = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']

export const ALL_KEYS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

export interface KeyPrefs {
  preferGb?: boolean
}

/** Tonic spelling of a key given the exercise's tonal context. */
export function tonicSpelling(pc: number, tonality: Tonality, prefs: KeyPrefs = {}): Spelled {
  if (tonality !== 'minor' && pc === 6 && prefs.preferGb) return parseSpelled('Gb')
  return parseSpelled((tonality === 'minor' ? MINOR : MAJOR)[pc])
}

export function keyLabel(pc: number, tonality: Tonality = 'major', prefs: KeyPrefs = {}): string {
  return spelledName(tonicSpelling(pc, tonality, prefs))
}
