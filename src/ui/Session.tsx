import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from './store'
import { MusicPanel, playExercise } from './MusicPanel'
import { Icon, MASTERY_LABEL, Segmented } from './common'
import { completedCount, currentTask } from '../schedule/session'
import { realizeExercise } from '../music/exercise'
import { progressId } from '../schedule/mastery'
import { piano } from '../audio/engine'
import { Generator } from './Generator'
import { keyLabel } from '../music/keys'
import type { Rating } from '../model/types'

const RATINGS: { r: Rating; label: string; hint: string }[] = [
  { r: 'again', label: 'Again', hint: 'Could not perform it correctly' },
  { r: 'hard', label: 'Hard', hint: 'Completed with difficulty' },
  { r: 'good', label: 'Good', hint: 'Completed reliably' },
  { r: 'easy', label: 'Easy', hint: 'Completed comfortably' },
]

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function SessionView({ onNew }: { onNew: () => void }) {
  const { session, exercises, settings, updateSettings, rate, move, tick, endSession, progress, startSession } = useStore()
  const [revealed, setRevealed] = useState(false)
  const [variant, setVariant] = useState(0)
  const [flash, setFlash] = useState<Rating | null>(null)
  const task = session ? currentTask(session) : undefined
  const exercise = exercises.find((e) => e.id === task?.exerciseId)
  const realized = useMemo(
    () => (exercise && task ? realizeExercise(exercise, task.key, { preferGb: settings.preferGb }, variant) : null),
    [exercise, task, settings.preferGb, variant],
  )
  const keyboardMode = settings.practiceMode === 'keyboard'

  useEffect(() => {
    setRevealed(false)
    setVariant(0)
    piano.stop()
  }, [task?.id])

  // session clock
  const last = useRef(Date.now())
  useEffect(() => {
    last.current = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      if (document.visibilityState === 'visible') tick(now - last.current)
      last.current = now
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reveal = () => {
    setRevealed((r) => {
      if (!r && settings.autoplayOnReveal && realized?.hasAnswer) playExercise(realized, settings, 'all')
      return !r
    })
  }
  const doRate = (r: Rating) => {
    setFlash(r)
    setTimeout(() => setFlash(null), 250)
    rate(r)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return
      if (!session || session.status !== 'active') return
      const k = e.key.toLowerCase()
      if (k === ' ') { e.preventDefault(); reveal() }
      else if (['1', '2', '3', '4'].includes(k)) doRate(RATINGS[Number(k) - 1].r)
      else if (k === 'arrowright') move(1)
      else if (k === 'arrowleft') move(-1)
      else if (k === 'k') updateSettings({ practiceMode: keyboardMode ? 'minimal' : 'keyboard' })
      else if (k === 'p' && realized) playExercise(realized, settings, 'all')
      else if (k === 'l' && realized) playExercise(realized, settings, 0, 'lh')
      else if (k === 'r' && realized) playExercise(realized, settings, 0, 'rh')
      else if (k === 'a' && realized) playExercise(realized, settings, 0, 'arpUp')
      else if (k === 's' || k === 'escape') piano.stop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!session) return null
  const done = completedCount(session)
  const total = session.tasks.length

  if (session.status === 'finished') {
    const counts = RATINGS.map(({ r, label }) => ({ label, r, n: Object.values(session.ratings).filter((x) => x === r).length }))
    return (
      <div className="session-done card">
        <div className="eyebrow">Session complete</div>
        <h1>{total} tasks · {fmt(session.elapsedMs)}</h1>
        <div className="summary-bars">
          {counts.map((c) => (
            <div key={c.r} className={`sumbar r-${c.r}`}>
              <span>{c.label}</span>
              <div><i style={{ width: `${(c.n / total) * 100}%` }} /></div>
              <b>{c.n}</b>
            </div>
          ))}
        </div>
        <table className="summary-table">
          <tbody>
            {session.exerciseIds.map((id) => {
              const ex = exercises.find((e) => e.id === id)
              return (
                <tr key={id}>
                  <td>{ex?.title ?? 'Deleted exercise'}</td>
                  {session.keys.map((k) => {
                    const t = session.tasks.find((x) => x.exerciseId === id && x.key === k)
                    const r = t && session.ratings[t.id]
                    const p = progress.get(progressId(id, k))
                    return (
                      <td key={k} className={`r-${r}`} title={p ? `${MASTERY_LABEL[p.mastery]} · next review ${new Date(p.due).toLocaleDateString()}` : ''}>
                        {keyLabel(k, ex?.tonality ?? 'major', { preferGb: settings.preferGb })}
                        <small>{r ?? '—'}</small>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="row gap wrap">
          <button className="btn primary" onClick={() => { endSession(); onNew() }}>New session</button>
          <button
            className="btn"
            onClick={() =>
              startSession({ ...session.params, keyMode: 'manual', manualKeys: session.keys, exerciseMode: 'manual', manualExercises: session.exerciseIds }, session.seed + 1)
            }
          >
            Practise the same set again
          </button>
        </div>
      </div>
    )
  }

  const target = session.params.timeTargetMin ? session.params.timeTargetMin * 60_000 : null
  const pairProgress = task ? progress.get(progressId(task.exerciseId, task.key)) : undefined

  return (
    <div className={`session ${flash ? `flash-${flash}` : ''}`}>
      <header className="session-head">
        <div className="progress-track" aria-label={`${done} of ${total} tasks complete`}>
          <i style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <div className="session-meta">
          <span className="count">
            {task && !session.ratings[task.id] ? (
              <><b>{done + 1}</b> / {total}</>
            ) : (
              <><b>Review</b> · {done} / {total} done</>
            )}
            {task && !session.ratings[task.id] && <span className="muted"> · {done} done</span>}
          </span>
          <span className={`clock ${target && session.elapsedMs > target ? 'over' : ''}`}>
            {fmt(session.elapsedMs)}
            {target && <span className="muted"> / {fmt(target)}</span>}
          </span>
          <Segmented
            size="sm" label="Practice mode" value={settings.practiceMode} onChange={(v) => updateSettings({ practiceMode: v })}
            options={[{ value: 'minimal', label: 'Minimal' }, { value: 'keyboard', label: <><Icon name="keys" /> Keyboard</>, title: 'Keyboard mode (K)' }]}
          />
          <button className="btn ghost sm" onClick={onNew}>New</button>
        </div>
      </header>

      {!exercise || !realized ? (
        <div className="card task">
          <p>This exercise was deleted from the library.</p>
          <button className="btn" onClick={() => move(1)}>Skip</button>
        </div>
      ) : (
        <article className="card task" aria-live="polite">
          <div className="task-top">
            <span className="eyebrow">{[exercise.category, exercise.unit].filter(Boolean).join(' · ')}</span>
            <span className={`badge m-${pairProgress?.mastery ?? 'new'}`}>{MASTERY_LABEL[pairProgress?.mastery ?? 'new']} in {realized.keyName}</span>
          </div>
          <div className="task-main">
            <div className="task-key" aria-label={`Key ${realized.keyName}`}>
              <span>{realized.keyName}</span>
              <small>{exercise.progression?.events.length ? exercise.progression.tonality : exercise.tonality}</small>
            </div>
            <div className="task-title">
              <h2>{exercise.title}</h2>
              <p className="heading">{realized.heading}</p>
              {exercise.instructions && <p className="instructions">{exercise.instructions}</p>}
            </div>
          </div>

          <MusicPanel
            exercise={exercise} realized={realized} revealed={revealed} showKeyboard={keyboardMode}
            variant={variant} onVariant={setVariant}
          />

          <div className="reveal-row">
            <button className="btn reveal" onClick={reveal} aria-pressed={revealed}>
              <Icon name="eye" /> {revealed ? 'Hide answer' : 'Reveal answer'} <kbd>Space</kbd>
            </button>
          </div>
        </article>
      )}

      <footer className="rate-bar">
        <button className="btn icon-btn nav" onClick={() => move(-1)} aria-label="Previous task (←)" title="Previous (←)"><Icon name="prev" /></button>
        <div className="ratings">
          {RATINGS.map(({ r, label, hint }, i) => (
            <button key={r} className={`rate r-${r}`} onClick={() => doRate(r)} title={`${hint} (${i + 1})`}>
              <span>{label}</span>
              <kbd>{i + 1}</kbd>
            </button>
          ))}
        </div>
        <button className="btn icon-btn nav" onClick={() => move(1)} aria-label="Next task (→)" title="Next (→)"><Icon name="next" /></button>
      </footer>
      <p className="shortcuts muted small">Space reveal · 1–4 rate · ←/→ navigate · K keyboard · P play · L/R hands · A arpeggio · S stop</p>
    </div>
  )
}

export function PracticeView() {
  const { session } = useStore()
  const [chooser, setChooser] = useState(false)
  const prevId = useRef(session?.id)
  useEffect(() => {
    if (session?.id !== prevId.current) {
      prevId.current = session?.id
      setChooser(false)
    }
  }, [session?.id])
  if (session && !chooser) return <SessionView onNew={() => setChooser(true)} />
  return <Generator onResume={session?.status === 'active' ? () => setChooser(false) : undefined} />
}
