import { describe, expect, it } from 'vitest'
import { buildServiceWorker } from './sw-plugin.ts'

const f = (path: string, s: string) => ({ path, content: Buffer.from(s) })

describe('offline service worker generation', () => {
  it('precaches built files but not server config or itself', () => {
    const sw = buildServiceWorker([f('index.html', 'x'), f('assets/a.js', 'y'), f('_headers', 'h'), f('sw.js', 'old'), f('samples/salamander/C4.mp3', 'z')])
    expect(sw).toContain('"./index.html"')
    expect(sw).toContain('"./assets/a.js"')
    expect(sw).toContain('"./samples/salamander/C4.mp3"')
    expect(sw).not.toContain('_headers')
    expect(sw).not.toContain('"./sw.js"')
  })
  it('changes version when any file changes, and only then', () => {
    const v = (s: string) => /const VERSION = '(\w+)'/.exec(s)![1]
    const a = buildServiceWorker([f('index.html', 'x'), f('a.js', '1')])
    const b = buildServiceWorker([f('a.js', '1'), f('index.html', 'x')])
    const c = buildServiceWorker([f('index.html', 'x'), f('a.js', '2')])
    expect(v(a)).toBe(v(b))
    expect(v(a)).not.toBe(v(c))
  })
})
