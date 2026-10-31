/** Application-level persistence operations shared by the UI and tests. */
import type { Repo } from './repo'
import { starterLibrary } from '../data/starter'
import { applyRating, progressId } from '../schedule/mastery'
import { rateTask } from '../schedule/session'
import type { Exercise, Progress, Rating, Session, Settings } from '../model/types'

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system', practiceMode: 'minimal', showNoteNames: true, showDegrees: false, showRoman: true,
  autoplayOnReveal: false, tempo: 80, countIn: false, metronome: false, volume: 0.8, preferGb: false,
  keyboardOctaves: 4, keyboardStartOctave: 2, lastParams: null,
}

export interface Snapshot {
  exercises: Exercise[]
  progress: Map<string, Progress>
  settings: Settings
  session: Session | undefined
}

export async function bootstrap(repo: Repo): Promise<Snapshot> {
  if (!(await repo.getMeta<boolean>('seeded'))) {
    await repo.putExercises(starterLibrary())
    await repo.setMeta('seeded', true)
  }
  const [exercises, progress, settings, session] = await Promise.all([
    repo.listExercises(), repo.listProgress(), repo.getSettings(), repo.latestActiveSession(),
  ])
  return {
    exercises: exercises.sort((a, b) => a.createdAt - b.createdAt),
    progress: new Map(progress.map((p) => [p.id, p])),
    settings: { ...DEFAULT_SETTINGS, ...settings },
    session,
  }
}

/** Rate the current task: updates the pair's mastery and the session queue, persisting both. */
export async function recordRating(
  repo: Repo,
  session: Session,
  taskId: string,
  rating: Rating,
  progress: Map<string, Progress>,
  now = Date.now(),
): Promise<{ session: Session; progress: Progress }> {
  const task = session.tasks.find((t) => t.id === taskId)
  if (!task) throw new Error(`Unknown task ${taskId}`)
  const p = applyRating(progress.get(progressId(task.exerciseId, task.key)), task.exerciseId, task.key, rating, now)
  const s = rateTask(session, taskId, rating, now)
  await repo.putProgress(p)
  await repo.putSession(s)
  return { session: s, progress: p }
}

export function newId(prefix = 'ex'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function duplicateExercise(e: Exercise, now = Date.now()): Exercise {
  const id = newId()
  return {
    ...structuredClone(e), id, title: `${e.title} (copy)`, createdAt: now, updatedAt: now, template: false,
    voicings: e.voicings.map((v, i) => ({ ...v, id: `${id}-v${i + 1}` })),
  }
}
