/** Pure data for printable voicing sheets: which exercise / key / variant cells to draw. */
import { realizeExercise, type RealizedExercise } from '../music/exercise'
import type { Exercise } from '../model/types'

export interface SheetCell {
  key: number
  variant: number
  variantName: string
  realized: RealizedExercise
}

export interface SheetSection {
  exercise: Exercise
  cells: SheetCell[]
}

export interface SheetOptions {
  allVariants: boolean
  preferGb?: boolean
}

export function buildSheet(exercises: Exercise[], ids: string[], keys: number[], opts: SheetOptions): SheetSection[] {
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const sortedKeys = [...new Set(keys)].sort((a, b) => a - b)
  return ids
    .map((id) => byId.get(id))
    .filter((e): e is Exercise => !!e)
    .map((exercise) => {
      const isProg = exercise.kind !== 'voicing' && !!exercise.progression?.events.length
      const variants = isProg || !opts.allVariants ? [0] : exercise.voicings.map((_, i) => i)
      const cells: SheetCell[] = []
      for (const variant of variants.length ? variants : [0]) {
        for (const key of sortedKeys) {
          cells.push({
            key,
            variant,
            variantName: isProg || exercise.voicings.length < 2 ? '' : (exercise.voicings[variant]?.name ?? ''),
            realized: realizeExercise(exercise, key, { preferGb: opts.preferGb }, variant),
          })
        }
      }
      return { exercise, cells }
    })
}

/** "D F A" style note list for one hand, or '' when the hand has no notes. */
export function handLine(r: RealizedExercise, event: number, hand: 'L' | 'R'): string {
  const ev = r.events[event]
  if (!ev?.complete) return ''
  return ev.notes.filter((n) => n.hand === hand).map((n) => n.name).join(' ')
}
