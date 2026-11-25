// The whole window: the city at night that the building stands in, from edge to edge. It is drawn as plain
// shapes on whole pixels, not as a raster, so a scene this wide stays small.

import { diamond, get, grid, rect as fillRect, set } from './pixels'
import type { Grid } from './pixels'
import { ROOM_INK as C, hash } from './room'

export const SCENE = { w: 640, h: 360 } as const
/** Where the building's own 0,0 lies in the scene: low on the right, clear of the words. */
export const AT = { x: 392, y: 108 } as const
const HZ = 240
/** The elevated line the trains run on. */
export const LINE = 214
/** The middle of the far column of light. */
const COLUMN = 178

const SKY = ['#070E15', '#08121A', '#0A1720', '#0C1D27', '#0F2530', '#122D39', '#153642', '#193F4B']

/** Runs of one colour, gathered into one path. */
class Ink {
  private by = new Map<string, string>()
  private px = 0
  run(x: number, y: number, n: number, c: string): void {
    this.by.set(c, `${this.by.get(c) ?? ''}M${x} ${y}.5h${n}`)
  }
  box(x: number, y: number, w: number, h: number, c: string): void {
    this.by.set(`=${c}`, `${this.by.get(`=${c}`) ?? ''}M${x} ${y}h${w}v${h}h${-w}z`)
  }
  flush(): string {
    let out = ''
    for (const [c, d] of this.by) out += c.startsWith('=') ? `<path fill="${c.slice(1)}" d="${d}"/>` : `<path stroke="${c}" d="${d}"/>`
    this.by.clear()
    return out
  }
}

type Tower = [x: number, w: number, top: number, seam: string]
const NEAR: Tower[] = [
  [-6, 34, 60, C.cyan], [38, 26, 104, C.red], [74, 30, 30, C.cyan], [116, 20, 128, C.cyan],
  [214, 24, 92, C.red], [246, 34, 140, C.cyan], [292, 20, 70, C.cyan], [322, 30, 156, C.red],
  [362, 22, 98, C.cyan], [396, 26, 52, C.red], [440, 18, 130, C.cyan], [566, 26, 64, C.cyan], [604, 40, 22, C.red],
]

/** Black towers, stepped at the top, each with one lit seam that bends and a few lit floors. */
function towers(): string {
  let bodies = ''
  let edges = ''
  const seams = new Map<string, string>()
  const ink = new Ink()
  for (const [x, w, top, seam] of NEAR) {
    const b = HZ + 22
    bodies += `M${x + 4} ${top}h${w - 8}v3h2v3h2v${HZ - 18 - top - 6}h2v${b - HZ + 18}h${-w - 4}v${HZ - 18 - b}h2v${top + 6 - HZ + 18}h2v-3h2z`
    edges += `M${x + w - 0.5} ${top + 6}V${HZ - 18}`
    const a = x + 4
    const bend = top + 20 + (hash(x, 9) % 22)
    const run = Math.min(6, w - 9)
    let d = `M${a + 0.5} ${top + 9}V${bend}`
    for (let k = 0; k < run; k++) d += `M${a + k} ${bend + k}.5h1`
    d += `M${a + run + 0.5} ${bend + run}V${HZ + 14}`
    seams.set(seam, (seams.get(seam) ?? '') + d)
    for (let y = top + 14; y < HZ - 6; y += 7) {
      const n = hash(x, y) % 5
      if (n < 2) ink.run(x + w - 7, y, 3, n === 0 ? '#2A7585' : '#1B4550')
    }
  }
  return (
    `<path fill="#050A0F" d="${bodies}"/><path stroke="#223A44" d="${edges}"/>` +
    [...seams].map(([c, d]) => `<path stroke="${c}" stroke-dasharray="8 1" d="${d}"/>`).join('') +
    ink.flush()
  )
}

let drawn = ''
/** Sky, towers, the line and the water. */
export function city(): string {
  if (drawn !== '') return drawn
  const { w: W, h: H } = SCENE
  let out = SKY.map((c, k) => `<rect y="${k * 30}" width="${W}" height="30" fill="${c}"/>`).join('')
  const ink = new Ink()
  // Long flat cloud, a little lighter around the column.
  for (let y = 12; y < 200; y += 8) {
    for (let x = hash(y, 3) % 60; x < W; x += 90 + (hash(y, x) % 80)) {
      const n = 20 + (hash(x, y) % 46)
      ink.run(x, y, n, Math.abs(x + n / 2 - COLUMN) < 90 ? '#1B4451' : '#11262F')
    }
  }
  // Stars, few.
  for (let k = 0; k < 34; k++) ink.run((hash(k, 21) * 7 + k * 53) % W, (hash(k, 33) * 3 + k * 11) % 96, 1, k % 5 === 0 ? '#7FB7C2' : '#2C4A55')
  // The red glow low down, broken up as it rises.
  ink.box(0, HZ - 10, W, 10, '#7C1D30')
  for (let y = HZ - 42; y < HZ - 10; y += 2) {
    const c = y > HZ - 20 ? '#541827' : y > HZ - 30 ? '#341722' : '#231B25'
    for (let x = hash(y, 2) % 40; x < W; ) {
      const n = 40 + (hash(x, y) % 60)
      ink.box(x, y, n, 2, c)
      x += n + 14 + ((HZ - y) >> 1)
    }
  }
  // Far roofs.
  for (let x = 0; x < W; ) {
    const w = 8 + (hash(x, 1) % 18)
    const h = 12 + (hash(x, 2) % 34)
    ink.box(x, HZ - h, w, h, '#0B161E')
    if (w > 12) ink.box(x + 3, HZ - h - 5, w - 8, 5, '#0B161E')
    if (hash(x, 5) % 3 === 0) ink.run(x + (w >> 1), HZ - h + 3, 1, C.red)
    if (hash(x, 6) % 3 === 0) ink.run(x + 3, HZ - h + 9, 3, '#20505C')
    x += w + (hash(x, 4) % 6)
  }
  out += ink.flush()

  // Black water, and the lights broken up in it.
  ink.box(0, HZ, W, H - HZ, '#04080C')
  ink.box(0, HZ, W, 2, '#3A1320')
  for (let y = HZ + 12; y < H; y += 5) {
    for (let x = hash(y, 11) % 60; x < W; x += 80 + (hash(x, y) % 70)) ink.run(x, y, 8 + (hash(y, x) % 26), y < HZ + 60 ? '#260E17' : '#0A141C')
  }
  out += ink.flush() + towers()
  // Two neon signs: bars, no words.
  for (const [x, y, c] of [[84, 62, C.red], [616, 58, C.amber]] as const) {
    ink.box(x, y, 12, 40, '#0A1118')
    for (let k = 0; k < 5; k++) ink.box(x + 2, y + 3 + k * 7, 8 - ((k * 3) % 5), 3, k % 2 === 0 ? c : C.teal)
  }
  for (let x = 16; x < W; x += 44) ink.box(x, LINE + 3, 3, 24, '#03060A')
  out += ink.flush()
  ink.box(0, LINE, W, 1, '#03060A')
  ink.box(0, LINE + 1, W, 2, '#162730')
  for (const [x, , , seam] of NEAR) {
    for (let y = HZ + 25; y < HZ + 92; y += 5) {
      const n = 2 + (hash(x, y) % 5)
      if (hash(y, x) % 3 > 0) ink.run(x + 6 - (n >> 1) + (hash(y, 5) % 4), y, n, seam === C.red ? '#4A1521' : '#12414B')
    }
  }
  for (let y = HZ + 24; y < HZ + 100; y += 2) {
    const n = 3 + (hash(y, 7) % 8)
    ink.run(COLUMN - (n >> 1) + (hash(y, 3) % 3) - 1, y, n, y < HZ + 46 ? '#1F5C69' : y < HZ + 72 ? '#163F48' : '#0F2A31')
  }
  drawn = out + ink.flush()
  return drawn
}

/** The far column of light, as plain bars: `isLit` when it answers the beacon. */
export function column(isLit: boolean): string {
  // Kept low, so the chat in the middle is what the eye goes to.
  const bar = (n: number, c: string, o = 1) => `<rect x="${COLUMN - (n >> 1)}" width="${n}" height="${HZ}" fill="${c}"${o < 1 ? ` opacity="${o}"` : ''}/>`
  const cloud = [104, 80, 58, 38, 22]
    .map((n, k) => `<rect x="${COLUMN - (n >> 1)}" y="${22 + k * 4}" width="${n}" height="2" fill="${['#0E2730', '#112F38', '#163B46', '#1E5260', '#2C6A76'][k]}"/>`)
    .join('')
  return bar(isLit ? 13 : 9, '#1F6473', 0.12) + bar(isLit ? 7 : 3, '#2A7585', 0.45) + bar(1, '#3E93A1', isLit ? 0.8 : 0.5) + cloud
}

/** The road, on from the building's own, down past the near edge of the window. In the building's pixels. */
const ROAD_TILES: Array<[number, number]> = [8, 9, 10, 11, 12, 13, 14].map(j => [7, j])
export function road(): Grid {
  const g = grid(256, 256)
  const at = ([i, j]: [number, number]): [number, number] => [128 + (i - j) * 16, 80 + (i + j) * 8 + 6]
  for (const t of ROAD_TILES) {
    const [x, y] = at(t)
    if (t[1] % 3 === 0) fillRect(g, x - 2, y + 4, 4, 60, C.ink)
    diamond(g, x, y + 5, C.void)
    diamond(g, x, y + 3, C.slab)
  }
  for (const t of ROAD_TILES) {
    const [x, y] = at(t)
    diamond(g, x, y, '#0B0F14', '#1A1016')
  }
  for (const t of ROAD_TILES) {
    const [x, y] = at(t)
    for (let k = -15; k < 15; k++) {
      const sx = x + k
      const sy = y - (k >> 1)
      if (get(g, sx, sy + 5) !== '') set(g, sx, sy + 5, C.red)
      if (get(g, sx, sy - 5) !== '') set(g, sx, sy - 5, C.ember)
      if (((k + 16) >> 2) % 2 === 0 && get(g, sx, sy) !== '') set(g, sx, sy, C.coal)
    }
  }
  return g
}

/** A flyer, far off: a bright nose and a thinning tail. */
export function flyer(ink: string): string {
  return `<path stroke="#24424C" d="M-16 .5h6"/><path stroke="#3F7C8A" d="M-10 .5h6"/><path stroke="${ink}" d="M-4 .5h4"/><path stroke="#FFFFFF" d="M0 .5h1"/>`
}
