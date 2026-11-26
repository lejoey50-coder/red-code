// The megacity round the tower, drawn in the tower's own pixels and at the room's own angle: two across
// for one up, so every block, bridge and rail meets the room's pixel art at its slopes. It is drawn inside
// the tower's group, so it shrinks and moves with the tower and keeps the same pixel size at every window
// shape. Blocks rise out of the cloud sea; their feet run far below the window, where the cloud hides them.
//
// Depth is told the way an orthographic camera tells it: what is further back is drawn first and stands
// higher, and the haze of the night air thins it. The faces reuse the tower's own window patterns
// (tower.ts), so the whole city shares one lattice of windows with the tower.

import { spire } from './city'
import { GLASS_BACK, glassDefs } from './glass'
import { ROOM_INK as C, hash } from './room'

/** Seconds, for a delay that puts a loop of `ms` at the clock's place in it. */
const at = (now: number, ms: number) => `${-(now % ms) / 1000}s`

/** Below the window at every window shape: where faces stop, under the cloud. */
const FOOT = 900

type Block = {
  /** The roof's front corner. */
  x: number
  y: number
  /** Across to the left corner and to the right corner, in pixels; the roof drops half of each. */
  a: number
  b: number
  /** Down from the roof to where the face stops. */
  h: number
  seam: string
}

/** Paths gathered by ink, so a whole tier is a handful of paths. */
class Pen {
  private by = new Map<string, string>()
  add(key: string, d: string): void {
    this.by.set(key, (this.by.get(key) ?? '') + d)
  }
  get(key: string): string {
    return this.by.get(key) ?? ''
  }
}

const leftFace = (k: Block) => `M${k.x - k.a} ${k.y - k.a / 2}L${k.x} ${k.y}v${k.h}H${k.x - k.a}z`
const rightFace = (k: Block) => `M${k.x} ${k.y}L${k.x + k.b} ${k.y - k.b / 2}V${k.y + k.h}H${k.x}z`
const roof = (k: Block) => `M${k.x} ${k.y}l${-k.a} ${-k.a / 2}l${k.b} ${-k.b / 2}l${k.a} ${k.a / 2}z`

/** Puts a block's corners on the windows' lattice: 14 across, and its left roof edge on a floor line. */
function snap(x: number, y: number, a: number, b: number, h: number, seam: string): Block {
  const sx = 2 + Math.round((x - 2) / 14) * 14
  const lift = (((y - sx / 2 - 7) % 18) + 18) % 18
  return { x: sx, y: y - lift, a: Math.max(14, Math.round(a / 14) * 14), b: Math.max(14, Math.round(b / 14) * 14), h, seam }
}

/** A pointed crown over a roof: its front corner, its two spans, and how high its peak stands. */
type Crown = { x: number; y: number; a: number; b: number; rise: number }
/** A mast on a roof: its foot and its height. */
type Mast = { x: number; y: number; h: number }
type Tier = { key: string; blocks: Block[]; crowns: Crown[]; masts: Mast[]; opacity: number; lit: boolean }

/** A smaller block standing back on a roof, `f` of its size and `rise` tall. */
function setback(k: Block, f: number, rise: number, seam: string): Block {
  const a = Math.max(14, Math.round((k.a * f) / 14) * 14)
  const b = Math.max(14, Math.round((k.b * f) / 14) * 14)
  // the smaller roof's front corner, moved back from the big one by half of what each side gave up
  const x = k.x - (k.a - a) / 2 + (k.b - b) / 2
  const y = k.y - (k.a - a) / 4 - (k.b - b) / 4
  return { x, y: y - rise, a, b, h: rise + 2, seam }
}

/** One ring of the city: blocks spread across `from..to`, roofs between `top` and `low`, back to front. */
function ring(key: string, seed: number, from: number, to: number, step: number, size: [number, number], top: number, low: number, opacity: number, lit: boolean, skip?: [number, number]): Tier {
  const groups: Block[][] = []
  const crowns: Crown[] = []
  const masts: Mast[] = []
  for (let x = from; x < to; x += step + (hash(x, seed) % step)) {
    if (skip && x > skip[0] && x < skip[1]) continue
    const a = size[0] + (hash(x, seed + 1) % (size[1] - size[0]))
    const b = size[0] + (hash(seed + 2, x) % (size[1] - size[0]))
    const y = top + (hash(x, seed + 3) * 7) % (low - top)
    const seam = hash(x, seed + 4) % 3 === 0 ? C.red : hash(x, seed + 5) % 2 === 0 ? C.cyan : C.teal
    const k = snap(x, y, a, b, FOOT - y, seam)
    const group = [k]
    // the roof: a setback tower, a small plant room, a pointed crown, a mast, or flat
    const top2 = (() => {
      switch (hash(x, seed + 6) % 6) {
        case 0: {
          const s = setback(k, 0.6, 28 + (hash(x, 7) % 40), seam)
          group.push(s)
          return s
        }
        case 1:
          group.push(setback(k, 0.34, 10 + (hash(x, 9) % 14), C.edge))
          return k
        default:
          return k
      }
    })()
    const style = hash(x, seed + 8) % 4
    if (style === 0) crowns.push({ x: top2.x, y: top2.y, a: top2.a, b: top2.b, rise: 10 + ((top2.a + top2.b) >> 3) })
    else if (style === 1) masts.push({ x: top2.x + ((top2.b - top2.a) >> 1), y: top2.y - ((top2.a + top2.b) >> 2), h: 16 + (hash(x, 10) % 26) })
    groups.push(group)
  }
  // farther back first: the higher a roof's ground line, the further away it stands; a roof's own setback after it
  groups.sort((p, q) => p[0]!.x + p[0]!.y * 2 - (q[0]!.x + q[0]!.y * 2))
  return { key, blocks: groups.flat(), crowns, masts, opacity, lit }
}

/** Pointed crowns: the left slope in the shade, the right in the light, a neon line up the ridge. */
function crowns(t: Tier): string {
  let left = ''
  let right = ''
  let ridge = ''
  for (const c of t.crowns) {
    const px = c.x + ((c.b - c.a) >> 1)
    const py = c.y - ((c.a + c.b) >> 2) - c.rise
    left += `M${c.x} ${c.y}L${c.x - c.a} ${c.y - c.a / 2}L${px} ${py}z`
    right += `M${c.x} ${c.y}L${c.x + c.b} ${c.y - c.b / 2}L${px} ${py}z`
    ridge += `M${c.x + 0.5} ${c.y}L${px + 0.5} ${py}`
  }
  return `<path fill="#0A1218" d="${left}"/><path fill="#17252E" d="${right}"/><path stroke="${t.lit ? C.cyan : C.edge}" d="${ridge}"/>`
}

/** Masts on the roofs, each with a lamp at its tip, and a dish that turns now and then. */
function masts(t: Tier): string {
  let pole = ''
  let tips = ''
  let dish = ''
  t.masts.forEach((m, i) => {
    pole += `M${m.x + 0.5} ${m.y}v${-m.h}M${m.x - 2} ${m.y - (m.h >> 1)}.5h5`
    tips += `M${m.x} ${m.y - m.h - 1}.5h1`
    if (i % 2 === 0) dish += `M${m.x + 1} ${m.y - m.h + 6}.5h3m-1 -1h2m-1 -1h1`
  })
  return (
    `<path stroke="#3B5360" d="${pole}"/><path stroke="#FF9295" style="animation:blink 1.6s step-end infinite" d="${tips}"/>` +
    (dish === '' ? '' : `<path stroke="#6E8C97" style="animation:dish 9s steps(1) infinite" d="${dish}"/>`)
  )
}

/** The city, ring by ring: far, middle and near. Laid out once. */
let rings: Tier[] = []
function layout(): Tier[] {
  if (rings.length > 0) return rings
  rings = [
    ring('f', 11, -1300, 330, 52, [28, 56], -40, 110, 0.38, false),
    ring('m', 23, -1300, 300, 76, [42, 70], 20, 200, 0.86, true, [-30, 250]),
    ring('n', 37, -1300, -170, 140, [42, 84], 110, 250, 1, true),
  ]
  return rings
}

/** A tier's faces, roofs, rims and window light, shared paths named once in `defs`. */
function drawTier(t: Tier, defs: Pen, isLean: boolean): string {
  const p = new Pen()
  for (const k of t.blocks) {
    p.add('L', leftFace(k))
    p.add('R', rightFace(k))
    p.add('T', roof(k))
    // far off, the haze takes the fine lines
    if (!t.lit) continue
    // light comes from the right, as in the room: the right roof edge catches it; near roofs are lined in neon
    p.add(t.key === 'n' && k.h > 300 ? `r${k.seam}` : 'rim', `M${k.x} ${k.y - 0.5}l${k.b} ${-k.b / 2}`)
    p.add('edge', `M${k.x - k.a} ${k.y - k.a / 2 - 0.5}l${k.a} ${k.a / 2}`)
    p.add(`s${k.seam}`, `M${k.x + 0.5} ${k.y}v${k.h}`)
  }
  const L = `${t.key}L`
  const R = `${t.key}R`
  defs.add(L, `<path id="${L}" d="${p.get('L')}"/>`)
  defs.add(R, `<path id="${R}" d="${p.get('R')}"/>`)
  const seams = [C.red, C.cyan, C.teal, C.edge]
    .map(c => (p.get(`s${c}`) === '' ? '' : `<path stroke="${c}"${c === C.edge ? '' : ' stroke-dasharray="8 1"'} d="${p.get(`s${c}`)}"/>`))
    .join('')
  const neonRims = [C.red, C.cyan, C.teal].map(c => (p.get(`r${c}`) === '' ? '' : `<path stroke="${c}" d="${p.get(`r${c}`)}"/>`)).join('')
  // far off, small windows; nearer, floor-to-ceiling glass offices, the left faces in the shade as in the room
  const faces = t.lit && !isLean
    ? `<use href="#${L}" fill="${GLASS_BACK}"/><use href="#${R}" fill="${GLASS_BACK}"/><use href="#${L}" fill="url(#gL)"/><use href="#${R}" fill="url(#gR)"/><use href="#${L}" fill="url(#nL)"/><use href="#${R}" fill="url(#nR)"/>` +
      (`<g style="animation:ol 97s steps(1) infinite"><use href="#${L}" fill="url(#oL)"/><use href="#${R}" fill="url(#oR)"/></g>`) +
      `<use href="#${L}" fill="#02060A" opacity=".22"/>`
    : `<use href="#${L}" fill="${C.ink}"/><use href="#${R}" fill="${C.slab}"/><use href="#${L}" fill="url(#wl)"/><use href="#${R}" fill="url(#wr)"/>`
  return (
    `<g opacity="${t.opacity}">${faces}` +
    `<path fill="${C.slab2}" d="${p.get('T')}"/><path stroke="${C.rim}" d="${p.get('rim')}"/><path stroke="${C.edge}" d="${p.get('edge')}"/>${neonRims}${seams}` +
    '</g>'
  )
}

/**
 * Penthouses on some of the tall blocks: the top floor all glass, a white ceiling lit end to end, a sofa,
 * a lamp and someone walking about. Drawn per block, so the ceiling meets each roof exactly.
 */
function penthouses(t: Tier, isLean: boolean): string {
  let room = ''
  let ceil = ''
  let ceil2 = ''
  let slab = ''
  let mull = ''
  let sofa = ''
  let walkers = ''
  const P = 24
  t.blocks.forEach((k, i) => {
    if (k.h < 300 || hash(k.x, 13) % 3 !== 0) return
    const faces = [
      [k.x - k.a, k.y - k.a / 2, k.a, 1],
      [k.x, k.y, k.b, -1],
    ] as const
    for (const [x0, y0, w, way] of faces) {
      const s = way / 2
      room += `M${x0} ${y0}l${w} ${w * s}v${P}l${-w} ${-w * s}z`
      ceil += `M${x0} ${y0 + 2.5}l${w} ${w * s}`
      ceil2 += `M${x0} ${y0 + 3.5}l${w} ${w * s}`
      slab += `M${x0} ${y0 + P - 1.5}l${w} ${w * s}`
      for (let u = 28; u < w; u += 28) mull += `M${x0 + u + 0.5} ${y0 + u * s + 4}v${P - 6}`
      const u = 6 + (hash(k.x, w) % Math.max(1, w - 20))
      sofa += `M${x0 + u} ${y0 + u * s + P - 6}l8 ${8 * s}v3l-8 ${-8 * s}z`
    }
    if (isLean || i % 2 !== 0) return
    // someone crossing the room behind the glass, there and back
    const [x0, y0, w] = faces[0]
    const ms = 14000 + (hash(k.x, 14) % 9) * 1000
    walkers += `<g style="transform:translate(${x0 + 4}px,${y0 + 8}px);animation:pw${t.key}${i} ${ms / 1000}s steps(${Math.round(w / 2)}) infinite alternate"><path fill="#0A1218" d="M1 0h2v2h-2zM0 2h4v6h-4zM0 8h1v4h-1zM3 8h1v4h-1z"/></g>`
    walkKeys.push(`@keyframes pw${t.key}${i}{to{transform:translate(${x0 + w - 8}px,${y0 + 8 + (w - 12) / 2}px)}}`)
  })
  return (
    `<path fill="#0F2C35" d="${room}"/><path stroke="#B8F6FF" d="${ceil}"/><path stroke="#4FE0F2" d="${ceil2}"/>` +
    `<path stroke="#0A1218" d="${slab}"/><path stroke="#2C4752" d="${mull}"/><path fill="#0E1A20" d="${sofa}"/>${walkers}`
  )
}
/** The walkers' paths, gathered while the penthouses are laid out. */
const walkKeys: string[] = []

/** Bridges between neighbours in the middle ring, at the room's slope, each with a lit strip. */
function bridges(t: Tier): string {
  let body = ''
  let light = ''
  const bs = [...t.blocks].filter(k => k.h > 300).sort((p, q) => p.x - q.x)
  for (let i = 0; i + 1 < bs.length; i++) {
    const p = bs[i]!
    const q = bs[i + 1]!
    if (hash(p.x, 5) % 3 !== 0) continue
    const x0 = p.x + (p.b >> 1)
    const x1 = q.x - (q.a >> 1)
    const dx = x1 - x0
    if (dx < 20 || dx > 160) continue
    const y0 = Math.max(p.y, q.y) + 30 + (hash(p.x, 6) % 40)
    const fall = hash(p.x, 7) % 2 === 0 ? dx / 2 : -dx / 2
    body += `M${x0} ${y0}l${dx} ${fall}v5l${-dx} ${-fall}z`
    light += `M${x0} ${y0 + 2.5}l${dx} ${fall}`
  }
  return `<path fill="${C.slab}" d="${body}"/><path stroke="${C.teal}" stroke-dasharray="3 2" d="${light}"/>`
}

/** Neon on the near faces: upright bars sheared to the wall, some flickering. */
function neon(t: Tier, now: number): string {
  let steady = ''
  let flicker = ''
  t.blocks.forEach((k, i) => {
    if (k.h < 300 || hash(k.x, 8) % 2 !== 0) return
    const ink = i % 3 === 0 ? C.red : i % 3 === 1 ? C.cyan : C.amber2
    const x = k.x - 10 - (hash(k.x, 9) % Math.max(1, k.a - 24))
    const y = k.y + 14 + (hash(k.x, 10) % 30) - (k.x - x) / 2
    const bar = `<path fill="${ink}" d="M${x} ${y}l4 2v${30 + (hash(k.x, 11) % 30)}l-4 -2z"/>`
    if (i % 4 === 0) flicker += bar
    else steady += bar
  })
  return steady + (flicker === '' ? '' : `<g style="animation:nf 7.3s steps(1) ${at(now, 7300)} infinite">${flicker}</g>`)
}

/** Red lamps on the tallest roofs. */
function lamps(t: Tier): string {
  let d = ''
  for (const k of t.blocks) if (k.y < -40 && k.h > 300) d += `M${k.x - 1} ${k.y - (k.a >> 2) - 8}.5h2`
  return `<path stroke="#FF9295" style="animation:blink 2s step-end infinite" d="${d}"/>`
}

/** Two elevated lines across the city on the two diagonals, with a train on each. */
const RAILS = [
  { x0: -1300, y0: -330, x1: 340, y1: 490, ms: 52000, ink: C.cyan },
  { x0: 340, y0: -230, x1: -1300, y1: 590, ms: 66000, ink: C.red },
] as const
function rails(now: number, isLean: boolean): string {
  let deck = ''
  let lights = ''
  let piers = ''
  let trains = ''
  RAILS.forEach((r, k) => {
    const dx = r.x1 - r.x0
    const dy = r.y1 - r.y0
    deck += `M${r.x0} ${r.y0}l${dx} ${dy}v4l${-dx} ${-dy}z`
    lights += `M${r.x0} ${r.y0 + 0.5}l${dx} ${dy}`
    for (let t = 0.04; t < 1; t += 0.07) piers += `M${Math.round(r.x0 + dx * t)} ${Math.round(r.y0 + dy * t) + 4}V${FOOT}`
    if (isLean) return
    const way = Math.sign(dx)
    // a car four lengths long at the slope: dark body, a lit band of windows, a white nose
    const car = `<path fill="${C.void}" d="M0 -4l${way * 44} 22v4l${-way * 44} -22z"/><path stroke="${r.ink}" stroke-dasharray="5 2" d="M${way * 2} -2.5l${way * 40} 20"/><path stroke="#FFFFFF" d="M${way * 42} 17.5h${way * 2}"/>`
    trains += `<g style="transform:translate(${r.x0}px,${r.y0}px);animation:rail${k} ${r.ms / 1000}s steps(${Math.round(Math.abs(dx) / 3)}) ${at(now, r.ms)} infinite">${car}</g>`
  })
  return `<path stroke="#0A1219" d="${piers}"/><path fill="#03060A" d="${deck}"/><path stroke="#162730" stroke-dasharray="6 3" d="${lights}"/>${trains}`
}

/** Far flyers crossing above the roofs, east to west and back: level flight, so level on screen. */
const FLY = [
  [-1300, 400, -250, 64000, C.cyan],
  [400, -1300, -190, 91000, C.red],
  [-1300, 400, -110, 120000, C.ice],
] as const
function flyers(now: number): string {
  return FLY.map(([x0, , y, ms, ink], k) => {
    const w = x0 < 0 ? 1 : -1
    return `<g style="transform:translate(${x0}px,${y}px);animation:fy${k} ${ms / 1000}s steps(400) ${at(now, ms)} infinite"><path stroke="#24424C" d="M${-w * 16} .5h${w * 6}"/><path stroke="${ink}" d="M${-w * 10} .5h${w * 8}"/><path stroke="#FFFFFF" d="M${-w * 2} .5h${w * 2}"/></g>`
  }).join('')
}

/** The motion of the city: trains, flyers, neon flicker. */
export const CITY_KEYS =
  RAILS.map((r, k) => `@keyframes rail${k}{to{transform:translate(${r.x1}px,${r.y1}px)}}`).join('') +
  FLY.map(([, x1, y], k) => `@keyframes fy${k}{to{transform:translate(${x1}px,${y}px)}}`).join('') +
  '@keyframes nf{0%,100%{opacity:1}92%{opacity:.3}94%{opacity:1}96%{opacity:.4}}' +
  // offices going dark and lighting again: a few at a time, over a minute and a half
  // a dish on a mast that swings round, once in a while
  '@keyframes dish{0%,70%{transform:none}71%,100%{transform:translateX(-3px)}}' +
  '@keyframes ol{0%,30%{opacity:0}31%,62%{opacity:1}63%,80%{opacity:.5}81%,100%{opacity:0}}'

/** The penthouse walkers' motion, known once the city is laid out. */
export function walkerKeys(): string {
  megacity(0)
  return walkKeys.join('')
}

let cachedStatic: Map<string, string> = new Map()

/** The whole megacity behind the tower, in the tower's pixels. */
export function megacity(now: number, isLean = false): string {
  const [far, mid, near] = layout()
  if (!far || !mid || !near) return ''
  const key = isLean ? 'lean' : 'full'
  let body = cachedStatic.get(key)
  if (body === undefined) {
    const defs = new Pen()
    // lean, for the busiest drawing: the far ring goes, and the bridges and lamps with it
    const tiers = isLean
      ? '@RAIL@' + drawTier(mid, defs, isLean) + drawTier(near, defs, isLean)
      : drawTier(far, defs, isLean) + crowns(far) + spire(-560, -330, 120) + '@RAIL@' + drawTier(mid, defs, isLean) + penthouses(mid, isLean) + crowns(mid) + masts(mid) + bridges(mid) + drawTier(near, defs, isLean) + penthouses(near, isLean) + crowns(near) + masts(near) + lamps(mid)
    const shared = (isLean ? [mid, near] : [far, mid, near]).map(t => defs.get(`${t.key}L`) + defs.get(`${t.key}R`)).join('')
    // lean, the offices are small windows again: the glass is the dearest pattern in the drawing
    body = `<defs>${isLean ? '' : glassDefs()}${shared}</defs>${tiers}`
    cachedStatic.set(key, body)
  }
  const [before = '', after = ''] = body.split('@RAIL@')
  return before + (isLean ? '' : flyers(now)) + rails(now, isLean) + after + (isLean ? '' : neon(near, now) + neon(mid, now))
}
