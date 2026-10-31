import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { Repo } from './repo'
import { bootstrap, recordRating, duplicateExercise } from './service'
import { exportData, importData, parseImport } from './transfer'
import { generateSession, defaultParams, currentTask } from '../schedule/session'
import { progressId } from '../schedule/mastery'
import type { Exercise } from '../model/types'

let n = 0
const fresh = () => `test-db-${n++}`

const myVoicing: Exercise = {
  id: 'mine', title: 'My m11', kind: 'voicing', category: 'Extensions', unit: 'Elevenths', tags: ['custom'],
  instructions: 'Try it', tonality: 'minor', archived: false, createdAt: 1, updatedAt: 1,
  voicings: [{ id: 'mine-v1', name: 'A', symbol: 'm11', lh: '1 5 9', rh: 'b3 b7 11', anchorOctave: 3 }],
}

describe('persistence', () => {
  it('seeds the starter library once', async () => {
    const name = fresh()
    let repo = await Repo.open(name)
    const a = await bootstrap(repo)
    expect(a.exercises.length).toBeGreaterThan(30)
    await repo.deleteExercise(a.exercises[0].id)
    repo.close()
    repo = await Repo.open(name)
    const b = await bootstrap(repo)
    expect(b.exercises.length).toBe(a.exercises.length - 1) // not re-seeded
    repo.close()
  })

  it('persists CRUD operations across reloads', async () => {
    const name = fresh()
    let repo = await Repo.open(name)
    await bootstrap(repo)
    await repo.putExercise(myVoicing)
    await repo.putExercise({ ...myVoicing, title: 'My m11 (edited)', updatedAt: 2 })
    const dup = duplicateExercise(myVoicing)
    await repo.putExercise(dup)
    await repo.putExercise({ ...dup, archived: true })
    repo.close()

    repo = await Repo.open(name)
    expect((await repo.getExercise('mine'))!.title).toBe('My m11 (edited)')
    expect((await repo.getExercise(dup.id))!.archived).toBe(true)
    expect((await repo.getExercise(dup.id))!.voicings[0].lh).toBe('1 5 9')
    await repo.deleteExercise('mine')
    repo.close()

    repo = await Repo.open(name)
    expect(await repo.getExercise('mine')).toBeUndefined()
    repo.close()
  })

  it('keeps mastery and the active session across reloads (resume)', async () => {
    const name = fresh()
    let repo = await Repo.open(name)
    let snap = await bootstrap(repo)
    await repo.putExercise(myVoicing)
    snap = await bootstrap(repo)
    const params = { ...defaultParams(), keyMode: 'manual' as const, manualKeys: [0, 3, 9], exerciseCount: 4 }
    const g = generateSession(snap.exercises, snap.progress, { ...params, exerciseMode: 'manual', manualExercises: ['mine', 'st-major-type-a', 'st-minor-251', 'st-altered-combos'] }, 77, Date.now())
    if (!g.ok) throw new Error(g.error)
    expect(g.session.tasks.length).toBe(12)
    await repo.putSession(g.session)
    let s = g.session
    const rated: string[] = []
    for (let i = 0; i < 5; i++) {
      const t = currentTask(s)!
      rated.push(t.id)
      const r = await recordRating(repo, s, t.id, i % 2 ? 'hard' : 'good', snap.progress)
      snap.progress.set(r.progress.id, r.progress)
      s = r.session
    }
    repo.close() // "close the application"

    repo = await Repo.open(name)
    const later = await bootstrap(repo)
    expect(later.session?.id).toBe(s.id)
    expect(Object.keys(later.session!.ratings).sort()).toEqual([...rated].sort())
    expect(later.session!.queue).toEqual(s.queue)
    expect(currentTask(later.session!)!.id).toBe(currentTask(s)!.id)
    const firstTask = g.session.tasks.find((t) => t.id === rated[0])!
    const p = later.progress.get(progressId(firstTask.exerciseId, firstTask.key))!
    expect(p.attempts).toBe(1)
    expect(p.mastery).toBe('learning')
    expect(p.history[0].r).toBe('good')
    repo.close()
  })

  it('round-trips the library and full backup through JSON', async () => {
    const a = await Repo.open(fresh())
    const snap = await bootstrap(a)
    await a.putExercise(myVoicing)
    const sess = generateSession(snap.exercises, snap.progress, defaultParams(), 5, 1000)
    if (!sess.ok) throw new Error(sess.error)
    await recordRating(a, sess.session, sess.session.tasks[0].id, 'easy', snap.progress, 2000)
    const lib = await exportData(a, 'library')
    const full = await exportData(a, 'full')
    expect(lib.progress).toBeUndefined()
    expect(full.progress!.length).toBe(1)

    const b = await Repo.open(fresh())
    const parsed = parseImport(JSON.stringify(full))
    if (!parsed.ok) throw new Error(parsed.errors.join())
    await importData(b, parsed.data, 'replace')
    const again = await exportData(b, 'full')
    expect(again.exercises).toEqual(full.exercises)
    expect(again.progress).toEqual(full.progress)
    expect(again.sessions).toEqual(full.sessions)
    // Re-bootstrapping an imported DB must not re-seed starters
    const snapB = await bootstrap(b)
    expect(snapB.exercises.length).toBe(full.exercises.length)

    // merge import adds/overwrites by id
    const c = await Repo.open(fresh())
    await importData(c, (parseImport(JSON.stringify(lib)) as { ok: true; data: typeof lib }).data, 'merge')
    expect((await c.getExercise('mine'))!.voicings[0].rh).toBe('b3 b7 11')
    a.close(); b.close(); c.close()
  })

  it('rejects malformed imports with explanations', () => {
    expect(parseImport('nope').ok).toBe(false)
    expect(parseImport('{"format":"other"}').ok).toBe(false)
    const bad = parseImport(JSON.stringify({ format: 'keys-lab', version: 1, exercises: [{ id: 'x', title: 'X', kind: 'banana', voicings: [] }] }))
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors[0]).toMatch(/kind/)
  })
})
