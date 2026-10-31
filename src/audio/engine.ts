/**
 * Web Audio piano: Salamander Grand Piano samples (CC BY 3.0, bundled locally)
 * pitch-shifted from the nearest sampled note. Falls back to a simple synthesized
 * piano tone if samples cannot be decoded.
 */
import type { Click, PlaybackPlan } from './plan'

const SAMPLE_NOTES: [string, number][] = []
{
  const names: [string, number][] = [['C', 0], ['Ds', 3], ['Fs', 6], ['A', 9]]
  for (let oct = 0; oct <= 8; oct++) {
    for (const [n, pc] of names) {
      const midi = 12 * (oct + 1) + pc
      if (midi >= 21 && midi <= 108) SAMPLE_NOTES.push([`${n}${oct}`, midi])
    }
  }
}

type Listener = (state: { playing: boolean; event: number | null; loaded: boolean }) => void

export class PianoEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buffers = new Map<number, AudioBuffer>()
  private loading: Promise<void> | null = null
  private active: { src: AudioScheduledSourceNode; gain: GainNode }[] = []
  private timers: number[] = []
  private listeners = new Set<Listener>()
  private volume = 0.8
  loaded = false
  failed = false
  baseUrl: string

  constructor(baseUrl = `${import.meta.env?.BASE_URL ?? '/'}samples/salamander/`) {
    this.baseUrl = baseUrl
  }

  subscribe(l: Listener) {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }

  private emit(playing: boolean, event: number | null) {
    for (const l of this.listeners) l({ playing, event, loaded: this.loaded })
  }

  setVolume(v: number) {
    this.volume = v
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02)
  }

  /** Must be called from a user gesture at least once (autoplay policy). */
  async ensure(): Promise<AudioContext> {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctx()
      const comp = this.ctx.createDynamicsCompressor()
      comp.threshold.value = -14
      comp.ratio.value = 3
      this.master = this.ctx.createGain()
      this.master.gain.value = this.volume
      this.master.connect(comp).connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume()
    if (!this.loading) this.loading = this.load()
    return this.ctx
  }

  private async load() {
    const ctx = this.ctx!
    const results = await Promise.allSettled(
      SAMPLE_NOTES.map(async ([name, midi]) => {
        const res = await fetch(`${this.baseUrl}${name}.mp3`)
        if (!res.ok) throw new Error(`${name}: ${res.status}`)
        const buf = await ctx.decodeAudioData(await res.arrayBuffer())
        this.buffers.set(midi, buf)
      }),
    )
    this.loaded = this.buffers.size > 0
    this.failed = results.every((r) => r.status === 'rejected')
    this.emit(false, null)
  }

  /** Wait until samples are available (or failed), at most `ms`. */
  async ready(ms = 4000) {
    await this.ensure()
    await Promise.race([this.loading, new Promise((r) => setTimeout(r, ms))])
  }

  private nearest(midi: number): [number, AudioBuffer] | null {
    let best: [number, AudioBuffer] | null = null
    for (const [m, b] of this.buffers) if (!best || Math.abs(m - midi) < Math.abs(best[0] - midi)) best = [m, b]
    return best
  }

  private voice(midi: number, when: number, duration: number, velocity: number) {
    const ctx = this.ctx!
    const gain = ctx.createGain()
    gain.connect(this.master!)
    const s = this.nearest(midi)
    const peak = 0.25 + velocity * 0.75
    const release = 1.2
    let src: AudioScheduledSourceNode
    if (s) {
      const b = ctx.createBufferSource()
      b.buffer = s[1]
      b.playbackRate.value = Math.pow(2, (midi - s[0]) / 12)
      src = b
      gain.gain.setValueAtTime(peak, when)
    } else {
      // Synth fallback: triangle with exponential decay.
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12)
      src = o
      gain.gain.setValueAtTime(0, when)
      gain.gain.linearRampToValueAtTime(peak * 0.5, when + 0.005)
      gain.gain.exponentialRampToValueAtTime(peak * 0.12, when + 1.5)
    }
    const end = when + duration
    gain.gain.setTargetAtTime(0, end, release / 4)
    src.connect(gain)
    src.start(when)
    src.stop(end + release * 1.5)
    const entry = { src, gain }
    this.active.push(entry)
    src.onended = () => {
      this.active = this.active.filter((a) => a !== entry)
      gain.disconnect()
    }
  }

  private click(c: Click, when: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = c.accent ? 1760 : 1175
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(c.accent ? 0.35 : 0.22, when + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.06)
    o.connect(g).connect(this.master!)
    o.start(when)
    o.stop(when + 0.08)
    const entry = { src: o, gain: g }
    this.active.push(entry)
    o.onended = () => (this.active = this.active.filter((a) => a !== entry))
  }

  /** Play a plan produced by audio/plan.ts. Stops anything currently playing. */
  async play(plan: PlaybackPlan) {
    this.stop()
    await this.ready()
    const ctx = this.ctx!
    const t0 = ctx.currentTime + 0.05
    for (const n of plan.notes) this.voice(n.midi, t0 + n.time, n.duration, n.velocity)
    for (const c of plan.clicks) this.click(c, t0 + c.time)
    plan.eventTimes.forEach((t, i) => {
      this.timers.push(window.setTimeout(() => this.emit(true, i), (t + 0.05) * 1000))
    })
    this.emit(true, plan.eventTimes.length ? 0 : null)
    this.timers.push(window.setTimeout(() => this.emit(false, null), plan.length * 1000))
  }

  /** Single key press from the on-screen keyboard. */
  async tap(midi: number) {
    await this.ensure()
    this.voice(midi, this.ctx!.currentTime + 0.01, 1.2, 0.6)
  }

  stop() {
    for (const t of this.timers) clearTimeout(t)
    this.timers = []
    if (this.ctx) {
      const now = this.ctx.currentTime
      for (const { src, gain } of this.active) {
        gain.gain.cancelScheduledValues(now)
        gain.gain.setTargetAtTime(0, now, 0.05)
        try {
          src.stop(now + 0.3)
        } catch {
          /* already stopped */
        }
      }
    }
    this.active = []
    this.emit(false, null)
  }
}

export const piano = new PianoEngine()
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __piano: PianoEngine }).__piano = piano
