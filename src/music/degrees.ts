/**
 * Scale/chord degrees (e.g. ♭3, 9, ♯11). A degree is an interval above a chord root
 * expressed as a diatonic number plus an alteration relative to the major scale.
 * The diatonic number fixes the letter (spelling); the alteration fixes the pitch.
 */
import { mod, pcOf, type Spelled } from './pitch'

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]

export interface Degree {
  /** 1..15 */
  num: number
  /** alteration relative to the major-scale degree, -2..2 */
  acc: number
}

export interface FormulaToken {
  degree: Degree
  /** explicit octave displacement from "+" / "-" suffixes */
  octaveShift: number
  raw: string
}

const DEGREE_RE = /^(bb|b|##|#|♭♭|♭|♯♯|♯|𝄫|𝄪)?(\d{1,2})$/

export function parseDegree(text: string): Degree {
  const m = DEGREE_RE.exec(text.trim())
  if (!m) throw new Error(`Invalid degree "${text}"`)
  const a = m[1] ?? ''
  const acc = a === '' ? 0 : /^(b|♭)$/.test(a) ? -1 : /^(bb|♭♭|𝄫)$/.test(a) ? -2 : /^(#|♯)$/.test(a) ? 1 : 2
  const num = Number(m[2])
  if (num < 1 || num > 15) throw new Error(`Degree out of range "${text}"`)
  return { num, acc }
}

/** Semitones above the root (compound degrees include the octave: 9 = 14). */
export function degreeSemitones(d: Degree): number {
  const i = d.num - 1
  return MAJOR_STEPS[i % 7] + 12 * Math.floor(i / 7) + d.acc
}

export function degreeLabel(d: Degree): string {
  const a = d.acc === -2 ? '𝄫' : d.acc === -1 ? '♭' : d.acc === 1 ? '♯' : d.acc === 2 ? '𝄪' : ''
  return a + d.num
}

/** Spell the pitch class a degree above a spelled root (e.g. ♭3 above C = E♭). */
export function spellDegree(root: Spelled, d: Degree): Spelled {
  const letter = mod(root.letter + d.num - 1, 7)
  const targetPc = mod(pcOf(root) + degreeSemitones(d), 12)
  const natural = [0, 2, 4, 5, 7, 9, 11][letter]
  let acc = mod(targetPc - natural, 12)
  if (acc > 6) acc -= 12
  if (acc < -2 || acc > 2) throw new Error(`Cannot spell degree ${degreeLabel(d)} above root`)
  return { letter, acc }
}

/** Parse a formula string such as "1 5 9", "b3, b7, 11", "1- 5 b10+" or "1–5–9". */
export function parseFormula(text: string): { tokens: FormulaToken[]; errors: string[] } {
  const tokens: FormulaToken[] = []
  const errors: string[] = []
  const parts = text
    .replace(/[–—]/g, ' ')
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  for (const raw of parts) {
    const m = /^(.*?)([+-]*)$/.exec(raw)!
    const core = m[1]
    const shifts = m[2]
    let octaveShift = 0
    for (const c of shifts) octaveShift += c === '+' ? 1 : -1
    try {
      tokens.push({ degree: parseDegree(core), octaveShift, raw })
    } catch {
      errors.push(`"${raw}" is not a valid degree (use e.g. 1, b3, 5, #9, b13; add + or - to move an octave)`)
    }
  }
  return { tokens, errors }
}
