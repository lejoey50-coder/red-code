// The megacity round the tower, drawn in the tower's own pixels and at the room's own angle: two across
// for one up, so every block, bridge and rail meets the room's pixel art at its slopes. It is drawn inside
// the tower's group, so it shrinks and moves with the tower and keeps the same pixel size at every window
// shape. Blocks rise out of the cloud sea; their feet run far below the window, where the cloud hides them.
//
// Depth is told the way an orthographic camera tells it: what is further back is drawn first and stands
// higher, and the haze of the night air thins it. The faces reuse the tower's own window patterns
// (tower.ts), so the whole city shares one lattice of windows with the tower.

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

type Tier = { key: string; blocks: Block[]; opacity: number; lit: boolean }

/** One ring of the city: blocks spread across `from..to`, roofs between `top` and `low`, back to front. */
function ring(key: string, seed: number, from: number, to: number, step: number, size: [number, number], top: number, low: number, opacity: number, lit: boolean, skip?: [number, number]): Tier {
  const blocks: Block[] = []
  for (let x = from; x < to; x += step + (hash(x, seed) % step)) {
    if (skip && x > skip[0] && x < skip[1]) continue
    const a = size[0] + (hash(x, seed + 1) % (size[1] - size[0]))
    const b = size[0] + (hash(seed + 2, x) % (size[1] - size[0]))
    const y = top + (hash(x, seed + 3) * 7) % (low - top)
    const seam = hash(x, seed + 4) % 3 === 0 ? C.red : hash(x, seed + 5) % 2 === 0 ? C.cyan : C.teal
    blocks.push(snap(x, y, a, b, FOOT - y, seam))
    // a plant on some roofs: a smaller block standing back on the roof
    if (hash(x, seed + 6) % 3 === 0) {
      const k = blocks[blocks.length - 1]!
      blocks.push(snap(k.x + 14, k.y - 10 - (hash(x, 9) % 18), k.a / 3, k.b / 3, 12 + (hash(x, 9) % 18), C.edge))
    }
  }
  // farther back first: the higher a roof's ground line, the further away it stands
  blocks.sort((p, q) => p.x + p.y * 2 - (q.x + q.y * 2))
  return { key, blocks, opacity, lit }
}

/** The city, ring by ring: far, middle and near. Laid out once. */
let rings: Tier[] = []
function layout(): Tier[] {
  if (rings.length > 0) return rings
  rings = [
    ring('f', 11, -1300, 330, 52, [28, 56], -40, 110, 0.38, false),
    ring('m', 23, -1300, 300, 76, [42, 70], 20, 200, 0.68, true, [-30, 250]),
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
    // light comes from the right, as in the room: the right roof edge catches it
    p.add('rim', `M${k.x} ${k.y - 0.5}l${k.b} ${-k.b / 2}`)
    p.add('edge', `M${k.x - k.a} ${k.y - k.a / 2 - 0.5}l${k.a} ${k.a / 2}`)
    p.add(`s${k.seam}`, `M${k.x + 0.5} ${k.y}v${k.h}`)
  }
  const L = `${t.key}L`
  const R = `${t.key}R`
  defs.add(L, `<path id="${L}" d="${p.get('L')}"/>`)
  defs.add(R, `<path id="${R}" d="${p.get('R')}"/>`)
  const lit = t.lit && !isLean ? `<use href="#${L}" fill="url(#la)"/><use href="#${R}" fill="url(#ra)"/>` : ''
  const seams = [C.red, C.cyan, C.teal, C.edge]
    .map(c => (p.get(`s${c}`) === '' ? '' : `<path stroke="${c}"${c === C.edge ? '' : ' stroke-dasharray="8 1"'} d="${p.get(`s${c}`)}"/>`))
    .join('')
  return (
    `<g opacity="${t.opacity}">` +
    `<use href="#${L}" fill="${C.ink}"/><use href="#${R}" fill="${C.slab}"/>` +
    `<use href="#${L}" fill="url(#wl)"/><use href="#${R}" fill="url(#wr)"/>${lit}` +
    `<path fill="${C.slab2}" d="${p.get('T')}"/><path stroke="${C.rim}" d="${p.get('rim')}"/><path stroke="${C.edge}" d="${p.get('edge')}"/>${seams}` +
    '</g>'
  )
}

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
  '@keyframes nf{0%,100%{opacity:1}92%{opacity:.3}94%{opacity:1}96%{opacity:.4}}'

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
      : drawTier(far, defs, isLean) + '@RAIL@' + drawTier(mid, defs, isLean) + bridges(mid) + drawTier(near, defs, isLean) + lamps(mid)
    const shared = (isLean ? [mid, near] : [far, mid, near]).map(t => defs.get(`${t.key}L`) + defs.get(`${t.key}R`)).join('')
    body = `<defs>${shared}</defs>${tiers}`
    cachedStatic.set(key, body)
  }
  const [before = '', after = ''] = body.split('@RAIL@')
  return before + (isLean ? '' : flyers(now)) + rails(now, isLean) + after + (isLean ? '' : neon(near, now) + neon(mid, now))
}
