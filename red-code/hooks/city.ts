// The whole window: the city at night that the building stands in, from edge to edge. It is drawn as plain
// shapes on whole pixels, not as a raster, so a scene this wide stays small.

import { diamond, get, grid, rect as fillRect, set } from './pixels'
import type { Grid } from './pixels'
import { ROOM_INK as C, hash } from './room'

export const SCENE = { w: 640, h: 360 } as const
/** Where the building's own 0,0 lies in the scene: low on the right, clear of the words. */
export const AT = { x: 392, y: 108 } as const
/** Where the far column of light runs down to, under the cloud. */
const HZ = 360
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

let drawn = ''
/**
 * The night sky over the megacity: bands of dark blue, a few stars and long flat cloud high up, lighter
 * round the far column. The city itself and the cloud sea under it are drawn at the room's own angle
 * (megacity.ts, tower.ts); what is left here is what has no angle: the sky.
 */
export function city(): string {
  if (drawn !== '') return drawn
  const { w: W, h: H } = SCENE
  let out = SKY.map((c, k) => `<rect y="${k * 45}" width="${W}" height="${k === SKY.length - 1 ? H - k * 45 : 45}" fill="${c}"/>`).join('')
  const ink = new Ink()
  for (let y = 12; y < 200; y += 13) {
    for (let x = hash(y, 3) % 60; x < W; x += 120 + (hash(y, x) % 90)) {
      const n = 20 + (hash(x, y) % 46)
      ink.run(x, y, n, Math.abs(x + n / 2 - COLUMN) < 90 ? '#1B4451' : '#11262F')
    }
  }
  for (let k = 0; k < 40; k++) ink.run((hash(k, 21) * 7 + k * 53) % W, (hash(k, 33) * 3 + k * 11) % 130, 1, k % 5 === 0 ? '#7FB7C2' : '#2C4A55')
  // the city's own light, thrown up into the haze above the cloud sea
  for (let y = 206; y < 262; y += 4) {
    const c = y > 246 ? '#2A1A26' : y > 230 ? '#1C1A25' : '#15202B'
    for (let x = hash(y, 2) % 40; x < W; ) {
      const n = 40 + (hash(x, y) % 60)
      ink.box(x, y, n, 2, c)
      x += n + 10 + ((262 - y) >> 1)
    }
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
