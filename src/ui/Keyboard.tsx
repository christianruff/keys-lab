import { useState } from 'react'
import type { RealizedNote } from '../music/voicing'
import { defaultSpelling, isBlackKey, mod, spelledName } from '../music/pitch'

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11]
// Black-key horizontal offsets (fraction of a white key) for a realistic layout.
const BLACK_OFFSET: Record<number, number> = { 1: -0.08, 3: 0.08, 6: -0.1, 8: 0, 10: 0.1 }

export interface KeyboardProps {
  /** MIDI of the lowest key; snapped down to a C. */
  start: number
  octaves: number
  notes: RealizedNote[]
  showNames?: boolean
  showDegrees?: boolean
  onKey?: (midi: number) => void
  dim?: boolean
  caption?: string
}

/** Choose a C-aligned range of at least `minOctaves` that contains every note. */
export function fitRange(notes: RealizedNote[], preferStart: number, minOctaves: number): { start: number; octaves: number } {
  const pref = preferStart - mod(preferStart, 12)
  if (!notes.length) return { start: pref, octaves: minOctaves }
  const lo = Math.min(...notes.map((n) => n.midi))
  const hi = Math.max(...notes.map((n) => n.midi))
  if (pref <= lo && pref + minOctaves * 12 >= hi) return { start: pref, octaves: minOctaves }
  const startC = lo - mod(lo, 12)
  const endC = mod(hi, 12) === 0 ? hi : hi - mod(hi, 12) + 12
  const span = (endC - startC) / 12
  const octaves = Math.max(minOctaves, span)
  const extra = octaves - span
  return { start: Math.max(12, startC - 12 * Math.floor(extra / 2)), octaves }
}

export function Keyboard({ start, octaves, notes, showNames, showDegrees, onKey, dim, caption }: KeyboardProps) {
  const [pressed, setPressed] = useState<number | null>(null)
  const lo = start - mod(start, 12)
  const hi = lo + octaves * 12 // inclusive final C
  const whites: number[] = []
  const blacks: number[] = []
  for (let m = lo; m <= hi; m++) (isBlackKey(m) ? blacks : whites).push(m)
  const W = 24
  const H = 132
  const BW = 14
  const BH = 84
  const byMidi = new Map(notes.map((n) => [n.midi, n]))
  const whiteIndex = (m: number) => whites.indexOf(m)
  const xOf = (m: number) => {
    if (!isBlackKey(m)) return whiteIndex(m) * W
    const leftWhite = whiteIndex(m - 1)
    return (leftWhite + 1) * W - BW / 2 + BLACK_OFFSET[mod(m, 12)] * W
  }
  const press = (m: number) => {
    setPressed(m)
    onKey?.(m)
    setTimeout(() => setPressed((p) => (p === m ? null : p)), 220)
  }
  const label = (n: RealizedNote) => (showDegrees && showNames ? `${n.pitch}|${n.degree}` : showDegrees ? n.degree : showNames ? n.pitch : '')

  const renderLabel = (m: number, n: RealizedNote, black: boolean) => {
    const text = label(n)
    if (!text) return null
    const [a, b] = text.split('|')
    const cx = xOf(m) + (black ? BW : W) / 2
    const base = black ? BH - 12 : H - 16
    return (
      <g className="kb-label" pointerEvents="none">
        <text x={cx} y={b ? base - 11 : base} textAnchor="middle" className={black ? 'kb-text kb-text-black' : 'kb-text'}>
          {a}
        </text>
        {b && (
          <text x={cx} y={base} textAnchor="middle" className={`kb-sub ${black ? 'kb-text-black' : ''}`}>
            {b}
          </text>
        )}
      </g>
    )
  }

  return (
    <figure className={`keyboard ${dim ? 'is-dim' : ''}`} aria-label={caption ?? 'Piano keyboard'}>
      <svg viewBox={`0 0 ${whites.length * W} ${H + 2}`} preserveAspectRatio="xMidYMin meet" role="group">
        {whites.map((m) => {
          const n = byMidi.get(m)
          return (
            <g key={m}>
              <rect
                x={xOf(m) + 0.5} y={0.5} width={W - 1} height={H} rx={3}
                className={`kb-white ${n ? `on hand-${n.hand}` : ''} ${pressed === m ? 'pressed' : ''}`}
                onPointerDown={() => press(m)} data-midi={m}
              >
                <title>{n ? `${n.name} · ${n.degree} · ${n.hand === 'L' ? 'left hand' : 'right hand'}` : spelledName(defaultSpelling(m % 12)) + (Math.floor(m / 12) - 1)}</title>
              </rect>
              {mod(m, 12) === 0 && !n && (
                <text x={xOf(m) + W / 2} y={H - 6} textAnchor="middle" className="kb-c" pointerEvents="none">
                  C{Math.floor(m / 12) - 1}
                </text>
              )}
              {n && renderLabel(m, n, false)}
            </g>
          )
        })}
        {blacks.map((m) => {
          const n = byMidi.get(m)
          return (
            <g key={m}>
              <rect
                x={xOf(m)} y={0} width={BW} height={BH} rx={2}
                className={`kb-black ${n ? `on hand-${n.hand}` : ''} ${pressed === m ? 'pressed' : ''}`}
                onPointerDown={() => press(m)} data-midi={m}
              >
                <title>{n ? `${n.name} · ${n.degree}` : spelledName(defaultSpelling(m % 12, false)) + '/' + spelledName(defaultSpelling(m % 12, true))}</title>
              </rect>
              {n && renderLabel(m, n, true)}
            </g>
          )
        })}
      </svg>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

export { WHITE_PCS }
