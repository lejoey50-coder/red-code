// The room is the top floor of a tall tower. Below the storeys the walls carry on down at the room's own
// isometric angles, with the same rows of windows, past an outside lift, into a low bank of cloud.
// Wisps pass behind the room, so a few show through its windows. The tower stands beside the chat: as the
// window narrows it grows smaller and keeps to the right edge (play.ts's placement, by the window's shape).

import { BANDS, placement, placementCss } from './play'
import { grid, paths, set } from './pixels'
import type { Grid } from './pixels'
import { ROOM_INK as C, hash } from './room'

/** Seconds, for a delay that puts a loop of `ms` at the clock's place in it. */
const at = (now: number, ms: number) => `${-(now % ms) / 1000}s`

// ---- the walls

// One storey window as building.ts draws them: 14 across, 18 high, a frame, a rim and dark glass,
// then a band and a dark line between floors. `p` runs across the window, `v` down it.
const tile = (band: string) =>
  `<path fill="${C.void}" d="M3 4h9v10h-9zM0 17h14v1h-14z"/><path fill="${C.rim}" d="M4 4h8v1h-8z"/><path fill="#0A161C" d="M4 5h8v8h-8z"/><path fill="${band}" d="M0 16h14v1h-14z"/>`

/** Lit glass in a few windows of a block 11 windows across and 7 floors down, by the storeys' own colours. */
function litTile(seed: number): string {
  const by = new Map<string, string>()
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 11; c++) {
      const n = hash(c * 7 + seed, r * 5 + seed * 3) % 17
      if (n > 2) continue
      const ink = n === 0 ? '#6FB9C2' : n === 1 ? '#2A7585' : hash(c, r + seed) % 5 === 0 ? C.ember : '#4E9AA5'
      by.set(ink, `${by.get(ink) ?? ''}M${c * 14 + 4} ${r * 18 + 9}h8`)
    }
  return [...by].map(([ink, d]) => `<path stroke="${ink}" stroke-width="8" d="${d}"/>`).join('')
}

// The left wall runs down to the right at one pixel in two, the right wall up. A pattern laid in the
// wall's own (u, v) and sheared by the same slope puts each window where the storeys put theirs:
// left, x = 16 + u and y = 141 + v + u/2; right, x = 239 - u and the same y.
const L = 'patternTransform="matrix(1 .5 0 1 0 0)" x="16" y="133"'
const R = 'patternTransform="matrix(-1 .5 0 1 0 0)" x="-239" y="261"'
const DEFS =
  `<pattern id="wl" width="14" height="18" patternUnits="userSpaceOnUse" ${L}>${tile(C.slab2)}</pattern>` +
  `<pattern id="wr" href="#wl" ${R}/>` +
  `<pattern id="la" width="154" height="126" patternUnits="userSpaceOnUse" ${L}>${litTile(5)}</pattern>` +
  `<pattern id="lb" href="#la" x="93" y="187"/>` +
  `<pattern id="ra" href="#la" ${R}/><pattern id="rb" href="#lb" ${R}/>`

/** Where the storeys end and the plain tower begins, in the building's pixels; far below the window's foot. */
const FOOT = 900
const LEFT = `M16 181l112 56V${FOOT}H16z`
const RIGHT = `M128 237l112 -56V${FOOT}H128z`

/** The walls under the storeys: cladding, windows, some lit, the corner and its light. Drawn before the room. */
export function walls(now: number, isLean = false): string {
  return (
    `<defs>${DEFS}</defs>` +
    `<path fill="${C.ink}" d="${LEFT}"/><path fill="${C.slab}" d="${RIGHT}"/>` +
    `<path fill="url(#wl)" d="${LEFT}"/><path fill="url(#wr)" d="${RIGHT}"/>` +
    (isLean ? '' : `<path fill="url(#la)" d="${LEFT}"/><path fill="url(#ra)" d="${RIGHT}"/>`) +
    // a second set of lit windows that comes and goes, slowly, as floors empty and fill
    (isLean ? '' : `<g style="animation:fl 67s linear ${at(now, 67000)} infinite"><path fill="url(#lb)" d="${LEFT}"/><path fill="url(#rb)" d="${RIGHT}"/></g>`) +
    // the corner, carried down: a slab each side and its cyan line, and the teal seams
    `<path fill="${C.slab}" d="M124 235h4V${FOOT}h-4z"/><path fill="${C.slab2}" d="M128 235h4V${FOOT}h-4z"/>` +
    `<path stroke="${C.cyan}" d="M125.5 235V${FOOT}M130.5 235V${FOOT}"/><path stroke="${C.teal}" d="M72.5 209V${FOOT}M183.5 209V${FOOT}"/>`
  )
}

/** The outside lift on the left wall: its rails and a lit car that rides down into the cloud and back. */
export function lift(now: number): string {
  const car =
    `<path fill="${C.void}" d="M0 0l10 5v14l-10 -5z"/><path fill="#6FB9C2" d="M1 3l8 4v9l-8 -4z"/>` +
    `<path fill="#B8F6FF" d="M2 5l2 1v5l-2 -1z"/><path fill="${C.rim}" d="M0 0l10 5v1l-10 -5z"/><path fill="${C.red}" d="M4 1h2v1h-2z"/>`
  return (
    `<path stroke="${C.edge}" d="M87.5 222V${FOOT}M98.5 228V${FOOT}"/>` +
    `<g style="transform:translate(88px,228px);animation:ride 76s ease-in-out ${at(now, 76000)} infinite">${car}</g>`
  )
}

/** Thin cloud passing behind the room: seen through its windows and against the sky round it. */
export function wisps(now: number): string {
  let d = ''
  for (let k = 0; k < 9; k++) {
    const x = 8 + ((hash(k, 4) * 5) % 210)
    const y = 4 + k * 8 + (hash(k, 9) % 5)
    d += `M${x} ${y}.5h${18 + (hash(k, 2) % 34)}`
  }
  return `<g style="animation:wisp 48s ease-in-out ${at(now, 96000)} infinite alternate"><path stroke="#1F3A45" opacity=".8" d="${d}"/></g>`
}

// ---- the cloud sea
//
// The megacity floats on a sea of cloud. It is drawn at the room's angle and pixel size: billows are
// domes flattened two to one, lit from the right as the room is, and the whole sea sits in its own
// group that takes the tower's scale and place (`.cs`, SEA_CSS), set lower or higher so its top stays at
// the same height on screen at every window shape. Its x is the tower's x, so the glow under the city's
// neon and the wisps round the tower line up with them.
//
// Four layers, back to front, each one period of billows in a pattern that slides by exactly that
// period, so the drift loops with no seam. Wind on an orthographic map moves everything alike, so the
// layers keep close speeds. A second pass of each strip swells and fades, so crests build and settle.
// What only shows while moving (crests, wisps, lightning) rests invisible: with motion off the sea is
// calm and whole.

/** Highlight, light, body and shade, as see-through inks over the layer's own colour. */
const PUFF_INK: Record<string, string> = { h: '#8FE6F240', m: '#6FC8D61C', b: 'currentColor', s: '#02050840' }

/** One billow: domes flattened two to one, the nearer drawn over the farther, lit from the upper right. */
function puff(w: number, h: number, seed: number): Grid {
  const g = grid(w, h)
  const n = Math.max(3, Math.round(w / 22))
  const domes: Array<[cx: number, cy: number, r: number]> = []
  for (let k = 0; k < n; k++) {
    const r = Math.round(h * (0.42 + (hash(seed, k) % 30) / 100))
    domes.push([Math.round(((k + 0.5) * w) / n + (hash(k, seed) % 7) - 3), h - Math.round(r * 0.35) + (hash(seed + 1, k) % 5), k === 0 || k === n - 1 ? Math.round(r * 0.75) : r])
  }
  // one height map for the billow, so the domes merge into one mass and only its outline and creases show
  const H = new Float32Array(w * h).fill(-1)
  for (const [cx, cy, r] of domes)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = (x + 0.5 - cx) / r
        const dy = (y + 0.5 - cy) / (y + 0.5 < cy ? r * 0.8 : r * 0.42)
        const q = dx * dx + dy * dy
        if (q < 1) H[y * w + x] = Math.max(H[y * w + x] ?? -1, Math.sqrt(1 - q) * r)
      }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : Math.max(0, H[y * w + x] ?? 0))
  const L = [0.58, -0.56, 0.59] as const
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if ((H[y * w + x] ?? -1) < 0) continue
      const gx = at(x + 1, y) - at(x - 1, y)
      const gy = at(x, y + 1) - at(x, y - 1)
      const n = Math.hypot(gx, gy, 2)
      const lit = (-gx * L[0] - gy * L[1] + 2 * L[2]) / n
      const isTop = (H[(y - 1) * w + x] ?? -1) < 0 || y === 0
      set(g, x, y, isTop && lit > 0.45 ? 'h' : lit > 0.8 ? 'm' : lit < 0.2 ? 's' : 'b')
    }
  return g
}

/** The billow sizes, in the tower's pixels, each drawn once and tinted by the layer that uses it. */
const PUFFS = [[150, 50], [104, 40], [64, 28]] as const

type Sea = { base: number; period: number; ms: number; ink: string; seed: number }
/** Back to front, in the sea's own pixels: midnight blue far off, charcoal near. */
const SEA: Sea[] = [
  { base: 10, period: 520, ms: 190000, ink: '#0A141B', seed: 11 },
  { base: 40, period: 455, ms: 175000, ink: '#0D1922', seed: 23 },
  { base: 74, period: 390, ms: 160000, ink: '#111C26', seed: 37 },
  { base: 114, period: 325, ms: 145000, ink: '#151B23', seed: 53 },
]
/** The sea's left edge and width in the tower's pixels: past the window's left edge at its smallest scale. */
const WEST = -1480
const SPAN = 1760
/** Below the window's foot at every window shape. */
const DEEP = 300
/** How far above its base line a layer's strip reaches, and below it. */
const RISE = 54
const STRIP = 68

/** Billows across one period, kept inside it, so tiles meet with a gap no wider than the gaps between them. */
function billows(sea: Sea): string {
  let out = ''
  for (let x = 0; ; x += 52 + (hash(x, sea.seed) % 34)) {
    const size = hash(x, sea.seed + 1) % 5 < 2 ? 0 : hash(x, sea.seed + 3) % 3 === 0 ? 2 : 1
    const [w, h] = PUFFS[size] ?? PUFFS[0]
    if (x + w > sea.period) break
    out += `<use href="#q${size}" x="${x}" y="${RISE - h + 3 + (hash(x, sea.seed + 2) % 12)}"/>`
  }
  return out
}

const seaDefs = new Map<string, string>()
/** The billows and the patterns of the layers drawn, and no others. */
function defsOfSea(layers: readonly number[]): string {
  const key = layers.join()
  let out = seaDefs.get(key)
  if (out !== undefined) return out
  out = '<defs>'
  PUFFS.forEach(([w, h], k) => {
    out += `<g id="q${k}">${paths(puff(w, h, 7 + k * 13), key => PUFF_INK[key])}</g>`
  })
  for (const k of layers) {
    const sea = SEA[k]
    if (sea) out += `<pattern id="sk${k}" width="${sea.period}" height="${STRIP}" patternUnits="userSpaceOnUse" x="${WEST}" y="${sea.base - RISE}"><g style="color:${sea.ink}">${billows(sea)}</g></pattern>`
  }
  out += '</defs>'
  seaDefs.set(key, out)
  return out
}

/**
 * A strip of one layer, sliding by whole pixels. A second pass of the same strip, half a period over and a
 * few pixels up, swells and fades on its own clock, so crests build and settle as the layer drifts.
 */
function layer(sea: Sea, k: number, now: number, isCalm: boolean): string {
  const strip = (more: string) => `<rect x="${WEST}" y="${sea.base - RISE}" width="${SPAN + sea.period}" height="${STRIP}" fill="url(#sk${k})"${more}/>`
  const ms = 23000 + k * 7000
  const swell = isCalm ? '' : strip(` transform="translate(${sea.period >> 1} -5)" style="opacity:0;animation:swell ${ms / 1000}s ease-in-out ${at(now, ms)} infinite"`)
  return `<path fill="${sea.ink}" d="M${WEST} ${sea.base + 4}h${SPAN}V${DEEP}h${-SPAN}z"/><g style="animation:sk${k} ${sea.ms / 1000}s steps(${sea.period}) ${at(now, sea.ms)} infinite">${swell}${strip('')}</g>`
}

/** Thin cloud lifting off the sea round the tower's lower floors, now and then. */
function rising(now: number): string {
  return [[20, 29000], [86, 37000], [150, 41000], [214, 33000]]
    .map(([x = 0, ms = 1], k) => `<path stroke="#24434F" style="opacity:0;animation:rise ${ms / 1000}s steps(30) ${at(now + k * 7000, ms)} infinite" d="M${x} ${40 + k * 4}.5h18m-14 -3h24m-17 -3h12"/>`)
    .join('')
}

/** Far lightning inside the cloud: a dim blue bloom and a short fork, once every few minutes. */
function lightning(now: number): string {
  return [[-1040, 24, 211000], [-380, 18, 283000]]
    .map(
      ([x = 0, y = 0, ms = 1]) =>
        `<g style="opacity:0;animation:zap ${ms / 1000}s linear ${at(now, ms)} infinite"><path fill="#2B65A3" opacity=".5" d="M${x - 48} ${y - 6}l48 -12l48 12l-48 24zM${x - 26} ${y}l26 -7l26 7l-26 13z"/>` +
        `<path stroke="#DDF2FF" d="M${x + 2} ${y - 14}.5h2m-3 1h2m-2 1h2m-3 1h2m1 1h2m-3 1h2m-3 1h2m-6 -2h2m-3 1h2"/></g>`,
    )
    .join('')
}

/** The city's neon caught on the cloud tops: flat diamonds of light lying on the sea. Fixed while the cloud moves. */
const GLOWS: Record<string, { o: number; at: Array<[x: number, w: number]> }> = {
  '#C0284A': { o: 0.08, at: [[-1120, 70], [-640, 60], [-180, 50]] },
  '#3E93A1': { o: 0.1, at: [[-880, 90], [-400, 70], [128, 120]] },
  '#E0A040': { o: 0.05, at: [[-1300, 60], [-60, 50]] },
}
let glowCached = ''
function reflections(): string {
  if (glowCached !== '') return glowCached
  for (const [ink, { o, at: spots }] of Object.entries(GLOWS)) {
    let d = ''
    for (const [x, w] of spots)
      for (const f of [1, 0.6]) {
        const r = Math.round(w * f)
        d += `M${x - r} 16l${r} ${-(r >> 1)}l${r} ${r >> 1}l${-r} ${r >> 1}z`
      }
    glowCached += `<path fill="${ink}" opacity="${o}" d="${d}"/>`
  }
  return glowCached
}

/**
 * The sea of cloud under the city. `isCalm`, for a busy drawing, keeps the three nearer layers drifting and
 * leaves out the farthest and what comes and goes; `isLean` keeps the nearest two; `isStill` keeps all four
 * at rest.
 */
export function cloudSea(now: number, o: { isLean?: boolean; isCalm?: boolean; isStill?: boolean } = {}): string {
  const calm = o.isCalm === true || o.isLean === true || o.isStill === true
  const at = (k: number) => {
    const sea = SEA[k]
    return sea ? layer(sea, k, now, calm) : ''
  }
  let inner: string
  if (o.isLean) inner = defsOfSea([2, 3]) + at(2) + at(3)
  else if (o.isCalm) inner = defsOfSea([1, 2, 3]) + at(1) + at(2) + at(3)
  else if (o.isStill) inner = defsOfSea([0, 1, 2, 3]) + at(0) + at(1) + at(2) + at(3)
  else inner = defsOfSea([0, 1, 2, 3]) + at(0) + lightning(now) + reflections() + at(1) + rising(now) + at(2) + at(3)
  return `<g class="cs">${inner}</g>`
}

/** Where the sea's top meets the screen, in the scene's pixels, where the tower is large enough to leave room. */
const SEA_TOP = 256
/** The lowest the sea's top goes in the tower's pixels, so a narrow window shows cloud, not long bare shafts. */
const SEA_LOW = 320
/** The sea takes the tower's scale and place, then drops so its top meets SEA_TOP, band by band. */
export const SEA_CSS = [...BANDS]
  .reverse()
  .map(b => {
    const p = placement(b.min)
    const rule = `.cs{transform:translate(${p.tx}px,${p.ty}px) scale(${p.s}) translateY(${Math.min(SEA_LOW, Math.round((SEA_TOP - p.ty) / p.s))}px)}`
    return b.ratio === '' ? rule : `@media (min-aspect-ratio:${b.ratio}){${rule}}`
  })
  .join('')

/** Where the tower stands, band by band. */
export const PLACE_CSS = placementCss()
/** The tower's motion. */
export const TOWER_KEYS =
  '@keyframes fl{0%,40%{opacity:1}50%,85%{opacity:0}95%,100%{opacity:1}}' +
  '@keyframes ride{0%,10%{transform:translate(88px,228px)}48%,58%{transform:translate(88px,640px)}96%,100%{transform:translate(88px,228px)}}' +
  '@keyframes wisp{from{transform:translateX(-26px)}to{transform:translateX(30px)}}' +
  SEA.map((sea, k) => `@keyframes sk${k}{to{transform:translateX(-${sea.period}px)}}`).join('') +
  '@keyframes swell{0%,100%{opacity:0}50%{opacity:1}}' +
  '@keyframes rise{0%,55%{opacity:0;transform:translate(0,0)}66%{opacity:.75}100%{opacity:0;transform:translate(8px,-44px)}}' +
  // two quick flickers inside 1.5 seconds, then nothing for minutes: well under three flashes a second
  '@keyframes zap{0%,97%{opacity:0}97.1%{opacity:.9}97.25%{opacity:.15}97.45%{opacity:1}97.8%,100%{opacity:0}}'
