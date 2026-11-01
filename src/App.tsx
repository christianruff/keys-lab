import { useEffect, useState } from 'react'
import { StoreProvider, useStore, type View } from './ui/store'
import { PracticeView } from './ui/Session'
import { LibraryView } from './ui/Library'
import { SettingsView } from './ui/Settings'
import { SheetsView } from './ui/Sheets'
import { pwaState, subscribePwa } from './pwa'
import { piano } from './audio/engine'

function Shell() {
  const { ready, error, view, setView, settings } = useStore()
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', settings.theme)
  }, [settings.theme])
  useEffect(() => {
    // Unlock audio + start loading samples on the first interaction.
    const unlock = () => piano.ensure()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])
  const tabs: { v: View; label: string }[] = [
    { v: 'practice', label: 'Practice' },
    { v: 'library', label: 'Library' },
    { v: 'sheets', label: 'Sheets' },
    { v: 'settings', label: 'Settings' },
  ]
  return (
    <div className="app">
      <nav className="topbar">
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); setView('practice') }}>
          <img src="./favicon.svg" alt="" width={22} height={22} />
          <span>Keys Lab</span>
        </a>
        <div className="tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.v} role="tab" aria-selected={view === t.v} className={view === t.v ? 'active' : ''} onClick={() => setView(t.v)}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      <main className={`content view-${view}`}>
        {error ? <p className="error card">{error}</p> : !ready ? <p className="muted center pad">Loading…</p> : view === 'practice' ? <PracticeView /> : view === 'library' ? <LibraryView /> : view === 'sheets' ? <SheetsView /> : <SettingsView />}
      </main>
      <UpdateBanner />
    </div>
  )
}

/** Tells you when a new deploy has been installed in the background. */
function UpdateBanner() {
  const [s, setS] = useState(pwaState)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => subscribePwa(setS), [])
  if (!s.updated || dismissed) return null
  return (
    <div className="app-banner" role="status">
      <span>A new version of Keys Lab is ready.</span>
      <button className="btn sm" onClick={() => location.reload()}>Reload</button>
      <button className="btn ghost sm" onClick={() => setDismissed(true)}>Later</button>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
