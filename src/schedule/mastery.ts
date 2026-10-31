/**
 * Simple, explainable spaced repetition per exercise-key pair (an SM-2 variant).
 *
 *  Again -> interval resets, due again in minutes, streak resets, ease drops.
 *  Hard  -> interval grows only slightly (x1.2, min half a day), ease drops a bit.
 *  Good  -> interval grows by ease (1 -> 2.3 -> 5.3 -> 12 -> 28 days ...).
 *  Easy  -> interval grows faster (ease x 1.3) and ease rises.
 *
 * Mastery is derived from the streak of successful reviews and the current interval:
 *  New (never attempted) -> Learning -> Comfortable (streak >= 2, interval >= 6d)
 *  -> Fluent (streak >= 4, interval >= 21d). Intervals are capped at 120 days, so fluent
 *  items always come back for review; any "Again" drops an item back to Learning.
 */
import type { Mastery, Progress, Rating } from '../model/types'

export const DAY = 86_400_000
export const MAX_INTERVAL = 120
const HISTORY = 30

export const progressId = (exerciseId: string, key: number) => `${exerciseId}::${key}`

export function emptyProgress(exerciseId: string, key: number, now: number): Progress {
  return {
    id: progressId(exerciseId, key), exerciseId, key, attempts: 0, lastAttempt: null, due: now,
    interval: 0, ease: 2.3, streak: 0, lapses: 0, mastery: 'new', history: [],
  }
}

export function deriveMastery(p: Pick<Progress, 'attempts' | 'streak' | 'interval'>): Mastery {
  if (p.attempts === 0) return 'new'
  if (p.streak >= 4 && p.interval >= 21) return 'fluent'
  if (p.streak >= 2 && p.interval >= 6) return 'comfortable'
  return 'learning'
}

export function applyRating(prev: Progress | undefined, exerciseId: string, key: number, rating: Rating, now: number): Progress {
  const p = prev ? { ...prev, history: [...prev.history] } : emptyProgress(exerciseId, key, now)
  let { interval, ease, streak, lapses } = p
  switch (rating) {
    case 'again':
      lapses += 1
      streak = 0
      interval = 0
      ease = Math.max(1.3, ease - 0.2)
      break
    case 'hard':
      ease = Math.max(1.3, ease - 0.15)
      interval = interval === 0 ? 0.5 : Math.max(1, interval * 1.2)
      break
    case 'good':
      streak += 1
      interval = interval < 1 ? 1 : Math.max(interval + 1, interval * ease)
      break
    case 'easy':
      streak += 1
      ease = Math.min(3, ease + 0.15)
      interval = interval < 1 ? 3 : Math.max(interval + 2, interval * ease * 1.3)
      break
  }
  interval = Math.min(MAX_INTERVAL, Math.round(interval * 10) / 10)
  const due = rating === 'again' ? now + 5 * 60_000 : now + interval * DAY
  const next: Progress = {
    ...p, interval, ease, streak, lapses, due, attempts: p.attempts + 1, lastAttempt: now,
    history: [...p.history, { t: now, r: rating }].slice(-HISTORY),
  }
  next.mastery = deriveMastery(next)
  return next
}

/**
 * How much a pair needs practice right now (higher = sooner).
 * Unseen pairs ~1.0; overdue pairs 0.8..1.4; weak pairs get a bonus;
 * pairs practiced within the last hour are pushed behind everything else.
 */
export function need(p: Progress | undefined, now: number): number {
  if (!p || p.attempts === 0) return 1
  const span = Math.max(p.interval, 0.5)
  const overdueDays = (now - p.due) / DAY
  let n = overdueDays >= 0 ? 0.8 + 0.6 * Math.min(1, overdueDays / span) : 0.08 + 0.5 * Math.max(0, 1 + overdueDays / span)
  const recent = p.history.slice(-5)
  n += 0.15 * recent.filter((h) => h.r === 'again').length + 0.07 * recent.filter((h) => h.r === 'hard').length
  const last = p.history[p.history.length - 1]?.r
  if (last === 'again') n += 0.3
  else if (last === 'hard') n += 0.15
  if (p.lastAttempt !== null && now - p.lastAttempt < 3_600_000) n *= 0.1
  return n
}

export function masteryOf(p: Progress | undefined): Mastery {
  return p ? p.mastery : 'new'
}
