import { useMemo, useState } from 'react'
import { useStore } from './store'
import { Icon, KeyChips, Segmented } from './common'
import { MusicPanel } from './MusicPanel'
import { realizeExercise } from '../music/exercise'
import { CATEGORIES } from '../data/starter'
import { newId } from '../db/service'
import { midiOf, parseSpelled, noteName, defaultSpelling } from '../music/pitch'
import type { Exercise, ExerciseKind, ProgressionEvent, Tonality, VoicingDef } from '../model/types'

export function blankExercise(): Exercise {
  const id = newId()
  const now = Date.now()
  return {
    id, title: '', kind: 'voicing', category: 'Extensions', unit: '', tags: [], instructions: '', tonality: 'major', archived: false,
    createdAt: now, updatedAt: now,
    voicings: [{ id: `${id}-v1`, name: 'Voicing', symbol: '', lh: '', rh: '', anchorOctave: 3 }],
  }
}

const blankEvent = (): ProgressionEvent => ({ id: newId('ev'), roman: 'I', quality: '', beats: 4 })

function parseMidiName(t: string): number | undefined {
  const m = /^\s*([A-Ga-g](?:bb|b|##|#|♭|♯)?)(-?\d)\s*$/.exec(t)
  if (!m) return undefined
  try {
    return midiOf(parseSpelled(m[1]), Number(m[2]))
  } catch {
    return undefined
  }
}
const midiText = (m?: number) => (m === undefined ? '' : noteName(m, defaultSpelling(m % 12)))

function RegisterInput({ value, onChange, placeholder }: { value?: number; onChange: (m?: number) => void; placeholder: string }) {
  const [t, setT] = useState(midiText(value))
  const bad = t.trim() !== '' && parseMidiName(t) === undefined
  return (
    <input
      className={`input sm ${bad ? 'invalid' : ''}`} value={t} placeholder={placeholder}
      onChange={(e) => {
        setT(e.target.value)
        const m = parseMidiName(e.target.value)
        if (e.target.value.trim() === '') onChange(undefined)
        else if (m !== undefined) onChange(m)
      }}
    />
  )
}

export function Editor({ initial, onClose }: { initial: Exercise; onClose: (savedId?: string) => void }) {
  const { saveExercise, exercises, settings } = useStore()
  const [e, setE] = useState<Exercise>(() => structuredClone(initial))
  const [previewKey, setPreviewKey] = useState(0)
  const [variant, setVariant] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const set = (patch: Partial<Exercise>) => setE((x) => ({ ...x, ...patch }))
  const setV = (i: number, patch: Partial<VoicingDef>) => setE((x) => ({ ...x, voicings: x.voicings.map((v, j) => (j === i ? { ...v, ...patch } : v)) }))
  const prog = e.progression ?? { tonality: 'major' as const, anchorOctave: null, events: [] }
  const setP = (patch: Partial<typeof prog>) => setE((x) => ({ ...x, progression: { ...prog, ...x.progression, ...patch } }))
  const setEv = (i: number, patch: Partial<ProgressionEvent>) => setP({ events: prog.events.map((ev, j) => (j === i ? { ...ev, ...patch } : ev)) })
  const usesProgression = e.kind === 'progression' || ((e.kind === 'technique' || e.kind === 'drill') && !!e.progression)
  const usesVoicings = e.kind === 'voicing' || (e.kind === 'drill' && !e.progression)

  const categories = [...new Set([...CATEGORIES.map((c) => c.name), ...exercises.map((x) => x.category)])]
  const units = [...new Set([...(CATEGORIES.find((c) => c.name === e.category)?.units ?? []), ...exercises.filter((x) => x.category === e.category).map((x) => x.unit)])]

  const realized = useMemo(() => {
    try {
      return realizeExercise({ ...e, progression: usesProgression ? prog : undefined, voicings: usesVoicings ? e.voicings : [] }, previewKey, { preferGb: settings.preferGb }, variant)
    } catch {
      return null
    }
  }, [e, previewKey, variant, settings.preferGb, usesProgression, usesVoicings, prog])

  const save = async () => {
    if (!e.title.trim()) return setErr('Give the exercise a title.')
    const out: Exercise = {
      ...e, title: e.title.trim(), template: e.template && !(e.voicings.some((v) => v.lh || v.rh) || prog.events.length),
      voicings: usesVoicings ? e.voicings : [], progression: usesProgression ? prog : undefined,
    }
    await saveExercise(out)
    onClose(out.id)
  }

  return (
    <div className="editor card">
      <div className="editor-head">
        <h2>{initial.title ? `Edit “${initial.title}”` : 'New exercise'}</h2>
        <div className="row gap">
          <button className="btn ghost" onClick={() => onClose()}>Cancel</button>
          <button className="btn primary" onClick={save}>Save</button>
        </div>
      </div>
      {err && <p className="error">{err}</p>}

      <div className="form-grid">
        <label className="span2">Title<input className="input" value={e.title} onChange={(x) => set({ title: x.target.value })} placeholder="e.g. Kenny Barron minor 11" autoFocus /></label>
        <label>Type
          <select className="input" value={e.kind} onChange={(x) => {
            const kind = x.target.value as ExerciseKind
            set({ kind, progression: kind === 'progression' && !e.progression ? { tonality: 'major', anchorOctave: 3, events: [blankEvent()] } : e.progression })
          }}>
            <option value="voicing">Voicing / chord</option>
            <option value="progression">Progression</option>
            <option value="drill">Drill</option>
            <option value="technique">Technique (instructions only)</option>
          </select>
        </label>
        <label>Key context
          <select className="input" value={e.tonality} onChange={(x) => set({ tonality: x.target.value as Tonality })}>
            <option value="major">Major</option><option value="minor">Minor</option><option value="dominant">Dominant</option>
          </select>
        </label>
        <label>Category
          <input className="input" list="cats" value={e.category} onChange={(x) => set({ category: x.target.value })} />
          <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label>Unit
          <input className="input" list="units" value={e.unit} onChange={(x) => set({ unit: x.target.value })} />
          <datalist id="units">{units.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label className="span2">Tags <input className="input" value={e.tags.join(', ')} onChange={(x) => set({ tags: x.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} placeholder="comma separated" /></label>
        <label className="span2">Instructions<textarea className="input" rows={2} value={e.instructions} onChange={(x) => set({ instructions: x.target.value })} /></label>
        {(e.kind === 'drill' || e.kind === 'technique') && (
          <label className="span2 check">
            <input type="checkbox" checked={!!e.progression} onChange={(x) => set({ progression: x.target.checked ? { tonality: 'major', anchorOctave: null, events: [blankEvent()] } : undefined })} />
            Attach a progression (instead of voicings)
          </label>
        )}
      </div>

      {usesVoicings && (
        <section className="sub-editor">
          <div className="sub-head">
            <h3>Voicings</h3>
            <button className="btn sm" onClick={() => { set({ voicings: [...e.voicings, { ...(e.voicings[variant] ?? e.voicings[0] ?? blankExercise().voicings[0]), id: newId('v'), name: `Variant ${e.voicings.length + 1}` }] }); setVariant(e.voicings.length) }}><Icon name="plus" /> Add variant</button>
          </div>
          <p className="muted small help">
            Enter degrees per hand in order from low to high: <code>1 5 9</code>, <code>b3 b7 11</code>. Notes stack upward from the root placed in the register octave.
            Add <code>+</code> or <code>-</code> after a degree to move it an octave. Leave the register empty if you only want chord tones (no keyboard answer).
          </p>
          {e.voicings.map((v, i) => (
            <div key={v.id} className={`voicing-row ${i === variant ? 'active' : ''}`} onFocus={() => setVariant(i)}>
              <div className="vr-grid">
                <label>Name<input className="input sm" value={v.name} onChange={(x) => setV(i, { name: x.target.value })} /></label>
                <label>Chord symbol<input className="input sm" value={v.symbol} onChange={(x) => setV(i, { symbol: x.target.value })} placeholder="m11, maj9, 7(b9,#5)" /></label>
                <label className="lh">Left hand<input className="input sm mono" value={v.lh} onChange={(x) => setV(i, { lh: x.target.value })} placeholder="1 5 9" /></label>
                <label className="rh">Right hand<input className="input sm mono" value={v.rh} onChange={(x) => setV(i, { rh: x.target.value })} placeholder="b3 b7 11" /></label>
                <label>Bass<input className="input sm mono" value={v.bass ?? ''} onChange={(x) => setV(i, { bass: x.target.value || undefined })} placeholder="optional" /></label>
                <label>Register (root octave)
                  <select className="input sm" value={v.anchorOctave ?? ''} onChange={(x) => setV(i, { anchorOctave: x.target.value === '' ? null : Number(x.target.value) })}>
                    <option value="">Not specified</option>
                    {[1, 2, 3, 4, 5].map((o) => <option key={o} value={o}>Octave {o} (C{o}–B{o})</option>)}
                  </select>
                </label>
                <label>Lowest allowed<RegisterInput value={v.minMidi} onChange={(m) => setV(i, { minMidi: m })} placeholder="e.g. C2" /></label>
                <label>Highest allowed<RegisterInput value={v.maxMidi} onChange={(m) => setV(i, { maxMidi: m })} placeholder="e.g. G5" /></label>
                <label>Style
                  <select className="input sm" value={v.style ?? 'harmonic'} onChange={(x) => setV(i, { style: x.target.value as 'harmonic' | 'melodic' })}>
                    <option value="harmonic">Chord (harmonic)</option><option value="melodic">Line (scale/arpeggio)</option>
                  </select>
                </label>
                <label>Context<input className="input sm" value={v.context ?? ''} onChange={(x) => setV(i, { context: x.target.value || undefined })} placeholder="harmonic context" /></label>
              </div>
              {e.voicings.length > 1 && (
                <button className="btn ghost sm" onClick={() => { set({ voicings: e.voicings.filter((_, j) => j !== i) }); setVariant(0) }}>Remove variant</button>
              )}
            </div>
          ))}
        </section>
      )}

      {usesProgression && (
        <section className="sub-editor">
          <div className="sub-head">
            <h3>Progression</h3>
            <div className="row gap wrap">
              <Segmented size="sm" label="Mode" value={prog.tonality} onChange={(t) => setP({ tonality: t })} options={[{ value: 'major', label: 'Major' }, { value: 'minor', label: 'Minor' }]} />
              <select className="input sm" value={prog.anchorOctave ?? ''} onChange={(x) => setP({ anchorOctave: x.target.value === '' ? null : Number(x.target.value) })} aria-label="Register">
                <option value="">Open-ended (free voicing)</option>
                {[2, 3, 4].map((o) => <option key={o} value={o}>Tonic in octave {o}</option>)}
              </select>
            </div>
          </div>
          <p className="muted small help">
            Roman numerals are relative to the major scale of the key in both modes (minor: <code>i iiø7 bIII iv V7 bVI bVII</code>). Leave hands empty for
            free-voicing events. Octave shifts the chord root (e.g. <code>-1</code> to keep V below ii for smooth voice leading).
          </p>
          <div className="events">
            <div className="ev-row ev-head">
              <span>Numeral</span><span>Quality</span><span>Beats</span><span>LH</span><span>RH</span><span>Oct</span><span>Bass</span><span />
            </div>
            {prog.events.map((ev, i) => (
              <div key={ev.id} className="ev-row">
                <input className="input sm mono" aria-label="Roman numeral" value={ev.roman} onChange={(x) => setEv(i, { roman: x.target.value })} />
                <input className="input sm mono" aria-label="Quality" value={ev.quality} onChange={(x) => setEv(i, { quality: x.target.value })} placeholder="auto" />
                <input className="input sm" aria-label="Beats" type="number" min={1} max={16} value={ev.beats ?? 4} onChange={(x) => setEv(i, { beats: Number(x.target.value) || 4 })} />
                <input className="input sm mono" aria-label="Left hand" value={ev.voicing?.lh ?? ''} disabled={prog.anchorOctave === null} onChange={(x) => setEv(i, { voicing: { lh: x.target.value, rh: ev.voicing?.rh ?? '' } })} placeholder={prog.anchorOctave === null ? 'free' : 'b3 5 b7 9'} />
                <input className="input sm mono" aria-label="Right hand" value={ev.voicing?.rh ?? ''} disabled={prog.anchorOctave === null} onChange={(x) => setEv(i, { voicing: { lh: ev.voicing?.lh ?? '', rh: x.target.value } })} placeholder={prog.anchorOctave === null ? 'free' : ''} />
                <input className="input sm" aria-label="Octave shift" type="number" min={-2} max={2} value={ev.octave ?? 0} onChange={(x) => setEv(i, { octave: Number(x.target.value) || 0 })} />
                <input className="input sm mono" aria-label="Bass degree" value={ev.bass ?? ''} onChange={(x) => setEv(i, { bass: x.target.value || undefined })} placeholder="—" />
                <button className="btn ghost icon-btn sm" aria-label="Remove chord" onClick={() => setP({ events: prog.events.filter((_, j) => j !== i) })}><Icon name="close" /></button>
              </div>
            ))}
            <button className="btn sm" onClick={() => setP({ events: [...prog.events, blankEvent()] })}><Icon name="plus" /> Add chord</button>
          </div>
        </section>
      )}

      {(usesVoicings || usesProgression) && realized && (
        <section className="sub-editor preview">
          <div className="sub-head">
            <h3>Preview <span className="muted">{realized.heading}</span></h3>
          </div>
          <KeyChips selected={[previewKey]} onToggle={setPreviewKey} tonality={e.tonality} preferGb={settings.preferGb} single />
          {realized.errors.length > 0 && <p className="error">{realized.errors.join(' · ')}</p>}
          <MusicPanel exercise={{ ...e, voicings: usesVoicings ? e.voicings : [], progression: usesProgression ? prog : undefined }} realized={realized} revealed showKeyboard variant={variant} onVariant={setVariant} />
        </section>
      )}
      <div className="row gap end">
        <button className="btn ghost" onClick={() => onClose()}>Cancel</button>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
    </div>
  )
}
