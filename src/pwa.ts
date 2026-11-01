/**
 * Offline support: registers the build-generated service worker, asks the browser
 * to keep local data (so Safari does not evict the library), and reports when a
 * new deploy has been installed.
 */
type Listener = (s: PwaState) => void
export interface PwaState {
  /** All app files are cached; the app opens without a network connection. */
  offlineReady: boolean
  /** A newer deploy has taken over; reloading shows it. */
  updated: boolean
  /** The browser promised not to evict local data. */
  persisted: boolean | null
}

let state: PwaState = { offlineReady: false, updated: false, persisted: null }
const listeners = new Set<Listener>()
const set = (patch: Partial<PwaState>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l(state))
}

export const pwaState = () => state
export function subscribePwa(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

export async function requestPersistence(): Promise<void> {
  try {
    if (!navigator.storage?.persist) return
    const already = await navigator.storage.persisted()
    set({ persisted: already || (await navigator.storage.persist()) })
  } catch {
    set({ persisted: null })
  }
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const hadController = !!navigator.serviceWorker.controller
  if (hadController) set({ offlineReady: true })
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) set({ updated: true })
    else set({ offlineReady: true })
  })
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' })
      await navigator.serviceWorker.ready
      set({ offlineReady: true })
      // Pick up new deploys when the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {})
      })
    } catch (e) {
      console.warn('Service worker registration failed', e)
    }
  })
}
