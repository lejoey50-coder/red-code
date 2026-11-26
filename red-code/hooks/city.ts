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

/** Storm-dark teal, deepening upward. */
const SKY = ['#03080B', '#050C10', '#071115', '#09161B', '#0B1C22', '#0E232A', '#112A32', '#15323B']

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
  // the city's own light, thrown up into the haze above the cloud sea: three soft steps, warmer low down
  const glow = [
    [206, 56, '#15202B'],
    [230, 32, '#1C1A25'],
    [246, 16, '#2A1A26'],
  ] as const
  for (const [y, n, c] of glow) out += `<rect y="${y}" width="${W}" height="${n}" fill="${c}" opacity=".6"/>`
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

// ---- the far spire and the storm


/**
 * A needle of a tower far off over the cloud, on a stepped base that glows from within: dark faces, a
 * line of light up its spine and down its edges, a lit core at its foot. Drawn among the far blocks, in the
 * tower's pixels, so it stands over every roof at every window shape.
 */
export function spire(x: number, tip: number, base: number): string {
  const left = `M${x} ${tip}L${x - 7} ${base - 60}L${x - 12} ${base}H${x}z`
  const right = `M${x} ${tip}L${x + 7} ${base - 60}L${x + 12} ${base}H${x}z`
  // the base: two stepped wings at the room's slope, each with a light line along its top
  const wingL = `M${x - 12} ${base - 6}L${x - 70} ${base + 23}V${base + 44}H${x - 12}z`
  const wingR = `M${x + 12} ${base - 6}L${x + 70} ${base + 23}V${base + 44}H${x + 12}z`
  const lines = `M${x - 12} ${base - 6.5}L${x - 70} ${base + 22.5}M${x + 12} ${base - 6.5}L${x + 70} ${base + 22.5}M${x - 40} ${base + 12}V${base + 40}M${x + 40} ${base + 12}V${base + 40}`
  return (
    // a soft column of haze round it
    `<rect x="${x - 26}" y="${tip + 40}" width="52" height="${base - tip}" fill="#1C8EA3" opacity=".05"/><rect x="${x - 14}" y="${tip + 20}" width="28" height="${base - tip}" fill="#4FE0F2" opacity=".05"/>` +
    `<path fill="#04080B" d="${left}${wingL}"/><path fill="#0A151A" d="${right}${wingR}"/>` +
    `<path stroke="#4FE0F2" stroke-width=".8" d="M${x - 7} ${base - 60}L${x - 12} ${base}M${x + 7} ${base - 60}L${x + 12} ${base}"/>` +
    `<path stroke="#B8F6FF" stroke-dasharray="6 3" d="M${x + 0.5} ${tip + 4}V${base}"/><path stroke="#1C8EA3" d="${lines}"/>` +
    // the lit core at its foot, between the wings
    `<path fill="#4FE0F2" opacity=".55" d="M${x - 8} ${base - 30}h16v34h-16z"/><path stroke="#E6FDFF" d="M${x - 5.5} ${base - 28}v30M${x - 1.5} ${base - 30}v32M${x + 2.5} ${base - 30}v32M${x + 6.5} ${base - 28}v30"/>`
  )
}

/**
 * Rain over the whole city, a pattern of thin streaks that falls by exactly one tile and starts over, and
 * two lightning bolts in the far sky, each flashing once in a few minutes. Both rest invisible or still
 * with motion off; the rain is faint enough to read the chat through.
 */
export function storm(now: number): string {
  const drops = `<path stroke="#8FD6E2" d="M3 2.5h1m-1 1h1m0 1h1m-1 1h1M23 30.5h1m-1 1h1m0 1h1m-1 1h1M33 12.5h1m-1 1h1m0 1h1M13 46.5h1m-1 1h1m0 1h1m-1 1h1"/>`
  const bolt = (x: number, ms: number, k: number) => {
    let d = `M${x} 0`
    let px = x
    for (let y = 8; y < 190; y += 8 + ((k * 7 + y) % 9)) {
      px += ((y * 13 + k * 31) % 15) - 7
      d += `L${px} ${y}`
    }
    return `<g style="opacity:0;animation:zap ${ms / 1000}s linear ${-(now % ms) / 1000}s infinite"><path stroke="#2B65A3" stroke-width="4" opacity=".5" d="${d}"/><path stroke="#E6F6FF" d="${d}"/></g>`
  }
  return (
    `<defs><pattern id="rn" width="40" height="60" patternUnits="userSpaceOnUse">${drops}</pattern></defs>` +
    bolt(40, 197000, 1) + bolt(596, 251000, 2) +
    `<g opacity=".35" style="animation:rain .9s linear infinite"><rect x="-40" y="-60" width="720" height="420" fill="url(#rn)"/></g>`
  )
}

/** The rain's fall: one tile down and one across, so it loops with no seam. */
export const STORM_KEYS = '@keyframes rain{to{transform:translate(-40px,60px)}}'
