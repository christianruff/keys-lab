/** IndexedDB persistence (local-first). One database, five object stores. */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Exercise, Progress, Session, Settings } from '../model/types'

interface KeysLabDB extends DBSchema {
  exercises: { key: string; value: Exercise }
  progress: { key: string; value: Progress; indexes: { byExercise: string } }
  sessions: { key: string; value: Session; indexes: { byUpdated: number } }
  settings: { key: string; value: { key: string; value: Settings } }
  meta: { key: string; value: { key: string; value: unknown } }
}

export const DB_NAME = 'keys-lab'

export class Repo {
  private db: IDBPDatabase<KeysLabDB>
  private constructor(db: IDBPDatabase<KeysLabDB>) {
    this.db = db
  }

  static async open(name = DB_NAME): Promise<Repo> {
    const db = await openDB<KeysLabDB>(name, 1, {
      upgrade(db) {
        db.createObjectStore('exercises', { keyPath: 'id' })
        db.createObjectStore('progress', { keyPath: 'id' }).createIndex('byExercise', 'exerciseId')
        db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('byUpdated', 'updatedAt')
        db.createObjectStore('settings', { keyPath: 'key' })
        db.createObjectStore('meta', { keyPath: 'key' })
      },
    })
    return new Repo(db)
  }

  close() {
    this.db.close()
  }

  // Meta
  async getMeta<T>(key: string): Promise<T | undefined> {
    return (await this.db.get('meta', key))?.value as T | undefined
  }
  async setMeta(key: string, value: unknown) {
    await this.db.put('meta', { key, value })
  }

  // Exercises
  listExercises() {
    return this.db.getAll('exercises')
  }
  getExercise(id: string) {
    return this.db.get('exercises', id)
  }
  async putExercise(e: Exercise) {
    await this.db.put('exercises', e)
  }
  async putExercises(list: Exercise[]) {
    const tx = this.db.transaction('exercises', 'readwrite')
    await Promise.all([...list.map((e) => tx.store.put(e)), tx.done])
  }
  /** Deletes the exercise and its mastery history. */
  async deleteExercise(id: string) {
    const tx = this.db.transaction(['exercises', 'progress'], 'readwrite')
    await tx.objectStore('exercises').delete(id)
    const keys = await tx.objectStore('progress').index('byExercise').getAllKeys(id)
    await Promise.all(keys.map((k) => tx.objectStore('progress').delete(k)))
    await tx.done
  }

  // Progress
  listProgress() {
    return this.db.getAll('progress')
  }
  async putProgress(p: Progress) {
    await this.db.put('progress', p)
  }

  // Sessions
  async putSession(s: Session) {
    await this.db.put('sessions', s)
  }
  getSession(id: string) {
    return this.db.get('sessions', id)
  }
  listSessions() {
    return this.db.getAll('sessions')
  }
  async latestActiveSession(): Promise<Session | undefined> {
    const all = await this.db.getAllFromIndex('sessions', 'byUpdated')
    return all.reverse().find((s) => s.status === 'active')
  }

  // Settings
  async getSettings(): Promise<Settings | undefined> {
    return (await this.db.get('settings', 'settings'))?.value
  }
  async putSettings(value: Settings) {
    await this.db.put('settings', { key: 'settings', value })
  }

  async clearAll() {
    const tx = this.db.transaction(['exercises', 'progress', 'sessions', 'settings', 'meta'], 'readwrite')
    await Promise.all([
      tx.objectStore('exercises').clear(), tx.objectStore('progress').clear(), tx.objectStore('sessions').clear(),
      tx.objectStore('settings').clear(), tx.objectStore('meta').clear(), tx.done,
    ])
  }

  async replaceAll(data: { exercises: Exercise[]; progress: Progress[]; sessions: Session[]; settings?: Settings }) {
    const tx = this.db.transaction(['exercises', 'progress', 'sessions', 'settings'], 'readwrite')
    await Promise.all([tx.objectStore('exercises').clear(), tx.objectStore('progress').clear(), tx.objectStore('sessions').clear()])
    await Promise.all([
      ...data.exercises.map((e) => tx.objectStore('exercises').put(e)),
      ...data.progress.map((p) => tx.objectStore('progress').put(p)),
      ...data.sessions.map((s) => tx.objectStore('sessions').put(s)),
      ...(data.settings ? [tx.objectStore('settings').put({ key: 'settings', value: data.settings })] : []),
    ])
    await tx.done
  }
}
