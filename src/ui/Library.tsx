import { useMemo, useState } from 'react'
import { useStore } from './store'
import { Icon, KeyChips, MASTERY_LABEL, MasteryDots } from './common'
import { MusicPanel } from './MusicPanel'
import { Editor, blankExercise } from './Editor'
import { realizeExercise } from '../music/exercise'
import { keyLabel, ALL_KEYS } from '../music/keys'
import { progressId } from '../schedule/mastery'
import { duplicateExercise } from '../db/service'
import { CATEGORIES } from '../data/starter'
import type { Exercise } from '../model/types'

const KIND_LABEL = { voicing: 'Voicing', progression: 'Progression', drill: 'Drill', technique: 'Technique' }

export function LibraryView() {
  const { exercises, progress, settings } = useStore()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<Exercise | null>(null)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return exercises.filter(
      (e) =>
        (showArchived ? e.archived : !e.archived) &&
        (!cat || e.category === cat) &&
        (!needle ||
          [e.title, e.unit, e.category, e.instructions, ...e.tags, ...e.voicings.map((v) => `${v.name} ${v.symbol} ${v.lh} ${v.rh}`)]
            .join(' ')
            .toLowerCase()
            .includes(needle)),
    )
  }, [exercises, q, cat, showArchived])

  const order = [...CATEGORIES.map((c) => c.name), ...new Set(exercises.map((e) => e.category))]
  const groups = [...new Set(order)]
    .map((c) => ({ c, items: filtered.filter((e) => e.category === c) }))
    .filter((g) => g.items.length)
  const current = exercises.find((e) => e.id === selected)

  if (editing) {
    return <Editor initial={editing} onClose={(id) => { setEditing(null); if (id) setSelected(id) }} />
  }

  return (
    <div className={`library ${current ? 'has-detail' : ''}`}>
      <aside className="lib-list">
        <div className="lib-tools">
          <div className="search">
            <Icon name="search" />
            <input className="input" placeholder="Search title, unit, tag, formula…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search library" />
          </div>
          <div className="row gap wrap">
            <select className="input sm" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {[...new Set(order)].map((c) => <option key={c}>{c}</option>)}
            </select>
            <label className="small"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Archived</label>
            <button className="btn primary sm" onClick={() => setEditing(blankExercise())}><Icon name="plus" /> New</button>
          </div>
        </div>
        <div className="lib-groups">
          {groups.length === 0 && <p className="muted pad">No exercises match.</p>}
          {groups.map((g) => (
            <section key={g.c}>
              <h4 className="group-title">{g.c} <span className="muted">{g.items.length}</span></h4>
              <ul>
                {g.items.map((e) => (
                  <li key={e.id}>
                    <button className={`lib-item ${selected === e.id ? 'active' : ''}`} onClick={() => setSelected(e.id)}>
                      <span className="li-title">{e.title}</span>
                      <span className="li-meta">
                        <span className="muted">{e.unit}</span>
                        <span className={`kind k-${e.kind}`}>{e.template ? 'Template' : KIND_LABEL[e.kind]}</span>
                      </span>
                      <MasteryDots exerciseId={e.id} progress={progress} tonality={e.tonality} preferGb={settings.preferGb} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </aside>
      <main className="lib-detail">
        {current ? (
          <Detail key={current.id} exercise={current} onEdit={() => setEditing(current)} onClose={() => setSelected(null)} onSelect={setSelected} />
        ) : (
          <div className="empty muted">
            <p>Select an exercise to view, hear and transpose it.</p>
          </div>
        )}
      </main>
    </div>
  )
}

function Detail({ exercise, onEdit, onClose, onSelect }: { exercise: Exercise; onEdit: () => void; onClose: () => void; onSelect: (id: string | null) => void }) {
  const { settings, progress, saveExercise, deleteExercise } = useStore()
  const [key, setKey] = useState(0)
  const [variant, setVariant] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const realized = useMemo(() => realizeExercise(exercise, key, { preferGb: settings.preferGb }, variant), [exercise, key, variant, settings.preferGb])

  return (
    <div className="detail">
      <div className="detail-head">
        <button className="btn ghost icon-btn back" onClick={onClose} aria-label="Back to list"><Icon name="prev" /></button>
        <div>
          <div className="eyebrow">{[exercise.category, exercise.unit, KIND_LABEL[exercise.kind]].filter(Boolean).join(' · ')}</div>
          <h2>{exercise.title}</h2>
          {exercise.tags.length > 0 && <div className="tags">{exercise.tags.map((t) => <span key={t} className="tag">#{t}</span>)}</div>}
        </div>
      </div>
      {exercise.instructions && <p className="instructions">{exercise.instructions}</p>}

      <div className="transpose">
        <span className="small muted">Transpose</span>
        <KeyChips selected={[key]} onToggle={setKey} tonality={exercise.tonality} preferGb={settings.preferGb} single />
      </div>
      <p className="heading">{realized.heading}</p>
      {realized.errors.length > 0 && <p className="error">{realized.errors.join(' · ')}</p>}

      <MusicPanel exercise={exercise} realized={realized} revealed showKeyboard variant={variant} onVariant={setVariant} />

      {exercise.voicings[variant] && (
        <dl className="formula">
          <dt>Formula</dt>
          <dd>
            {exercise.voicings[variant].bass && <>Bass <code>{exercise.voicings[variant].bass}</code> · </>}
            LH <code>{exercise.voicings[variant].lh || '—'}</code> · RH <code>{exercise.voicings[variant].rh || '—'}</code>
          </dd>
          <dt>Register</dt>
          <dd>{exercise.voicings[variant].anchorOctave === null ? 'Not specified (chord tones only)' : `Root in octave ${exercise.voicings[variant].anchorOctave}`}</dd>
          {exercise.voicings[variant].context && (<><dt>Context</dt><dd>{exercise.voicings[variant].context}</dd></>)}
        </dl>
      )}

      <section className="mastery-grid">
        <h4>Mastery by key</h4>
        <div className="mg">
          {ALL_KEYS.map((k) => {
            const p = progress.get(progressId(exercise.id, k))
            return (
              <div key={k} className={`mg-cell m-${p?.mastery ?? 'new'}`} title={p ? `${p.attempts} attempts · last ${p.lastAttempt ? new Date(p.lastAttempt).toLocaleDateString() : '—'} · recent ${p.history.slice(-5).map((h) => h.r).join(', ')}` : 'Never practised'}>
                <b>{keyLabel(k, exercise.tonality, { preferGb: settings.preferGb })}</b>
                <span>{MASTERY_LABEL[p?.mastery ?? 'new']}</span>
                <small>{p ? (p.due <= Date.now() ? 'due now' : `due ${new Date(p.due).toLocaleDateString()}`) : ''}</small>
              </div>
            )
          })}
        </div>
      </section>

      <div className="row gap wrap actions">
        <button className="btn" onClick={onEdit}>Edit</button>
        <button className="btn" onClick={async () => { const d = duplicateExercise(exercise); await saveExercise(d); onSelect(d.id) }}>Duplicate</button>
        <button className="btn" onClick={() => saveExercise({ ...exercise, archived: !exercise.archived })}>{exercise.archived ? 'Unarchive' : 'Archive'}</button>
        {!confirm ? (
          <button className="btn danger-ghost" onClick={() => setConfirm(true)}>Delete</button>
        ) : (
          <span className="confirm">
            Delete “{exercise.title}” and its practice history?
            <button className="btn danger" onClick={async () => { await deleteExercise(exercise.id); onSelect(null) }}>Delete</button>
            <button className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button>
          </span>
        )}
      </div>
    </div>
  )
}
