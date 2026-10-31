import { describe, expect, it } from 'vitest'
import { fitRange } from './Keyboard'
import { isBlackKey } from '../music/pitch'
import type { RealizedNote } from '../music/voicing'

const n = (midi: number): RealizedNote => ({ midi, name: '', pitch: '', degree: '', hand: 'L' })

describe('keyboard geometry', () => {
  it('black keys are exactly C♯ D♯ F♯ G♯ A♯', () => {
    const blacks = Array.from({ length: 12 }, (_, i) => i).filter((m) => isBlackKey(60 + m))
    expect(blacks).toEqual([1, 3, 6, 8, 10])
  })
  it('keeps the preferred range when notes fit, otherwise expands to cover all notes', () => {
    expect(fitRange([n(48), n(77)], 36, 4)).toEqual({ start: 36, octaves: 4 })
    const r = fitRange([n(40), n(90)], 48, 2)
    expect(r.start).toBeLessThanOrEqual(40)
    expect(r.start + r.octaves * 12).toBeGreaterThanOrEqual(90)
    expect(r.start % 12).toBe(0)
  })
})
