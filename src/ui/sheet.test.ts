import { describe, expect, it } from 'vitest'
import { buildSheet, handLine } from './sheet'
import { starterLibrary } from '../data/starter'

const lib = starterLibrary()

describe('printable sheets', () => {
  it('builds one cell per key and variant, in key order, skipping unknown ids', () => {
    const ex = lib.find((e) => e.kind === 'voicing' && e.voicings.length > 1 && e.voicings[0].anchorOctave !== null)!
    const all = buildSheet(lib, [ex.id, 'missing'], [7, 0, 7], { allVariants: true })
    expect(all).toHaveLength(1)
    expect(all[0].cells.map((c) => c.key)).toEqual(ex.voicings.flatMap(() => [0, 7]))
    const first = buildSheet(lib, [ex.id], [0], { allVariants: false })
    expect(first[0].cells).toHaveLength(1)
    expect(handLine(first[0].cells[0].realized, 0, 'L').length + handLine(first[0].cells[0].realized, 0, 'R').length).toBeGreaterThan(0)
  })
  it('treats progressions as one cell per key', () => {
    const ex = lib.find((e) => e.kind === 'progression' && e.progression?.events.length)!
    const s = buildSheet(lib, [ex.id], [0, 2], { allVariants: true })
    expect(s[0].cells).toHaveLength(2)
    expect(s[0].cells[0].realized.events.length).toBe(ex.progression!.events.length)
  })
})
