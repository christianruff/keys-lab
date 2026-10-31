/** Seeded PRNG (mulberry32) so sessions are reproducible from a stored seed. */
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Weighted sampling without replacement (Efraimidis–Spirakis). Items with weight <= 0 come last. */
export function weightedSample<T>(items: T[], weight: (t: T) => number, k: number, rng: Rng): T[] {
  const keyed = items.map((it) => {
    const w = Math.max(weight(it), 1e-6)
    return { it, key: Math.log(Math.max(rng(), 1e-12)) / w }
  })
  keyed.sort((a, b) => b.key - a.key)
  return keyed.slice(0, k).map((x) => x.it)
}
