// The building, cut away to show one room: the city behind it, its walls and roof, the storeys below, and the furniture.

import { diamond, disc, get, grid, line, poly, rect, set } from './pixels'
import type { Grid } from './pixels'
import { H, N, PIER_TILES, TRACK_TILES, VIEW, W, place } from './map'
import { ROOM_INK as C, hash, wallBase } from './room'

const UP = -VIEW.y
/** A corner of the floor grid (0 to 7 each way), `z` up from the floor. */
const P = (i: number, j: number, z = 0): readonly [number, number] => [128 + (i - j) * 16, 72 + (i + j) * 8 - z]

/** A block with three faces showing. */
function box(g: Grid, i0: number, j0: number, i1: number, j1: number, z0: number, z1: number, top: string, left: string, right: string): void {
  poly(g, [P(i0, j1, z1), P(i1, j1, z1), P(i1, j1, z0), P(i0, j1, z0)], left)
  poly(g, [P(i1, j1, z1), P(i1, j0, z1), P(i1, j0, z0), P(i1, j1, z0)], right)
  poly(g, [P(i0, j0, z1), P(i1, j0, z1), P(i1, j1, z1), P(i0, j1, z1)], top)
}

// ---- outside

/** A train on the far line: a bright nose and a tail that thins. */
export function train(ink: string): Grid {
  const g = grid(52, 4)
  rect(g, 0, 1, 14, 1, C.deep)
  for (let x = 2; x < 14; x += 3) set(g, x, 1, ink)
  rect(g, 14, 0, 34, 2, ink)
  for (let x = 16; x < 46; x += 6) rect(g, x, 0, 4, 1, '#FFFFFF')
  rect(g, 48, 0, 3, 2, '#FFFFFF')
  return g
}

// ---- the shell

function floorInk(i: number, j: number): string {
  // i and j run 0 to 7 across the floor.
  const lo = 0.95
  const hi = 6.05
  const r = 1.15
  const qx = Math.max(lo + r - i, i - (hi - r), 0)
  const qy = Math.max(lo + r - j, j - (hi - r), 0)
  const out = Math.hypot(qx, qy) - r
  const inset = Math.min(i - lo, hi - i, j - lo, hi - j)
  const depth = qx > 0 && qy > 0 ? -out : inset
  if (depth > 0) {
    const cut = Math.min(...[1.95, 5.05].map(c => Math.min(Math.abs(i - c), Math.abs(j - c))))
    if (depth < 0.1) return C.g0
    if (cut < 0.055) return C.g0
    const e = Math.min(depth, cut)
    if (e < 0.16) return C.g1
    if (e < 0.32) return C.g2
    const mid = Math.hypot(i - 3.5, j - 3.5)
    return e < 0.7 || mid > 2.3 ? C.g3 : C.g4
  }
  if (depth > -0.14) return C.f0
  // Lit lines let into the gloss: from the shelves round to the core, and out to both doors.
  if (Math.abs(i - 0.62) < 0.035 || Math.abs(j - 6.38) < 0.035 || Math.abs(i - 6.38) < 0.035) return C.teal
  const a = Math.abs((i + 0.02) % 1.75)
  const b = Math.abs((j + 0.02) % 1.75)
  if (a < 0.06 || b < 0.06) return C.f0
  return depth > -0.34 ? C.f3 : depth > -0.6 ? C.f2 : C.f1
}

const WALL = 58

/** The storeys under this floor: dark cladding, rows of windows, some of them lit. */
function storeys(g: Grid): void {
  for (let x = 16; x < 240; x++) {
    const isLeft = x < 128
    const u = isLeft ? x - 16 : 239 - x
    const top = 128 + (u >> 1)
    for (let k = 11; k < 50; k++) {
      const row = Math.floor((k - 13) / 18)
      const v = (k - 13) - row * 18
      const col = Math.floor(u / 14)
      const p = u % 14
      let c = isLeft ? C.ink : C.slab
      if (k < 13 || v === 16) c = isLeft ? C.slab2 : C.edge
      else if (v === 17) c = C.void
      else if (p > 2 && p < 12 && v > 3 && v < 14) {
        const n = hash(col + (isLeft ? 3 : 41), row + 7) % 9
        const lit = n < 2 ? '#6FB9C2' : n < 4 ? '#2A7585' : n === 4 ? C.ember : C.deep
        const isSill = v === 13 || p === 3
        c = isSill ? C.void : v === 4 ? C.rim : n < 5 ? lit : '#0A161C'
        // Someone's shelf, or a lamp, in the lit ones.
        if (n < 4 && !isSill && v > 9 && p > 6) c = C.deep
      }
      if (u > 107) c = u === 109 ? C.cyan : isLeft ? C.slab : C.slab2
      if (u === 56 && k > 14) c = C.teal
      set(g, x, top + k, c)
    }
    for (let k = 50; k < 53; k++) set(g, x, top + k, k === 50 ? C.teal : C.void)
  }
}

/** A window in the right wall: is (u, v) inside its glass, on its frame, or neither? */
function windowAt(u: number, v: number): 'glass' | 'frame' | 'none' {
  for (const [a, b] of [[5, 31], [37, 63], [69, 91], [97, 109]] as const) {
    if (u < a - 2 || u > b + 2 || v < 12 || v > 48) continue
    const dx = Math.min(u - a, b - u)
    const dy = Math.min(v - 14, 46 - v)
    const isCorner = dx + dy < 4
    if (dx >= 0 && dy >= 0 && !isCorner) return 'glass'
    if (dx >= -2 && dy >= -2 && dx + dy >= 0) return 'frame'
  }
  return 'none'
}

/** Storeys, landing, road, floor and walls. Transparent through the windows and outside. */
export function shell(): Grid {
  const g = grid(W, VIEW.h)
  storeys(g)

  // The landing and the road, held off the building on posts.
  for (const [px, py] of [[50, 188], [64, 195], [78, 188], [128, 200], [172, 194]] as const) {
    rect(g, px, py, 4, 50, C.ink)
    rect(g, px + 3, py, 1, 50, C.edge)
  }
  for (const t of [...TRACK_TILES, ...PIER_TILES]) {
    const [x, y] = place(t)
    diamond(g, x, y + 5, C.void)
    diamond(g, x, y + 3, C.slab)
  }
  for (const t of TRACK_TILES) {
    const [x, y] = place(t)
    diamond(g, x, y, '#0B0F14', '#1A1016')
  }
  for (const t of TRACK_TILES) {
    const [x, y] = place(t)
    const alongI = t[1] === 7
    for (let k = -15; k < 15; k += 1) {
      const sx = x + k
      const sy = y + (alongI ? k >> 1 : -(k >> 1))
      if (get(g, sx, sy + 5) !== '') set(g, sx, sy + 5, C.red)
      if (get(g, sx, sy - 5) !== '') set(g, sx, sy - 5, C.ember)
      if (((k + 16) >> 2) % 2 === 0 && get(g, sx, sy) !== '') set(g, sx, sy, C.coal)
    }
  }
  for (const t of PIER_TILES) {
    const [x, y] = place(t)
    diamond(g, x, y, '#131C23', '#22303A')
  }
  {
    const [x, y] = place([4, 8])
    diamond(g, x, y, C.ember, undefined, 3)
    diamond(g, x, y, '#1B1217', undefined, 4)
  }

  // This floor's own slab, with one bright seam.
  for (let x = 16; x < 128; x++) {
    const y = 128 + ((x - 16) >> 1)
    for (let k = 0; k < 11; k++) set(g, x, y + k, k === 3 ? C.ice : k === 4 ? C.teal : k > 8 ? C.void : C.slab)
  }
  for (let x = 128; x < 240; x++) {
    const y = 128 + ((239 - x) >> 1)
    for (let k = 0; k < 11; k++) set(g, x, y + k, k === 3 ? '#FFFFFF' : k === 4 ? C.cyan : k > 8 ? C.void : C.slab2)
  }

  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const [cx, cy] = place([i, j])
      for (let r = 0; r < 16; r++) {
        const half = 2 * Math.min(r, 15 - r) + 1
        for (let x = cx - half; x < cx + half; x++) {
          const y = cy - 8 + r
          const a = (x + 0.5 - 128) / 16
          const b = (y + 0.5 - 80) / 8
          set(g, x, y, floorInk((a + b) / 2 + 0.5, (b - a) / 2 + 0.5))
        }
      }
    }
  // Where the front-left wall was cut: a low stub, open at the landing door.
  for (let x = 16; x < 128; x++) {
    if (x >= 80 && x < 96) continue
    const y = 128 + ((x - 16) >> 1)
    for (let k = 0; k < 4; k++) set(g, x, y - 1 - k, k === 3 ? C.p1 : C.slab2)
  }

  // Left wall: large stone.
  for (let x = 16; x < 128; x++) {
    const u = 127 - x
    const b = wallBase(x)
    for (let v = 0; v < WALL; v++) {
      const T = 14
      const course = Math.floor(v / T)
      const shift = (hash(course, 13) % 14) + u
      const n = 22 + (hash(course, 17) % 13)
      const block = Math.floor(shift / n)
      const tone = hash(block * 3 + 1, course * 5 + 2) % 5
      const isSeam = v % T === 0 || shift % n === 0
      const isLip = v % T === T - 1 && tone > 1
      set(g, x, b - 1 - v, isSeam ? C.s0 : isLip ? C.s4 : [C.s1, C.s2, C.s2, C.s3, C.s1][tone] ?? C.s2)
      const p = shift % n
      const q = v % T
      if (tone !== 1 && p > 4 && p < n - 8 && q > 3 && q < 10) set(g, x, b - 1 - v, q === 9 ? C.s4 : q === 4 || p === 5 ? C.s0 : tone === 3 ? C.s1 : C.s3)
    }
    set(g, x, b - 2, C.p0)
    set(g, x, b - 1, C.g0)
  }
  // Right wall: white panels and tall windows with rounded corners.
  for (let x = 128; x < 240; x++) {
    const u = x - 128
    const b = 72 + (u >> 1)
    for (let v = 0; v < WALL; v++) {
      const is = windowAt(u, v)
      if (is === 'glass') {
        // Two glints to a pane, and the rest is the city.
        if ((u + v * 2) % 53 === 0 || (u + v * 2) % 53 === 1) set(g, x, b - 1 - v, '#2B5660')
        continue
      }
      let c: string = is === 'frame' ? C.p3 : v < 10 ? C.p0 : C.p1
      if (is === 'none' && v === 10) c = C.ice
      if (is === 'none' && (u === 34 || u === 66 || u === 94) && v > 13 && v < 47) c = C.cyan
      if (is === 'none' && v < 10 && u % 16 === 3) c = C.slab2
      if (v < 10 && v > 3 && u % 16 > 8 && u % 16 < 13 && v % 2 === 0) c = C.slab2
      set(g, x, b - 1 - v, c)
    }
    set(g, x, b - 1, C.g0)
  }
  // The corner, lit.
  rect(g, 127, 14, 2, 58, '#FFFFFF')
  rect(g, 126, 14, 1, 58, C.teal)
  rect(g, 129, 14, 1, 58, C.p3)
  // The cut ends of both walls.
  poly(g, [P(0, 7, WALL), P(-0.35, 7, WALL), P(-0.35, 7, 0), P(0, 7, 0)], C.p0)
  poly(g, [P(7, 0, WALL), P(7, -0.35, WALL), P(7, -0.35, 0), P(7, 0, 0)], C.p0)
  for (const z of [14, 28, 42]) {
    poly(g, [P(0, 7, z + 1), P(-0.35, 7, z + 1), P(-0.35, 7, z), P(0, 7, z)], C.slab)
    poly(g, [P(7, 0, z + 1), P(7, -0.35, z + 1), P(7, -0.35, z), P(7, 0, z)], C.slab)
  }
  return g
}

/** A patch of the left wall, `u` along from the corner and `v` up. */
function onLeft(g: Grid, u: number, v: number, w: number, h: number, c: string): void {
  for (let a = u; a < u + w; a++) for (let k = v; k < v + h; k++) set(g, 127 - a, wallBase(127 - a) - 1 - k, c)
}
function onRight(g: Grid, u: number, v: number, w: number, h: number, c: string): void {
  for (let a = u; a < u + w; a++) for (let k = v; k < v + h; k++) set(g, 128 + a, 72 + (a >> 1) - 1 - k, c)
}

/** What hangs on the walls and stands against them. */
export function decor(g: Grid): void {
  // Pipes and a cable tray along the top of the stone.
  onLeft(g, 2, 47, 108, 2, C.p0)
  onLeft(g, 2, 48, 108, 1, C.p1)
  onLeft(g, 2, 44, 108, 1, C.slab2)
  for (let u = 12; u < 108; u += 24) onLeft(g, u, 43, 3, 7, C.slab2)

  // The big wall screen.
  onLeft(g, 7, 19, 30, 22, C.p1)
  onLeft(g, 8, 20, 28, 20, C.slab)
  onLeft(g, 9, 21, 26, 18, '#0B2730')
  // Neon: three bars and a ring, no words.
  onLeft(g, 41, 18, 2, 22, C.red)
  onLeft(g, 41, 18, 2, 1, C.amber)
  onLeft(g, 41, 39, 2, 1, C.amber)
  // At the far end, a vent, a lamp and a panel of switches.
  onLeft(g, 98, 8, 11, 30, C.slab2)
  for (let v = 10; v < 22; v += 3) onLeft(g, 100, v, 7, 1, C.void)
  onLeft(g, 100, 27, 7, 8, C.void)
  for (let k = 0; k < 6; k++) onLeft(g, 101 + (k % 3) * 2, 29 + (k >> 1 & 1) * 3, 1, 1, [C.cyan, C.red, C.amber][k % 3] ?? C.cyan)

  // Between the windows: status lights and a ring clock.
  for (const u of [33, 65, 93]) for (let v = 2; v < 8; v += 2) onRight(g, u, v, 2, 1, v === 4 ? C.red : C.cyan)
  disc(g, 162, 46, 4, C.slab, 0)
  disc(g, 162, 46, 4, C.p4, 2)
  set(g, 162, 46, C.red)
  set(g, 162, 45, C.red)
  set(g, 163, 46, C.red)

  // Sofa under the screen, with light beneath it.
  box(g, 0.2, 1.05, 0.85, 2.95, 0, 2, C.cyan, C.cyan, C.ice)
  box(g, 0.12, 1.0, 0.92, 3.0, 2, 7, C.p2, C.p0, C.p1)
  box(g, 0.08, 1.0, 0.34, 3.0, 7, 15, C.p4, C.p1, C.p3)
  box(g, 0.34, 1.0, 0.92, 1.2, 7, 10, C.p4, C.p1, C.p2)
  box(g, 0.34, 2.8, 0.92, 3.0, 7, 10, C.p4, C.p1, C.p2)
  line(g, ...P(0.34, 2, 7), ...P(0.92, 2, 7), C.p1)
  poly(g, [P(0.4, 1.35, 9), P(0.62, 1.35, 9), P(0.62, 1.7, 9), P(0.4, 1.7, 9)], C.red)

  // An arcade cabinet in the corner.
  box(g, 0.12, 0.12, 0.72, 0.72, 0, 9, C.slab2, C.ink, C.slab)
  box(g, 0.12, 0.12, 0.46, 0.72, 9, 25, C.slab2, C.ink, C.slab)
  poly(g, [P(0.46, 0.64, 20), P(0.46, 0.2, 20), P(0.46, 0.2, 12), P(0.46, 0.64, 12)], '#0F3A45')
  poly(g, [P(0.46, 0.7, 24), P(0.46, 0.14, 24), P(0.46, 0.14, 21), P(0.46, 0.7, 21)], C.red)
  for (const [i, j, c] of [[0.58, 0.55, C.amber], [0.58, 0.35, C.cyan]] as const) set(g, Math.round(P(i, j, 10)[0]), Math.round(P(i, j, 10)[1]), c)

  // A lit tank under the windows; its fish are drawn over it.
  box(g, 2.95, 0.1, 4.95, 0.5, 0, 5, C.p2, C.p0, C.p1)
  box(g, 3.0, 0.14, 4.9, 0.46, 5, 17, '#1B6E7C', '#0E4551', '#13596A')
  poly(g, [P(3.0, 0.46, 17), P(4.9, 0.46, 17), P(4.9, 0.46, 15.5), P(3.0, 0.46, 15.5)], C.ice)
  for (const [a, n] of [[3.2, 6], [3.3, 4], [4.1, 7], [4.6, 4], [4.7, 6]] as const) poly(g, [P(a, 0.46, 5 + n), P(a + 0.07, 0.46, 5 + n), P(a + 0.07, 0.46, 5), P(a, 0.46, 5)], '#2E9E77')

  // An arc lamp that leans over the sofa.
  box(g, 0.92, 3.0, 1.12, 3.2, 0, 2, C.p2, C.p0, C.p1)
  rect(g, 95, 72, 1, 31, C.p3)
  for (const [x, y] of [[96, 69], [97, 67], [99, 65], [101, 64], [103, 64], [105, 65], [107, 67]] as const) rect(g, x, y, 2, 2, C.p3)
  rect(g, 105, 69, 7, 3, C.p4)
  rect(g, 106, 72, 5, 1, '#FFFFFF')

  // A low chair that looks out of the window.
  box(g, 3.3, 1.3, 3.7, 1.7, 0, 3, C.slab, C.void, C.slab)
  box(g, 3.18, 1.15, 3.82, 1.8, 3, 7, C.p2, C.p0, C.p1)
  box(g, 3.18, 1.62, 3.82, 1.85, 7, 15, C.p4, C.p2, C.p3)
  box(g, 3.18, 1.15, 3.3, 1.62, 7, 10, C.p4, C.p2, C.p3)
  box(g, 3.7, 1.15, 3.82, 1.62, 7, 10, C.p4, C.p2, C.p3)

  // A plant in a lit tube, at the end of the shelves.
  box(g, 0.05, 6.28, 0.71, 6.94, 0, 5, C.p2, C.p0, C.p1)
  rect(g, 22, 95, 13, 27, '#0C3036')
  rect(g, 22, 95, 1, 27, C.teal)
  rect(g, 34, 95, 1, 27, C.cyan)
  for (let y = 98; y < 122; y++) set(g, 28, y, '#2E9E77')
  for (const [x, y, n] of [[24, 100, 4], [29, 103, 4], [25, 107, 3], [29, 110, 4], [24, 113, 4], [29, 116, 3]] as const) {
    rect(g, x, y, n, 2, '#5CE0A0')
    rect(g, x + (x < 28 ? 0 : n - 1), y - 1, 1, 1, '#B8FFD9')
    rect(g, x, y + 2, n - 1, 1, '#2E9E77')
  }
  rect(g, 21, 92, 15, 3, C.p2)
  rect(g, 21, 92, 15, 1, C.p4)
  rect(g, 21, 121, 15, 2, C.p1)
}

/** What is left of the roof, over both walls, with what stands on it. */
export function roof(): Grid {
  const g = grid(W, 170)
  // Drawn lower by UP, so the mast has room above it.
  const z = WALL + 4 - UP
  const d = 0.7
  const LIP = 5
  // The undersides' edge, then the light under it, then the top.
  poly(g, [P(d, 7, z), P(d, d, z), P(d, d, z - LIP), P(d, 7, z - LIP)], C.slab)
  poly(g, [P(d, d, z), P(7, d, z), P(7, d, z - LIP), P(d, d, z - LIP)], C.slab2)
  poly(g, [P(d, 7, z - LIP + 1), P(d, d, z - LIP + 1), P(d, d, z - LIP), P(d, 7, z - LIP)], '#FFFFFF')
  poly(g, [P(d, d, z - LIP + 1), P(7, d, z - LIP + 1), P(7, d, z - LIP), P(d, d, z - LIP)], '#FFFFFF')
  poly(g, [P(-0.35, 7, z), P(d, 7, z), P(d, 7, z - LIP), P(-0.35, 7, z - LIP)], C.edge)
  poly(g, [P(7, d, z), P(7, -0.35, z), P(7, -0.35, z - LIP), P(7, d, z - LIP)], C.edge)
  poly(g, [P(-0.35, -0.35, z), P(d, d, z), P(d, 7, z), P(-0.35, 7, z)], '#18252E')
  poly(g, [P(-0.35, -0.35, z), P(7, -0.35, z), P(7, d, z), P(d, d, z)], '#1E2D37')
  line(g, ...P(d, 7, z), ...P(d, d, z), C.rim)
  line(g, ...P(d, d, z), ...P(7, d, z), C.rim)
  // Plant, vents and a lit sign on the roof.
  box(g, -0.15, 5.2, 0.45, 6.4, z, z + 7, C.edge, C.slab, C.slab2)
  poly(g, [P(0.45, 6.2, z + 5), P(0.45, 5.4, z + 5), P(0.45, 5.4, z + 2), P(0.45, 6.2, z + 2)], C.void)
  box(g, -0.1, 3.4, 0.35, 4.2, z, z + 4, C.edge, C.slab, C.slab2)
  box(g, -0.1, 1.6, 0.35, 2.4, z, z + 10, C.edge, C.slab, C.slab2)
  poly(g, [P(0.35, 2.25, z + 8), P(0.35, 1.75, z + 8), P(0.35, 1.75, z + 3), P(0.35, 2.25, z + 3)], C.ember)
  for (const [a, b] of [[2.2, 3], [3.2, 3.5], [3.7, 4.9]] as const) for (const k of [3, 6, 9]) poly(g, [P(a, 0.1, z + k + 2), P(b, 0.1, z + k + 2), P(b, 0.1, z + k), P(a, 0.1, z + k)], k === 6 ? C.amber2 : C.red)
  poly(g, [P(2.1, 0.12, z + 2), P(5, 0.12, z + 2), P(5, 0.12, z), P(2.1, 0.12, z)], C.slab)
  box(g, 5.6, -0.15, 6.5, 0.4, z, z + 6, C.edge, C.slab, C.slab2)
  // Mast on the corner.
  const [mx, my] = P(0.1, 0.1, z).map(Math.round) as [number, number]
  rect(g, mx - 1, my - 19, 3, 19, C.slab2)
  rect(g, mx + 1, my - 19, 1, 19, C.rim)
  rect(g, mx - 5, my - 12, 11, 1, C.rim)
  rect(g, mx - 3, my - 16, 7, 1, C.rim)
  rect(g, mx - 1, my - 21, 3, 2, C.red)

  // Pendant tubes under the left edge.
  for (const [u, n] of [[52, 9], [56, 13], [60, 8], [78, 8], [82, 12], [86, 9]] as const) {
    const x = 139 - u
    const y = wallBase(127 - u) - WALL + 7 + UP
    rect(g, x, y, 1, 3, C.rim)
    rect(g, x - 1, y + 3, 2, n - 3, C.ice)
    rect(g, x - 1, y + n - 1, 2, 1, '#FFFFFF')
  }
  return g
}

// ---- parts that move, or that someone can stand behind

/** The wall screen's picture, in three frames. */
export function screen(frame: number): Grid {
  const g = grid(W, H)
  for (let k = 0; k < 6; k++) onLeft(g, 11 + k * 4, 23, 2, 3 + ((k * 5 + frame * 4) % 11), k === 3 ? C.red : C.cyan)
  onLeft(g, 11, 37 - frame, 14 + frame * 3, 1, C.ice)
  // Two fish, and where they have got to.
  for (const [i, z, c] of [[3.2 + frame * 0.2, 8, C.red], [3.6 - frame * 0.2, 12, C.amber]] as const) {
    const [x, y] = P(i, 0.46, z).map(Math.round) as [number, number]
    rect(g, x, y, 3, 1, c)
    set(g, x + (c === C.red ? -1 : 3), y, c)
  }
  return g
}

/** The arcade's screen, awake. */
export function arcade(frame: number): Grid {
  const g = grid(W, H)
  const at = (j: number, z: number, c: string) => { const [x, y] = P(0.46, j, z); set(g, Math.round(x), Math.round(y), c) }
  at(0.55 - frame * 0.12, 17, C.ice)
  at(0.3 + frame * 0.1, 15, C.red)
  at(0.4, 14, C.cyan)
  return g
}

/** The projector, and the globe it holds up: four turns of it. */
export function projector(): Grid {
  const g = grid(36, 48)
  diamond(g, 18, 38, C.slab2, C.p1, 3)
  diamond(g, 18, 36, C.slab, C.cyan, 4)
  rect(g, 17, 34, 2, 2, '#FFFFFF')
  return g
}
export function globe(frame: number): Grid {
  const g = grid(36, 48)
  const R = 11
  disc(g, 18, 16, R, '#0D3A45')
  disc(g, 17, 15, R - 4, '#124C59')
  for (let y = -R; y <= R; y++) {
    const half = Math.sqrt(R * R - y * y)
    set(g, 18 + Math.round(half), 16 + y, C.cyan)
    set(g, 18 - Math.round(half), 16 + y, C.cyan)
    for (let m = 0; m < 3; m++) {
      const a = ((m * 60 + frame * 15) * Math.PI) / 180
      const x = Math.round(Math.cos(a) * half)
      if ((y + m) % 2 === 0) set(g, 18 + x, 16 + y, C.teal)
    }
  }
  for (const y of [-6, 0, 6]) {
    const half = Math.round(Math.sqrt(R * R - y * y))
    for (let x = -half; x <= half; x += 2) set(g, 18 + x, 16 + y + (Math.abs(x) < half * 0.7 ? 1 : 0), y === 0 ? C.ice : C.teal)
  }
  set(g, 18 + [5, 8, 3, -4][frame]!, 13, C.red)
  for (let k = 0; k < 4; k++) for (const s of [-1, 1]) set(g, 18 + s * (2 + k * 2), 33 - k, C.teal)
  return g
}

/** A low planter by the landing door. */
export function planter(): Grid {
  const g = grid(W, H)
  box(g, 5.12, 6.15, 5.88, 6.8, 0, 6, '#16352C', C.p0, C.p2)
  const [x, y] = P(5.5, 6.48, 6).map(Math.round) as [number, number]
  for (const [dx, n] of [[-7, 5], [-4, 8], [-1, 6], [2, 10], [5, 7], [8, 4]] as const) {
    for (let k = 0; k < n; k++) set(g, x + dx + (k > 4 ? Math.sign(dx) : 0), y - k, k > n - 3 ? '#B8FFD9' : '#5CE0A0')
    set(g, x + dx + 1, y - (n >> 1), '#2E9E77')
  }
  return g
}

/** A doorway in the cut wall: two short lit jambs. `isLeft` for the landing's, else the road's. */
export function doorway(isLeft: boolean): Grid {
  const g = grid(W, H)
  const ink = isLeft ? C.cyan : C.red
  for (const [x, y] of isLeft ? [P(4, 7), P(5, 7)] : [P(7, 6), P(7, 5)]) {
    rect(g, x - 2, y - 13, 5, 14, C.void)
    rect(g, x - 1, y - 12, 3, 13, C.slab2)
    rect(g, x - 1, y - 12, 3, 2, ink)
    rect(g, x + (isLeft ? 1 : -1), y - 9, 1, 9, ink)
  }
  return g
}
/** A small drone that looks in on things. */
export function drone(): Grid {
  const g = grid(13, 10)
  rect(g, 1, 1, 3, 1, C.p1)
  rect(g, 9, 1, 3, 1, C.p1)
  rect(g, 2, 2, 1, 2, C.rim)
  rect(g, 10, 2, 1, 2, C.rim)
  rect(g, 2, 3, 9, 3, C.void)
  rect(g, 3, 3, 7, 2, C.p3)
  rect(g, 4, 5, 5, 2, C.slab2)
  rect(g, 6, 5, 2, 1, C.red)
  rect(g, 6, 7, 2, 1, C.cyan)
  return g
}
