/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Repo } from '../db/repo'
import { bootstrap, recordRating, DEFAULT_SETTINGS } from '../db/service'
import { exportData, importData, parseImport } from '../db/transfer'
import { starterLibrary } from '../data/starter'
import { generateSession, moveCursor } from '../schedule/session'
import { newSeed } from '../schedule/rng'
import { piano } from '../audio/engine'
import type { Exercise, Progress, Rating, Session, SessionParams, Settings } from '../model/types'

export type View = 'practice' | 'library' | 'settings'

interface Store {
  ready: boolean
  error: string | null
  exercises: Exercise[]
  progress: Map<string, Progress>
  settings: Settings
  session: Session | undefined
  view: View
  setView: (v: View) => void
  updateSettings: (patch: Partial<Settings>) => void
  startSession: (params: SessionParams, seed?: number) => string | null
  rate: (r: Rating) => Promise<void>
  move: (delta: number) => void
  endSession: () => Promise<void>
  tick: (ms: number) => void
  saveExercise: (e: Exercise) => Promise<void>
  deleteExercise: (id: string) => Promise<void>
  exportJson: (scope: 'library' | 'full') => Promise<void>
  importJson: (text: string, mode: 'merge' | 'replace') => Promise<string>
  resetLibrary: () => Promise<void>
}

const Ctx = createContext<Store | null>(null)

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}

const viewFromHash = (): View => {
  const h = location.hash.replace('#/', '')
  return h === 'library' || h === 'settings' ? h : 'practice'
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<Repo | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [progress, setProgress] = useState<Map<string, Progress>>(new Map())
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [session, setSession] = useState<Session | undefined>()
  const [view, setViewState] = useState<View>(viewFromHash)
  const sessionRef = useRef(session)
  sessionRef.current = session
  const progressRef = useRef(progress)
  progressRef.current = progress

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const repo = await Repo.open()
        repoRef.current = repo
        const snap = await bootstrap(repo)
        if (cancelled) return
        setExercises(snap.exercises)
        setProgress(snap.progress)
        setSettings(snap.settings)
        setSession(snap.session)
        piano.setVolume(snap.settings.volume)
        setReady(true)
      } catch (e) {
        setError(`Could not open local storage (IndexedDB): ${(e as Error).message}`)
      }
    })()
    const onHash = () => setViewState(viewFromHash())
    window.addEventListener('hashchange', onHash)
    return () => {
      cancelled = true
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  const repo = () => {
    if (!repoRef.current) throw new Error('Storage not ready')
    return repoRef.current
  }

  const setView = useCallback((v: View) => {
    location.hash = v === 'practice' ? '' : `/${v}`
    setViewState(v)
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      repoRef.current?.putSettings(next)
      if (patch.volume !== undefined) piano.setVolume(patch.volume)
      return next
    })
  }, [])

  const persistSession = (s: Session) => {
    setSession(s.status === 'active' ? s : s)
    repoRef.current?.putSession(s)
  }

  const startSession = (params: SessionParams, seed = newSeed()): string | null => {
    const r = generateSession(exercises, progress, params, seed, Date.now())
    if (!r.ok) return r.error
    const prev = sessionRef.current
    if (prev && prev.status === 'active') repoRef.current?.putSession({ ...prev, status: 'finished' })
    persistSession(r.session)
    updateSettings({ lastParams: params })
    return null
  }

  const rate = async (r: Rating) => {
    const s = sessionRef.current
    if (!s) return
    const id = s.queue[s.cursor]
    const res = await recordRating(repo(), s, id, r, progressRef.current)
    setProgress((m) => new Map(m).set(res.progress.id, res.progress))
    setSession(res.session)
  }

  const move = (delta: number) => {
    const s = sessionRef.current
    if (s) persistSession(moveCursor(s, delta))
  }

  const tick = (ms: number) => {
    const s = sessionRef.current
    if (s && s.status === 'active') {
      const next = { ...s, elapsedMs: s.elapsedMs + ms }
      sessionRef.current = next
      setSession(next)
      if (Math.floor(next.elapsedMs / 10000) !== Math.floor(s.elapsedMs / 10000)) repoRef.current?.putSession(next)
    }
  }

  const endSession = async () => {
    const s = sessionRef.current
    if (s) await repo().putSession({ ...s, status: 'finished', updatedAt: Date.now() })
    setSession(undefined)
  }

  const saveExercise = async (e: Exercise) => {
    const next = { ...e, updatedAt: Date.now() }
    await repo().putExercise(next)
    setExercises((list) => {
      const i = list.findIndex((x) => x.id === e.id)
      return i >= 0 ? list.map((x) => (x.id === e.id ? next : x)) : [...list, next]
    })
  }

  const deleteExercise = async (id: string) => {
    await repo().deleteExercise(id)
    setExercises((list) => list.filter((x) => x.id !== id))
    setProgress((m) => new Map([...m].filter(([, p]) => p.exerciseId !== id)))
  }

  const reload = async () => {
    const snap = await bootstrap(repo())
    setExercises(snap.exercises)
    setProgress(snap.progress)
    setSettings(snap.settings)
    setSession(snap.session)
  }

  const exportJson = async (scope: 'library' | 'full') => {
    const data = await exportData(repo(), scope)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `keys-lab-${scope}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const importJson = async (text: string, mode: 'merge' | 'replace') => {
    const parsed = parseImport(text)
    if (!parsed.ok) throw new Error(parsed.errors.join('\n'))
    const res = await importData(repo(), parsed.data, mode)
    await reload()
    return `Imported ${res.exercises} exercises${res.progress ? ` and ${res.progress} progress records` : ''}.`
  }

  const resetLibrary = async () => {
    await repo().replaceAll({ exercises: starterLibrary(), progress: [], sessions: [], settings })
    await reload()
  }

  const value = useMemo<Store>(
    () => ({
      ready, error, exercises, progress, settings, session, view, setView, updateSettings, startSession, rate, move,
      endSession, tick, saveExercise, deleteExercise, exportJson, importJson, resetLibrary,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, error, exercises, progress, settings, session, view],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
