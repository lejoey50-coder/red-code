// The fog the megacity stands in. No billows: thin sheets of mist, each a long low crest over a body that
// runs down out of sight, laid one behind another between the rings of towers, so every block stands in
// fog up to a different height and the nearer ones stand clear of what hides the farther ones.
//
// Each sheet is two crests of different lengths sliding at different speeds, both see-through, so the
// outline they make together never comes round the same way twice and no loop shows. Currents of mist
// come down between the blocks and run out into the fog. The city's neon lies in it where a lit corner
// goes under.
//
// Everything is drawn in the sea's own pixels: the tower's scale, with 0 where the fog's top meets the
// screen. The pieces that go between the rings are drawn inside the tower's group, lowered by `.cf` to
// the same height the sea's own group (`.cs`) takes.

import { BANDS, placement } from './play'
import { hash } from './room'

/** Seconds, for a delay that puts a loop of `ms` at the clock's place in it. */
const at = (now: number, ms: number) => `${-(now % ms) / 1000}s`

/** The fog's left edge and width in the tower's pixels: past the window's left edge at its smallest scale. */
const WEST = -1480
const SPAN = 1760
/** How far a sheet's body runs down under its crest: below the window's foot at every window shape. */
const DEEP = 620

// ---- the crests

/** Smooth noise that comes round after `period`: `cells` knots, eased between. 0 to 1. */
function wave(x: number, period: number, cells: number, seed: number): number {
  const u = (x / period) * cells
  const i = Math.floor(u)
  const f = u - i
  const a = hash(i % cells, seed + cells) / 96
  const b = hash((i + 1) % cells, seed + cells) / 96
  return a + (b - a) * f * f * (3 - 2 * f)
}

/** A crest's height at each pixel across one period: long flats, a few slow rises, small ripples on them. */
function crest(period: number, seed: number, tall: number): number[] {
  const ys: number[] = []
  for (let x = 0; x < period; x++) {
    const slow = wave(x, period, 3, seed)
    const mid = wave(x, period, 7, seed + 1)
    const fine = wave(x, period, 13, seed + 2)
    // a rise is rare and steep on its windward side: the square keeps most of the crest low
    const lift = slow * 0.55 + mid * mid * 0.45
    ys.push(Math.round(tall - lift * tall + fine * 3))
  }
  return ys
}

/** The crest as an outline, in steps, closed far below. */
function outline(ys: number[], deep: number): string {
  const n = ys.length
  let d = `M0 ${ys[0]}`
  let run = 0
  for (let x = 1; x <= n; x++) {
    run++
    const y = ys[x % n] ?? 0
    const was = ys[x - 1] ?? 0
    if (y === was && x < n) continue
    d += `h${run}`
    if (y !== was) d += `v${y - was}`
    run = 0
  }
  return `${d}V${deep}H0z`
}

/** Loose threads of mist lying just over a crest, where it rises. */
function threads(ys: number[], seed: number): string {
  const n = ys.length
  let d = ''
  for (let x = 9; x < n - 60; x += 31 + (hash(x, seed) % 37)) {
    const y = (ys[x] ?? 0) - 2 - (hash(seed, x) % 6)
    const w = 22 + (hash(x, seed + 4) % 34)
    d += `M${x} ${y}.5h${w}m${-(w >> 1)} -2h${w >> 1}`
    if (hash(x, seed + 5) % 2 === 0) d += `m${6 - w} 5h${w - 10}`
  }
  return d
}

type Tile = { id: string; period: number; seed: number; tall: number; ink: string; thread: string }
/** Two crests of different lengths, the pale one for far sheets and the deep one for near; each also mirrored. */
const TILES: Tile[] = [
  { id: 'va', period: 416, seed: 11, tall: 44, ink: '#1F4C592E', thread: '#4F93A150' },
  { id: 'vb', period: 352, seed: 29, tall: 34, ink: '#0F2A3352', thread: '#2E66744A' },
]
/** A mirrored copy's id. */
const flip = (id: string) => `${id}m`

// ---- ribbons: the mist a current carries

/** A ribbon's loop, the height of its row, and how far the field drops in one loop (whole rows, so it joins). */
const RIB = { period: 300, tall: 24, fall: 144 }

/** A ribbon: a band of mist of changing thickness, wandering a little, broken where it thins to nothing. */
function ribbon(seed: number, thick: number): string {
  const n = RIB.period
  const top: number[] = []
  const low: number[] = []
  for (let x = 0; x < n; x++) {
    const mid = RIB.tall / 2 + (wave(x, n, 4, seed) - 0.5) * 8
    const t = wave(x, n, 5, seed + 3) * 1.5 - 0.3 + wave(x, n, 13, seed + 5) * 0.2
    const half = Math.max(0, t) * (thick / 2)
    top.push(half < 1 ? NaN : Math.round(mid - half))
    low.push(half < 1 ? NaN : Math.round(mid + half))
  }
  let d = ''
  for (let x0 = 0; x0 < n; ) {
    if (Number.isNaN(top[x0])) {
      x0++
      continue
    }
    let x1 = x0
    while (x1 < n && !Number.isNaN(top[x1])) x1++
    // along the top, then back along the bottom
    d += `M${x0} ${top[x0]}`
    let run = 0
    for (let x = x0 + 1; x <= x1; x++) {
      run++
      if (x < x1 && top[x] === top[x - 1]) continue
      d += `h${run}`
      if (x < x1) d += `v${(top[x] ?? 0) - (top[x - 1] ?? 0)}`
      run = 0
    }
    d += `v${(low[x1 - 1] ?? 0) - (top[x1 - 1] ?? 0)}`
    for (let x = x1 - 1; x >= x0; x--) {
      run++
      if (x > x0 && low[x - 1] === low[x]) continue
      d += `h${-run}`
      if (x > x0) d += `v${(low[x - 1] ?? 0) - (low[x] ?? 0)}`
      run = 0
    }
    d += 'z'
    x0 = x1
  }
  return d
}

// ---- currents
//
// A current is a path the mist takes: an S from the upper left to the lower right, steep where it comes
// down past a block and running out flat into the fog. The path itself stands still, as wind round a
// building does; the mist moves along it. Each gap between the rings has its own set, cut as a mask over a
// field of ribbons that slides down to the right at the room's slope.

/** The top and the height of the band the currents lie in, in the sea's pixels. */
const BAND = { y: -350, h: 450 }

/** One current from (x, y): steep in the middle, flat at its foot. */
function current(x: number, y: number, seed: number): string {
  const j = (n: number, k: number) => hash(seed, k) % n
  return `M${x} ${y}c${34 + j(22, 1)} ${16 + j(14, 2)} ${48 + j(22, 3)} ${54 + j(22, 4)} ${64 + j(26, 5)} ${98 + j(30, 6)}s${48 + j(34, 7)} ${48 + j(16, 8)} ${130 + j(70, 9)} ${60 + j(22, 10)}`
}

/** Where each gap's currents start: how high, and how far apart. The last set runs in front of the tower. */
const GAPS: Array<{ y: number; step: number; ms: number }> = [
  { y: -340, step: 520, ms: 131000 },
  { y: -262, step: 440, ms: 97000 },
  { y: -208, step: 560, ms: 113000 },
  { y: -158, step: 480, ms: 83000 },
]

/** A gap's currents as a mask: a core, and a wider, fainter edge. */
function currents(k: number): string {
  const gap = GAPS[k]
  if (!gap) return ''
  let d = ''
  for (let x = WEST + k * 130 + (hash(k, 3) % 60); x < WEST + SPAN - 60; x += gap.step + (hash(x, k) % 90) - 45) d += current(x, gap.y + (hash(x, k + 7) % 56), x + k)
  // the one that crosses the tower's own walls, under the room
  if (k === 3) d += current(-22, -152, 5)
  return (
    `<path id="vc${k}" d="${d}"/><mask id="vq${k}" maskUnits="userSpaceOnUse" x="${WEST}" y="${BAND.y}" width="${SPAN}" height="${BAND.h}">` +
    `<g stroke="url(#vg)" stroke-linecap="round"><use href="#vc${k}" stroke-width="56" stroke-opacity=".3"/><use href="#vc${k}" stroke-width="36" stroke-opacity=".6"/><use href="#vc${k}" stroke-width="16"/></g></mask>`
  )
}

/**
 * A gap's currents: their own pale body, faintest at the edge, and the mist running down them in
 * two passes of the field, the second lower and slower. The whole set leans slowly from side to side.
 */
function flow(k: number, now: number): string {
  const ms = GAPS[k]?.ms ?? 1
  const slow = Math.round(ms * 1.37)
  const pass = (t: number, more: string) => `<use href="#vf"${more} style="animation:vr ${t / 1000}s steps(${RIB.period}) ${at(now, t)} infinite"/>`
  const sway = 41000 + k * 9000
  return (
    `<g style="animation:wisp ${sway / 1000}s ease-in-out ${at(now, sway * 2)} infinite alternate"><g mask="url(#vq${k})"><rect x="${WEST}" y="${BAND.y}" width="${SPAN}" height="${BAND.h}" fill="#3C8090" opacity=".13"/>${pass(ms, '')}${pass(slow, ' y="11"')}</g></g>`
  )
}

// ---- what is drawn once

const defsCached = new Map<number, string>()
/**
 * The crests, the ribbons and the currents: drawn once, used by every sheet. `gaps` is how many sets of
 * currents the drawing uses, counted from the front: 4 for all, 1 for the tower's own, 0 for none.
 */
export function fogDefs(gaps: 0 | 1 | 4 = 4): string {
  const got = defsCached.get(gaps)
  if (got !== undefined) return got
  let out = ''
  for (const t of TILES) {
    const ys = crest(t.period, t.seed, t.tall)
    out +=
      `<pattern id="${t.id}" width="${t.period}" height="${DEEP}" patternUnits="userSpaceOnUse"><path fill="${t.ink}" d="${outline(ys, DEEP)}"/><path stroke="${t.thread}" d="${threads(ys, t.seed)}"/></pattern>` +
      `<pattern id="${flip(t.id)}" href="#${t.id}" patternTransform="scale(-1 1)"/>`
    for (const id of [t.id, flip(t.id)]) out += `<rect id="s${id}" x="${WEST - t.period}" width="${SPAN + t.period}" height="${DEEP}" fill="url(#${id})"/>`
  }
  if (gaps > 0)
    out += `<pattern id="vr" width="${RIB.period}" height="${RIB.tall}" patternUnits="userSpaceOnUse"><path fill="#3F7F8E40" d="${ribbon(41, 11)}"/><path fill="#8FD0DA38" d="${ribbon(41, 4)}"/></pattern>`
  // the field of ribbons and the currents cut out of it
  if (gaps > 0)
    out +=
    `<rect id="vf" x="${WEST - RIB.period}" y="${BAND.y - RIB.fall}" width="${SPAN + RIB.period}" height="${BAND.h + RIB.fall}" fill="url(#vr)"/>` +
    // a current comes out of nothing at its head and goes back to it at its foot
    '<linearGradient id="vg" x2="0" y2="1"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".4" stop-color="#fff"/><stop offset=".72" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
    GAPS.map((_, k) => (k >= GAPS.length - gaps ? currents(k) : '')).join('')
  defsCached.set(gaps, out)
  return out
}

// ---- the sheets

/** A sheet: where its crest lies, its two crests and how long each takes to come round. Back to front. */
type Sheet = { y: number; a: string; aMs: number; b: string; bMs: number }
const tileOf = (id: string) => TILES.find(t => id.startsWith(t.id)) ?? TILES[0]!

function sheet(s: Sheet, now: number): string {
  const pass = (id: string, ms: number) => {
    const t = tileOf(id)
    return `<use href="#s${id}" style="animation:${t.id} ${ms / 1000}s steps(${t.period}) ${at(now, ms)} infinite"/>`
  }
  return `<g transform="translate(0 ${s.y})">${pass(s.a, s.aMs)}${pass(s.b, s.bMs)}</g>`
}

/** Behind the middle ring, between the middle and the near ring, and in front of the near ring. */
const BACK: Sheet[][] = [
  [
    { y: -176, a: 'va', aMs: 262000, b: 'vam', bMs: 331000 },
    { y: -118, a: 'vam', aMs: 211000, b: 'va', bMs: 283000 },
  ],
  [
    { y: -78, a: 'va', aMs: 173000, b: 'vbm', bMs: 229000 },
    { y: -44, a: 'vb', aMs: 151000, b: 'vam', bMs: 197000 },
  ],
  [{ y: -16, a: 'vbm', aMs: 131000, b: 'va', bMs: 167000 }],
]
/** In front of the tower: the sea itself, nearest last. */
const FRONT: Sheet[] = [
  { y: 6, a: 'vb', aMs: 113000, b: 'vam', bMs: 149000 },
  { y: 34, a: 'vbm', aMs: 97000, b: 'vb', bMs: 127000 },
  { y: 70, a: 'vb', aMs: 79000, b: 'vbm', bMs: 103000 },
]

/**
 * A lit corner going under: its light pools on the fog's top.
 * [x, red or cyan]. `y` is where the fog's top stands there.
 */
export function glow(spots: ReadonlyArray<readonly [x: number, isRed: boolean]>, y: number): string {
  let cyan = ''
  let red = ''
  for (const [x, isRed] of spots) {
    // two pools on the fog's top, at the fog's own angle: no upright box round the light itself
    const d = `M${x - 36} ${y + 8}l36 -18l36 18l-36 18zm-28 0l64 -32l64 32l-64 32z`
    if (isRed) red += d
    else cyan += d
  }
  return `<g style="animation:vg 9s ease-in-out infinite alternate">${cyan === '' ? '' : `<path fill="#4FE0F2" opacity=".11" d="${cyan}"/>`}${red === '' ? '' : `<path fill="#FF3355" opacity=".15" d="${red}"/>`}</g>`
}

/**
 * The fog between the rings, for the megacity to lay in as it draws: `k` 0 behind the middle ring, 1
 * between the middle and the near, 2 in front of the near. `lit` are the corners that go under there.
 * `rest` 1, for a busy drawing, leaves the currents out; 2 the light as well. The sheets are always drawn.
 */
export function between(k: 0 | 1 | 2, now: number, lit: ReadonlyArray<readonly [number, boolean]>, rest: 0 | 1 | 2): string {
  const sheets = BACK[k] ?? []
  const last = sheets[sheets.length - 1]
  return (
    `<g class="cf">` +
    sheets.map(s => sheet(s, now)).join('') +
    (rest < 2 && lit.length > 0 && last ? glow(lit, last.y + 8) : '') +
    (rest < 1 ? flow(k, now) : '') +
    `</g>`
  )
}

/** Far lightning inside the fog: a dim blue bloom and a short fork, once every few minutes. */
function lightning(now: number): string {
  return [[-1040, 24, 211000], [-380, 18, 283000]]
    .map(
      ([x = 0, y = 0, ms = 1]) =>
        `<g style="opacity:0;animation:zap ${ms / 1000}s linear ${at(now, ms)} infinite"><path fill="#2B65A3" opacity=".5" d="M${x - 48} ${y - 6}l48 -12l48 12l-48 24zM${x - 26} ${y}l26 -7l26 7l-26 13z"/>` +
        `<path stroke="#DDF2FF" d="M${x + 2} ${y - 14}.5h2m-3 1h2m-2 1h2m-3 1h2m1 1h2m-3 1h2m-3 1h2m-6 -2h2m-3 1h2"/></g>`,
    )
    .join('')
}

/**
 * The fog in front of the tower. Every sheet is always drawn, so the fog never thins as the room gets busy.
 * `isCalm`, for a busy drawing, leaves out the lightning; `isLean` also the tower's own current and the
 * light under it; `isStill` keeps everything but the lightning, at rest.
 */
export function fogSea(now: number, o: { isLean?: boolean; isCalm?: boolean; isStill?: boolean; lit?: ReadonlyArray<readonly [number, boolean]> } = {}): string {
  const plain = o.isCalm === true || o.isLean === true || o.isStill === true
  const [first, ...rest] = FRONT.map(s => sheet(s, now))
  return (
    `<g class="cs">${first ?? ''}` +
    // the tower's own light going under: its corner, and the cores in its faces
    (o.isLean ? '' : glow(o.lit ?? [[128, false]], 14)) +
    (plain ? '' : lightning(now)) +
    (o.isLean ? '' : flow(3, now)) +
    `${rest.join('')}</g>`
  )
}

// ---- where the fog stands

/** Where the fog's top meets the screen, in the scene's pixels, where the tower is large enough to leave room. */
const SEA_TOP = 256
/** The lowest the fog's top goes in the tower's pixels, so a narrow window shows fog, not long bare shafts. */
const SEA_LOW = 320
/** The sea takes the tower's scale and place, then drops so its top meets SEA_TOP, band by band. */
export const SEA_CSS = [...BANDS]
  .reverse()
  .map(b => {
    const p = placement(b.min)
    const drop = Math.min(SEA_LOW, Math.round((SEA_TOP - p.ty) / p.s))
    const rule = `.cs{transform:translate(${p.tx}px,${p.ty}px) scale(${p.s}) translateY(${drop}px)}.cf{transform:translateY(${drop}px)}`
    return b.ratio === '' ? rule : `@media (min-aspect-ratio:${b.ratio}){${rule}}`
  })
  .join('')

/** The fog's motion: each crest slides one period, the field of ribbons one tile down its slope. */
export const FOG_KEYS =
  TILES.map(t => `@keyframes ${t.id}{to{transform:translateX(${t.period}px)}}`).join('') +
  '@keyframes vg{from{opacity:.6}}' +
  `@keyframes vr{to{transform:translate(${RIB.period}px,${RIB.fall}px)}}` +
  // two quick flickers inside 1.5 seconds, then nothing for minutes: well under three flashes a second
  '@keyframes zap{0%,97%{opacity:0}97.1%{opacity:.9}97.25%{opacity:.15}97.45%{opacity:1}97.8%,100%{opacity:0}}'
