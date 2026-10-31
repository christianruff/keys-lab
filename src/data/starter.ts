/**
 * Starter vocabulary. Only well-established formulas are filled in; anything that
 * depends on a specific source or interpretation is left as an editable template
 * or an instruction-only exercise.
 */
import type { Exercise, ExerciseKind, ProgressionEvent, Tonality, VoicingDef } from '../model/types'

export const CATEGORIES: { name: string; units: string[] }[] = [
  { name: 'Basics', units: ['Major scales', 'Minor scales', 'Arpeggios', 'Major seventh chords', 'Minor seventh chords'] },
  { name: 'Extensions', units: ['Ninths', 'Elevenths', 'Thirteenths', 'Kenny Barron voicings', 'Herbie Hancock voicings', 'So What voicings'] },
  {
    name: 'Rootless voicings',
    units: ['Major Type A', 'Major Type B', 'Minor Type A', 'Minor Type B', 'Dominant derivations', 'Major 2-5-1s', 'Minor 2-5-1s', 'Two-handed minor 2-5-1s'],
  },
  { name: 'Altered harmony', units: ['Dominant ♭9', 'Dominant ♯9', 'Dominant ♯5', 'Dominant ♭13', 'Dominant ♯11', 'Altered dominant combinations'] },
  { name: 'Upper-structure triads', units: ['UST voicings', 'UST progressions', 'UST substitutions'] },
  {
    name: 'Gospel vocabulary',
    units: ['Passing chords', 'Gospel turnarounds', 'Diminished passing harmony', 'Suspensions', 'Embellishments', 'Walk-ups and walk-downs'],
  },
  {
    name: 'Creative application',
    units: [
      'Reharmonize a simple progression', 'Create multiple voicings for the same progression', 'Create introductions and endings',
      'Develop rhythmic variation', 'Improvise over simple changes',
    ],
  },
]

const T0 = Date.UTC(2026, 0, 1)
let order = 0

interface Spec {
  id: string
  title: string
  kind: ExerciseKind
  category: string
  unit: string
  tonality: Tonality
  instructions: string
  tags?: string[]
  voicings?: Omit<VoicingDef, 'id'>[]
  progression?: { tonality: 'major' | 'minor'; anchorOctave: number | null; minMidi?: number; maxMidi?: number; events: Omit<ProgressionEvent, 'id'>[] }
  template?: boolean
}

function ex(s: Spec): Exercise {
  const t = T0 + order++ * 1000
  return {
    id: s.id, title: s.title, kind: s.kind, category: s.category, unit: s.unit, tonality: s.tonality,
    instructions: s.instructions, tags: s.tags ?? [], archived: false, template: s.template, createdAt: t, updatedAt: t,
    voicings: (s.voicings ?? []).map((v, i) => ({ ...v, id: `${s.id}-v${i + 1}` })),
    progression: s.progression
      ? { ...s.progression, events: s.progression.events.map((e, i) => ({ ...e, id: `${s.id}-e${i + 1}` })) }
      : undefined,
  }
}

const line = (name: string, rh: string, octave = 4): Omit<VoicingDef, 'id'> => ({
  name, symbol: name.toLowerCase(), lh: '', rh, anchorOctave: octave, style: 'melodic',
})

const tmpl = (category: string, unit: string, title: string, instructions: string, kind: ExerciseKind = 'technique', tonality: Tonality = 'major') =>
  ex({
    id: `st-${slug(title)}`, title, kind, category, unit, tonality, instructions, template: true, tags: ['template'],
    progression: kind === 'progression' ? { tonality: 'major', anchorOctave: null, events: [] } : undefined,
  })

function slug(s: string) {
  return s.toLowerCase().replace(/[♭]/g, 'b').replace(/[♯]/g, 's').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const open = (tonality: 'major' | 'minor', events: [string, string, number?, string?][]) => ({
  tonality, anchorOctave: null,
  events: events.map(([roman, quality, beats, bass]) => ({ roman, quality, beats: beats ?? 4, bass })),
})

export function starterLibrary(): Exercise[] {
  order = 0
  const B = 'Basics', X = 'Extensions', R = 'Rootless voicings', A = 'Altered harmony', U = 'Upper-structure triads',
    G = 'Gospel vocabulary', C = 'Creative application'
  return [
    // ---------- Basics
    ex({ id: 'st-major-scale', title: 'Major scale', kind: 'voicing', category: B, unit: 'Major scales', tonality: 'major',
      instructions: 'One octave up and down, hands separately then together. Keep the fingering consistent.',
      voicings: [line('major scale', '1 2 3 4 5 6 7 1')] }),
    ex({ id: 'st-natural-minor', title: 'Natural minor scale', kind: 'voicing', category: B, unit: 'Minor scales', tonality: 'minor',
      instructions: 'One octave up and down.', voicings: [line('natural minor', '1 2 b3 4 5 b6 b7 1')] }),
    ex({ id: 'st-harmonic-minor', title: 'Harmonic minor scale', kind: 'voicing', category: B, unit: 'Minor scales', tonality: 'minor',
      instructions: 'One octave up and down. Listen for the augmented 2nd between ♭6 and 7.', voicings: [line('harmonic minor', '1 2 b3 4 5 b6 7 1')] }),
    ex({ id: 'st-melodic-minor', title: 'Melodic minor scale (jazz)', kind: 'voicing', category: B, unit: 'Minor scales', tonality: 'minor',
      instructions: 'Same notes ascending and descending (jazz melodic minor).', voicings: [line('melodic minor', '1 2 b3 4 5 6 7 1')] }),
    ex({ id: 'st-major-triad-arp', title: 'Major triad arpeggio', kind: 'voicing', category: B, unit: 'Arpeggios', tonality: 'major',
      instructions: 'Two octaves up and down.', voicings: [line('major arpeggio', '1 3 5 1 3 5 1', 3)] }),
    ex({ id: 'st-minor-triad-arp', title: 'Minor triad arpeggio', kind: 'voicing', category: B, unit: 'Arpeggios', tonality: 'minor',
      instructions: 'Two octaves up and down.', voicings: [line('minor arpeggio', '1 b3 5 1 b3 5 1', 3)] }),
    ex({ id: 'st-maj7-arp', title: 'Major 7th arpeggio', kind: 'voicing', category: B, unit: 'Arpeggios', tonality: 'major',
      instructions: 'Two octaves up and down.', voicings: [line('maj7 arpeggio', '1 3 5 7 1 3 5 7 1', 3)] }),
    ex({ id: 'st-maj7-inversions', title: 'Major 7th chord & inversions', kind: 'voicing', category: B, unit: 'Major seventh chords', tonality: 'major',
      instructions: 'Right hand: root position, then each inversion, ascending.',
      voicings: [
        { name: 'Root position', symbol: 'maj7', lh: '', rh: '1 3 5 7', anchorOctave: 4, inversion: 'root' },
        { name: '1st inversion', symbol: 'maj7', lh: '', rh: '3 5 7 1', anchorOctave: 4, inversion: '1st' },
        { name: '2nd inversion', symbol: 'maj7', lh: '', rh: '5 7 1 3', anchorOctave: 4, inversion: '2nd' },
        { name: '3rd inversion', symbol: 'maj7', lh: '', rh: '7 1 3 5', anchorOctave: 4, inversion: '3rd' },
      ] }),
    ex({ id: 'st-m7-inversions', title: 'Minor 7th chord & inversions', kind: 'voicing', category: B, unit: 'Minor seventh chords', tonality: 'minor',
      instructions: 'Right hand: root position, then each inversion, ascending.',
      voicings: [
        { name: 'Root position', symbol: 'm7', lh: '', rh: '1 b3 5 b7', anchorOctave: 4, inversion: 'root' },
        { name: '1st inversion', symbol: 'm7', lh: '', rh: 'b3 5 b7 1', anchorOctave: 4, inversion: '1st' },
        { name: '2nd inversion', symbol: 'm7', lh: '', rh: '5 b7 1 b3', anchorOctave: 4, inversion: '2nd' },
        { name: '3rd inversion', symbol: 'm7', lh: '', rh: 'b7 1 b3 5', anchorOctave: 4, inversion: '3rd' },
      ] }),

    // ---------- Extensions
    ex({ id: 'st-maj9', title: 'Major 9 (root + upper structure)', kind: 'voicing', category: X, unit: 'Ninths', tonality: 'major',
      instructions: 'LH root, RH 3–5–7–9.', voicings: [{ name: 'Maj9', symbol: 'maj9', lh: '1', rh: '3+ 5 7 9', anchorOctave: 3 }] }),
    ex({ id: 'st-m9', title: 'Minor 9 (root + upper structure)', kind: 'voicing', category: X, unit: 'Ninths', tonality: 'minor',
      instructions: 'LH root, RH ♭3–5–♭7–9.', voicings: [{ name: 'm9', symbol: 'm9', lh: '1', rh: 'b3+ 5 b7 9', anchorOctave: 3 }] }),
    ex({ id: 'st-dom9', title: 'Dominant 9', kind: 'voicing', category: X, unit: 'Ninths', tonality: 'dominant',
      instructions: 'LH 1–♭7, RH 3–5–9.', voicings: [{ name: 'Dom9', symbol: '9', lh: '1 b7', rh: '3 5 9', anchorOctave: 3 }] }),
    ex({ id: 'st-9sus4', title: 'Dominant 11 / 9sus4', kind: 'voicing', category: X, unit: 'Elevenths', tonality: 'dominant',
      instructions: 'LH root, RH the major triad a whole step below the root (♭7–9–11).',
      voicings: [{ name: '9sus4', symbol: '9sus4', lh: '1', rh: 'b7 9 11', anchorOctave: 3 }] }),
    ex({ id: 'st-m11', title: 'Minor 11', kind: 'voicing', category: X, unit: 'Elevenths', tonality: 'minor',
      instructions: 'LH 1–5, RH ♭7–♭3–11.', voicings: [{ name: 'm11', symbol: 'm11', lh: '1 5', rh: 'b7 b3 11', anchorOctave: 3 }] }),
    ex({ id: 'st-dom13', title: 'Dominant 13', kind: 'voicing', category: X, unit: 'Thirteenths', tonality: 'dominant',
      instructions: 'LH 1–♭7, RH 9–3–13.', voicings: [
        { name: '13 (with 9)', symbol: '13', lh: '1 b7', rh: '9 3 13', anchorOctave: 3 },
        { name: '13 shell', symbol: '13', lh: '1 b7', rh: '3 13', anchorOctave: 3 },
      ] }),
    ex({ id: 'st-kenny-barron-m11', title: 'Kenny Barron minor 11', kind: 'voicing', category: X, unit: 'Kenny Barron voicings', tonality: 'minor',
      instructions: 'LH 1–5–9, RH ♭3–♭7–11. Two stacked fifths in each hand, a minor 2nd apart.',
      voicings: [{ name: 'Kenny Barron m11', symbol: 'm11', lh: '1 5 9', rh: 'b3 b7 11', anchorOctave: 3, maxMidi: 84 }] }),
    tmpl(X, 'Herbie Hancock voicings', 'Herbie Hancock voicing (template)',
      'Template: open Edit and enter the Herbie Hancock voicing you are studying (LH and RH degrees, register octave) from your source.', 'voicing', 'minor'),
    ex({ id: 'st-so-what', title: 'So What voicing', kind: 'voicing', category: X, unit: 'So What voicings', tonality: 'minor',
      instructions: 'Three perfect 4ths plus a major 3rd: LH 1–4–♭7, RH ♭3–5.',
      voicings: [{ name: 'So What', symbol: 'm11', lh: '1 4 b7', rh: 'b3 5', anchorOctave: 3, context: 'Quartal minor voicing (m7 with 11)' }] }),

    // ---------- Rootless voicings (left hand, kept near middle C)
    ex({ id: 'st-major-type-a', title: 'Major rootless Type A', kind: 'voicing', category: R, unit: 'Major Type A', tonality: 'major',
      instructions: 'LH 3–5–7–9 (no root).', voicings: [
        { name: 'Maj9 Type A', symbol: 'maj9', lh: '3 5 7 9', rh: '', anchorOctave: 3, maxMidi: 71 },
        { name: '6/9 Type A', symbol: '69', lh: '3 5 6 9', rh: '', anchorOctave: 3, maxMidi: 71 },
      ] }),
    ex({ id: 'st-major-type-b', title: 'Major rootless Type B', kind: 'voicing', category: R, unit: 'Major Type B', tonality: 'major',
      instructions: 'LH 7–9–3–5 (no root).', voicings: [
        { name: 'Maj9 Type B', symbol: 'maj9', lh: '7 9 3 5', rh: '', anchorOctave: 3, maxMidi: 71 },
        { name: '6/9 Type B', symbol: '69', lh: '6 9 3 5', rh: '', anchorOctave: 3, maxMidi: 71 },
      ] }),
    ex({ id: 'st-minor-type-a', title: 'Minor rootless Type A', kind: 'voicing', category: R, unit: 'Minor Type A', tonality: 'minor',
      instructions: 'LH ♭3–5–♭7–9 (no root).', voicings: [{ name: 'm9 Type A', symbol: 'm9', lh: 'b3 5 b7 9', rh: '', anchorOctave: 3, maxMidi: 71 }] }),
    ex({ id: 'st-minor-type-b', title: 'Minor rootless Type B', kind: 'voicing', category: R, unit: 'Minor Type B', tonality: 'minor',
      instructions: 'LH ♭7–9–♭3–5 (no root).', voicings: [{ name: 'm9 Type B', symbol: 'm9', lh: 'b7 9 b3 5', rh: '', anchorOctave: 3, maxMidi: 71 }] }),
    ex({ id: 'st-dominant-derivations', title: 'Dominant rootless derivations', kind: 'drill', category: R, unit: 'Dominant derivations', tonality: 'dominant',
      instructions: 'Play the unaltered 13 in both positions, then lower the 9 and 13 to get the ♭9/♭13 versions. Use the variant tabs.',
      voicings: [
        { name: '13 Type A', symbol: '13', lh: '3 13 b7 9', rh: '', anchorOctave: 3, maxMidi: 71 },
        { name: '13 Type B', symbol: '13', lh: 'b7 9 3 13', rh: '', anchorOctave: 3, maxMidi: 71 },
        { name: '7(♭9,♭13) Type A', symbol: '7(b9,b13)', lh: '3 b13 b7 b9', rh: '', anchorOctave: 3, maxMidi: 71 },
        { name: '7(♭9,♭13) Type B', symbol: '7(b9,b13)', lh: 'b7 b9 3 b13', rh: '', anchorOctave: 3, maxMidi: 71 },
      ] }),
    ex({ id: 'st-major-251-a', title: 'Major ii–V–I rootless (starting Type A)', kind: 'progression', category: R, unit: 'Major 2-5-1s', tonality: 'major',
      instructions: 'LH rootless: ii Type A → V Type B → I Type A. Only one or two notes move each time.',
      progression: { tonality: 'major', anchorOctave: 3, maxMidi: 71, events: [
        { roman: 'ii', quality: 'm9', beats: 4, voicing: { lh: 'b3 5 b7 9', rh: '' } },
        { roman: 'V', quality: '13', beats: 4, octave: -1, voicing: { lh: 'b7 9 3 13', rh: '' } },
        { roman: 'I', quality: 'maj9', beats: 8, voicing: { lh: '3 5 7 9', rh: '' } },
      ] } }),
    ex({ id: 'st-major-251-b', title: 'Major ii–V–I rootless (starting Type B)', kind: 'progression', category: R, unit: 'Major 2-5-1s', tonality: 'major',
      instructions: 'LH rootless: ii Type B → V Type A → I Type B.',
      progression: { tonality: 'major', anchorOctave: 3, maxMidi: 71, events: [
        { roman: 'ii', quality: 'm9', beats: 4, voicing: { lh: 'b7 9 b3 5', rh: '' } },
        { roman: 'V', quality: '13', beats: 4, voicing: { lh: '3 13 b7 9', rh: '' } },
        { roman: 'I', quality: 'maj9', beats: 8, voicing: { lh: '7 9 3 5', rh: '' } },
      ] } }),
    ex({ id: 'st-minor-251', title: 'Minor iiø–V7(♭9,♭13)–i rootless', kind: 'progression', category: R, unit: 'Minor 2-5-1s', tonality: 'minor',
      instructions: 'LH rootless: iiø (♭3 ♭5 ♭7 1) → V7 (♭7 ♭9 3 ♭13) → i m9 (♭3 5 ♭7 9).',
      progression: { tonality: 'minor', anchorOctave: 3, maxMidi: 71, events: [
        { roman: 'iiø7', quality: '', beats: 4, voicing: { lh: 'b3 b5 b7 1', rh: '' } },
        { roman: 'V7', quality: '7(b9,b13)', beats: 4, octave: -1, voicing: { lh: 'b7 b9 3 b13', rh: '' } },
        { roman: 'i', quality: 'm9', beats: 8, voicing: { lh: 'b3 5 b7 9', rh: '' } },
      ] } }),
    ex({ id: 'st-minor-251-two-hands', title: 'Two-handed minor ii–V–i', kind: 'progression', category: R, unit: 'Two-handed minor 2-5-1s', tonality: 'minor',
      instructions: 'LH plays the root; RH plays the rootless voicings from the one-handed minor ii–V–i.',
      progression: { tonality: 'minor', anchorOctave: 3, minMidi: 36, maxMidi: 74, events: [
        { roman: 'iiø7', quality: '', beats: 4, voicing: { lh: '1-', rh: 'b3 b5 b7 1' } },
        { roman: 'V7', quality: '7(b9,b13)', beats: 4, octave: -1, voicing: { lh: '1', rh: 'b7 b9 3 b13' } },
        { roman: 'i', quality: 'm9', beats: 8, voicing: { lh: '1-', rh: 'b3 5 b7 9' } },
      ] } }),

    // ---------- Altered harmony (LH 1–♭7, RH colour tones)
    ex({ id: 'st-dom-b9', title: 'Dominant ♭9', kind: 'voicing', category: A, unit: 'Dominant ♭9', tonality: 'dominant',
      instructions: 'LH 1–♭7, RH 3–5–♭9.', voicings: [{ name: '7(♭9)', symbol: '7(b9)', lh: '1 b7', rh: '3 5 b9', anchorOctave: 3, maxMidi: 79 }] }),
    ex({ id: 'st-dom-s9', title: 'Dominant ♯9', kind: 'voicing', category: A, unit: 'Dominant ♯9', tonality: 'dominant',
      instructions: 'LH 1–♭7, RH 3–♯9.', voicings: [{ name: '7(♯9)', symbol: '7(#9)', lh: '1 b7', rh: '3 #9', anchorOctave: 3, maxMidi: 79 }] }),
    ex({ id: 'st-dom-s5', title: 'Dominant ♯5', kind: 'voicing', category: A, unit: 'Dominant ♯5', tonality: 'dominant',
      instructions: 'LH 1–♭7, RH 3–♯5.', voicings: [{ name: '7(♯5)', symbol: '7(#5)', lh: '1 b7', rh: '3 #5', anchorOctave: 3, maxMidi: 79 }] }),
    ex({ id: 'st-dom-b13', title: 'Dominant ♭13', kind: 'voicing', category: A, unit: 'Dominant ♭13', tonality: 'dominant',
      instructions: 'LH 1–♭7, RH 3–♭13 (add 9 for the second variant).', voicings: [
        { name: '7(♭13)', symbol: '7(b13)', lh: '1 b7', rh: '3 b13', anchorOctave: 3, maxMidi: 79 },
        { name: '9(♭13)', symbol: '9(b13)', lh: '1 b7', rh: '9 3 b13', anchorOctave: 3, maxMidi: 79 },
      ] }),
    ex({ id: 'st-dom-s11', title: 'Dominant ♯11 (13♯11)', kind: 'voicing', category: A, unit: 'Dominant ♯11', tonality: 'dominant',
      instructions: 'LH 1–♭7, RH 3–♯11–13.', voicings: [{ name: '13(♯11)', symbol: '13(#11)', lh: '1 b7', rh: '3 #11 13', anchorOctave: 3, maxMidi: 79 }] }),
    ex({ id: 'st-altered-combos', title: 'Altered dominant combinations', kind: 'voicing', category: A, unit: 'Altered dominant combinations', tonality: 'dominant',
      instructions: 'LH 1–♭7; RH combines two alterations. Switch variants for each combination.', voicings: [
        { name: '7(♭9,♯5)', symbol: '7(b9,#5)', lh: '1 b7', rh: '3 #5 b9', anchorOctave: 3, maxMidi: 79 },
        { name: '7(♯9,♭13)', symbol: '7(#9,b13)', lh: '1 b7', rh: '3 b13 #9', anchorOctave: 3, maxMidi: 79 },
        { name: '7(♭9,♭13)', symbol: '7(b9,b13)', lh: '1 b7', rh: '3 b13 b9', anchorOctave: 3, maxMidi: 79 },
      ] }),

    // ---------- Upper-structure triads (LH 3–♭7 tritone, RH triad)
    ex({ id: 'st-ust', title: 'Upper-structure triads on a dominant', kind: 'voicing', category: U, unit: 'UST voicings', tonality: 'dominant',
      instructions: 'LH 3–♭7 tritone. RH: II major triad (13♯11), ♭VI major triad (7♯9♭13) or ♭III major triad (7♯9). ♯9 is spelled as ♭10 so each triad reads as a triad.',
      voicings: [
        { name: 'UST II', symbol: '13(#11)', lh: '3 b7', rh: '9 #11 13', anchorOctave: 3, maxMidi: 79 },
        { name: 'UST ♭VI', symbol: '7(#9,b13)', lh: '3 b7', rh: 'b13 1 b10', anchorOctave: 3, maxMidi: 79 },
        { name: 'UST ♭III', symbol: '7(#9)', lh: '3 b7', rh: 'b10 5 b7', anchorOctave: 3, maxMidi: 79 },
      ] }),
    ex({ id: 'st-ust-progression', title: 'ii–V–I with an upper structure on V', kind: 'progression', category: U, unit: 'UST progressions', tonality: 'major',
      instructions: 'Open-ended: voice the ii and I freely; on the V choose one of the upper-structure triads (LH 3–♭7, RH triad).',
      progression: open('major', [['ii', 'm7', 4], ['V', '7alt', 4], ['I', 'maj7', 8]]) }),
    tmpl(U, 'UST substitutions', 'UST substitutions (technique)',
      'Take a tune you know. On every dominant chord, replace your usual voicing with an upper-structure triad that fits the melody note. Note which triads you used.'),

    // ---------- Gospel vocabulary (open-ended progressions: you choose the voicings)
    ex({ id: 'st-gospel-passing', title: 'I – I7 – IV – ♯iv°7 – I/5', kind: 'progression', category: G, unit: 'Passing chords', tonality: 'major',
      instructions: 'Open-ended. Voice-lead through the passing ♯iv°7 back to I over the 5th in the bass.',
      progression: open('major', [['I', '', 2], ['I', '7', 2], ['IV', '', 2], ['#iv', 'dim7', 2], ['I', '', 4, '5']]) }),
    tmpl(G, 'Gospel turnarounds', 'Gospel turnaround (template)',
      'Template: enter a turnaround from your teacher or a recording as a progression (Edit → kind: progression).', 'progression'),
    ex({ id: 'st-dim-passing', title: 'Diminished passing chords: I – ♯i°7 – ii7 – ♯ii°7 – iii7', kind: 'progression', category: G, unit: 'Diminished passing harmony', tonality: 'major',
      instructions: 'Open-ended. Move by half step in the bass; keep common tones in the right hand.',
      progression: open('major', [['I', 'maj7', 2], ['#i', 'dim7', 2], ['ii', 'm7', 2], ['#ii', 'dim7', 2], ['iii', 'm7', 4]]) }),
    ex({ id: 'st-suspension', title: 'Suspension: V7sus4 – V7 – I', kind: 'progression', category: G, unit: 'Suspensions', tonality: 'major',
      instructions: 'Open-ended. Resolve the 4th down to the 3rd, then to I.',
      progression: open('major', [['V', '7sus4', 2], ['V', '7', 2], ['I', '', 4]]) }),
    tmpl(G, 'Embellishments', 'Create three embellishments',
      'Choose a chord or cadence and create three distinct embellishments (e.g. grace-note fills, neighbour tones, a short run into the next chord).'),
    ex({ id: 'st-walk-up', title: 'Walk-up: I – ii7 – I/3 – IV', kind: 'progression', category: G, unit: 'Walk-ups and walk-downs', tonality: 'major',
      instructions: 'Open-ended. Bass walks 1–2–3–4.', progression: open('major', [['I', '', 2], ['ii', 'm7', 2], ['I', '', 2, '3'], ['IV', '', 2]]) }),
    ex({ id: 'st-walk-down', title: 'Walk-down: I – V/3 – vi – I/5', kind: 'progression', category: G, unit: 'Walk-ups and walk-downs', tonality: 'major',
      instructions: 'Open-ended. Bass walks down 1–7–6–5.', progression: open('major', [['I', '', 2], ['V', '', 2, '3'], ['vi', '', 2], ['I', '', 2, '5']]) }),

    // ---------- Creative application
    ex({ id: 'st-reharm', title: 'Reharmonize I – IV – V – I', kind: 'technique', category: C, unit: 'Reharmonize a simple progression', tonality: 'major',
      instructions: 'Reharmonize this progression two different ways (e.g. add ii–V approaches, tritone subs, passing diminished chords).',
      progression: open('major', [['I', '', 4], ['IV', '', 4], ['V', '', 4], ['I', '', 4]]) }),
    ex({ id: 'st-multi-voicing', title: 'Three voicings for one ii–V–I', kind: 'technique', category: C, unit: 'Create multiple voicings for the same progression', tonality: 'major',
      instructions: 'Play this ii–V–I three ways: shells, rootless, and a two-handed voicing of your choice.',
      progression: open('major', [['ii', 'm7', 4], ['V', '7', 4], ['I', 'maj7', 8]]) }),
    tmpl(C, 'Create introductions and endings', 'Create an intro and an ending',
      'Create a 4-bar introduction and a short ending in this key, using vocabulary you have practised.'),
    tmpl(C, 'Develop rhythmic variation', 'Rhythmic variation',
      'Take any voicing or progression from today and play it with three different rhythmic feels (e.g. Charleston, anticipations, gospel 12/8).'),
    ex({ id: 'st-improv-1625', title: 'Improvise over I – vi – ii – V', kind: 'technique', category: C, unit: 'Improvise over simple changes', tonality: 'major',
      instructions: 'Comp in the left hand and improvise a melody in the right for several choruses.',
      progression: open('major', [['I', 'maj7', 4], ['vi', 'm7', 4], ['ii', 'm7', 4], ['V', '7', 4]]) }),
    ex({ id: 'st-improv-145', title: 'Improvise over I – IV – V', kind: 'technique', category: C, unit: 'Improvise over simple changes', tonality: 'major',
      instructions: 'Comp in the left hand and improvise in the right; try a gospel or pop feel.',
      progression: open('major', [['I', '', 4], ['IV', '', 4], ['V', '', 4], ['I', '', 4]]) }),
  ]
}
