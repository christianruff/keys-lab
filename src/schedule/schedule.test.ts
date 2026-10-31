import { describe, expect, it } from 'vitest'
import { applyRating, deriveMastery, need, progressId, DAY, MAX_INTERVAL } from './mastery'
import { generateSession, defaultParams, rateTask, currentTask, moveCursor, type ProgressMap } from './session'
import { starterLibrary } from '../data/starter'
import type { Progress, Rating, SessionParams } from '../model/types'

const lib = starterLibrary()
const NOW = Date.UTC(2026, 9, 31, 12)
const params = (p: Partial<SessionParams> = {}): SessionParams => ({ ...defaultParams(), ...p })

describe('session generation', () => {
  it('creates exactly N × M tasks for valid parameters', () => {
    for (const [n, m] of [[1, 1], [3, 4], [12, 5], [7, 10]]) {
      const r = generateSession(lib, new Map(), params({ keyCount: n, exerciseCount: m }), 42, NOW)
      expect(r.ok).toBe(true)
      if (!r.ok) continue
      expect(r.session.tasks.length).toBe(n * m)
      expect(new Set(r.session.keys).size).toBe(n)
      expect(new Set(r.session.exerciseIds).size).toBe(m)
    }
  })
  it('never duplicates an exercise-key pair', () => {
    for (const order of ['byExercise', 'shuffled'] as const) for (let seed = 1; seed < 30; seed++) {
      const r = generateSession(lib, new Map(), params({ keyCount: 12, exerciseCount: 6, order }), seed, NOW)
      if (!r.ok) throw new Error(r.error)
      const pairs = r.session.tasks.map((t) => `${t.exerciseId}:${t.key}`)
      expect(new Set(pairs).size).toBe(pairs.length)
      expect(new Set(r.session.queue).size).toBe(pairs.length)
    }
  })
  it('repeats pairs only when explicitly requested via rounds', () => {
    const r = generateSession(lib, new Map(), params({ keyCount: 2, exerciseCount: 2, rounds: 2 }), 1, NOW)
    if (!r.ok) throw new Error(r.error)
    expect(r.session.tasks.length).toBe(8)
    expect(new Set(r.session.tasks.map((t) => t.id)).size).toBe(8)
  })
  it('orders by exercise: each exercise in every key before the next', () => {
    const r = generateSession(lib, new Map(), params({ keyCount: 3, exerciseCount: 4 }), 7, NOW)
    if (!r.ok) throw new Error(r.error)
    const ex = r.session.tasks.map((t) => t.exerciseId)
    for (let i = 0; i < 4; i++) expect(new Set(ex.slice(i * 3, i * 3 + 3)).size).toBe(1)
  })
  it('is reproducible from the stored seed', () => {
    const p = params({ keyCount: 4, exerciseCount: 5, order: 'shuffled' })
    const a = generateSession(lib, new Map(), p, 1234, NOW, 'x')
    const b = generateSession(lib, new Map(), p, 1234, NOW, 'x')
    const c = generateSession(lib, new Map(), p, 999, NOW, 'x')
    expect(a).toEqual(b)
    expect(a.ok && c.ok && a.session.tasks).not.toEqual(c.ok && c.session.tasks)
  })
  it('explains when more exercises are requested than the filters allow', () => {
    const r = generateSession(lib, new Map(), params({ exerciseCount: 10, categories: ['Upper-structure triads'] }), 1, NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/Only 3 exercises match the current filters/)
  })
  it('supports manual keys and manual exercises', () => {
    const r = generateSession(
      lib, new Map(),
      params({ keyMode: 'manual', manualKeys: [0, 3, 9], exerciseMode: 'manual', manualExercises: ['st-major-type-a', 'st-kenny-barron-m11', 'st-altered-combos', 'st-minor-251'] }),
      5, NOW,
    )
    if (!r.ok) throw new Error(r.error)
    expect(r.session.keys).toEqual([0, 3, 9])
    expect(r.session.tasks.length).toBe(12)
  })
  it('ignores archived exercises', () => {
    const archived = lib.map((e) => ({ ...e, archived: e.category !== 'Basics' }))
    const r = generateSession(archived, new Map(), params({ exerciseCount: 9 }), 3, NOW)
    if (!r.ok) throw new Error(r.error)
    expect(r.session.exerciseIds.every((id) => lib.find((e) => e.id === id)!.category === 'Basics')).toBe(true)
  })
})

describe('session queue', () => {
  it('moves completed tasks behind every unattempted task', () => {
    const r = generateSession(lib, new Map(), params({ keyCount: 3, exerciseCount: 2 }), 11, NOW)
    if (!r.ok) throw new Error(r.error)
    let s = r.session
    const first = currentTask(s)!.id
    s = rateTask(s, first, 'good', NOW)
    expect(s.queue[s.queue.length - 1]).toBe(first)
    expect(currentTask(s)!.id).not.toBe(first)
    expect(s.ratings[currentTask(s)!.id]).toBeUndefined()
    // skip one, rate the next: rated ones always sit after unrated ones
    s = moveCursor(s, 1)
    s = rateTask(s, currentTask(s)!.id, 'again', NOW)
    const rated = s.queue.map((id) => !!s.ratings[id])
    expect(rated.indexOf(true)).toBeGreaterThan(rated.lastIndexOf(false))
    while (s.status === 'active') s = rateTask(s, currentTask(s)!.id, 'good', NOW)
    expect(Object.keys(s.ratings).length).toBe(6)
  })
})

describe('mastery / spaced repetition', () => {
  const run = (ratings: Rating[], start = NOW) => {
    let p: Progress | undefined
    let t = start
    for (const r of ratings) {
      p = applyRating(p, 'x', 0, r, t)
      t = p.due
    }
    return p!
  }
  it('starts new, develops through repeated successes over time', () => {
    expect(deriveMastery({ attempts: 0, streak: 0, interval: 0 })).toBe('new')
    expect(run(['good']).mastery).toBe('learning')
    expect(run(['good', 'good', 'good', 'good']).mastery).toBe('comfortable')
    expect(run(['good', 'good', 'good', 'good', 'good']).mastery).toBe('fluent')
  })
  it('a single success never removes an item: it is always due again', () => {
    const p = run(['easy'])
    expect(p.due).toBeGreaterThan(NOW)
    expect(Number.isFinite(p.due)).toBe(true)
    const f = run(Array(20).fill('easy'))
    expect(f.mastery).toBe('fluent')
    expect(f.interval).toBeLessThanOrEqual(MAX_INTERVAL)
    expect(need(f, f.due + DAY)).toBeGreaterThan(0.8)
  })
  it('Again drops a fluent item back to learning and makes it due soon', () => {
    const f = run(['good', 'good', 'good', 'good', 'good'])
    const a = applyRating(f, 'x', 0, 'again', f.due)
    expect(a.mastery).toBe('learning')
    expect(a.due - f.due).toBeLessThan(DAY)
    expect(a.lapses).toBe(1)
  })
  it('records history, attempts and dates', () => {
    const p = run(['hard', 'good'])
    expect(p.attempts).toBe(2)
    expect(p.history.map((h) => h.r)).toEqual(['hard', 'good'])
    expect(p.lastAttempt).not.toBeNull()
  })
  it('prioritises weak and overdue pairs over comfortable ones, and just-practised pairs last', () => {
    const weak = applyRating(undefined, 'x', 0, 'again', NOW - 2 * DAY)
    const comfy = run(['good', 'good', 'good', 'good'], NOW - 40 * DAY)
    const fresh = applyRating(undefined, 'x', 0, 'good', NOW - 60_000)
    expect(need(weak, NOW)).toBeGreaterThan(need(undefined, NOW))
    expect(need(undefined, NOW)).toBeGreaterThan(need(fresh, NOW))
    const notDue = { ...comfy, due: NOW + 10 * DAY, lastAttempt: NOW - 2 * DAY }
    expect(need(undefined, NOW)).toBeGreaterThan(need(notDue, NOW))
  })
  it('smart selection favours unseen pairs over just-completed ones', () => {
    // Mark half of the library as just practised in every key
    const progress: ProgressMap = new Map()
    const practised = lib.slice(0, Math.floor(lib.length / 2))
    for (const e of practised) for (let k = 0; k < 12; k++) {
      progress.set(progressId(e.id, k), applyRating(undefined, e.id, k, 'good', NOW - 60_000))
    }
    let practisedPicked = 0
    for (let seed = 0; seed < 40; seed++) {
      const r = generateSession(lib, progress, params({ keyCount: 3, exerciseCount: 4 }), seed, NOW)
      if (!r.ok) throw new Error(r.error)
      practisedPicked += r.session.exerciseIds.filter((id) => practised.some((e) => e.id === id)).length
    }
    expect(practisedPicked / (40 * 4)).toBeLessThan(0.1)
  })
  it('smart key selection gives weak keys more attention', () => {
    const progress: ProgressMap = new Map()
    for (const e of lib) for (let k = 0; k < 12; k++) {
      const p = k === 6 ? applyRating(undefined, e.id, k, 'again', NOW - DAY) : applyRating(undefined, e.id, k, 'easy', NOW - DAY)
      progress.set(p.id, p)
    }
    let hits = 0
    for (let seed = 0; seed < 50; seed++) {
      const r = generateSession(lib, progress, params({ keyCount: 2, keyMode: 'smart' }), seed, NOW)
      if (r.ok && r.session.keys.includes(6)) hits++
    }
    expect(hits).toBeGreaterThan(40)
  })
  it('fully random mode remains available and ignores mastery', () => {
    const r = generateSession(lib, new Map(), params({ exerciseMode: 'random', keyCount: 2, exerciseCount: 3 }), 8, NOW)
    expect(r.ok).toBe(true)
  })
})
