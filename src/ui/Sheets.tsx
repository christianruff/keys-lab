import { useMemo, useState } from 'react'
import { useStore } from './store'
import { Icon, KeyChips, Segmented } from './common'
import { Keyboard, fitRange } from './Keyboard'
import { buildSheet, handLine, type SheetCell } from './sheet'
import { ALL_KEYS } from '../music/keys'
import { prettyAccidentals } from '../music/pitch'
import { piano } from '../audio/engine'
import type { Exercise } from '../model/types'

/**
 * Printable / screenshot-friendly voicing sheets. Pick exercises and keys, then
 * print or "Save as PDF" for an offline reference that needs no app at all.
 */
export function SheetsView() {
  const { exercises, settings, sheetPreset } = useStore()
  const [ids, setIds] = useState<string[]>(() => sheetPreset?.ids ?? [])
  const [keys, setKeys] = useState<number[]>(() => sheetPreset?.keys ?? ALL_KEYS)
  const [names, setNames] = useState(true)
  const [degrees, setDegrees] = useState(settings.showDegrees)
  const [allVariants, setAllVariants] = useState(true)
  const [cols, setCols] = useState<'1' | '2' | '3'>('2')
  const [picking, setPicking] = useState(!sheetPreset?.ids.length)
  const [q, setQ] = useState('')

  const sections = useMemo(
    () => buildSheet(exercises, ids, keys, { allVariants, preferGb: settings.preferGb }),
    [exercises, ids, keys, allVariants, settings.preferGb],
  )
  const active = exercises.filter((e) => !e.archived)
  const needle = q.trim().toLowerCase()
  const shown = active.filter((e) => !needle || `${e.title} ${e.category} ${e.unit} ${e.tags.join(' ')}`.toLowerCase().includes(needle))
  const groups = [...new Set(shown.map((e) => e.category))].map((c) => ({ c, items: shown.filter((e) => e.category === c) }))
  const toggleId = (id: string) => setIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const toggleKey = (k: number) => setKeys((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))
  const cellCount = sections.reduce((n, s) => n + s.cells.length, 0)

  return (
    <div className="sheets">
      <section className="card sheet-controls">
        <div className="row gap wrap sheet-top">
          <h3>Voicing sheets</h3>
          <button className="btn primary" disabled={!cellCount} onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
        <p className="small muted">Make a clean reference you can print, save as a PDF to Files, or screenshot. On iPhone or iPad, pinch out on the print preview to get a PDF you can save to Files.</p>

        <div className="sheet-picker">
          <button className="btn sm" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
            {picking ? 'Done choosing' : `Choose exercises (${ids.length} selected)`}
          </button>
          {ids.length > 0 && <button className="btn ghost sm" onClick={() => setIds([])}>Clear</button>}
          {picking && (
            <div className="sheet-pick-list">
              <div className="search">
                <Icon name="search" />
                <input className="input" placeholder="Filter exercises…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter exercises" />
              </div>
              {groups.map((g) => (
                <fieldset key={g.c}>
                  <legend>
                    {g.c}{' '}
                    <button type="button" className="link small" onClick={() => setIds((s) => [...new Set([...s, ...g.items.map((e) => e.id)])])}>all</button>
                  </legend>
                  {g.items.map((e) => (
                    <label key={e.id} className="pick">
                      <input type="checkbox" checked={ids.includes(e.id)} onChange={() => toggleId(e.id)} />
                      <span>{e.title}</span>
                      {e.unit && <small className="muted">{e.unit}</small>}
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          )}
        </div>

        <div className="sheet-keys">
          <div className="row gap wrap">
            <span className="small muted">Keys</span>
            <button className="btn ghost sm" onClick={() => setKeys(ALL_KEYS)}>All 12</button>
            <button className="btn ghost sm" onClick={() => setKeys([])}>None</button>
          </div>
          <KeyChips selected={keys} onToggle={toggleKey} preferGb={settings.preferGb} />
        </div>

        <div className="row gap wrap sheet-opts">
          <label className="small"><input type="checkbox" checked={names} onChange={(e) => setNames(e.target.checked)} /> Note names</label>
          <label className="small"><input type="checkbox" checked={degrees} onChange={(e) => setDegrees(e.target.checked)} /> Degrees</label>
          <label className="small"><input type="checkbox" checked={allVariants} onChange={(e) => setAllVariants(e.target.checked)} /> All variants</label>
          <Segmented size="sm" label="Columns" value={cols} onChange={setCols} options={[{ value: '1', label: '1 col' }, { value: '2', label: '2 col' }, { value: '3', label: '3 col' }]} />
        </div>
      </section>

      {cellCount === 0 ? (
        <p className="muted center pad sheet-empty">Choose exercises and keys above, or open an exercise in the Library and tap “Print sheet”.</p>
      ) : (
        <article className={`sheet cols-${cols}`}>
          {sections.map(({ exercise, cells }) => (
            <section key={exercise.id} className="sheet-section">
              <header className="sheet-head">
                <div className="eyebrow">{[exercise.category, exercise.unit].filter(Boolean).join(' · ')}</div>
                <h2>{exercise.title}</h2>
                <Formula exercise={exercise} />
                {exercise.instructions && <p className="small sheet-instr">{exercise.instructions}</p>}
              </header>
              <div className="sheet-grid">
                {cells.map((c) => (
                  <Cell key={`${c.variant}-${c.key}`} cell={c} names={names} degrees={degrees} showRoman={settings.showRoman} />
                ))}
              </div>
            </section>
          ))}
          <footer className="sheet-foot small muted">Keys Lab · {new Date().toLocaleDateString()}</footer>
        </article>
      )}
    </div>
  )
}

function Formula({ exercise }: { exercise: Exercise }) {
  if (exercise.kind === 'progression' && exercise.progression?.events.length) {
    return <p className="small mono sheet-formula">{exercise.progression.events.map((e) => prettyAccidentals(`${e.roman}${e.quality ? e.quality : ''}`)).join(' – ')}</p>
  }
  if (!exercise.voicings.length) return null
  return (
    <p className="small mono sheet-formula">
      {exercise.voicings.map((v, i) => (
        <span key={v.id}>
          {i > 0 && ' · '}
          {exercise.voicings.length > 1 && <b>{v.name || `Variant ${i + 1}`}: </b>}
          {v.bass && `bass ${v.bass} | `}LH {v.lh || '—'} | RH {v.rh || '—'}
        </span>
      ))}
    </p>
  )
}

function Cell({ cell, names, degrees, showRoman }: { cell: SheetCell; names: boolean; degrees: boolean; showRoman: boolean }) {
  const r = cell.realized
  const allNotes = r.events.flatMap((e) => e.notes)
  const range = fitRange(allNotes, 48, 2)
  const multi = r.events.length > 1
  return (
    <div className={`sheet-cell ${multi ? 'is-prog' : ''}`}>
      <div className="sheet-cell-head">
        <b>{prettyAccidentals(r.heading)}</b>
        {cell.variantName && <span className="muted small">{cell.variantName}</span>}
      </div>
      {r.events.length === 0 && <p className="small muted">Nothing to show.</p>}
      <div className={multi ? 'sheet-events' : ''}>
        {r.events.map((ev, i) => (
          <div key={i} className="sheet-event">
            {multi && <div className="small center sheet-ev-label">{showRoman && ev.roman ? `${prettyAccidentals(ev.roman)} · ` : ''}<b>{ev.label}</b></div>}
            {ev.complete ? (
              <>
                <Keyboard {...range} notes={ev.notes} showNames={names} showDegrees={degrees} onKey={(m) => piano.tap(m)} />
                <div className="sheet-hands small">
                  {handLine(r, i, 'L') && <span><i className="sw hand-L" /> {handLine(r, i, 'L')}</span>}
                  {handLine(r, i, 'R') && <span><i className="sw hand-R" /> {handLine(r, i, 'R')}</span>}
                </div>
              </>
            ) : ev.tones.length ? (
              <p className="small sheet-tones">Chord tones: {ev.tones.map((t) => `${t.pitch} (${t.degree})`).join(', ')}</p>
            ) : (
              <p className="small muted">Free voicing</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
