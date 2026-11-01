/**
 * Generates dist/sw.js after the build: a dependency-free service worker that
 * precaches every built file (app shell, piano samples, icons) so Keys Lab
 * works fully offline once it has been opened once.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

/** Files that must never be precached (server config and the worker itself). */
const SKIP = new Set(['sw.js', '_headers', '_redirects', 'robots.txt'])

export function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? listFiles(p) : [p]
  })
}

export function buildServiceWorker(files: { path: string; content: Buffer }[]): string {
  const hash = createHash('sha256').update(SW_TEMPLATE)
  const urls: string[] = []
  for (const f of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    if (SKIP.has(f.path)) continue
    hash.update(f.path).update(f.content)
    urls.push(`./${f.path}`)
  }
  const version = hash.digest('hex').slice(0, 12)
  return SW_TEMPLATE.replace('__VERSION__', version).replace('__URLS__', JSON.stringify(['./', ...urls], null, 0))
}

export function offlineServiceWorker(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'keys-lab-offline-sw',
    apply: 'build',
    configResolved(c) {
      config = c
    },
    closeBundle() {
      const out = join(config.root, config.build.outDir)
      const files = listFiles(out).map((p) => ({ path: relative(out, p).split(sep).join('/'), content: readFileSync(p) }))
      writeFileSync(join(out, 'sw.js'), buildServiceWorker(files))
    },
  }
}

const SW_TEMPLATE = `/* Keys Lab offline service worker (generated at build time). */
const VERSION = '__VERSION__'
const CACHE = 'keys-lab-' + VERSION
const PRECACHE = __URLS__

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('keys-lab-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (req.mode === 'navigate') {
    // App shell: always the cached index.html, so the app opens instantly and offline.
    event.respondWith(caches.match('./index.html').then((r) => r || fetch(req)))
    return
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
      }
      return res
    })),
  )
})
`
