/**
 * Voicing realization: degree formula + root + register -> concrete notes.
 *
 * Stacking rule (makes a formula entered once fully determine the register):
 *  - The chord root is placed at `rootMidi` (from the anchor octave).
 *  - Left hand: first note is the lowest pitch >= root with that pitch class;
 *    each following note is the next pitch strictly above the previous note.
 *  - Right hand: first note is the lowest pitch above both the root and the top LH note;
 *    following notes stack upward the same way.
 *  - A "+" / "-" suffix moves that note by an octave; later notes stack from its new position.
 *  - Optional bass: the nearest pitch below the lowest voiced note.
 */
import { degreeLabel, degreeSemitones, parseFormula, parseDegree, spellDegree, type FormulaToken } from './degrees'
import { midiOf, mod, noteName, pcOf, spelledName, type Spelled } from './pitch'
import type { Hand, VoicingDef } from '../model/types'

export interface RealizedNote {
  midi: number
  /** Absolute note name, e.g. "E♭4" */
  name: string
  /** Pitch-class spelling, e.g. "E♭" */
  pitch: string
  /** Degree label relative to the chord root, e.g. "♭3" */
  degree: string
  hand: Hand
  isBass?: boolean
}

export interface ChordTone {
  pitch: string
  degree: string
}

export interface Realization {
  /** True only if every note has an unambiguous MIDI pitch. */
  complete: boolean
  notes: RealizedNote[]
  /** Spelled chord tones in formula order (always available when the formula parses). */
  tones: ChordTone[]
  errors: string[]
  /** Reason the voicing is not a fully specified performance. */
  incompleteReason?: string
}

export interface StackInput {
  lh: string
  rh: string
  bass?: string
}

function placeHand(
  tokens: FormulaToken[],
  root: Spelled,
  rootMidi: number,
  floor: number,
  hand: Hand,
): RealizedNote[] {
  const out: RealizedNote[] = []
  let prev = floor - 1 // first note may equal floor
  for (const t of tokens) {
    const pc = mod(pcOf(root) + degreeSemitones(t.degree), 12)
    let m = prev + 1
    while (mod(m, 12) !== pc) m++
    m += 12 * t.octaveShift
    const sp = spellDegree(root, t.degree)
    out.push({ midi: m, name: noteName(m, sp), pitch: spelledName(sp), degree: degreeLabel(t.degree), hand })
    prev = m
  }
  void rootMidi
  return out
}

export function chordTones(input: StackInput, root: Spelled): { tones: ChordTone[]; errors: string[] } {
  const lh = parseFormula(input.lh)
  const rh = parseFormula(input.rh)
  const errors = [...lh.errors, ...rh.errors]
  const tokens = [...lh.tokens, ...rh.tokens]
  if (input.bass?.trim()) {
    try {
      tokens.unshift({ degree: parseDegree(input.bass), octaveShift: 0, raw: input.bass })
    } catch {
      errors.push(`Bass "${input.bass}" is not a valid degree`)
    }
  }
  const seen = new Set<string>()
  const tones: ChordTone[] = []
  for (const t of tokens) {
    try {
      const pitch = spelledName(spellDegree(root, t.degree))
      const degree = degreeLabel(t.degree)
      const k = pitch + degree
      if (!seen.has(k)) {
        seen.add(k)
        tones.push({ pitch, degree })
      }
    } catch (e) {
      errors.push((e as Error).message)
    }
  }
  return { tones, errors }
}

/** Realize a stacked formula with an explicit root MIDI pitch. */
export function stackVoicing(
  input: StackInput,
  root: Spelled,
  rootMidi: number | null,
  constraints: { minMidi?: number; maxMidi?: number } = {},
): Realization {
  const { tones, errors } = chordTones(input, root)
  const lh = parseFormula(input.lh).tokens
  const rh = parseFormula(input.rh).tokens
  if (errors.length) return { complete: false, notes: [], tones, errors, incompleteReason: 'Formula has errors' }
  if (!lh.length && !rh.length) {
    return { complete: false, notes: [], tones, errors, incompleteReason: 'No notes defined' }
  }
  if (rootMidi === null) {
    return {
      complete: false,
      notes: [],
      tones,
      errors,
      incompleteReason: 'Register not specified — chord tones only, no playable voicing defined',
    }
  }
  const left = placeHand(lh, root, rootMidi, rootMidi, 'L')
  const lhTop = left.length ? Math.max(...left.map((n) => n.midi)) : -Infinity
  const right = placeHand(rh, root, rootMidi, Math.max(rootMidi, lhTop + 1), 'R')
  let notes = [...left, ...right]
  if (input.bass?.trim()) {
    const d = parseDegree(input.bass)
    const sp = spellDegree(root, d)
    const lowest = Math.min(...notes.map((n) => n.midi))
    let m = lowest - 1
    while (mod(m, 12) !== pcOf(sp)) m--
    notes.unshift({ midi: m, name: noteName(m, sp), pitch: spelledName(sp), degree: degreeLabel(d), hand: 'L', isBass: true })
  }
  notes = fitRegister(notes, constraints)
  notes.sort((a, b) => a.midi - b.midi)
  return { complete: true, notes, tones, errors }
}

/** Shift the whole voicing by octaves to satisfy register constraints when possible. */
export function fitRegister(notes: RealizedNote[], c: { minMidi?: number; maxMidi?: number }): RealizedNote[] {
  if (!notes.length) return notes
  let shift = 0
  const lo = () => Math.min(...notes.map((n) => n.midi)) + shift
  const hi = () => Math.max(...notes.map((n) => n.midi)) + shift
  if (c.maxMidi !== undefined) while (hi() > c.maxMidi && (c.minMidi === undefined || lo() - 12 >= c.minMidi)) shift -= 12
  if (c.minMidi !== undefined) while (lo() < c.minMidi && (c.maxMidi === undefined || hi() + 12 <= c.maxMidi)) shift += 12
  if (!shift) return notes
  return notes.map((n) => transposeNote(n, shift))
}

export function transposeNote(n: RealizedNote, semis: number): RealizedNote {
  if (semis % 12 !== 0) throw new Error('transposeNote only shifts by octaves')
  const oct = Number(/-?\d+$/.exec(n.name)![0]) + semis / 12
  return { ...n, midi: n.midi + semis, name: n.pitch + oct }
}

/** Realize a stored voicing definition for a given root spelling. */
export function realizeVoicing(def: VoicingDef, root: Spelled): Realization {
  const rootMidi = def.anchorOctave === null || def.anchorOctave === undefined ? null : midiOf(root, def.anchorOctave)
  return stackVoicing(def, root, rootMidi, { minMidi: def.minMidi, maxMidi: def.maxMidi })
}
