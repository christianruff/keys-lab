/**
 * Progressions: ordered harmonic events written as Roman numerals relative to a tonic.
 * Numerals are measured against the MAJOR scale of the tonic in both modes
 * (so in minor write i, iiø, bIII, iv, V, bVI, bVII).
 */
import { degreeLabel, degreeSemitones, spellDegree, type Degree } from './degrees'
import { midiOf, spelledName, type Spelled } from './pitch'
import { normalizeQuality, prettyQuality, qualityTones } from './chords'
import { chordTones, fitRegister, stackVoicing, type ChordTone, type RealizedNote } from './voicing'
import type { ProgressionDef, ProgressionEvent } from '../model/types'

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

export interface ParsedRoman {
  degree: Degree
  upper: boolean
  suffix: string
}

export function parseRoman(text: string): ParsedRoman {
  const m = /^([b#♭♯]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/.exec(text.trim())
  if (!m) throw new Error(`Invalid Roman numeral "${text}"`)
  const acc = m[1] === 'b' || m[1] === '♭' ? -1 : m[1] ? 1 : 0
  const num = NUMERALS.indexOf(m[2].toUpperCase()) + 1
  return { degree: { num, acc }, upper: m[2] === m[2].toUpperCase(), suffix: m[3] }
}

/** Quality implied by the numeral when no explicit quality is given. */
export function impliedQuality(r: ParsedRoman): string {
  const s = r.suffix.trim()
  if (s.startsWith('ø')) return 'm7b5'
  if (s.startsWith('°') || s.startsWith('o')) return s.includes('7') ? 'dim7' : 'dim'
  if (s === '+') return 'aug'
  if (!r.upper) {
    if (s === '') return 'm'
    if (/^(7|9|11)$/.test(s)) return 'm' + s
  }
  return normalizeQuality(s)
}

export interface RealizedEvent {
  index: number
  roman: string
  /** e.g. "Dm7", "G7alt", "C/E" */
  symbol: string
  rootPitch: string
  rootDegree: string
  beats: number
  /** Concrete notes; empty for open-ended events. */
  notes: RealizedNote[]
  complete: boolean
  openEnded: boolean
  tones: ChordTone[]
  errors: string[]
}

export interface RealizedProgression {
  events: RealizedEvent[]
  /** True when every event has a fully specified voicing. */
  complete: boolean
  openEnded: boolean
  errors: string[]
}

export function realizeEvent(ev: ProgressionEvent, tonic: Spelled, tonicMidi: number | null, index: number): RealizedEvent {
  const errors: string[] = []
  let parsed: ParsedRoman
  try {
    parsed = parseRoman(ev.roman)
  } catch (e) {
    return {
      index, roman: ev.roman, symbol: '?', rootPitch: '?', rootDegree: '?', beats: ev.beats ?? 4,
      notes: [], complete: false, openEnded: true, tones: [], errors: [(e as Error).message],
    }
  }
  const root = spellDegree(tonic, parsed.degree)
  const quality = ev.quality?.trim() ? normalizeQuality(ev.quality) : impliedQuality(parsed)
  const rootPitch = spelledName(root)
  let symbol = rootPitch + prettyQuality(quality)
  if (ev.bass?.trim()) {
    try {
      const b = chordTones({ lh: '', rh: '', bass: ev.bass }, root).tones[0]
      if (b) symbol += '/' + b.pitch
    } catch {
      errors.push(`Invalid bass "${ev.bass}"`)
    }
  }
  const beats = ev.beats ?? 4
  const base = { index, roman: ev.roman, symbol, rootPitch, rootDegree: degreeLabel(parsed.degree), beats }
  if (!ev.voicing || (!ev.voicing.lh.trim() && !ev.voicing.rh.trim())) {
    const qt = qualityTones(quality)
    const tones = qt ? chordTones({ lh: qt, rh: '', bass: ev.bass }, root).tones : []
    return { ...base, notes: [], complete: false, openEnded: true, tones, errors }
  }
  const rootMidi =
    tonicMidi === null ? null : tonicMidi + (degreeSemitones(parsed.degree) % 12 + 12) % 12 + 12 * (ev.octave ?? 0)
  const r = stackVoicing({ lh: ev.voicing.lh, rh: ev.voicing.rh, bass: ev.voicing.bass ?? ev.bass }, root, rootMidi)
  return { ...base, notes: r.notes, complete: r.complete, openEnded: false, tones: r.tones, errors: [...errors, ...r.errors] }
}

export function realizeProgression(def: ProgressionDef, tonic: Spelled): RealizedProgression {
  const tonicMidi = def.anchorOctave === null ? null : midiOf(tonic, def.anchorOctave)
  let events = def.events.map((e, i) => realizeEvent(e, tonic, tonicMidi, i))
  // Register constraints apply to the progression as a whole so voice leading is preserved.
  const all = events.flatMap((e) => e.notes)
  if (all.length && (def.minMidi !== undefined || def.maxMidi !== undefined)) {
    const fitted = fitRegister(all, def)
    const shift = fitted[0].midi - all[0].midi
    if (shift) {
      let k = 0
      events = events.map((e) => ({ ...e, notes: e.notes.map(() => fitted[k++]) }))
    }
  }
  return {
    events,
    complete: events.length > 0 && events.every((e) => e.complete),
    openEnded: events.some((e) => e.openEnded),
    errors: events.flatMap((e) => e.errors.map((m) => `${e.roman}: ${m}`)),
  }
}
