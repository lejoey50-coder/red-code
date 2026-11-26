// The room is the top floor of a tall tower. Below the storeys the walls carry on down at the room's own
// isometric angles, with the same rows of windows, past an outside lift, into a low bank of cloud.
// Wisps pass behind the room, so a few show through its windows. The tower stands beside the chat: as the
// window narrows it grows smaller and keeps to the right edge (play.ts's placement, by the window's shape).

import { placementCss } from './play'
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
// The city floats on a sea of cloud that fills the foot of the window, edge to edge, in four layers.
// Each layer is a strip of billows laid in a pattern one period wide; the strip slides left by exactly
// one period and starts over, so the loop has no seam. Nearer layers are lower, lighter and faster.
// Small billows on each layer's crest swell and fade, so the shapes change as they drift. Everything
// that only shows while moving (billows forming, rising wisps, lightning) rests invisible, so reduced
// motion and the Still setting leave a calm, whole cloudscape.

/** Highlights, creases and shade, as see-through inks over the layer's own colour. */
const PUFF_INK: Record<string, string> = { b: 'currentColor', h: '#7FDDEA59', s: '#02050859' }

/** One billow in pixel art: domes along the top, flat below, lit from above and shaded down and to the right. */
function puff(w: number, h: number, seed: number): Grid {
  const g = grid(w, h)
  const n = Math.max(2, Math.round(w / 15))
  const domes: Array<[number, number]> = []
  for (let k = 0; k < n; k++) {
    const r = Math.max(4, Math.round(h * (0.5 + (hash(seed, k) % 45) / 100)))
    const edge = k === 0 || k === n - 1
    domes.push([Math.round(((k + 0.5) * w) / n + (hash(k, seed) % 5) - 2), edge ? Math.round(r * 0.7) : r])
  }
  for (let x = 0; x < w; x++) {
    let top = h
    let owner = -1
    domes.forEach(([cx, r], k) => {
      const d = x + 0.5 - cx
      if (Math.abs(d) >= r) return
      const t = Math.round(h - Math.sqrt(r * r - d * d))
      if (t < top) {
        top = t
        owner = k
      }
    })
    for (let y = top; y < h; y++) {
      const depth = y - top
      const [cx, r] = domes[owner] ?? [0, 1]
      const side = (x + 0.5 - cx) / r
      let key = 'b'
      if (depth === 0 && side < 0.6) key = 'h'
      else if (y > h - 4) key = 's'
      else if (side > 0.55 && depth > 1 && depth < 5) key = 's'
      set(g, x, y, key)
    }
  }
  return g
}

/** The billow sizes, each drawn once and tinted by the layer that uses it. */
const PUFFS = [[68, 30], [46, 22], [30, 14]] as const

type Sea = { base: number; period: number; ms: number; ink: string; seed: number }
/** Far to near: midnight blue at the back, charcoal in front; nearer is lower and faster. */
const SEA: Sea[] = [
  { base: 276, period: 384, ms: 260000, ink: '#0A141B', seed: 11 },
  { base: 294, period: 320, ms: 190000, ink: '#0D1922', seed: 23 },
  { base: 314, period: 288, ms: 130000, ink: '#111C26', seed: 37 },
  { base: 336, period: 256, ms: 90000, ink: '#151B23', seed: 53 },
]
/** How far above its base line a layer's strip reaches, and below it. */
const RISE = 40
const STRIP = 48

/** Billows across one period, kept inside it, so tiles meet with a gap no wider than the gaps between billows. */
function billows(sea: Sea): string {
  let out = ''
  for (let x = 0; ; x += 30 + (hash(x, sea.seed) % 22)) {
    const size = hash(x, sea.seed + 1) % 5 < 2 ? 0 : hash(x, sea.seed + 3) % 3 === 0 ? 2 : 1
    const [w, h] = PUFFS[size] ?? PUFFS[0]
    if (x + w > sea.period) break
    out += `<use href="#q${size}" x="${x}" y="${RISE - h + 2 + (hash(x, sea.seed + 2) % 6)}"/>`
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
    if (sea) out += `<pattern id="sk${k}" width="${sea.period}" height="${STRIP}" patternUnits="userSpaceOnUse" y="${sea.base - RISE}"><g style="color:${sea.ink}">${billows(sea)}</g></pattern>`
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
  const strip = (more: string) => `<rect y="${sea.base - RISE}" width="${640 + sea.period}" height="${STRIP}" fill="url(#sk${k})"${more}/>`
  const ms = 23000 + k * 7000
  const swell = isCalm ? '' : strip(` transform="translate(${sea.period >> 1} -4)" style="opacity:0;animation:swell ${ms / 1000}s ease-in-out ${at(now, ms)} infinite"`)
  return `<path fill="${sea.ink}" d="M0 ${sea.base + 4}H640V360H0z"/><g style="animation:sk${k} ${sea.ms / 1000}s steps(${sea.period}) ${at(now, sea.ms)} infinite">${swell}${strip('')}</g>`
}

/** Thin cloud lifting off the sea round the tower's lower floors, now and then. */
function rising(now: number): string {
  return [[468, 29000], [522, 37000], [574, 41000], [612, 33000]]
    .map(([x = 0, ms = 1], k) => `<path stroke="#24434F" style="opacity:0;animation:rise ${ms / 1000}s steps(30) ${at(now + k * 7000, ms)} infinite" d="M${x} ${300 - k * 3}.5h14m-11 -2h19m-13 -2h9"/>`)
    .join('')
}

/** Far lightning inside the cloud: a dim blue bloom and a short fork, once every few minutes. */
function lightning(now: number): string {
  return [[96, 268, 211000], [548, 262, 283000]]
    .map(
      ([x = 0, y = 0, ms = 1]) =>
        `<g style="opacity:0;animation:zap ${ms / 1000}s linear ${at(now, ms)} infinite"><path fill="#2B65A3" opacity=".5" d="M${x - 34} ${y - 4}h68v14h-68zM${x - 22} ${y - 9}h44v22h-44z"/>` +
        `<path stroke="#DDF2FF" d="M${x + 2} ${y - 12}.5h2m-3 1h2m-2 1h2m-3 1h2m1 1h2m-3 1h2m-3 1h2m-6 -2h2m-3 1h2"/></g>`,
    )
    .join('')
}

/** Neon from the city caught on the cloud tops: faint stepped bands under each source. Fixed while the cloud moves. */
const GLOWS: Record<string, { o: number; at: Array<[x: number, w: number]> }> = {
  '#C0284A': { o: 0.07, at: [[90, 44], [226, 26], [337, 30]] },
  '#3E93A1': { o: 0.1, at: [[178, 64], [452, 28]] },
  '#4FE0F2': { o: 0.05, at: [[560, 96]] },
  '#E0A040': { o: 0.04, at: [[622, 40]] },
}
let glowCached = ''
function reflections(): string {
  if (glowCached !== '') return glowCached
  for (const [ink, { o, at: spots }] of Object.entries(GLOWS)) {
    let d = ''
    for (const [x, w] of spots)
      for (const [y, f, h] of [[281, 0.6, 4], [285, 1, 7], [292, 0.6, 9]] as const) d += `M${Math.round(x - (w * f) / 2)} ${y}h${Math.round(w * f)}v${h}h${-Math.round(w * f)}z`
    glowCached += `<path fill="${ink}" opacity="${o}" d="${d}"/>`
  }
  return glowCached
}

/**
 * The sea of cloud under the city, edge to edge, in the scene's own pixels. `isCalm`, for a busy drawing,
 * keeps the three nearer layers drifting and leaves out the farthest and what comes and goes (swelling
 * crests, wisps, lightning, neon). `isLean` keeps the nearest two.
 */
export function cloudSea(now: number, o: { isLean?: boolean; isCalm?: boolean; isStill?: boolean } = {}): string {
  const calm = o.isCalm === true || o.isLean === true || o.isStill === true
  const at = (k: number) => {
    const sea = SEA[k]
    return sea ? layer(sea, k, now, calm) : ''
  }
  if (o.isLean) return defsOfSea([2, 3]) + at(2) + at(3)
  if (o.isCalm) return defsOfSea([1, 2, 3]) + at(1) + at(2) + at(3)
  // standing still, all four layers rest; what only shows while moving is left out
  if (o.isStill) return defsOfSea([0, 1, 2, 3]) + at(0) + at(1) + at(2) + at(3)
  return defsOfSea([0, 1, 2, 3]) + at(0) + lightning(now) + at(1) + rising(now) + at(2) + reflections() + at(3)
}

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
