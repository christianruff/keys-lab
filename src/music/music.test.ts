import { describe, expect, it } from 'vitest'
import {
  parseSpelled, midiOf, noteName, spellDegree, parseDegree, degreeSemitones, realizeVoicing, tonicSpelling,
  realizeProgression, parseRoman, impliedQuality, keyLabel, stackVoicing, spelledName, octaveOf,
} from './index'
import type { VoicingDef, ProgressionDef } from '../model/types'

const kb: VoicingDef = { id: 'kb', name: 'Kenny Barron', symbol: 'm11', lh: '1 5 9', rh: 'b3 b7 11', anchorOctave: 3 }
const names = (def: VoicingDef, root: string) => realizeVoicing(def, parseSpelled(root)).notes.map((n) => n.name)
const hands = (def: VoicingDef, root: string) => realizeVoicing(def, parseSpelled(root)).notes.map((n) => n.hand).join('')

describe('pitch basics', () => {
  it('uses MIDI 60 = C4 and letter-based octaves', () => {
    expect(midiOf(parseSpelled('C'), 4)).toBe(60)
    expect(midiOf(parseSpelled('A'), 4)).toBe(69)
    expect(midiOf(parseSpelled('Cb'), 4)).toBe(59)
    expect(midiOf(parseSpelled('B#'), 3)).toBe(60)
    expect(noteName(59, parseSpelled('Cb'))).toBe('C♭4')
    expect(noteName(60, parseSpelled('B#'))).toBe('B♯3')
    expect(octaveOf(61, parseSpelled('C#'))).toBe(4)
  })
  it('parses degrees with compound intervals', () => {
    expect(degreeSemitones(parseDegree('9'))).toBe(14)
    expect(degreeSemitones(parseDegree('b3'))).toBe(3)
    expect(degreeSemitones(parseDegree('#11'))).toBe(18)
    expect(degreeSemitones(parseDegree('b13'))).toBe(20)
    expect(degreeSemitones(parseDegree('♭7'))).toBe(10)
    expect(() => parseDegree('x9')).toThrow()
  })
})

describe('voicing realization and transposition', () => {
  it('realizes Kenny Barron m11 in C at the specified register', () => {
    expect(names(kb, 'C')).toEqual(['C3', 'G3', 'D4', 'E♭4', 'B♭4', 'F5'])
    expect(realizeVoicing(kb, parseSpelled('C')).notes.map((n) => n.midi)).toEqual([48, 55, 62, 63, 70, 77])
    expect(hands(kb, 'C')).toBe('LLLRRR')
  })
  it('preserves interval structure, hands and register in every key', () => {
    const base = realizeVoicing(kb, parseSpelled('C')).notes.map((n) => n.midi - 48)
    for (let pc = 0; pc < 12; pc++) {
      const root = tonicSpelling(pc, 'minor')
      const r = realizeVoicing(kb, root)
      expect(r.complete).toBe(true)
      const rootMidi = midiOf(root, 3)
      expect(r.notes.map((n) => n.midi - rootMidi)).toEqual(base)
      expect(r.notes.map((n) => n.hand).join('')).toBe('LLLRRR')
      expect(rootMidi).toBeGreaterThanOrEqual(48)
      expect(rootMidi).toBeLessThan(60)
    }
  })
  it('transposes to F♯ minor with correct pitches and spelling', () => {
    expect(names(kb, 'F#')).toEqual(['F♯3', 'C♯4', 'G♯4', 'A4', 'E5', 'B5'])
    expect(names(kb, 'Eb')).toEqual(['E♭3', 'B♭3', 'F4', 'G♭4', 'D♭5', 'A♭5'])
  })
  it('handles octave displacement and bass notes', () => {
    const d: VoicingDef = { id: 'x', name: 'x', symbol: '', lh: '1- 5', rh: '3+', anchorOctave: 3 }
    expect(names(d, 'C')).toEqual(['C2', 'G2', 'E4'])
    const slash: VoicingDef = { id: 'y', name: 'y', symbol: '', lh: '', rh: '1 3 5', bass: '3', anchorOctave: 4 }
    const r = realizeVoicing(slash, parseSpelled('C'))
    expect(r.notes.map((n) => n.name)).toEqual(['E3', 'C4', 'E4', 'G4'])
    expect(r.notes[0].isBass).toBe(true)
  })
  it('supports inversions by ordering degrees', () => {
    const inv: VoicingDef = { id: 'i', name: '1st inv', symbol: 'maj7', lh: '', rh: '3 5 7 1', anchorOctave: 4 }
    expect(names(inv, 'C')).toEqual(['E4', 'G4', 'B4', 'C5'])
  })
  it('applies register constraints by whole-octave shifts', () => {
    const d: VoicingDef = { ...kb, maxMidi: 76 }
    // F#: top note B5 (83) exceeds 76 -> whole voicing shifted down one octave
    expect(names(d, 'F#')).toEqual(['F♯2', 'C♯3', 'G♯3', 'A3', 'E4', 'B4'])
  })
})

describe('incomplete voicing definitions', () => {
  it('does not treat a formula without register as a playable performance', () => {
    const d: VoicingDef = { ...kb, anchorOctave: null }
    const r = realizeVoicing(d, parseSpelled('C'))
    expect(r.complete).toBe(false)
    expect(r.notes).toEqual([])
    expect(r.tones.map((t) => t.pitch)).toEqual(['C', 'G', 'D', 'E♭', 'B♭', 'F'])
    expect(r.incompleteReason).toMatch(/Register not specified/)
  })
  it('reports invalid tokens and empty formulas without producing notes', () => {
    const bad = stackVoicing({ lh: '1 q5', rh: '' }, parseSpelled('C'), 48)
    expect(bad.complete).toBe(false)
    expect(bad.errors.length).toBe(1)
    const empty = stackVoicing({ lh: '', rh: '' }, parseSpelled('C'), 48)
    expect(empty.complete).toBe(false)
    expect(empty.notes).toEqual([])
  })
})

describe('enharmonic spelling', () => {
  const sp = (root: string, deg: string) => spelledName(spellDegree(parseSpelled(root), parseDegree(deg)))
  it('spells chord degrees by letter, not by default accidental', () => {
    expect(sp('C', 'b3')).toBe('E♭')
    expect(sp('A', 'b3')).toBe('C')
    expect(sp('E', '3')).toBe('G♯')
    expect(sp('Db', '3')).toBe('F')
    expect(sp('Gb', 'b7')).toBe('F♭')
    expect(sp('F#', '7')).toBe('E♯')
    expect(sp('C', '#9')).toBe('D♯')
    expect(sp('C', 'b9')).toBe('D♭')
    expect(sp('C', '#11')).toBe('F♯')
    expect(sp('C', 'b13')).toBe('A♭')
    expect(sp('C', 'b10')).toBe('E♭')
    expect(sp('C', 'bb7')).toBe('B𝄫')
    expect(sp('B', '#9')).toBe('C𝄪')
  })
  it('chooses tonic spellings by tonal context', () => {
    expect(keyLabel(1, 'major')).toBe('D♭')
    expect(keyLabel(1, 'minor')).toBe('C♯')
    expect(keyLabel(8, 'major')).toBe('A♭')
    expect(keyLabel(8, 'minor')).toBe('G♯')
    expect(keyLabel(3, 'minor')).toBe('E♭')
    expect(keyLabel(6, 'major', { preferGb: true })).toBe('G♭')
    expect(keyLabel(10, 'dominant')).toBe('B♭')
  })
  it('spells a C♯ minor triad and D♭ major triad correctly', () => {
    const minor: VoicingDef = { id: 'm', name: '', symbol: 'm', lh: '', rh: '1 b3 5', anchorOctave: 4 }
    expect(realizeVoicing(minor, tonicSpelling(1, 'minor')).notes.map((n) => n.pitch)).toEqual(['C♯', 'E', 'G♯'])
    const major: VoicingDef = { ...minor, rh: '1 3 5' }
    expect(realizeVoicing(major, tonicSpelling(1, 'major')).notes.map((n) => n.pitch)).toEqual(['D♭', 'F', 'A♭'])
  })
})

describe('progressions', () => {
  it('parses roman numerals relative to the major scale', () => {
    expect(parseRoman('bVI').degree).toEqual({ num: 6, acc: -1 })
    expect(impliedQuality(parseRoman('ii7'))).toBe('m7')
    expect(impliedQuality(parseRoman('iiø7'))).toBe('m7b5')
    expect(impliedQuality(parseRoman('V7'))).toBe('7')
    expect(impliedQuality(parseRoman('#i°7'))).toBe('dim7')
    expect(impliedQuality(parseRoman('IV'))).toBe('')
  })
  const majorTwoFive: ProgressionDef = {
    tonality: 'major',
    anchorOctave: 3,
    events: [
      { id: '1', roman: 'ii', quality: 'm9', voicing: { lh: 'b3 5 b7 9', rh: '' } },
      { id: '2', roman: 'V', quality: '13', voicing: { lh: 'b7 9 3 13', rh: '' }, octave: -1 },
      { id: '3', roman: 'I', quality: 'maj9', voicing: { lh: '3 5 7 9', rh: '' } },
    ],
  }
  it('generates a major ii–V–I with smooth rootless voice leading', () => {
    const p = realizeProgression(majorTwoFive, tonicSpelling(0, 'major'))
    expect(p.complete).toBe(true)
    expect(p.events.map((e) => e.symbol)).toEqual(['Dm9', 'G13', 'Cmaj9'])
    expect(p.events.map((e) => e.notes.map((n) => n.name))).toEqual([
      ['F3', 'A3', 'C4', 'E4'],
      ['F3', 'A3', 'B3', 'E4'],
      ['E3', 'G3', 'B3', 'D4'],
    ])
  })
  it('transposes the ii–V–I to D♭ with correct spelling', () => {
    const p = realizeProgression(majorTwoFive, tonicSpelling(1, 'major'))
    expect(p.events.map((e) => e.symbol)).toEqual(['E♭m9', 'A♭13', 'D♭maj9'])
    expect(p.events[1].notes.map((n) => n.name)).toEqual(['G♭3', 'B♭3', 'C4', 'F4'])
  })
  it('generates a minor iiø–V7alt–i', () => {
    const minor: ProgressionDef = {
      tonality: 'minor',
      anchorOctave: 3,
      events: [
        { id: '1', roman: 'iiø7', quality: '', voicing: { lh: 'b3 b5 b7 1', rh: '' } },
        { id: '2', roman: 'V7', quality: '7(b9,b13)', voicing: { lh: 'b7 b9 3 b13', rh: '' }, octave: -1 },
        { id: '3', roman: 'i', quality: 'm9', voicing: { lh: 'b3 5 b7 9', rh: '' } },
      ],
    }
    const c = realizeProgression(minor, tonicSpelling(0, 'minor'))
    expect(c.events.map((e) => e.symbol)).toEqual(['Dø7', 'G7(♭9,♭13)', 'Cm9'])
    expect(c.events.map((e) => e.notes.map((n) => n.name))).toEqual([
      ['F3', 'A♭3', 'C4', 'D4'],
      ['F3', 'A♭3', 'B3', 'E♭4'],
      ['E♭3', 'G3', 'B♭3', 'D4'],
    ])
    const a = realizeProgression(minor, tonicSpelling(9, 'minor'))
    expect(a.events.map((e) => e.symbol)).toEqual(['Bø7', 'E7(♭9,♭13)', 'Am9'])
    expect(a.events[1].notes.map((n) => n.pitch)).toEqual(['D', 'F', 'G♯', 'C'])
  })
  it('keeps open-ended progressions free of fabricated voicings', () => {
    const open: ProgressionDef = {
      tonality: 'major',
      anchorOctave: null,
      events: ['I', 'vi', 'ii', 'V7'].map((r, i) => ({ id: String(i), roman: r, quality: '' })),
    }
    const p = realizeProgression(open, tonicSpelling(3, 'major'))
    expect(p.complete).toBe(false)
    expect(p.openEnded).toBe(true)
    expect(p.events.map((e) => e.symbol)).toEqual(['E♭', 'Cm', 'Fm', 'B♭7'])
    expect(p.events.every((e) => e.notes.length === 0)).toBe(true)
    expect(p.events[3].tones.map((t) => t.pitch)).toEqual(['B♭', 'D', 'F', 'A♭'])
  })
  it('handles minor-key borrowed numerals and slash bass', () => {
    const p = realizeProgression(
      { tonality: 'minor', anchorOctave: null, events: [{ id: 'a', roman: 'bVI', quality: 'maj7' }, { id: 'b', roman: 'I', quality: '', bass: '3' }] },
      tonicSpelling(4, 'minor'),
    )
    expect(p.events.map((e) => e.symbol)).toEqual(['Cmaj7', 'E/G♯'])
  })
})
