// The glass house, drawn once into layers: the night city behind, the house, what stands in it, what stands in front.

import { diamond, disc, get, grid, line, rect, set } from './pixels'
import type { Grid } from './pixels'
import { H, VIEW, W, isFloor, place } from './map'
import { INK } from './sprites'

const C = {
  ...INK,
  void: '#04070B', ink: '#070D13', slab: '#0D161D', slab2: '#131F28', edge: '#22323D', rim: '#3B5360',
  // The room is a light-line grid: black gloss everywhere, and every edge, seam and lip drawn in light.
  // The floor's centre: dark glass, its lip and cut lines lit cyan.
  g0: '#4FE0F2', g1: '#1C8EA3', g2: '#0F3A45', g3: '#0B1A22', g4: '#0E2029',
  // The rest of the floor: black gloss, with a grid of dim light let into it.
  f0: '#16707F', f1: '#05080B', f2: '#080D11', f3: '#0B1217',
  // The left wall: black panels, their lips lit.
  s0: '#020407', s1: '#080D12', s2: '#0B1117', s3: '#0F171E', s4: '#2FB5C8',
  // Panels and furniture: black gloss in three tones, edges in light.
  p0: '#04070A', p1: '#0A1015', p2: '#10181E', p3: '#1C8EA3', p4: '#7FEAF6',
  cyan: '#4FE0F2', ice: '#B8F6FF', teal: '#1C8EA3', deep: '#0E4551',
  red: '#EE344D', ember: '#8C1B31', coal: '#3A0D18', amber2: '#E08A3C',
}

export const hash = (a: number, b: number) => (((a * 73856093) ^ (b * 19349663)) >>> 0) % 97
export const wallBase = (x: number) => 72 + ((127 - x) >> 1)

/** The archive: a black unit that curves out of the wall, edged in light, with three dark shelves of discs. */
export function archive(g: Grid): void {
  const D = 10
  for (let x = 32; x < 84; x++) {
    const b = wallBase(x - D) + 5
    // Rounded at the top two corners.
    const near = Math.min(x - 32, 83 - x)
    const cut = near < 4 ? [4, 2, 1, 1][near] ?? 0 : 0
    for (let y = b - 42 + cut; y < b; y++) set(g, x, y, y < b - 40 + cut ? C.p4 : y > b - 3 ? C.p0 : C.p2)
  }
  // Top face, and the end that faces us.
  for (let k = 0; k < D; k++) for (let x = 26; x < 74; x++) for (const e of [0, 1]) set(g, x + k - 1, wallBase(x - 1) - 42 + (k >> 1) + e, k < 2 ? C.p4 : C.p2)
  for (let k = 0; k < D; k++) {
    const b = wallBase(22) + (k >> 1)
    for (let y = b - 40; y < b; y++) set(g, 23 + k, y, k > 7 ? C.p1 : C.p0)
  }
  for (let row = 0; row < 3; row++) {
    for (let x = 35; x < 82; x++) {
      const b = wallBase(x - D) + 5 - 2 - row * 13
      const isEnd = x === 35 || x === 81
      for (let y = b - 10; y < b; y++) if (!isEnd || (y > b - 9 && y < b - 1)) set(g, x, y, y === b - 10 ? C.void : C.slab)
      if (!isEnd) set(g, x, b, C.p4)
    }
    for (let k = 0; k < 6; k++) {
      const x = 38 + k * 8
      const b = wallBase(x - D) + 5 - 2 - row * 13
      disc(g, x, b - 5, 3, C.teal, 1)
      set(g, x, b - 5, C.void)
    }
  }
}

/** The same shelves, awake. */
export function archiveLit(isWriting: boolean): Grid {
  const g = grid(W, H)
  for (let row = 0; row < 3; row++)
    for (let k = 0; k < 6; k++) {
      const x = 38 + k * 8
      const b = wallBase(x - 10) + 5 - 2 - row * 13
      disc(g, x, b - 5, 3, (k + row) % 3 === 0 ? '#FFFFFF' : C.cyan, 1)
    }
  for (let row = 0; row < 3; row++)
    for (let x = 36; x < 81; x++) set(g, x, wallBase(x - 10) + 5 - 2 - row * 13, isWriting ? C.red : C.ice)
  for (let x = 36; x < 80; x++) set(g, x, wallBase(x - 10) + 5 - 41, isWriting ? C.red : '#FFFFFF')
  for (let x = 34; x < 84; x += 2) {
    const y = wallBase(x - 10) + 6
    for (let k = 0; k < 5; k++) if ((x + k) % 4 < 2) set(g, x + k * 2, y + k, isWriting ? '#A65A66' : C.ice)
  }
  return g
}

// ---- the core: a stack of plates round a spine, each edged in light

const CORE = { x: 208, y: 128 }
const PLATES = [[4, 22], [13, 23], [22, 23], [31, 23], [40, 22], [48, 19]] as const

function plate(g: Grid, lift: number, r: number, top: string, lip: string): void {
  const cy = CORE.y - lift
  for (let y = -(r >> 1); y <= r >> 1; y++) {
    const half = Math.round(r * Math.sqrt(Math.max(0, 1 - (y * 2 * (y * 2)) / (r * r))))
    if (half <= 0) continue
    rect(g, CORE.x - half, cy + y, half * 2, 1, top)
    if (y >= 0) {
      const next = Math.round(r * Math.sqrt(Math.max(0, 1 - ((y + 1) * 2 * ((y + 1) * 2)) / (r * r)))) || 0
      for (let x = next; x <= half; x++) {
        set(g, CORE.x - x, cy + y + 1, lip)
        set(g, CORE.x + x - 1, cy + y + 1, lip)
      }
    }
  }
}

export function turbine(g: Grid): void {
  // A ring in the floor, then the stack from the bottom up.
  plate(g, -1, 28, C.slab, C.rim)
  plate(g, 1, 25, C.void, C.edge)
  for (const [lift, r] of PLATES) {
    plate(g, lift - 3, r, C.void, C.void)
    plate(g, lift, r, C.slab2, '#23707D')
    if (lift > 46) plate(g, lift, r - 4, C.slab, C.slab)
  }
  rect(g, CORE.x - 3, CORE.y - 66, 6, 14, C.slab2)
  rect(g, CORE.x + 1, CORE.y - 66, 1, 14, C.rim)
  // The pale spine down its near side, on a foot of its own.
  rect(g, CORE.x - 3, CORE.y - 40, 6, 46, C.p0)
  rect(g, CORE.x - 2, CORE.y - 40, 4, 46, C.p2)
  rect(g, CORE.x - 2, CORE.y - 40, 1, 46, C.p4)
  for (let k = 0; k < 6; k++) rect(g, CORE.x - 2 + (k >> 2), CORE.y - 46 + k, 4 - (k >> 2), 1, C.p1)
  for (let y = -30; y < 4; y += 9) rect(g, CORE.x - 3, CORE.y + y, 6, 2, C.slab)
  rect(g, CORE.x - 6, CORE.y + 4, 12, 3, C.p1)
  // The stand he works it from.
  const [cx, cy] = place([4, 1])
  for (let r = 0; r < 9; r++) diamond(g, cx, cy - r, r === 8 ? C.p2 : C.slab2, r === 8 ? C.p4 : undefined, 3)
  rect(g, cx - 1, cy - 18, 2, 8, C.p1)
  rect(g, cx - 2, cy - 20, 4, 3, C.rim)
}

/** The stack's light in one of four positions: it climbs. */
export function rotor(frame: number, isLit: boolean): Grid {
  const g = grid(W, H)
  if (!isLit) return g
  PLATES.forEach(([lift, r], k) => {
    const on = (k + 4 - frame) % 4
    plate2(g, lift, r, on === 0 ? '#FFFFFF' : on === 2 ? '#2BB4C8' : C.cyan)
  })
  return g
}
/** One plate's lip alone, two pixels deep. */
function plate2(g: Grid, lift: number, r: number, ink: string): void {
  const p = grid(W, H)
  plate(p, lift, r, '', ink)
  for (let y = 1; y < H; y++) for (let x = CORE.x - 28; x < CORE.x + 28; x++) if (get(p, x, y) === ink && (Math.abs(x - CORE.x + 0.5) > 3 || y < CORE.y - 46 || y > CORE.y + 6)) set(g, x, y, ink)
}
export function turbineLit(): Grid {
  const g = grid(W, H)
  plate2(g, -1, 28, C.cyan)
  rect(g, CORE.x - 1, CORE.y - 66, 2, 14, '#FFFFFF')
  const [cx, cy] = place([4, 1])
  rect(g, cx - 2, cy - 20, 4, 3, C.red)
  return g
}

export function beacon(g: Grid): void {
  const [x, y] = place([1, 0])
  for (let r = 0; r < 5; r++) diamond(g, x, y - r, r === 4 ? C.p2 : C.slab2, r === 4 ? C.p4 : undefined, 3)
  // A slim mast that opens into two arms with a ring held between them.
  rect(g, x - 1, y - 24, 3, 20, C.slab2)
  rect(g, x + 1, y - 24, 1, 20, C.p1)
  line(g, x - 1, y - 24, x - 6, y - 32, C.p1, 2)
  line(g, x + 1, y - 24, x + 6, y - 32, C.p1, 2)
  rect(g, x - 7, y - 38, 2, 7, C.p2)
  rect(g, x + 6, y - 38, 2, 7, C.p2)
  disc(g, x, y - 36, 4, '#2F6570', 2)
}
export function beaconLit(): Grid {
  const g = grid(W, H)
  const [x, y] = place([1, 0])
  disc(g, x, y - 36, 4, '#FFFFFF', 2)
  rect(g, x - 7, y - 38, 2, 7, C.ice)
  rect(g, x + 6, y - 38, 2, 7, C.ice)
  return g
}
/** The beam, straight up out of the ring, into the same cloud the far column lights. */
export function beam(): Grid {
  const g = grid(W, 80)
  const [x, y] = place([1, 0])
  // Drawn from the top of the view, which stands above the room's own frame.
  for (let k = 0; k < y - 38 - VIEW.y; k++) {
    const half = k < 10 ? 4 : 3
    rect(g, x - half, k, half * 2 + 1, 1, '#1C6E7E')
    rect(g, x - 1, k, 3, 1, C.ice)
    set(g, x, k, '#FFFFFF')
  }
  return g
}

/** The console: a glass slab on one leg, with a pane standing on it. */
export function desk(): Grid {
  const g = grid(36, 40)
  for (let r = 0; r < 8; r++) diamond(g, 18, 30 - r, C.slab, undefined, 5)
  for (let r = 8; r < 11; r++) diamond(g, 18, 30 - r, r === 10 ? C.p3 : C.teal, r === 10 ? C.p4 : undefined, 2)
  rect(g, 9, 4, 18, 12, C.p1)
  rect(g, 10, 5, 16, 10, '#0A1C24')
  rect(g, 17, 16, 2, 3, C.p0)
  return g
}
export function deskLit(): Grid {
  const g = grid(36, 40)
  rect(g, 9, 4, 18, 1, C.ice)
  rect(g, 10, 5, 16, 10, '#0F3A45')
  for (let k = 0; k < 4; k++) rect(g, 12, 6 + k * 2, [11, 7, 9, 4][k] ?? 6, 1, k === 1 ? INK.hot : '#FFFFFF')
  return g
}

export function lift(g: Grid): void {
  const [x, y] = place([2, 6])
  diamond(g, x, y, C.rim, undefined, 1)
  diamond(g, x, y, C.f0, undefined, 2)
  diamond(g, x, y, C.f2, undefined, 4)
}
/** The open lift: a column of light while a helper is in the room. */
export function liftLit(): Grid {
  const g = grid(W, H)
  const [x, y] = place([2, 6])
  diamond(g, x, y, C.cyan, undefined, 1)
  diamond(g, x, y, '#1B6E7C', undefined, 2)
  for (let k = 0; k < 22; k++) {
    if (k % 3 !== 2) set(g, x - 13, y - k, C.cyan)
    if (k % 3 !== 0) set(g, x + 12, y - k, C.cyan)
  }
  return g
}

/** One length of the front rail, for tile (6, j): a pane of glass under a lit hand line. */
export function railPiece(): Grid {
  const g = grid(18, 24)
  for (let x = 0; x < 16; x++) {
    const y = 12 - (x >> 1)
    set(g, x, y - 4, C.p4)
    set(g, x, y - 3, C.teal)
    if (x % 4 === 1) set(g, x, y + 1, C.rim)
    set(g, x, y + 4, C.rim)
  }
  rect(g, 0, 8, 2, 11, C.p0)
  return g
}

/** The near pillar: one dark shape that hides a passing rider, with a seam of its own. */
export function pillar(): Grid {
  const g = grid(20, 84)
  for (let y = 0; y < 84; y++) {
    for (let x = 0; x < 20; x++) {
      const flare = y < 10 ? 0 : 2
      if (x < flare || x > 19 - flare) continue
      const dy = x < 10 ? x >> 1 : (19 - x) >> 1
      if (y > 76 + (dy >> 1)) continue
      set(g, x, y, y === 0 ? C.p2 : y < 10 ? C.slab2 : x < 10 ? C.ink : C.slab)
    }
  }
  rect(g, 0, 9, 20, 1, C.void)
  for (let y = 10; y < 76; y++) set(g, 10, y, C.void)
  for (let y = 16; y < 40; y++) set(g, 6, y, C.deep)
  for (let k = 0; k < 4; k++) set(g, 6 - (k >> 1), 40 + k, C.deep)
  for (let y = 44; y < 58; y++) set(g, 5, y, C.deep)
  return g
}
export function pillarLit(): Grid {
  const g = grid(20, 66)
  for (let y = 10; y < 60; y++) set(g, 17, y, y % 3 === 0 ? INK.hot : INK.crimson)
  return g
}

/** A road tile under a headlight. */
export function wetTile(): Grid {
  const g = grid(34, 18)
  diamond(g, 16, 8, '#2A0F18', '#7A1E30')
  for (let k = 0; k < 14; k++) set(g, 8 + k, 7 + ((k * 5) % 3), k % 4 === 0 ? INK.hot : INK.crimson)
  return g
}

export function brokenRing(isCancelled: boolean): Grid {
  const g = grid(13, 13)
  const ink = isCancelled ? INK.steel : INK.crimson
  disc(g, 6, 6, 6, '#04070C')
  disc(g, 6, 6, 5, ink, 3)
  rect(g, 7, 0, 3, 4, '#04070C')
  rect(g, 2, 8, 3, 4, '#04070C')
  rect(g, 5, 5, 3, 3, isCancelled ? '#04070C' : INK.hot)
  return g
}

export { C as ROOM_INK, isFloor }
