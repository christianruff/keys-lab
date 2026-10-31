import { useMemo, useState } from 'react'
import { useStore } from './store'
import { KeyChips, MASTERY_LABEL, Segmented, Stepper } from './common'
import { candidateExercises, completedCount, defaultParams } from '../schedule/session'
import { CATEGORIES } from '../data/starter'
import { keyLabel } from '../music/keys'
import type { Mastery, SessionParams } from '../model/types'

const MASTERIES: Mastery[] = ['new', 'learning', 'comfortable', 'fluent']

export function Generator({ onResume }: { onResume?: () => void }) {
  const { settings, exercises, session, startSession, endSession } = useStore()
  const [p, setP] = useState<SessionParams>(() => ({ ...defaultParams(), ...(settings.lastParams ?? {}) }))
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seed, setSeed] = useState('')
  const [pickSearch, setPickSearch] = useState('')
  const set = (patch: Partial<SessionParams>) => {
    setError(null)
    setP((x) => ({ ...x, ...patch }))
  }

  const categories = useMemo(() => {
    const names = new Set([...CATEGORIES.map((c) => c.name), ...exercises.map((e) => e.category)])
    return [...names]
  }, [exercises])
  const unitsFor = (cats: string[]) =>
    [...new Set(exercises.filter((e) => !e.archived && (!cats.length || cats.includes(e.category))).map((e) => e.unit).filter(Boolean))]
  const pool = candidateExercises(exercises, p)
  const N = p.keyMode === 'manual' ? p.manualKeys.length : p.keyCount
  const M = p.exerciseMode === 'manual' ? p.manualExercises.length : p.exerciseCount
  const total = N * M * Math.max(1, p.rounds)

  const start = () => {
    const s = seed.trim() ? Number(seed) : undefined
    if (seed.trim() && !Number.isFinite(s)) return setError('Seed must be a number.')
    const err = startSession(p, s)
    setError(err)
  }
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  return (
    <div className="generator">
      {session && session.status === 'active' && (
        <section className="resume card">
          <div>
            <div className="eyebrow">Session in progress</div>
            <b>
              {completedCount(session)} of {session.tasks.length} tasks done
            </b>
            <span className="muted"> · {session.keys.map((k) => keyLabel(k, 'major', { preferGb: settings.preferGb })).join(', ')}</span>
          </div>
          <div className="row gap">
            <button className="btn ghost" onClick={() => endSession()}>Discard</button>
            {onResume && <button className="btn primary" onClick={onResume}>Resume</button>}
          </div>
        </section>
      )}

      <section className="card hero" onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON' && start()}>
        <h1>New practice session</h1>
        <div className="nm">
          <div className="nm-field">
            <span className="nm-label">Keys</span>
            {p.keyMode === 'manual' ? <span className="nm-fixed">{N}</span> : <Stepper label="keys" value={p.keyCount} min={1} max={12} onChange={(v) => set({ keyCount: v })} />}
          </div>
          <span className="nm-x">×</span>
          <div className="nm-field">
            <span className="nm-label">Exercises</span>
            {p.exerciseMode === 'manual' ? <span className="nm-fixed">{M}</span> : <Stepper label="exercises" value={p.exerciseCount} min={1} max={Math.max(1, pool.length)} onChange={(v) => set({ exerciseCount: v })} />}
          </div>
          <span className="nm-x">=</span>
          <div className="nm-total">
            <b>{total}</b>
            <span>tasks</span>
          </div>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row gap wrap">
          <button className="btn primary big" onClick={start} disabled={total === 0}>Start practice</button>
          <button className="btn ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? 'Hide options' : 'Options'}</button>
        </div>
        <p className="muted small">
          {p.keyMode === 'manual' ? 'Chosen keys' : p.keyMode === 'smart' ? 'Smart keys' : 'Random keys'} ·{' '}
          {p.exerciseMode === 'smart' ? 'smart selection' : p.exerciseMode === 'random' ? 'fully random' : 'chosen exercises'} ·{' '}
          {p.order === 'byExercise' ? 'grouped by exercise' : 'shuffled'}
          {p.categories.length ? ` · ${p.categories.join(', ')}` : ''}
          {p.timeTargetMin ? ` · ${p.timeTargetMin} min target` : ''}
        </p>
      </section>

      {open && (
        <section className="card options">
          <div className="opt">
            <h3>Keys</h3>
            <Segmented
              label="Key selection" value={p.keyMode} onChange={(v) => set({ keyMode: v })}
              options={[
                { value: 'random', label: 'Random' },
                { value: 'smart', label: 'Smart', title: 'Favour keys that are weak or due' },
                { value: 'manual', label: 'Choose' },
              ]}
            />
            {p.keyMode === 'manual' && <KeyChips selected={p.manualKeys} preferGb={settings.preferGb} onToggle={(k) => set({ manualKeys: toggle(p.manualKeys, k) })} />}
          </div>

          <div className="opt">
            <h3>Exercises</h3>
            <Segmented
              label="Exercise selection" value={p.exerciseMode} onChange={(v) => set({ exerciseMode: v })}
              options={[
                { value: 'smart', label: 'Smart', title: 'Prioritise overdue, weak and unseen exercise-key pairs' },
                { value: 'random', label: 'Fully random' },
                { value: 'manual', label: 'Choose' },
              ]}
            />
            {p.exerciseMode === 'manual' && (
              <div className="picker">
                <input className="input" placeholder="Filter exercises…" value={pickSearch} onChange={(e) => setPickSearch(e.target.value)} />
                <div className="picker-list">
                  {pool
                    .filter((e) => !pickSearch || `${e.title} ${e.unit} ${e.tags.join(' ')}`.toLowerCase().includes(pickSearch.toLowerCase()))
                    .map((e) => (
                      <label key={e.id} className="pick">
                        <input type="checkbox" checked={p.manualExercises.includes(e.id)} onChange={() => set({ manualExercises: toggle(p.manualExercises, e.id) })} />
                        <span>{e.title}</span>
                        <small className="muted">{e.unit}</small>
                      </label>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="opt">
            <h3>Categories</h3>
            <div className="chips">
              {categories.map((c) => (
                <button key={c} className={`chip ${p.categories.includes(c) ? 'active' : ''}`} onClick={() => set({ categories: toggle(p.categories, c), units: [] })}>{c}</button>
              ))}
            </div>
            {p.categories.length > 0 && (
              <div className="chips sub">
                {unitsFor(p.categories).map((u) => (
                  <button key={u} className={`chip sm ${p.units.includes(u) ? 'active' : ''}`} onClick={() => set({ units: toggle(p.units, u) })}>{u}</button>
                ))}
              </div>
            )}
            <p className="muted small">{pool.length} exercises available with these filters.</p>
          </div>

          {p.exerciseMode !== 'manual' && (
            <div className="opt">
              <h3>Mastery</h3>
              <div className="chips">
                {MASTERIES.map((m) => (
                  <button key={m} className={`chip ${p.masteryFilter.includes(m) ? 'active' : ''}`} onClick={() => set({ masteryFilter: toggle(p.masteryFilter, m) })}>
                    <i className={`dot m-${m}`} /> {MASTERY_LABEL[m]}
                  </button>
                ))}
              </div>
              <p className="muted small">Only include exercises at these levels in the chosen keys (none selected = all).</p>
              {p.exerciseMode === 'smart' && (
                <div className="mix">
                  {MASTERIES.map((m) => (
                    <label key={m}>
                      <span>{MASTERY_LABEL[m]}</span>
                      <input type="range" min={0} max={2} step={0.05} value={p.mix[m]} onChange={(e) => set({ mix: { ...p.mix, [m]: Number(e.target.value) } })} />
                      <output>{Math.round(p.mix[m] * 100)}%</output>
                    </label>
                  ))}
                  <p className="muted small">Relative weight of each mastery level in smart selection.</p>
                </div>
              )}
            </div>
          )}

          <div className="opt grid2">
            <div>
              <h3>Order</h3>
              <Segmented label="Order" value={p.order} onChange={(v) => set({ order: v })} options={[{ value: 'byExercise', label: 'By exercise' }, { value: 'shuffled', label: 'Shuffled' }]} />
            </div>
            <div>
              <h3>Time target</h3>
              <select className="input" value={p.timeTargetMin ?? ''} onChange={(e) => set({ timeTargetMin: e.target.value ? Number(e.target.value) : null })}>
                <option value="">None</option>
                {[5, 10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
              </select>
            </div>
            <div>
              <h3>Repeat each task</h3>
              <Segmented label="Rounds" value={String(p.rounds) as '1' | '2' | '3'} onChange={(v) => set({ rounds: Number(v) })} options={[{ value: '1', label: 'Once' }, { value: '2', label: '×2' }, { value: '3', label: '×3' }]} />
            </div>
            <div>
              <h3>Seed</h3>
              <input className="input" inputMode="numeric" placeholder="Random" value={seed} onChange={(e) => setSeed(e.target.value.replace(/[^0-9]/g, ''))} />
              {session && <p className="muted small">Current session seed: {session.seed}</p>}
            </div>
          </div>
          <div className="row">
            <button className="btn ghost sm" onClick={() => setP(defaultParams())}>Reset options</button>
          </div>
        </section>
      )}
    </div>
  )
}
