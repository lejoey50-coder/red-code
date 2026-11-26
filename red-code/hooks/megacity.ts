// The megacity round the tower, drawn in the tower's own pixels and at the room's own angle: two across
// for one up, so every block, bridge and rail meets the room's pixel art at its slopes. It is drawn inside
// the tower's group, so it shrinks and moves with the tower and keeps the same pixel size at every window
// shape. Blocks rise out of the fog; their feet run far below the window, where it hides them.
//
// The city is composed, not scattered: each tower is placed by hand and given a form of its own (a shed
// roof cut on a slant, a block stepped back to one corner, a top that cantilevers out to one side, a front
// corner shaved into a narrow lit face). Façades are black metal with fine fins; light lives in the
// structure (edges, roof lines) and in a few bands of white panoramic offices. Crimson marks a handful.
//
// Depth is told the way an orthographic camera tells it: what is further back is drawn first and stands
// higher, and sheets of fog (fog.ts) lie between the rings, so each ring stands in it to a different height.

import { spire } from './city'
import { between } from './fog'
import { hash } from './room'

/** Seconds, for a delay that puts a loop of `ms` at the clock's place in it. */
const at = (now: number, ms: number) => `${-(now % ms) / 1000}s`

/** Below the window at every window shape: where faces stop, under the fog. */
const FOOT = 900

const CYAN = '#4FE0F2'
const ICE = '#B8F6FF'
const RED = '#FF3355'
const DIM = '#1C8EA3'

/**
 * One volume: its roof's front corner, its spans to the left and right corners (the roof drops half of
 * each), its height, a front corner shaved back by `cham` on each side, and a roof cut on a slant that
 * rises `cut` toward the left corner (or toward the right one when negative).
 */
type Vol = { x: number; y: number; a: number; b: number; h: number; cham: number; cut: number }

/** A band of lit offices: down from the volume's roof, and how tall. */
type Band = [depth: number, tall: number]

/** One tower, as placed by hand: a base and what stands on it. */
type Spec = {
  x: number
  y: number
  a: number
  b: number
  form: 'shed' | 'step' | 'cant' | 'cham'
  /** Crimson structure instead of cyan. */
  red?: boolean
  bands?: Band[]
  /** A pulse of light running up the front corner. */
  pulse?: boolean
}

/** Paths gathered by ink, so a whole ring is a handful of paths. */
class Pen {
  private by = new Map<string, string>()
  add(key: string, d: string): void {
    this.by.set(key, (this.by.get(key) ?? '') + d)
  }
  get(key: string): string {
    return this.by.get(key) ?? ''
  }
}

/** The four roof corners: front-left, left, back, right, front-right (the two fronts meet unless shaved). */
function corners(v: Vol) {
  const c = v.cham
  const up = Math.max(0, v.cut)
  const upR = Math.max(0, -v.cut)
  return {
    fl: [v.x - c, v.y - c / 2],
    l: [v.x - v.a, v.y - v.a / 2 - up],
    k: [v.x - v.a + v.b, v.y - v.a / 2 - v.b / 2 - up - upR],
    r: [v.x + v.b, v.y - v.b / 2 - upR],
    fr: [v.x + c, v.y - c / 2],
  } as const
}

const pt = (p: readonly number[]) => `${p[0]} ${p[1]}`

/** A volume's faces, roof and structural light into the pen. */
function volume(p: Pen, v: Vol, edge: string): void {
  // Written in relative steps, which are short: the city is one of the dearest parts of the drawing.
  const q = corners(v)
  const { h, a, b, cham: c } = v
  const up = Math.max(0, v.cut)
  const upR = Math.max(0, -v.cut)
  const A = a - c
  const B = b - c
  const across = c > 0 ? `h${2 * c}` : ''
  p.add('L', `M${pt(q.l)}l${A} ${A / 2 + up}v${h}l${-A} ${-A / 2}z`)
  p.add('R', `M${pt(q.fr)}l${B} ${-B / 2 - upR}v${h + upR}l${-B} ${B / 2}z`)
  if (c > 0) p.add('C', `M${pt(q.fl)}${across}v${h}h${-2 * c}z`)
  p.add('T', `M${pt(q.fl)}l${-A} ${-A / 2 - up}l${b} ${-b / 2 - upR}l${a} ${a / 2 + up}${c > 0 ? `l${-B} ${B / 2 + upR}` : ''}z`)
  // light in the structure: the two front roof lines, the front corner (or both edges of its shaved face)
  p.add(edge, `M${pt(q.l)}l${A} ${A / 2 + up}${across}l${B} ${-B / 2 - upR}`)
  p.add(edge, c > 0 ? `M${q.fl[0] + 0.5} ${q.fl[1]}v${h}m${2 * c - 1} ${-h}v${h}` : `M${v.x + 0.5} ${v.y}v${h}`)
  // dimmer, the back roof lines
  p.add('d', `M${pt(q.l)}l${b} ${-b / 2 - upR}l${a} ${a / 2 + up}`)
}

/** Bands of white offices across a volume's faces, following its floors. */
function bands(p: Pen, v: Vol, list: Band[]): void {
  const c = v.cham
  for (const [d, t] of list) {
    const y = v.y + d
    const A = v.a - c
    const B = v.b - c
    const across = (n: number) => (c > 0 ? `h${n * c}` : '')
    p.add('B', `M${v.x - v.a} ${y - v.a / 2}l${A} ${A / 2}${across(2)}l${B} ${-B / 2}v${t}l${-B} ${B / 2}${across(-2)}l${-A} ${-A / 2}z`)
    // the lit ceiling along the top of the band
    p.add('Bc', `M${v.x - v.a} ${y - v.a / 2 + 1}l${A} ${A / 2}${across(2)}l${B} ${-B / 2}`)
  }
}

/** A tower's volumes, built from its form. */
function build(s: Spec): Vol[] {
  const base: Vol = { x: s.x, y: s.y, a: s.a, b: s.b, h: FOOT - s.y, cham: 0, cut: 0 }
  switch (s.form) {
    case 'shed':
      // the roof cut on a slant, high on the side away from the tower
      return [{ ...base, cut: hash(s.x, 3) % 2 === 0 ? (s.a >> 1) + 8 : -((s.b >> 1) + 8) }]
    case 'cham':
      return [{ ...base, cham: Math.min(s.a, s.b) >> 2 }]
    case 'step': {
      // a narrower block standing back in one corner, never in the middle
      const a = Math.round(s.a * 0.55)
      const b = Math.round(s.b * 0.6)
      const rise = 40 + (hash(s.x, 5) % 50)
      const kx = s.x - s.a + s.b
      const ky = s.y - s.a / 2 - s.b / 2
      const x = kx + a - b
      const y = ky + a / 2 + b / 2 - rise
      return [base, { x, y, a, b, h: rise + 4, cham: 0, cut: hash(s.x, 6) % 2 === 0 ? 0 : 14 }]
    }
    case 'cant': {
      // the top floors reach out past the left face, over nothing
      const over = 28 + (hash(s.x, 7) % 2) * 14
      return [base, { ...base, a: s.a + over, h: 26 + (hash(s.x, 8) % 3) * 6 }]
    }
  }
}

/** The far ring: silhouettes in the haze, a few with a faint lit corner. [x, roof, left span, right span, cut] */
const FAR: Array<[number, number, number, number, number]> = [
  [-1420, -20, 42, 28, 0], [-1330, 60, 56, 42, 20], [-1240, -110, 28, 42, 0], [-1150, 20, 70, 28, -18],
  [-1040, -60, 42, 56, 0], [-930, 80, 56, 42, 0], [-830, -150, 28, 28, 30], [-730, 0, 56, 70, 0],
  [-430, -80, 42, 42, -24], [-330, 40, 70, 42, 0], [-210, -130, 28, 42, 20], [-90, -20, 56, 28, 0],
  [30, -90, 42, 56, 0], [150, -40, 28, 42, 26], [240, -140, 42, 28, 0],
]

/** The middle ring, monumental, left of the tower. */
const MID: Spec[] = [
  { x: -1320, y: -60, a: 70, b: 42, form: 'shed', bands: [[48, 12], [150, 8]] },
  { x: -1180, y: 40, a: 56, b: 84, form: 'step', bands: [[30, 14]] },
  { x: -1010, y: -150, a: 84, b: 56, form: 'cham', red: true, bands: [[22, 16], [210, 12]], pulse: true },
  { x: -880, y: 70, a: 42, b: 56, form: 'cant', bands: [[40, 10]] },
  { x: -760, y: -40, a: 56, b: 70, form: 'shed', bands: [[64, 14]] },
  { x: -520, y: -110, a: 98, b: 70, form: 'step', bands: [[26, 14], [120, 18]], pulse: true },
  { x: -640, y: 110, a: 70, b: 42, form: 'shed', bands: [[16, 10]] },
  { x: -380, y: 30, a: 56, b: 42, form: 'cham', bands: [[50, 12]] },
  { x: -250, y: -20, a: 42, b: 70, form: 'cant', red: true, bands: [[12, 14]] },
  { x: -120, y: 90, a: 56, b: 56, form: 'shed', bands: [[34, 12]], pulse: true },
]

/** The near ring: broad, low and dark, its offices bright, at the bottom left. */
const NEAR: Spec[] = [
  { x: -1260, y: 120, a: 84, b: 56, form: 'shed', bands: [[30, 18]] },
  { x: -1060, y: 60, a: 70, b: 84, form: 'step', red: true, bands: [[16, 16], [96, 12]] },
  { x: -820, y: 150, a: 56, b: 70, form: 'cham', bands: [[14, 20]], pulse: true },
  { x: -600, y: 90, a: 70, b: 56, form: 'shed', bands: [[40, 16], [110, 10]] },
  { x: -330, y: 170, a: 56, b: 56, form: 'cham', red: true, bands: [[20, 14]] },
]

/** Fine vertical fins on the black metal: wider on the lit right faces, tighter in the shade. */
const FINS =
  '<pattern id="fr" width="5" height="8" patternUnits="userSpaceOnUse"><rect width="5" height="8" fill="#0A1319"/><path stroke="#13232C" d="M.5 0v8"/></pattern>' +
  '<pattern id="fl" width="7" height="8" patternUnits="userSpaceOnUse"><rect width="7" height="8" fill="#04080B"/><path stroke="#0A151B" d="M.5 0v8"/></pattern>' +
  // the offices: white light behind tall glass, a mullion every few steps
  '<pattern id="of" width="9" height="8" patternUnits="userSpaceOnUse"><rect width="9" height="8" fill="#C9F4FB"/><path stroke="#6FB5C2" d="M.5 0v8"/></pattern>'

/** Someone crossing an office band, there and back. */
const walkKeys: string[] = []

/** A ring of towers: faces, roofs, structure light, office bands, pulses and walkers. */
function drawRing(key: string, specs: Spec[], opacity: number, now: number, isLean: boolean): string {
  const p = new Pen()
  let walkers = ''
  let pulses = ''
  const order = [...specs].sort((s, t) => s.x + s.y * 2 - (t.x + t.y * 2))
  order.forEach((s, i) => {
    const vols = build(s)
    const edge = s.red ? 'er' : 'ec'
    vols.forEach((v, n) => {
      volume(p, v, edge)
      // the base's bands; the top volume of a step or cantilever gets one of its own
      if (n === 0 && s.bands) bands(p, v, s.form === 'cant' ? s.bands.map(([d, t]) => [d + 34, t] as Band) : s.bands)
      if (n === 1 && s.form !== 'cant') bands(p, v, [[10, 10]])
      if (n === 1 && s.form === 'cant') p.add(edge, `M${v.x - s.a} ${v.y - s.a / 2 + v.h - 0.5}L${v.x - v.a} ${v.y - v.a / 2 + v.h - 0.5}`)
    })
    const top = vols[vols.length - 1]!
    // a line of light down the right face, a third of the way along, never in the middle
    const u = Math.round(s.b / 3)
    p.add(edge, `M${s.x + u + 0.5} ${s.y - u / 2}v${160 + (hash(s.x, 12) % 4) * 60}`)
    if (s.pulse && !isLean) {
      const ms = 5000 + (hash(s.x, 11) % 5) * 900
      pulses += `<path stroke="${ICE}" stroke-dasharray="18 600" style="animation:up ${ms / 1000}s linear ${at(now, ms)} infinite" d="M${top.x + 0.5 - top.cham} ${top.y - top.cham / 2}V${FOOT}"/>`
    }
    // someone in the first band of every other tower, walking its left face
    const first = s.bands?.[0]
    if (first && first[1] >= 5 && i % 2 === 0 && !isLean) {
      const v = vols[0]!
      const d = s.form === 'cant' ? first[0] + 34 : first[0]
      const x0 = v.x - v.a + 4
      const y0 = v.y + d - v.a / 2 + first[1] - 7 + 2
      const run = v.a - 12 - v.cham
      const ms = 16000 + (hash(s.x, 14) % 9) * 1000
      walkers += `<g style="transform:translate(${x0}px,${y0}px);animation:pw${key}${i} ${ms / 1000}s steps(${run >> 1}) ${at(now, ms * 2)} infinite alternate"><path fill="#0B2C35" d="M0 0h2v2h-2zm-1 2h4v5h-4z"/></g>`
      walkKeys.push(`@keyframes pw${key}${i}{to{transform:translate(${x0 + run}px,${y0 + run / 2}px)}}`)
    }
  })
  return (
    `<g opacity="${opacity}"><defs><path id="${key}L" d="${p.get('L')}"/></defs>` +
    `<use href="#${key}L" fill="url(#fl)"/><path fill="url(#fr)" d="${p.get('R')}"/><path fill="#0E1A21" d="${p.get('C')}"/><path fill="#0D171D" d="${p.get('T')}"/>` +
    `<path fill="url(#of)" d="${p.get('B')}"/><path stroke="#FFFFFF" d="${p.get('Bc')}"/>` +
    // the shade on the left faces falls over their offices too
    `<use href="#${key}L" fill="#02060A" opacity=".35"/>` +
    `<path stroke="${DIM}" opacity=".35" d="${p.get('d')}"/><path stroke="${CYAN}" d="${p.get('ec')}"/><path stroke="${RED}" d="${p.get('er')}"/>` +
    `${walkers}${pulses}</g>`
  )
}

/** The far ring: one path of silhouettes and one of faint corners. */
function far(): string {
  let body = ''
  let lit = ''
  FAR.forEach(([x, y, a, b, cut], i) => {
    const v: Vol = { x, y, a, b, h: FOOT - y, cham: 0, cut }
    const q = corners(v)
    body += `M${pt(q.l)}L${pt(q.k)}L${pt(q.r)}V${FOOT}H${q.l[0]}z`
    if (i % 3 !== 1) lit += `M${x + 0.5} ${y}v${60 + (i % 4) * 30}M${pt(q.l)}L${x} ${y}L${pt(q.r)}`
  })
  return `<g opacity=".5"><path fill="#0B1A21" d="${body}"/><path stroke="${DIM}" opacity=".6" d="${lit}"/></g>`
}

/** The lit corners of a ring that go under the fog in front of it: every crimson tower and every pulse. */
const litOf = (specs: Spec[]) => specs.filter(s => s.red || s.pulse).map(s => [s.x, s.red === true] as const)

/** Red lamps at the high corner of the tallest roofs. */
function lamps(): string {
  let d = ''
  for (const s of [...MID, ...NEAR]) {
    if (s.y > 0) continue
    const top = build(s).at(-1)!
    const k = corners(top).k
    d += `M${k[0] - 1} ${k[1] - 3}.5h2`
  }
  return `<path stroke="#FF9295" style="animation:blink 2s step-end infinite" d="${d}"/>`
}

/** Two suspended lines across the city on the two diagonals, a train hanging under each. */
const RAILS = [
  { x0: -1300, y0: -330, x1: 340, y1: 490, ms: 52000, ink: CYAN },
  { x0: 340, y0: -230, x1: -1300, y1: 590, ms: 66000, ink: RED },
] as const
function rails(now: number, isLean: boolean): string {
  let beam = ''
  let lights = ''
  let hangers = ''
  let trains = ''
  RAILS.forEach((r, k) => {
    const dx = r.x1 - r.x0
    const dy = r.y1 - r.y0
    beam += `M${r.x0} ${r.y0}l${dx} ${dy}v3l${-dx} ${-dy}z`
    lights += `M${r.x0} ${r.y0 + 0.5}l${dx} ${dy}`
    // the beam hangs from tall pylons, far apart
    for (let t = 0.06; t < 1; t += 0.16) hangers += `M${Math.round(r.x0 + dx * t)} ${Math.round(r.y0 + dy * t) + 3}V${FOOT}`
    if (isLean) return
    const way = Math.sign(dx)
    // the car hangs under the beam: dark body, a lit band of windows, a white nose
    const car = `<path fill="#03070A" d="M0 4l${way * 44} 22v6l${-way * 44} -22z"/><path stroke="${r.ink}" stroke-dasharray="5 2" d="M${way * 2} 6.5l${way * 40} 20"/><path stroke="#FFFFFF" d="M${way * 42} 26.5h${way * 2}"/>`
    trains += `<g style="transform:translate(${r.x0}px,${r.y0}px);animation:rail${k} ${r.ms / 1000}s steps(${Math.round(Math.abs(dx) / 3)}) ${at(now, r.ms)} infinite">${car}</g>`
  })
  return `<path stroke="#0A1219" d="${hangers}"/><path fill="#03060A" d="${beam}"/><path stroke="#1F5966" stroke-dasharray="6 3" d="${lights}"/>${trains}`
}

/** Far flyers crossing above the roofs, east to west and back: level flight, so level on screen. */
const FLY = [
  [-1300, 400, -250, 64000, CYAN],
  [400, -1300, -190, 91000, RED],
  [-1300, 400, -110, 120000, ICE],
] as const
function flyers(now: number): string {
  return FLY.map(([x0, , y, ms, ink], k) => {
    const w = x0 < 0 ? 1 : -1
    return `<g style="transform:translate(${x0}px,${y}px);animation:fy${k} ${ms / 1000}s steps(400) ${at(now, ms)} infinite"><path stroke="#24424C" d="M${-w * 22} .5h${w * 10}"/><path stroke="${ink}" d="M${-w * 12} .5h${w * 10}"/><path stroke="#FFFFFF" d="M${-w * 2} .5h${w * 2}"/></g>`
  }).join('')
}

/** The motion of the city: trains, flyers, pulses up the corners. */
export const CITY_KEYS =
  RAILS.map((r, k) => `@keyframes rail${k}{to{transform:translate(${r.x1}px,${r.y1}px)}}`).join('') +
  FLY.map(([, x1, y], k) => `@keyframes fy${k}{to{transform:translate(${x1}px,${y}px)}}`).join('') +
  '@keyframes up{to{stroke-dashoffset:618}}'

/** The office walkers' motion, known once the city is laid out. */
export function walkerKeys(): string {
  megacity(0)
  return walkKeys.join('')
}

/**
 * The whole megacity behind the tower, in the tower's pixels. `quiet` drops what passes (traffic, walkers,
 * pulses, blinking lamps, the currents in the fog) and leaves every building as it is; `thin` also drops
 * the neon's light in the fog; `bare`, the last resort of a crowded room,
 * also drops the far ring and the fog behind the middle ring; the fog in front of it always stays.
 */
export function megacity(now: number, level: 'full' | 'quiet' | 'thin' | 'bare' = 'full'): string {
  walkKeys.length = 0
  const isLean = level !== 'full'
  const rest = level === 'full' ? 0 : level === 'quiet' ? 1 : 2
  const isBare = level === 'bare'
  return (
    `<defs>${FINS}</defs>` +
    (isBare ? '' : far() + spire(-560, -330, 120) + between(0, now, [], rest)) +
    (isLean ? '' : flyers(now)) +
    rails(now, isLean) +
    drawRing('m', MID, 0.92, now, isLean) +
    between(1, now, litOf(MID), rest) +
    drawRing('n', NEAR, 1, now, isLean) +
    between(2, now, litOf(NEAR), rest) +
    (isLean ? '' : lamps())
  )
}
