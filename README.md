# Keys Lab

A local-first piano practice and vocabulary trainer for jazz, gospel, pop and contemporary harmony.
It's built with React, TypeScript and Vite. All data stays in the browser (IndexedDB), with no accounts or servers.

## Run

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit + integration tests (vitest)
npm run build      # production build in dist/
npm run preview    # serve the production build at http://localhost:4173
```

`dist/` is a static site, so any static file server works (`npx serve dist`). It must be served over http(s),
not opened as a `file://` URL, because the browser blocks module scripts and sample loading from `file://`.

## Deploy (keys.christianruff.com)

The app is a static site hosted on Cloudflare Pages. Every push to `main` deploys production, and every pull request
gets its own preview URL. GitHub Actions (`.github/workflows/ci.yml`) runs lint, tests and the build on the same pushes.

One-time setup in the Cloudflare dashboard:

1. **Workers & Pages → Create → Pages → Connect to Git**, pick `christianruff/keys-lab`.
2. Framework preset: none. Build command `npm run build`, output directory `dist`, production branch `main`.
   Node comes from `.node-version`.
3. After the first deploy: **Custom domains → Set up a domain → `keys.christianruff.com`**. Because christianruff.com
   already uses Cloudflare DNS, the CNAME record is created for you.

`public/_headers` sends `X-Robots-Tag: noindex` on every response, `index.html` has a `noindex` meta tag, and
`robots.txt` disallows all crawlers, so the app stays out of search engines.

## Offline and devices

`npm run build` generates `dist/sw.js`, a service worker that precaches the whole app, including the piano samples.
After one online visit, Keys Lab opens and plays with no connection. Add it to the Home Screen (iPhone/iPad: Share →
Add to Home Screen) to use it like an app. A new deploy installs in the background and the app offers to reload.

Data is stored per device (and on iOS the Home Screen app is separate from Safari). Move it with
Settings → Data: export a full backup (or "Send backup to another device…" via AirDrop/Files) and import it on the
other device. The **Sheets** tab builds printable voicing sheets in any keys for paper or PDF reference.

## Writing formulas

A voicing is a list of degrees for each hand, written low to high, such as LH `1 5 9` and RH `b3 b7 11`.
The **register octave** places the chord root (3 means the root lands in C3–B3). Each hand then stacks upward:

* the first LH note is the lowest pitch at or above the root;
* each following note is the next pitch above the previous one;
* the RH starts above both the root and the top LH note;
* a `+` or `-` after a degree moves that note (and everything stacked after it) by an octave;
* the optional lowest/highest limits shift the whole voicing by octaves to keep it in range.

If you leave the register empty, the voicing is treated as **chord tones only**. It has no keyboard answer and no audio.

Progressions use Roman numerals measured against the major scale of the key in both modes
(minor: `i iiø7 bIII iv V7 bVI bVII`). Chords without hand formulas are open-ended (free voicing).

## Spaced repetition

Progress is tracked for each exercise-and-key pair. Again resets the interval and makes the pair due again within minutes.
Hard grows the interval ×1.2. Good grows it by the pair's ease (about 1 → 2.3 → 5 → 12 → 28 days), and Easy grows it faster.
Mastery: **New** (never attempted), **Learning**, **Comfortable** (2+ successes in a row with an interval of 6+ days),
**Fluent** (4+ successes in a row with an interval of 21+ days). Intervals are capped at 120 days, so fluent items come back for review.
Smart selection favours overdue, weak and unseen pairs, applies some random jitter and the mastery-mix weights you set,
and pushes pairs you practised within the last hour to the back.

## Code layout

| Folder | Responsibility |
| --- | --- |
| `src/music` | Pitch/spelling, degrees, keys, chord qualities, voicing and progression realization (pure) |
| `src/audio` | `plan.ts` (pure playback plans from the same note data the keyboard shows), `engine.ts` (Web Audio sampler) |
| `src/schedule` | Seeded RNG, session generator and queue, spaced-repetition mastery (pure) |
| `src/db` | IndexedDB repository, app-level persistence operations, JSON import/export |
| `src/data` | Starter vocabulary |
| `src/ui` | React components |

## Credits

The piano sound is the Salamander Grand Piano by Alexander Holm (CC BY 3.0), bundled in `public/samples/salamander`.
