/**
 * Pitch primitives. Distinguishes:
 *  - spelled pitch class (letter + accidental, e.g. E♭)
 *  - absolute note name (spelled pitch + octave, e.g. E♭4)
 *  - MIDI note number (63)
 * Octave convention: MIDI 60 = C4.
 */

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
export const LETTER_PC = [0, 2, 4, 5, 7, 9, 11] as const

export interface Spelled {
  /** 0..6 index into LETTERS */
  letter: number
  /** -2..2 (double flat .. double sharp) */
  acc: number
}

export const mod = (n: number, m: number) => ((n % m) + m) % m

export function pcOf(s: Spelled): number {
  return mod(LETTER_PC[s.letter] + s.acc, 12)
}

const ACC_UNICODE: Record<string, string> = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' }
const ACC_ASCII: Record<string, string> = { '-2': 'bb', '-1': 'b', '0': '', '1': '#', '2': '##' }

export function accidentalText(acc: number, ascii = false): string {
  const t = (ascii ? ACC_ASCII : ACC_UNICODE)[String(acc)]
  if (t === undefined) throw new Error(`Unsupported accidental ${acc}`)
  return t
}

export function spelledName(s: Spelled, ascii = false): string {
  return LETTERS[s.letter] + accidentalText(s.acc, ascii)
}

/** Parse "C", "Eb", "F#", "Bbb", "E♭", "F♯" (no octave). */
export function parseSpelled(text: string): Spelled {
  const m = /^([A-Ga-g])(bb|b|##|#|x|♭♭|♭|♯♯|♯|𝄫|𝄪)?$/.exec(text.trim())
  if (!m) throw new Error(`Invalid note name: ${text}`)
  const letter = LETTERS.indexOf(m[1].toUpperCase() as (typeof LETTERS)[number])
  const a = m[2] ?? ''
  const acc =
    a === '' ? 0 : a === 'b' || a === '♭' ? -1 : a === 'bb' || a === '♭♭' || a === '𝄫' ? -2 : a === '#' || a === '♯' ? 1 : 2
  return { letter, acc }
}

/** MIDI number of a spelled pitch in a given octave (B♯3 = 60, C♭4 = 59). */
export function midiOf(s: Spelled, octave: number): number {
  return 12 * (octave + 1) + LETTER_PC[s.letter] + s.acc
}

/** Octave number of a MIDI pitch as spelled by `s` (written octave follows the letter). */
export function octaveOf(midi: number, s: Spelled): number {
  return Math.floor((midi - s.acc) / 12) - 1
}

export function noteName(midi: number, s: Spelled, ascii = false): string {
  if (mod(midi, 12) !== pcOf(s)) throw new Error(`Spelling ${spelledName(s)} does not match MIDI ${midi}`)
  return spelledName(s, ascii) + octaveOf(midi, s)
}

/** Default (context-free) spelling for a MIDI note: sharps for black keys unless preferFlats. */
export function defaultSpelling(pc: number, preferFlats = true): Spelled {
  const sharp: Spelled[] = [
    { letter: 0, acc: 0 }, { letter: 0, acc: 1 }, { letter: 1, acc: 0 }, { letter: 1, acc: 1 },
    { letter: 2, acc: 0 }, { letter: 3, acc: 0 }, { letter: 3, acc: 1 }, { letter: 4, acc: 0 },
    { letter: 4, acc: 1 }, { letter: 5, acc: 0 }, { letter: 5, acc: 1 }, { letter: 6, acc: 0 },
  ]
  const flat: Spelled[] = [
    { letter: 0, acc: 0 }, { letter: 1, acc: -1 }, { letter: 1, acc: 0 }, { letter: 2, acc: -1 },
    { letter: 2, acc: 0 }, { letter: 3, acc: 0 }, { letter: 4, acc: -1 }, { letter: 4, acc: 0 },
    { letter: 5, acc: -1 }, { letter: 5, acc: 0 }, { letter: 6, acc: -1 }, { letter: 6, acc: 0 },
  ]
  return (preferFlats ? flat : sharp)[mod(pc, 12)]
}

export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(mod(midi, 12))
}

/** Pretty-print ASCII accidentals in free text (b3 -> ♭3, #11 -> ♯11). */
export function prettyAccidentals(text: string): string {
  return text
    .replace(/bb(?=\d)/g, '𝄫')
    .replace(/b(?=\d)/g, '♭')
    .replace(/##(?=\d)/g, '𝄪')
    .replace(/#/g, '♯')
}
