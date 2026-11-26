// The megacity round the tower, drawn in the tower's own pixels and at the room's own angle: two across
// for one up, so every block, bridge and rail meets the room's pixel art at its slopes. It is drawn inside
// the tower's group, so it shrinks and moves with the tower and keeps the same pixel size at every window
// shape. Blocks rise out of the fog; their feet run far below the window, where it hides them.
//
// The city is composed, not scattered: each tower is placed by hand and given a form of its own (a shed
// roof cut on a slant, a block stepped back to one corner, a top that cantilevers out to one side, a front
// corner shaved into a narrow lit face). Façades are smooth black, with no windows: light is let into the
// structure, as it is in the tower (tower.ts): broad cores, white inside cyan, with the blue they leave on
// the black beside them, and lit slots across the faces where floors meet. No two towers near each other
// carry their light the same way (`Light`), and no light just stops: it runs down into the fog, ends in a
// slot, or ends in a foot of its own. Roof lines are only dimly drawn. Crimson marks a handful.
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

const CYAN = '#00CFFF'
const ICE = '#8EEFFF'
const RED = '#FF1744'
const DIM = '#1C8EA3'

/**
 * One volume: its roof's front corner, its spans to the left and right corners (the roof drops half of
 * each), its height, a front corner shaved back by `cham` on each side, and a roof cut on a slant that
 * rises `cut` toward the left corner (or toward the right one when negative).
 */
type Vol = { x: number; y: number; a: number; b: number; h: number; cham: number; cut: number }

/** A lit slot across a volume's faces: down from the volume's roof, and how tall its recess is. */
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
  /** How this tower carries its light. */
  light: Light[]
  /** A pulse of light running up its longest core, if it has one that goes down into the fog. */
  pulse?: boolean
}

/**
 * One way a tower carries light. Broad cores: `spine` down the front corner into the fog; `drop` down the
 * corner from the roof to the first slot; `stub` down the corner from the first slot to the second; `blade`
 * down the right face from the first slot into the fog; `left` down the left face from the roof into the fog.
 * And one thin line: `trace`, down the right face from under the first slot, a jog along the wall, and a foot.
 */
type Light = 'spine' | 'drop' | 'stub' | 'blade' | 'left' | 'trace'

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

/** A volume's faces, roof and roof lines into the pen. */
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
  // the two front roof lines, dimly
  p.add(`t${edge}`, `M${pt(q.l)}l${A} ${A / 2 + up}${across}l${B} ${-B / 2 - upR}`)
  // dimmer, the back roof lines
  p.add('d', `M${pt(q.l)}l${b} ${-b / 2 - upR}l${a} ${a / 2 + up}`)
}

/** Lit slots across a volume's faces, following its floors: a dark recess with a line of light along its top. */
function bands(p: Pen, v: Vol, list: Band[]): void {
  const c = v.cham
  for (const [d, t] of list) {
    const y = v.y + d
    const A = v.a - c
    const B = v.b - c
    const across = (n: number) => (c > 0 ? `h${n * c}` : '')
    p.add('B', `M${v.x - v.a} ${y - v.a / 2}l${A} ${A / 2}${across(2)}l${B} ${-B / 2}v${t}l${-B} ${B / 2}${across(-2)}l${-A} ${-A / 2}z`)
    // the light along the top of the recess
    p.add('Bc', `M${v.x - v.a} ${y - v.a / 2 + 1}l${A} ${A / 2}${across(2)}l${B} ${-B / 2}`)
  }
}

/** Which way a core's ends are cut: with both roof lines at a corner, with one face's slope, or square. */
type Cut = 'corner' | 'right' | 'left' | 'flat'

/** A shape `w` each side of `cx` from `y0` to `y1`, its two ends cut as `cut` says. */
function bar(cx: number, w: number, y0: number, y1: number, cut: Cut): string {
  const h = y1 - y0
  if (cut === 'flat') return `M${cx - w} ${y0}h${w * 2}v${h}h${-w * 2}z`
  if (cut === 'corner') return `M${cx - w} ${y0 - w / 2}l${w} ${w / 2}l${w} ${-w / 2}v${h}l${-w} ${w / 2}l${-w} ${-w / 2}z`
  const up = cut === 'left' ? w : -w
  return `M${cx - w} ${y0 - up / 2}l${w * 2} ${up}v${h}l${-w * 2} ${-up}z`
}

/**
 * A broad core of light into the pen, built as the tower's are: a trench with a dark lip, the blue of its
 * walls, the core's colour and the white inside, and soft light on the black each side. Every shape's ends
 * are cut at the slope of the wall it is in, so a core meets a roof line or a slot along that line, never
 * across it. `foot` says where a line down at `x` goes out of sight. Nothing is drawn if it has no length.
 */
function core(p: Pen, edge: string, cx: number, y0: number, foot: (x: number) => number, cut: Cut, y1 = FOOT): void {
  const end = Math.min(y1, foot(cx))
  if (end - y0 < 6) return
  ;[6.5, 4.5, 2.5, 1.5].forEach((w, k) => p.add(`${edge}${k}`, bar(cx, w, y0, end, cut)))
  // the light beside it stops short of any nearer tower it would fall across
  const lit = Math.min(y1, foot(cx - 15), foot(cx), foot(cx + 15))
  if (lit - y0 > 12) p.add(`l${edge}`, `${bar(cx, 17, y0, lit, cut)}|`)
}

/** A thin circuit's end: a small foot across it. */
const FOOT_MARK = 'm-2 .5h4m-4 1h4'

/**
 * A tower's light into the pen, each piece ending somewhere made for it. Returns the path of its longest
 * core when that goes down into the fog, for a pulse to run along.
 */
function lights(p: Pen, s: Spec, vols: Vol[], edge: string, foot: (x: number) => number): string {
  const v = vols[0]!
  const c = v.cham
  const x = v.x + 0.5
  const top = v.y - c / 2
  const front: Cut = c > 0 ? 'flat' : 'corner'
  // a cantilever's slots sit under its overhang
  const lift = s.form === 'cant' ? 34 : 0
  const first = s.bands?.[0]
  const d0 = first ? first[0] + lift : 0
  const t0 = first ? first[1] : 0
  const d1 = (s.bands?.[1]?.[0] ?? d0 + 90) + lift
  let run = ''
  /** A circuit branching off a core at (bx, by): along the wall, a turn at the wall's 45 degrees, down, and a foot. */
  const branch = (bx: number, by: number, way: 1 | -1) => {
    const out = 8 + (hash(s.x, 24) % 3) * 3
    const len = 20 + (hash(s.x, 25) % 4) * 9
    if (foot(bx + way * (out + 8)) > by + len + 8) p.add(`v${edge}`, `M${bx} ${by}l${way * out} ${-out / 2}l${way * 6} 3v${len}${FOOT_MARK}`)
  }
  for (const l of s.light) {
    if (l === 'spine') {
      run = `M${x} ${top}V${foot(x)}`
      core(p, edge, x, top + 1, foot, front)
      // a block stepped back on the roof carries the spine up its own corner, down to the roof it stands on
      if (s.form === 'step') for (const w of vols.slice(1)) core(p, edge, w.x + 0.5, w.y + 1, foot, 'corner', w.y + w.h - 4)
      // a circuit off the spine onto the left face, under the first slot
      branch(v.x - c - 4, top + d0 + t0 + 22 + (hash(s.x, 26) % 3) * 14, -1)
    } else if (l === 'drop') core(p, edge, x, top + 1, foot, front, top + d0 + 1)
    else if (l === 'stub') core(p, edge, x, top + d0 + 1, foot, front, top + d1 + 1)
    else if (l === 'blade' || l === 'left') {
      // down a face from its first slot, never from the roof line
      const isLeft = l === 'left'
      const u = Math.max(Math.round(isLeft ? v.a * 0.4 : v.b / 3), c + 8)
      const cx = v.x + (isLeft ? -u : u) + 0.5
      const y = v.y + d0 - u / 2
      run = `M${cx} ${y}V${foot(cx)}`
      core(p, edge, cx, y + 1, foot, isLeft ? 'left' : 'right')
      // a circuit off it, away from the corner
      branch(cx + (isLeft ? -4.5 : 4.5), y + t0 + 30 + (hash(s.x, 26) % 3) * 16, isLeft ? -1 : 1)
    } else {
      // a thin circuit of its own down the right face: a turn at the wall's 45 degrees on the way
      const u = Math.round(v.b * 0.56)
      const k = 6 + (hash(s.x, 21) % 3) * 3
      p.add(`v${edge}`, `M${v.x + u + 0.5} ${v.y + d0 + t0 - u / 2}v${22 + (hash(s.x, 22) % 4) * 10}l${k} ${k / 2}v${34 + (hash(s.x, 23) % 4) * 12}${FOOT_MARK}`)
    }
  }
  return run
}

/**
 * What is built into a tower besides its light, each by the tower's own place so no two match: a groove or a
 * row of fins down the right face, ticks cut down the left, louvres under the roof, a thin circuit on the
 * left face, and on the roof a landing mark or a mast.
 */
function details(p: Pen, s: Spec, vols: Vol[], foot: (x: number) => number, edge: string): void {
  const v = vols[0]!
  const first = s.bands?.[0]
  const under = first ? first[0] + first[1] + (s.form === 'cant' ? 34 : 0) : 0
  const n = hash(s.x, 31) % 4
  // down the right face near its far edge: one groove, or three fins, each a dark cut with a lit edge
  for (let f = 0; f < (n > 1 ? 3 : n); f++) {
    const u = Math.round(v.b * 0.7) + f * 5
    const y = v.y - u / 2 + under + (n > 1 ? 6 + f * 5 : 0)
    if (u > v.b - 3 || foot(v.x + u) < y + 10) continue
    p.add('g', `M${v.x + u} ${y}V${foot(v.x + u)}`)
    if (n > 1) p.add('g2', `M${v.x + u + 1.5} ${y}V${foot(v.x + u)}`)
  }
  // ticks down the left face under its first slot, like a scale cut into the wall
  if (n !== 2) {
    const u = Math.round(v.a * 0.18) + v.cham
    const y = v.y - u / 2 + under + 5
    const end = Math.min(y + 60 + (hash(s.x, 32) % 4) * 24, foot(v.x - u))
    if (end > y + 12) p.add('k', `M${v.x - u + 0.5} ${y}V${end}`)
  }
  // a landing mark on a level roof: a ring at the roof's own angle, and a dot
  const top = vols[vols.length - 1]!
  if (top.cut === 0 && top.cham === 0) {
    const r = Math.min(top.a, top.b) >> 2
    const cx = top.x - top.a / 2 + top.b / 2
    const cy = top.y - top.a / 4 - top.b / 4
    p.add('k2', `M${cx - 2 * r} ${cy}l${2 * r} ${-r}l${2 * r} ${r}l${-2 * r} ${r}zM${cx - 1} ${cy}h2`)
  } else if (s.y > 0) {
    // a mast at the back corner of a slanted roof too low for a lamp: a crossbar, and a light at its tip
    const k = corners(top).k
    p.add('m', `M${k[0] + 0.5} ${k[1]}v-17m-3 6.5h6m-5 -3h4`)
    p.add('k2', `M${k[0]} ${k[1] - 17.5}h1`)
  }
  const m = hash(s.x, 33) % 4
  const b = v.b - v.cham
  // louvres under the roof on the right face, where there is room above the first slot
  if (m > 0 && first && first[0] > 24 && s.form !== 'cant') {
    const u0 = v.cham + Math.round(b * 0.5)
    const w = Math.round(b * 0.3)
    for (let q = 0; q < 3; q++) p.add('m', `M${v.x + u0} ${v.y - u0 / 2 + 7.5 + q * 4}l${w} ${-w / 2}`)
  }
  // a thin circuit on the left face: down from under the first slot, a turn at the wall's 45 degrees, and a foot
  if (m > 1 && !s.light.includes('left')) {
    const u = v.cham + Math.round((v.a - v.cham) * 0.5)
    const y = v.y - u / 2 + under
    const j = 8 + (hash(s.x, 34) % 2) * 6
    const l1 = 18 + (hash(s.x, 35) % 3) * 10
    const l2 = 26 + (hash(s.x, 36) % 3) * 12
    if (foot(v.x - u - j) > y + l1 + l2 + j + 4) p.add(`v${edge}`, `M${v.x - u + 0.5} ${y}v${l1}l${-j} ${j / 2}v${l2}${FOOT_MARK}`)
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
  { x: -1320, y: -60, a: 70, b: 42, form: 'shed', bands: [[48, 12], [150, 8]], light: ['stub', 'trace'] },
  { x: -1180, y: 40, a: 56, b: 84, form: 'step', bands: [[30, 14]], light: ['spine'] },
  { x: -1010, y: -150, a: 84, b: 56, form: 'cham', red: true, bands: [[22, 16], [210, 12]], light: ['spine'], pulse: true },
  { x: -880, y: 70, a: 42, b: 56, form: 'cant', bands: [[40, 10]], light: ['blade'] },
  { x: -760, y: -40, a: 56, b: 70, form: 'shed', bands: [[64, 14]], light: ['left', 'trace'] },
  { x: -520, y: -110, a: 98, b: 70, form: 'step', bands: [[26, 14], [120, 18]], light: ['drop', 'blade'], pulse: true },
  { x: -640, y: 110, a: 70, b: 42, form: 'shed', bands: [[16, 10]], light: ['trace'] },
  { x: -380, y: 30, a: 56, b: 42, form: 'cham', bands: [[50, 12]], light: ['drop'] },
  { x: -250, y: -20, a: 42, b: 70, form: 'cant', red: true, bands: [[12, 14]], light: ['left'] },
  { x: -120, y: 90, a: 56, b: 56, form: 'shed', bands: [[34, 12]], light: ['spine'], pulse: true },
]

/** The near ring: broad, low and dark, its offices bright, at the bottom left. */
const NEAR: Spec[] = [
  { x: -1260, y: 120, a: 84, b: 56, form: 'shed', bands: [[30, 18]], light: ['blade'] },
  { x: -1060, y: 60, a: 70, b: 84, form: 'step', red: true, bands: [[16, 16], [96, 12]], light: ['stub', 'trace'] },
  { x: -820, y: 150, a: 56, b: 70, form: 'cham', bands: [[14, 20]], light: ['spine'], pulse: true },
  { x: -600, y: 90, a: 70, b: 56, form: 'shed', bands: [[40, 16], [110, 10]], light: ['drop', 'left'] },
  { x: -330, y: 170, a: 56, b: 56, form: 'cham', red: true, bands: [[20, 14]], light: ['blade'] },
]

/** How high a volume's outline stands at `x`: its back roof lines; far below everything where it does not reach. */
function crest(v: Vol, x: number): number {
  const q = corners(v)
  if (x < q.l[0] || x > q.r[0]) return FOOT
  const [a, b] = x < q.k[0] ? [q.l, q.k] : [q.k, q.r]
  return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0] || 1)
}

/**
 * A ring's cores in one colour: the soft light beside each (one path apiece, as the light is laid across each
 * shape's own width), then the shapes `core` laid down, from the trench's dark lip in to the white.
 */
const cores = (p: Pen, edge: string, glow: string, wall: string, ink: string, hot: string) =>
  p.get(`l${edge}`).split('|').filter(Boolean).map(d => `<path fill="url(#${glow})" d="${d}"/>`).join('') +
  `<path fill="#020508" d="${p.get(`${edge}0`)}"/><path fill="${wall}" d="${p.get(`${edge}1`)}"/><path fill="${ink}" d="${p.get(`${edge}2`)}"/><path fill="${hot}" d="${p.get(`${edge}3`)}"/>`

/** Crimson light on the black each side of a core: the cyan one is the tower's own (tower.ts's `tgx`). */
const GLOW = `<defs><linearGradient id="tgq"><stop stop-color="${RED}" stop-opacity="0"/><stop offset=".5" stop-color="${RED}" stop-opacity=".3"/><stop offset="1" stop-color="${RED}" stop-opacity="0"/></linearGradient></defs>`

/** A ring of towers: black faces and roofs, lit slots, dim roof lines, and the cores of light with their pulses. */
function drawRing(key: string, specs: Spec[], opacity: number, now: number, isLean: boolean): string {
  const p = new Pen()
  let pulses = ''
  const order = [...specs].sort((s, t) => s.x + s.y * 2 - (t.x + t.y * 2))
  const built = order.map(build)
  order.forEach((s, i) => {
    const vols = built[i]!
    // where a line down this tower at `x` goes out of sight: behind the nearer towers of the ring, or the fog
    const foot = (x: number) => Math.min(FOOT, ...built.slice(i + 1).flat().map(v => crest(v, x) - 3))
    const edge = s.red ? 'er' : 'ec'
    vols.forEach((v, n) => {
      volume(p, v, edge)
      // the base's slots; the top volume of a step or cantilever gets one of its own
      if (n === 0 && s.bands) bands(p, v, s.form === 'cant' ? s.bands.map(([d, t]) => [d + 34, t] as Band) : s.bands)
      if (n === 1 && s.form !== 'cant') bands(p, v, [[10, 10]])
      if (n === 1 && s.form === 'cant') p.add(`t${edge}`, `M${v.x - s.a} ${v.y - s.a / 2 + v.h - 0.5}L${v.x - v.a} ${v.y - v.a / 2 + v.h - 0.5}`)
    })
    details(p, s, vols, foot, edge)
    const run = lights(p, s, vols, edge, foot)
    if (s.pulse && run !== '' && !isLean) {
      const ms = 5000 + (hash(s.x, 11) % 5) * 900
      pulses += `<path stroke="#FFFFFF" stroke-width="3" stroke-dasharray="18 600" style="animation:up ${ms / 1000}s linear ${at(now, ms)} infinite" d="${run}"/>`
    }
  })
  return (
    `<g opacity="${opacity}"><defs><path id="${key}L" d="${p.get('L')}"/><path id="${key}B" d="${p.get('Bc')}"/></defs>` +
    `<use href="#${key}L" fill="#060B10"/><path fill="#0A1219" d="${p.get('R')}"/><path fill="#0E1A21" d="${p.get('C')}"/><path fill="#0D171D" d="${p.get('T')}"/>` +
    // grooves and fins cut into the faces, under the slots that cross them
    `<path stroke="#020508" stroke-width="2" d="${p.get('g')}"/><path stroke="#22323D" d="${p.get('g2')}"/>` +
    // the slots: a recess the light has turned blue, white along its top and cyan under that
    `<path fill="#075B80" d="${p.get('B')}"/><use href="#${key}B" stroke="#E8FAFF"/><use href="#${key}B" y="1" stroke="${CYAN}"/>` +
    // ticks down the walls, and the marks on the level roofs
    `<path stroke="#0E7FA0" stroke-dasharray="2 4" d="${p.get('k')}"/><path stroke="#0E7FA0" d="${p.get('k2')}"/>` +
    // the shade on the left faces falls over their slots too
    `<use href="#${key}L" fill="#02060A" opacity=".35"/>` +
    // masts and louvres, in dull metal
    `<path stroke="#22323D" d="${p.get('m')}"/>` +
    `<path stroke="${DIM}" opacity=".35" d="${p.get('d')}"/><path stroke="#0E7FA0" d="${p.get('tec')}"/><path stroke="#A0142F" d="${p.get('ter')}"/>` +
    cores(p, 'ec', 'tgx', '#075B80', CYAN, '#E8FAFF') +
    cores(p, 'er', 'tgq', '#7A0B22', RED, '#FFD9DF') +
    // the thin traces: the blue (or crimson) of their walls, and a single line of light
    `<path stroke="#075B80" stroke-width="3" d="${p.get('vec')}"/><path stroke="${CYAN}" d="${p.get('vec')}"/>` +
    `<path stroke="#7A0B22" stroke-width="3" d="${p.get('ver')}"/><path stroke="${RED}" d="${p.get('ver')}"/>` +
    `${pulses}</g>`
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

/** The motion of the city: trains, flyers, pulses up the cores. */
export const CITY_KEYS =
  RAILS.map((r, k) => `@keyframes rail${k}{to{transform:translate(${r.x1}px,${r.y1}px)}}`).join('') +
  FLY.map(([, x1, y], k) => `@keyframes fy${k}{to{transform:translate(${x1}px,${y}px)}}`).join('') +
  '@keyframes up{to{stroke-dashoffset:618}}'

/**
 * The whole megacity behind the tower, in the tower's pixels. `quiet` drops what passes (traffic,
 * pulses, blinking lamps, the currents in the fog) and leaves every building as it is; `thin` also drops
 * the neon's light in the fog; `bare`, the last resort of a crowded room,
 * also drops the far ring and the fog behind the middle ring; the fog in front of it always stays.
 */
export function megacity(now: number, level: 'full' | 'quiet' | 'thin' | 'bare' = 'full'): string {
  const isLean = level !== 'full'
  const rest = level === 'full' ? 0 : level === 'quiet' ? 1 : 2
  const isBare = level === 'bare'
  return (
    GLOW +
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
