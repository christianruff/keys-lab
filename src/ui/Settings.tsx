import { useEffect, useRef, useState } from 'react'
import { useStore } from './store'
import { Segmented } from './common'
import { isStandalone, pwaState, subscribePwa } from '../pwa'

const canShareFiles = () => {
  try {
    return !!navigator.canShare?.({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] })
  } catch {
    return false
  }
}

export function SettingsView() {
  const { settings, updateSettings, exportJson, importJson, resetLibrary } = useStore()
  const file = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [msg, setMsg] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [pwa, setPwa] = useState(pwaState)
  useEffect(() => subscribePwa(setPwa), [])
  const share = canShareFiles()
  const toggle = (k: 'showNoteNames' | 'showDegrees' | 'showRoman' | 'autoplayOnReveal' | 'countIn' | 'metronome' | 'preferGb', label: string, hint?: string) => (
    <label className="setting-check">
      <input type="checkbox" checked={settings[k]} onChange={(e) => updateSettings({ [k]: e.target.checked })} />
      <span>{label}{hint && <small className="muted"> {hint}</small>}</span>
    </label>
  )
  return (
    <div className="settings">
      <section className="card">
        <h3>Appearance</h3>
        <div className="setting"><span>Theme</span>
          <Segmented label="Theme" value={settings.theme} onChange={(v) => updateSettings({ theme: v })} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        </div>
        <div className="setting"><span>Default practice mode</span>
          <Segmented label="Practice mode" value={settings.practiceMode} onChange={(v) => updateSettings({ practiceMode: v })} options={[{ value: 'minimal', label: 'Minimal' }, { value: 'keyboard', label: 'Keyboard' }]} />
        </div>
        <div className="setting"><span>Keyboard size</span>
          <Segmented label="Octaves" value={String(settings.keyboardOctaves) as '2'} onChange={(v) => updateSettings({ keyboardOctaves: Number(v) })} options={['2', '3', '4', '5'].map((o) => ({ value: o as '2', label: `${o} oct` }))} />
        </div>
        <div className="setting"><span>Keyboard starts at</span>
          <Segmented label="Start octave" value={String(settings.keyboardStartOctave) as '1'} onChange={(v) => updateSettings({ keyboardStartOctave: Number(v) })} options={['1', '2', '3'].map((o) => ({ value: o as '1', label: `C${o}` }))} />
        </div>
        {toggle('showNoteNames', 'Show note names on the keyboard')}
        {toggle('showDegrees', 'Show chord degrees on the keyboard')}
        {toggle('showRoman', 'Show Roman numerals for progressions')}
        {toggle('preferGb', 'Spell the F♯/G♭ major key as G♭')}
      </section>
      <section className="card">
        <h3>Audio</h3>
        <div className="setting"><span>Volume</span>
          <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => updateSettings({ volume: Number(e.target.value) })} aria-label="Volume" />
        </div>
        <div className="setting"><span>Tempo ♩ = {settings.tempo}</span>
          <input type="range" min={40} max={200} step={2} value={settings.tempo} onChange={(e) => updateSettings({ tempo: Number(e.target.value) })} aria-label="Tempo" />
        </div>
        {toggle('autoplayOnReveal', 'Autoplay after revealing an answer')}
        {toggle('countIn', 'Count-in before progressions')}
        {toggle('metronome', 'Metronome click during progressions')}
      </section>
      <section className="card">
        <h3>Data</h3>
        <p className="muted small">Everything is stored on this device only. To move to another device, export a full backup here and import it there with Replace all (or Merge to just add exercises).</p>
        <div className="row gap wrap">
          {share && <button className="btn primary" onClick={() => exportJson('full', true)}>Send backup to another device…</button>}
          <button className="btn" onClick={() => exportJson('library')}>Export library</button>
          <button className="btn" onClick={() => exportJson('full')}>Export full backup</button>
        </div>
        <div className="row gap wrap import">
          <Segmented size="sm" label="Import mode" value={mode} onChange={setMode} options={[{ value: 'merge', label: 'Merge', title: 'Add or update exercises by id' }, { value: 'replace', label: 'Replace all', title: 'Wipe local data first' }]} />
          <button className="btn" onClick={() => file.current?.click()}>Import JSON…</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            try {
              setMsg(await importJson(await f.text(), mode))
            } catch (err) {
              setMsg(`Import failed: ${(err as Error).message}`)
            }
          }} />
        </div>
        {msg && <p className="small" role="status">{msg}</p>}
        <div className="row gap wrap">
          {!confirmReset ? (
            <button className="btn danger-ghost" onClick={() => setConfirmReset(true)}>Reset to starter library…</button>
          ) : (
            <span className="confirm">This deletes all your exercises, progress and sessions.
              <button className="btn danger" onClick={async () => { await resetLibrary(); setConfirmReset(false); setMsg('Library reset.') }}>Reset</button>
              <button className="btn ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
            </span>
          )}
        </div>
      </section>
      <section className="card">
        <h3>Offline</h3>
        <ul className="small offline-status">
          <li>{pwa.offlineReady ? '✓ Saved for offline use. Keys Lab opens and plays without a connection.' : '… Saving the app for offline use (open it once while online).'}</li>
          <li>{isStandalone() ? '✓ Running as an installed app.' : 'Install it: on iPhone/iPad tap Share → Add to Home Screen; in Chrome or Edge use Install app in the address bar.'}</li>
          {pwa.persisted === false && <li>The browser may clear local data if storage runs low, so export a backup now and then.</li>}
        </ul>
        <p className="muted small">On iPhone and iPad the Home Screen app keeps its own data, separate from Safari. Use the installed app for practice, and move data between them with a backup.</p>
      </section>
      <section className="card about">
        <h3>About</h3>
        <p className="small muted">Keys Lab is local-first: no accounts, servers or analytics. Piano sound: Salamander Grand Piano by Alexander Holm, CC BY 3.0, bundled with the app.</p>
      </section>
    </div>
  )
}
