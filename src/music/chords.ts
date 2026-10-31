/** Chord-quality vocabulary: symbol normalisation and chord-tone formulas (for display only). */
import { prettyAccidentals } from './pitch'

/** Chord tones (as degrees) of common qualities. Used to list chord tones for open-ended events. */
export const QUALITY_TONES: Record<string, string> = {
  '': '1 3 5',
  m: '1 b3 5',
  dim: '1 b3 b5',
  aug: '1 3 #5',
  sus4: '1 4 5',
  sus2: '1 2 5',
  '6': '1 3 5 6',
  m6: '1 b3 5 6',
  '69': '1 3 5 6 9',
  maj7: '1 3 5 7',
  m7: '1 b3 5 b7',
  '7': '1 3 5 b7',
  m7b5: '1 b3 b5 b7',
  dim7: '1 b3 b5 bb7',
  mmaj7: '1 b3 5 7',
  '7sus4': '1 4 5 b7',
  maj9: '1 3 5 7 9',
  m9: '1 b3 5 b7 9',
  '9': '1 3 5 b7 9',
  m11: '1 b3 5 b7 9 11',
  '11': '1 5 b7 9 11',
  '13': '1 3 5 b7 9 13',
  '7b9': '1 3 5 b7 b9',
  '7#9': '1 3 5 b7 #9',
  '7#5': '1 3 #5 b7',
  '7b13': '1 3 5 b7 b13',
  '7#11': '1 3 5 b7 #11',
  '7alt': '1 3 b7 b9 #9 b5 b13',
}

const ALIASES: Record<string, string> = {
  M: '', maj: '', major: '', min: 'm', '-': 'm', minor: 'm',
  M7: 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7', ma7: 'maj7',
  min7: 'm7', '-7': 'm7', 'ø': 'm7b5', 'ø7': 'm7b5', 'm7♭5': 'm7b5', '-7b5': 'm7b5',
  '°': 'dim', o: 'dim', '°7': 'dim7', o7: 'dim7', '+': 'aug',
  'm(maj7)': 'mmaj7', 'mMaj7': 'mmaj7', '6/9': '69', alt: '7alt', '7sus': '7sus4', sus: 'sus4',
}

export function normalizeQuality(q: string): string {
  const t = q.trim().replace(/♭/g, 'b').replace(/♯/g, '#')
  return ALIASES[t] ?? t
}

/** Pretty chord-symbol suffix: m7b5 -> ø7, maj7 -> maj7, b9 -> ♭9 */
export function prettyQuality(q: string): string {
  const n = normalizeQuality(q)
  if (n === 'm7b5') return 'ø7'
  if (n === 'dim7') return '°7'
  if (n === 'dim') return '°'
  if (n === 'mmaj7') return 'm(maj7)'
  if (n === '69') return '6/9'
  return prettyAccidentals(n)
}

export function qualityTones(q: string): string | null {
  return QUALITY_TONES[normalizeQuality(q)] ?? null
}
