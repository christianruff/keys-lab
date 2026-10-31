import { describe, expect, it } from 'vitest'
import { starterLibrary, CATEGORIES } from './starter'
import { realizeExercise } from '../music/exercise'

const lib = starterLibrary()
const byId = (id: string) => lib.find((e) => e.id === id)!
const notes = (id: string, key: number, variant = 0, ev = 0) =>
  realizeExercise(byId(id), key, {}, variant).events[ev].notes.map((n) => n.name)

describe('starter vocabulary', () => {
  it('has unique ids and covers every category/unit', () => {
    expect(new Set(lib.map((e) => e.id)).size).toBe(lib.length)
    for (const c of CATEGORIES) for (const u of c.units) {
      expect(lib.some((e) => e.category === c.name && e.unit === u), `${c.name} / ${u}`).toBe(true)
    }
  })
  it('every defined voicing/progression realizes without errors in all 12 keys', () => {
    for (const e of lib) for (let k = 0; k < 12; k++) {
      const vs = Math.max(1, e.voicings.length)
      for (let v = 0; v < vs; v++) {
        const r = realizeExercise(e, k, {}, v)
        expect(r.errors, `${e.id} key ${k}`).toEqual([])
        if (e.voicings.length || (e.progression && e.progression.anchorOctave !== null)) expect(r.hasAnswer, `${e.id} key ${k} v${v}`).toBe(true)
      }
    }
  })
  it('templates and open-ended items never carry fabricated notes', () => {
    for (const e of lib.filter((x) => x.template || x.progression?.anchorOctave === null)) {
      const r = realizeExercise(e, 0)
      expect(r.hasAnswer).toBe(false)
      expect(r.events.every((ev) => ev.notes.length === 0)).toBe(true)
    }
  })
  it('spot-checks verified formulas', () => {
    expect(notes('st-major-type-a', 0)).toEqual(['E3', 'G3', 'B3', 'D4'])
    expect(notes('st-major-type-b', 0)).toEqual(['B3', 'D4', 'E4', 'G4'])
    expect(notes('st-minor-type-a', 2)).toEqual(['F3', 'A3', 'C4', 'E4'])
    expect(notes('st-so-what', 4)).toEqual(['E3', 'A3', 'D4', 'G4', 'B4'])
    expect(notes('st-ust', 0, 0)).toEqual(['E3', 'B♭3', 'D4', 'F♯4', 'A4'])
    expect(notes('st-ust', 0, 1)).toEqual(['E3', 'B♭3', 'A♭4', 'C5', 'E♭5'])
    expect(notes('st-dom-s9', 0)).toEqual(['C3', 'B♭3', 'E4', 'D♯5'])
    // register constraint (max G5) moves G7♯9 down an octave as a whole
    expect(notes('st-dom-s9', 7)).toEqual(['G2', 'F3', 'B3', 'A♯4'])
    expect(notes('st-altered-combos', 0, 0)).toEqual(['C3', 'B♭3', 'E4', 'G♯4', 'D♭5'])
    expect(notes('st-major-scale', 2)).toEqual(['D4', 'E4', 'F♯4', 'G4', 'A4', 'B4', 'C♯5', 'D5'])
    expect(notes('st-harmonic-minor', 9)).toEqual(['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G♯5', 'A5'])
    // Rootless voicings stay near middle C: high keys drop an octave
    expect(notes('st-major-type-a', 11)).toEqual(['D♯3', 'F♯3', 'A♯3', 'C♯4'])
  })
  it('two-handed minor ii–V–i puts roots in the left hand', () => {
    const r = realizeExercise(byId('st-minor-251-two-hands'), 0)
    expect(r.events.map((e) => e.label)).toEqual(['Dø7', 'G7(♭9,♭13)', 'Cm9'])
    expect(r.events.map((e) => e.notes.filter((n) => n.hand === 'L').map((n) => n.name))).toEqual([['D2'], ['G2'], ['C2']])
    expect(r.events[1].notes.filter((n) => n.hand === 'R').map((n) => n.name)).toEqual(['F3', 'A♭3', 'B3', 'E♭4'])
  })
})
