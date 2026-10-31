/** Session generation (N keys x M exercises) and in-session queue handling. Pure functions. */
import { ALL_KEYS } from '../music/keys'
import { mulberry32, shuffle, weightedSample } from './rng'
import { masteryOf, need, progressId } from './mastery'
import type { Exercise, Mastery, Progress, Rating, Session, SessionParams, Task } from '../model/types'

export const DEFAULT_MIX: Record<Mastery, number> = { new: 1, learning: 1, comfortable: 0.6, fluent: 0.35 }

export function defaultParams(): SessionParams {
  return {
    keyCount: 3, exerciseCount: 4, keyMode: 'random', manualKeys: [], exerciseMode: 'smart', manualExercises: [],
    categories: [], units: [], masteryFilter: [], mix: { ...DEFAULT_MIX }, order: 'byExercise', rounds: 1, timeTargetMin: null,
  }
}

export type ProgressMap = Map<string, Progress>

export function candidateExercises(library: Exercise[], params: SessionParams): Exercise[] {
  return library.filter(
    (e) =>
      !e.archived &&
      (!params.categories.length || params.categories.includes(e.category)) &&
      (!params.units.length || params.units.includes(e.unit)),
  )
}

export type GenerateResult = { ok: true; session: Session } | { ok: false; error: string }

export function generateSession(
  library: Exercise[],
  progress: ProgressMap,
  params: SessionParams,
  seed: number,
  now: number,
  id = `s_${now.toString(36)}_${seed.toString(36)}`,
): GenerateResult {
  const rng = mulberry32(seed)
  const get = (ex: string, k: number) => progress.get(progressId(ex, k))

  // 1. Keys
  let keys: number[]
  if (params.keyMode === 'manual') {
    keys = [...new Set(params.manualKeys)].filter((k) => ALL_KEYS.includes(k))
    if (!keys.length) return { ok: false, error: 'Choose at least one key.' }
  } else {
    const n = Math.round(params.keyCount)
    if (!(n >= 1 && n <= 12)) return { ok: false, error: 'Number of keys must be between 1 and 12.' }
    if (params.keyMode === 'smart') {
      const pool = candidateExercises(library, params)
      keys = weightedSample(
        ALL_KEYS,
        // squared so clearly weak keys win most of the time, with jitter for variety
        (k) => (pool.length ? pool.reduce((s, e) => s + need(get(e.id, k), now), 0) / pool.length : 1) ** 2 * (0.75 + 0.5 * rng()),
        n,
        rng,
      )
    } else {
      keys = shuffle(ALL_KEYS, rng).slice(0, n)
    }
  }

  // 2. Exercises
  let exercises: Exercise[]
  if (params.exerciseMode === 'manual') {
    const byId = new Map(library.map((e) => [e.id, e]))
    exercises = [...new Set(params.manualExercises)].map((id) => byId.get(id)).filter((e): e is Exercise => !!e)
    if (!exercises.length) return { ok: false, error: 'Choose at least one exercise.' }
  } else {
    const m = Math.round(params.exerciseCount)
    if (!(m >= 1)) return { ok: false, error: 'Number of exercises must be at least 1.' }
    let pool = candidateExercises(library, params)
    if (params.masteryFilter.length) {
      pool = pool.filter((e) => keys.some((k) => params.masteryFilter.includes(masteryOf(get(e.id, k)))))
    }
    if (pool.length < m) {
      const filtered = params.categories.length || params.units.length || params.masteryFilter.length
      return {
        ok: false,
        error:
          pool.length === 0
            ? 'No exercises match the current filters.'
            : `Only ${pool.length} exercise${pool.length === 1 ? '' : 's'} ${filtered ? 'match the current filters' : 'available'}, so ${m} distinct exercises can't be selected. Lower the count to ${pool.length}${filtered ? ' or widen the filters' : ''}.`,
      }
    }
    if (params.exerciseMode === 'random') {
      exercises = shuffle(pool, rng).slice(0, m)
    } else {
      const mix = params.mix
      exercises = weightedSample(
        pool,
        (e) =>
          (keys.reduce((s, k) => {
            const p = get(e.id, k)
            return s + need(p, now) * Math.max(0, mix[masteryOf(p)] ?? 1)
          }, 0) /
            keys.length) *
          (0.7 + 0.6 * rng()),
        m,
        rng,
      )
    }
  }

  // 3. Tasks: every exercise in every key (x rounds, only when explicitly requested)
  const rounds = Math.max(1, Math.min(5, Math.round(params.rounds || 1)))
  let tasks: Task[] = []
  for (let r = 0; r < rounds; r++) {
    const round: Task[] = []
    for (const e of exercises) for (const k of keys) round.push({ id: `${e.id}::${k}::${r}`, exerciseId: e.id, key: k, round: r })
    tasks.push(...(params.order === 'shuffled' ? spreadShuffle(round, rng) : round))
  }
  tasks = dedupe(tasks)
  return {
    ok: true,
    session: {
      id, seed, createdAt: now, updatedAt: now, params, keys, exerciseIds: exercises.map((e) => e.id), tasks,
      queue: tasks.map((t) => t.id), cursor: 0, ratings: {}, log: [], status: 'active', elapsedMs: 0,
    },
  }
}

function dedupe(tasks: Task[]): Task[] {
  const seen = new Set<string>()
  return tasks.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
}

/** Shuffle, then reduce back-to-back repeats of the same exercise where possible. */
function spreadShuffle(tasks: Task[], rng: () => number): Task[] {
  const a = shuffle(tasks, rng)
  for (let i = 1; i < a.length; i++) {
    if (a[i].exerciseId === a[i - 1].exerciseId) {
      const j = a.findIndex((t, idx) => idx > i && t.exerciseId !== a[i - 1].exerciseId)
      if (j > 0) [a[i], a[j]] = [a[j], a[i]]
    }
  }
  return a
}

/**
 * Record a rating: the task moves to the back of the active queue, behind every
 * task not yet attempted. The cursor stays in place, so the next unattempted task
 * slides into view.
 */
export function rateTask(s: Session, taskId: string, rating: Rating, now: number): Session {
  const queue = s.queue.filter((id) => id !== taskId)
  queue.push(taskId)
  const ratings = { ...s.ratings, [taskId]: rating }
  const done = s.tasks.every((t) => ratings[t.id])
  const firstUnrated = queue.findIndex((id) => !ratings[id])
  const cursor = done ? s.cursor : firstUnrated >= 0 && !ratings[queue[s.cursor]] ? s.cursor : Math.max(0, firstUnrated)
  return {
    ...s, queue, ratings, cursor: Math.min(cursor, queue.length - 1), log: [...s.log, { taskId, r: rating, t: now }],
    status: done ? 'finished' : 'active', updatedAt: now,
  }
}

export function moveCursor(s: Session, delta: number): Session {
  const n = s.queue.length
  return { ...s, cursor: ((s.cursor + delta) % n + n) % n }
}

export function currentTask(s: Session): Task | undefined {
  const id = s.queue[s.cursor]
  return s.tasks.find((t) => t.id === id)
}

export function completedCount(s: Session): number {
  return s.tasks.filter((t) => s.ratings[t.id]).length
}
