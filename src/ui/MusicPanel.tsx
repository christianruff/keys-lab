import { useEffect, useMemo, useState } from 'react'
import { Keyboard, fitRange } from './Keyboard'
import { Icon } from './common'
import { piano } from '../audio/engine'
import { planEvent, planLine, planProgression, type PlayMode } from '../audio/plan'
import type { RealizedExercise, MusicEvent } from '../music/exercise'
import type { Exercise, Settings } from '../model/types'
import { useStore } from './store'
import { prettyAccidentals } from '../music/pitch'

export function useNarrow(px = 640) {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < px)
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < px)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [px])
  return narrow
}

export function usePlayingEvent() {
  const [state, setState] = useState<{ playing: boolean; event: number | null }>({ playing: false, event: null })
  useEffect(() => {
    const off = piano.subscribe((s) => setState({ playing: s.playing, event: s.event }))
    return () => {
      off()
    }
  }, [])
  return state
}

/** Imperative playback helpers shared by keyboard shortcuts and buttons. */
export function playExercise(r: RealizedExercise, settings: Settings, step: number | 'all', mode: PlayMode | 'auto' = 'auto') {
  if (!r.hasAnswer && !(step !== 'all' && r.events[step]?.complete)) return
  const tempo = settings.tempo
  if (r.events.length > 1 && step === 'all' && mode === 'auto') {
    piano.play(planProgression(r.events, tempo, { countIn: settings.countIn, metronome: settings.metronome }))
    return
  }
  const idx = step === 'all' ? 0 : step
  const ev = r.events[idx]
  if (!ev || !ev.complete) return
  if (mode === 'auto') {
    piano.play(r.melodic ? planLine(ev, tempo) : planEvent(ev, 'chord', tempo, idx))
  } else {
    piano.play(planEvent(ev, mode, tempo, idx))
  }
}

function NotesByHand({ ev }: { ev: MusicEvent }) {
  if (!ev.complete) return null
  const lh = ev.notes.filter((n) => n.hand === 'L')
  const rh = ev.notes.filter((n) => n.hand === 'R')
  const row = (label: string, cls: string, notes: typeof lh) =>
    notes.length > 0 && (
      <div className={`hand-row ${cls}`}>
        <span className="hand-tag">{label}</span>
        <span className="hand-notes">
          {notes.map((n) => (
            <span key={n.midi} className="note-pill">
              <b>{n.name}</b>
              <small>{n.degree}</small>
            </span>
          ))}
        </span>
      </div>
    )
  return (
    <div className="hands">
      {row('LH', 'hand-L', lh)}
      {row('RH', 'hand-R', rh)}
    </div>
  )
}

function Tones({ ev }: { ev: MusicEvent }) {
  if (!ev.tones.length) return null
  return (
    <div className="tones">
      {ev.tones.map((t, i) => (
        <span key={i} className="tone">
          {t.pitch}
          <small>{t.degree}</small>
        </span>
      ))}
    </div>
  )
}

export interface MusicPanelProps {
  exercise: Exercise
  realized: RealizedExercise
  revealed: boolean
  showKeyboard: boolean
  variant: number
  onVariant: (i: number) => void
  compact?: boolean
}

export function MusicPanel({ exercise, realized, revealed, showKeyboard, variant, onVariant }: MusicPanelProps) {
  const { settings, updateSettings } = useStore()
  const narrow = useNarrow()
  const isProg = realized.events.length > 1 || exercise.kind === 'progression' || !!exercise.progression?.events.length
  const [step, setStep] = useState<number | 'all'>('all')
  const playing = usePlayingEvent()
  useEffect(() => setStep('all'), [exercise.id, realized.keyName])
  const activeStep = playing.playing && playing.event !== null && isProg ? playing.event : step
  const shownEvents = activeStep === 'all' ? realized.events : realized.events.filter((_, i) => i === activeStep)
  const canPlay = realized.hasAnswer || (step !== 'all' && !!realized.events[step]?.complete)
  const currentEv = realized.events[step === 'all' ? 0 : step]

  const allNotes = useMemo(() => realized.events.flatMap((e) => e.notes), [realized])
  const multiRange = fitRange(allNotes, settings.keyboardStartOctave * 12 + 24, 2)
  const range = fitRange(allNotes, settings.keyboardStartOctave * 12 + 12, narrow ? Math.min(3, settings.keyboardOctaves) : settings.keyboardOctaves)

  return (
    <div className="music-panel">
      {exercise.voicings.length > 1 && (
        <div className="variant-tabs" role="tablist" aria-label="Voicing variants">
          {exercise.voicings.map((v, i) => (
            <button key={v.id} role="tab" aria-selected={i === variant} className={`chip ${i === variant ? 'active' : ''}`} onClick={() => onVariant(i)}>
              {v.name || `Variant ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {isProg && (
        <div className="event-strip" role="tablist" aria-label="Progression chords">
          <button className={`event-chip ${activeStep === 'all' ? 'active' : ''}`} onClick={() => setStep('all')}>All</button>
          {realized.events.map((e, i) => (
            <button key={i} className={`event-chip ${activeStep === i ? 'active' : ''}`} onClick={() => setStep(i)} title={`${e.beats} beats`}>
              {settings.showRoman && <small>{prettyAccidentals(e.roman ?? "")}</small>}
              <b>{e.label}</b>
            </button>
          ))}
        </div>
      )}

      {showKeyboard && (
        <div className="kb-wrap">
          {realized.hasAnswer || (step !== 'all' && currentEv?.complete) ? (
            activeStep === 'all' && realized.events.length > 1 ? (
              <div className="kb-multi">
                {realized.events.map((e, i) => (
                  <Keyboard
                    key={i} {...multiRange} notes={revealed ? e.notes : []} showNames={settings.showNoteNames}
                    showDegrees={settings.showDegrees} onKey={(m) => piano.tap(m)} caption={settings.showRoman ? `${prettyAccidentals(e.roman ?? '')} · ${e.label}` : e.label}
                  />
                ))}
              </div>
            ) : (
              <Keyboard
                {...range} notes={revealed ? (shownEvents[0]?.notes ?? []) : []} showNames={settings.showNoteNames}
                showDegrees={settings.showDegrees} onKey={(m) => piano.tap(m)}
                caption={shownEvents[0] ? (settings.showRoman && shownEvents[0].roman ? `${prettyAccidentals(shownEvents[0].roman ?? '')} · ` : '') + shownEvents[0].label : undefined}
              />
            )
          ) : (
            <>
              <Keyboard {...range} notes={[]} onKey={(m) => piano.tap(m)} dim />
              <p className="muted small center">No fixed answer is defined for this exercise, so nothing is shown on the keyboard.</p>
            </>
          )}
          {!revealed && realized.hasAnswer && <p className="muted small center">Answer hidden. Press Reveal (Space) to show the notes.</p>}
          <div className="kb-toggles">
            <label><input type="checkbox" checked={settings.showNoteNames} onChange={(e) => updateSettings({ showNoteNames: e.target.checked })} /> Note names</label>
            <label><input type="checkbox" checked={settings.showDegrees} onChange={(e) => updateSettings({ showDegrees: e.target.checked })} /> Degrees</label>
            {isProg && <label><input type="checkbox" checked={settings.showRoman} onChange={(e) => updateSettings({ showRoman: e.target.checked })} /> Roman numerals</label>}
            <span className="legend"><i className="sw hand-L" /> Left <i className="sw hand-R" /> Right</span>
          </div>
        </div>
      )}

      {revealed && (
        <div className="answer">
          {realized.hasAnswer ? (
            shownEvents.map((e, i) => (
              <div key={i} className="answer-event">
                {shownEvents.length > 1 || isProg ? (
                  <div className="answer-head">
                    {settings.showRoman && e.roman && <span className="roman">{prettyAccidentals(e.roman)}</span>}
                    <b>{e.label}</b>
                  </div>
                ) : null}
                <NotesByHand ev={e} />
              </div>
            ))
          ) : (
            <div className="no-answer">
              <p>
                <b>No fixed answer.</b> {realized.incompleteReason ?? 'This exercise is instruction-only.'}
              </p>
              {shownEvents.map((e, i) =>
                e.tones.length ? (
                  <div key={i} className="answer-event">
                    {(isProg || shownEvents.length > 1) && (
                      <div className="answer-head">
                        {settings.showRoman && e.roman && <span className="roman">{prettyAccidentals(e.roman)}</span>}
                        <b>{e.label}</b> <span className="muted small">chord tones</span>
                      </div>
                    )}
                    <Tones ev={e} />
                  </div>
                ) : null,
              )}
            </div>
          )}
        </div>
      )}

      <div className="audio-bar" aria-label="Playback">
        <div className="audio-buttons">
          <button className="btn icon-btn primary-soft" disabled={!canPlay} onClick={() => playExercise(realized, settings, step)} title="Play (P)">
            <Icon name="play" /> <span>{isProg && step === 'all' ? 'Play all' : 'Play'}</span>
          </button>
          {isProg && step !== 'all' && (
            <button className="btn icon-btn" disabled={!realized.hasAnswer} onClick={() => playExercise(realized, settings, 'all')} title="Play the whole progression">
              <Icon name="replay" /> <span>All</span>
            </button>
          )}
          <button className="btn" disabled={!currentEv?.complete || !currentEv.notes.some((n) => n.hand === 'L')} onClick={() => playExercise(realized, settings, step === 'all' ? 0 : step, 'lh')} title="Left hand (L)">LH</button>
          <button className="btn" disabled={!currentEv?.complete || !currentEv.notes.some((n) => n.hand === 'R')} onClick={() => playExercise(realized, settings, step === 'all' ? 0 : step, 'rh')} title="Right hand (R)">RH</button>
          <button className="btn icon-btn" disabled={!currentEv?.complete} onClick={() => playExercise(realized, settings, step === 'all' ? 0 : step, 'arpUp')} title="Arpeggiate up (A)" aria-label="Arpeggiate up"><Icon name="up" /></button>
          <button className="btn icon-btn" disabled={!currentEv?.complete} onClick={() => playExercise(realized, settings, step === 'all' ? 0 : step, 'arpDown')} title="Arpeggiate down" aria-label="Arpeggiate down"><Icon name="down" /></button>
          <button className="btn icon-btn" onClick={() => piano.stop()} title="Stop (S / Esc)" aria-label="Stop"><Icon name="stop" /></button>
        </div>
        <div className="audio-settings">
          <label className="tempo">
            <span>♩ = {settings.tempo}</span>
            <input type="range" min={40} max={200} step={2} value={settings.tempo} onChange={(e) => updateSettings({ tempo: Number(e.target.value) })} aria-label="Tempo" />
          </label>
          {isProg && (
            <>
              <label className="small"><input type="checkbox" checked={settings.countIn} onChange={(e) => updateSettings({ countIn: e.target.checked })} /> Count-in</label>
              <label className="small"><input type="checkbox" checked={settings.metronome} onChange={(e) => updateSettings({ metronome: e.target.checked })} /> Click</label>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
