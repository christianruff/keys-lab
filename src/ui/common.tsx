import type { ReactNode } from 'react'
import { ALL_KEYS, keyLabel } from '../music/keys'
import type { Mastery, Progress } from '../model/types'
import { progressId } from '../schedule/mastery'

export function Segmented<T extends string>({
  value, options, onChange, label, size,
}: { value: T; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; label?: string; size?: 'sm' }) {
  return (
    <div className={`segmented ${size === 'sm' ? 'sm' : ''}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value} type="button" role="radio" aria-checked={o.value === value} title={o.title}
          className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="stepper" aria-label={label}>
      <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <input
        type="number" inputMode="numeric" min={min} max={max} value={value} aria-label={label}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, Math.round(v))))
        }}
      />
      <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  )
}

export function KeyChips({
  selected, onToggle, tonality = 'major', preferGb, single,
}: { selected: number[]; onToggle: (k: number) => void; tonality?: 'major' | 'minor' | 'dominant'; preferGb?: boolean; single?: boolean }) {
  return (
    <div className={`key-chips ${single ? 'single' : ''}`} role="group" aria-label="Keys">
      {ALL_KEYS.map((k) => (
        <button key={k} type="button" className={`chip ${selected.includes(k) ? 'active' : ''}`} aria-pressed={selected.includes(k)} onClick={() => onToggle(k)}>
          {keyLabel(k, tonality, { preferGb })}
        </button>
      ))}
    </div>
  )
}

export const MASTERY_LABEL: Record<Mastery, string> = { new: 'New', learning: 'Learning', comfortable: 'Comfortable', fluent: 'Fluent' }

export function MasteryDots({ exerciseId, progress, tonality, preferGb }: { exerciseId: string; progress: Map<string, Progress>; tonality: 'major' | 'minor' | 'dominant'; preferGb?: boolean }) {
  return (
    <span className="mastery-dots" aria-label="Mastery by key">
      {ALL_KEYS.map((k) => {
        const m = progress.get(progressId(exerciseId, k))?.mastery ?? 'new'
        return <i key={k} className={`dot m-${m}`} title={`${keyLabel(k, tonality, { preferGb })}: ${MASTERY_LABEL[m]}`} />
      })}
    </span>
  )
}

export function Icon({ name }: { name: 'play' | 'stop' | 'replay' | 'up' | 'down' | 'prev' | 'next' | 'keys' | 'eye' | 'plus' | 'search' | 'close' }) {
  const p: Record<string, ReactNode> = {
    play: <path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none" />,
    stop: <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor" stroke="none" />,
    replay: <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" />,
    up: <path d="M5 18l4-4 3 3 7-9M15 8h4v4" />,
    down: <path d="M5 6l4 4 3-3 7 9M15 16h4v-4" />,
    prev: <path d="M15 5l-7 7 7 7" />,
    next: <path d="M9 5l7 7-7 7" />,
    keys: <path d="M3 5h18v14H3zM8 5v8M12 5v8M16 5v8M8 13v6M12 13v6M16 13v6" />,
    eye: <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    search: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 3-4.3-4.3" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
  }
  return (
    <svg className="icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {p[name]}
    </svg>
  )
}
