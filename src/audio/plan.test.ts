import { describe, expect, it } from 'vitest'
import { highlightedMidis, planEvent, planProgression, planLine } from './plan'
import { realizeExercise } from '../music/exercise'
import type { Exercise } from '../model/types'

const base = { category: 'x', unit: 'x', tags: [], instructions: '', archived: false, createdAt: 0, updatedAt: 0 }
const kb: Exercise = {
  ...base, id: 'kb', title: 'Kenny Barron m11', kind: 'voicing', tonality: 'minor',
  voicings: [{ id: 'v', name: 'KB', symbol: 'm11', lh: '1 5 9', rh: 'b3 b7 11', anchorOctave: 3 }],
}
const prog: Exercise = {
  ...base, id: 'p', title: 'ii-V-I', kind: 'progression', tonality: 'major', voicings: [],
  progression: {
    tonality: 'major', anchorOctave: 3,
    events: [
      { id: '1', roman: 'ii', quality: 'm9', voicing: { lh: 'b3 5 b7 9', rh: '' } },
      { id: '2', roman: 'V', quality: '13', voicing: { lh: 'b7 9 3 13', rh: '' }, octave: -1 },
      { id: '3', roman: 'I', quality: 'maj9', voicing: { lh: '3 5 7 9', rh: '' }, beats: 8 },
    ],
  },
}

describe('keyboard and audio consume the same pitches', () => {
  it('chord playback MIDI equals keyboard highlights in every key', () => {
    for (let k = 0; k < 12; k++) {
      const ev = realizeExercise(kb, k).events[0]
      const audio = planEvent(ev, 'chord', 90).notes.map((n) => n.midi).sort((a, b) => a - b)
      expect(audio).toEqual(highlightedMidis(ev))
      expect(audio.length).toBe(6)
    }
  })
  it('transposed audio sounds at the right absolute pitch (E♭m11: E♭3 = MIDI 51)', () => {
    const ev = realizeExercise(kb, 3).events[0]
    expect(planEvent(ev, 'chord', 90).notes.map((n) => n.midi)).toEqual([51, 58, 65, 66, 73, 80])
  })
  it('hand-only and arpeggio modes use subsets/orderings of the same notes', () => {
    const ev = realizeExercise(kb, 0).events[0]
    expect(planEvent(ev, 'lh', 90).notes.map((n) => n.midi)).toEqual([48, 55, 62])
    expect(planEvent(ev, 'rh', 90).notes.map((n) => n.midi)).toEqual([63, 70, 77])
    const down = planEvent(ev, 'arpDown', 120).notes
    expect(down.map((n) => n.midi)).toEqual([77, 70, 63, 62, 55, 48])
    expect(down[1].time).toBeCloseTo(0.25)
  })
  it('progression playback follows event order, beats, tempo and count-in', () => {
    const r = realizeExercise(prog, 0)
    const plan = planProgression(r.events, 120, { countIn: true, metronome: true })
    expect(plan.eventTimes).toEqual([2, 4, 6])
    expect(plan.clicks.length).toBe(4 + 4 + 4 + 8)
    for (let i = 0; i < 3; i++) {
      const at = plan.notes.filter((n) => n.event === i).map((n) => n.midi).sort((a, b) => a - b)
      expect(at).toEqual(highlightedMidis(r.events[i]))
    }
    expect(plan.notes.find((n) => n.event === 2)!.duration).toBeCloseTo(4)
  })
  it('melodic lines go up and back down', () => {
    const scale: Exercise = { ...kb, voicings: [{ id: 's', name: 'Major scale', symbol: ' major scale', lh: '', rh: '1 2 3 4 5 6 7 1', anchorOctave: 4, style: 'melodic' }], tonality: 'major' }
    const ev = realizeExercise(scale, 0).events[0]
    expect(planLine(ev, 120).notes.map((n) => n.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60])
  })
})
