/** JSON import/export with validation. */
import type { Exercise, Progress, Session, Settings } from '../model/types'
import type { Repo } from './repo'

export const FORMAT = 'keys-lab'
export const VERSION = 1

export interface ExportFile {
  format: typeof FORMAT
  version: number
  exportedAt: string
  scope: 'library' | 'full'
  exercises: Exercise[]
  progress?: Progress[]
  sessions?: Session[]
  settings?: Settings
}

export async function exportData(repo: Repo, scope: 'library' | 'full'): Promise<ExportFile> {
  const exercises = (await repo.listExercises()).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  const file: ExportFile = { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), scope, exercises }
  if (scope === 'full') {
    file.progress = await repo.listProgress()
    file.sessions = await repo.listSessions()
    file.settings = await repo.getSettings()
  }
  return file
}

const KINDS = ['voicing', 'progression', 'drill', 'technique']

export function validateExercise(e: unknown, i: number): string[] {
  const errs: string[] = []
  const x = e as Partial<Exercise>
  const at = `exercises[${i}]`
  if (!x || typeof x !== 'object') return [`${at} is not an object`]
  if (typeof x.id !== 'string' || !x.id) errs.push(`${at}.id is missing`)
  if (typeof x.title !== 'string') errs.push(`${at}.title is missing`)
  if (!KINDS.includes(x.kind as string)) errs.push(`${at}.kind must be one of ${KINDS.join(', ')}`)
  if (!Array.isArray(x.voicings)) errs.push(`${at}.voicings must be an array`)
  if (x.kind === 'progression' && (!x.progression || !Array.isArray(x.progression.events)))
    errs.push(`${at}.progression.events must be an array`)
  return errs
}

export function parseImport(text: string): { ok: true; data: ExportFile } | { ok: false; errors: string[] } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['File is not valid JSON.'] }
  }
  const d = raw as Partial<ExportFile>
  if (!d || d.format !== FORMAT) return { ok: false, errors: ['Not a Keys Lab export (missing "format": "keys-lab").'] }
  if (typeof d.version !== 'number' || d.version > VERSION) return { ok: false, errors: [`Unsupported version ${d.version}.`] }
  if (!Array.isArray(d.exercises)) return { ok: false, errors: ['"exercises" must be an array.'] }
  const errors = d.exercises.flatMap((e, i) => validateExercise(e, i))
  if (errors.length) return { ok: false, errors: errors.slice(0, 10) }
  const exercises = d.exercises.map((e) => ({ ...e, tags: e.tags ?? [], instructions: e.instructions ?? '', archived: e.archived ?? false, category: e.category ?? 'Uncategorized', unit: e.unit ?? '', tonality: e.tonality ?? 'major' }))
  return { ok: true, data: { ...(d as ExportFile), exercises } }
}

/** merge: upsert by id; replace: wipe and load. Returns counts. */
export async function importData(repo: Repo, data: ExportFile, mode: 'merge' | 'replace') {
  if (mode === 'replace') {
    await repo.replaceAll({ exercises: data.exercises, progress: data.progress ?? [], sessions: data.sessions ?? [], settings: data.settings })
  } else {
    await repo.putExercises(data.exercises)
    for (const p of data.progress ?? []) await repo.putProgress(p)
    for (const s of data.sessions ?? []) await repo.putSession(s)
    if (data.settings) await repo.putSettings(data.settings)
  }
  await repo.setMeta('seeded', true)
  return { exercises: data.exercises.length, progress: data.progress?.length ?? 0 }
}
