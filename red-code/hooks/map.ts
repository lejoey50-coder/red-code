// The room's one layout: tiles, doors, station anchors, and how to walk between them.

import type { Clip, Face, Pose, Station, Tile } from '../types'

export const W = 256
export const H = 216
export const N = 7
/** What is shown: more sky and more building than the floor's own frame. */
export const VIEW = { y: -22, h: 256 } as const
const OX = 128
const OY = 80

/** Screen position of a tile's centre, where a sprite's feet stand. */
export function place([i, j]: Tile): [number, number] {
  const low = i >= N || j >= N ? 6 : 0
  return [OX + (i - j) * 16, OY + (i + j) * 8 + low]
}

const BLOCKED = new Set(['0,3', '0,4', '0,5', '5,0', '6,0', '5,1', '6,1', '4,1', '3,0', '4,0', '2,3', '0,0', '1,0', '0,1', '0,2', '0,6', '3,1', '4,3', '5,6'])
const PIER = new Set(['4,7', '4,8'])
const TRACK = new Set(['5,7', '6,7', '7,7', '7,6', '7,5'])
export const TRACK_TILES: Tile[] = [[5, 7], [6, 7], [7, 7], [7, 6], [7, 5]]
export const PIER_TILES: Tile[] = [[4, 7], [4, 8]]
const key = ([i, j]: Tile) => `${i},${j}`

export function isFloor(t: Tile): boolean {
  return t[0] >= 0 && t[1] >= 0 && t[0] < N && t[1] < N && !BLOCKED.has(key(t))
}
function isWalkable(t: Tile): boolean {
  return isFloor(t) || PIER.has(key(t)) || TRACK.has(key(t))
}

/** The platform's edge is a rail. Its doors: the pier gate at (4,6), the track gate at (6,5). */
function isOpen(a: Tile, b: Tile): boolean {
  const aIn = isFloor(a)
  const bIn = isFloor(b)
  if (aIn && bIn) return true
  if (!aIn && !bIn) return true
  const [inside, outside] = aIn ? [a, b] : [b, a]
  return (key(inside) === '4,6' && key(outside) === '4,7') || (key(inside) === '6,5' && key(outside) === '7,5')
}

const STEPS: Tile[] = [[-1, 0], [0, -1], [1, 0], [0, 1]]

/** The shortest walk, straight where it can be, off the track unless told to ride it. */
export function route(from: Tile, to: Tile, isRide = false): Tile[] {
  const start = { t: from, d: -1 }
  const came = new Map<string, { prev: string; t: Tile; d: number } | null>([[key(from), null]])
  const cost = new Map<string, number>([[key(from), 0]])
  const open: Array<{ t: Tile; d: number; c: number }> = [{ ...start, c: 0 }]
  while (open.length > 0) {
    open.sort((x, y) => x.c - y.c)
    const now = open.shift()
    if (!now) break
    if (key(now.t) === key(to)) break
    STEPS.forEach((s, d) => {
      const t: Tile = [now.t[0] + s[0], now.t[1] + s[1]]
      if (!isWalkable(t) || !isOpen(now.t, t)) return
      const onTrack = TRACK.has(key(t))
      const c = now.c + (onTrack ? (isRide ? 0.2 : 4) : 1) + (now.d >= 0 && now.d !== d ? 0.3 : 0)
      if (c < (cost.get(key(t)) ?? Infinity)) {
        cost.set(key(t), c)
        came.set(key(t), { prev: key(now.t), t, d })
        open.push({ t, d, c })
      }
    })
  }
  if (!came.has(key(to))) return [from, to]
  const path: Tile[] = [to]
  let at: string = key(to)
  for (;;) {
    const step = came.get(at)
    if (!step) break
    at = step.prev
    const [i = 0, j = 0] = at.split(',').map(Number)
    path.unshift([i, j])
  }
  return path
}

export function faceOf(from: Tile, to: Tile): Face {
  return to[0] > from[0] ? 'SE' : to[0] < from[0] ? 'NW' : to[1] > from[1] ? 'SW' : 'NE'
}

type Anchor = { at: Tile; face: Face; pose: Pose }
/** Where each address is worked from. The spare places are for a second and third Red Code. */
export const ANCHORS: Record<Station, Anchor[]> = {
  archive: [{ at: [1, 4], face: 'NW', pose: 'read' }, { at: [1, 5], face: 'NW', pose: 'read' }, { at: [1, 3], face: 'NW', pose: 'read' }],
  turbine: [{ at: [4, 2], face: 'NE', pose: 'lever' }, { at: [5, 2], face: 'NE', pose: 'lever' }, { at: [6, 2], face: 'NE', pose: 'lever' }],
  beacon: [{ at: [1, 1], face: 'NE', pose: 'wheel' }, { at: [2, 0], face: 'NW', pose: 'wheel' }, { at: [2, 1], face: 'NW', pose: 'wheel' }],
  console: [{ at: [3, 3], face: 'NW', pose: 'type' }, { at: [2, 4], face: 'NE', pose: 'type' }, { at: [3, 4], face: 'NW', pose: 'type' }],
  lift: [{ at: [2, 6], face: 'SE', pose: 'idle' }, { at: [2, 6], face: 'SE', pose: 'idle' }, { at: [2, 6], face: 'SE', pose: 'idle' }],
  rail: [{ at: [6, 3], face: 'SE', pose: 'lean' }, { at: [6, 2], face: 'SE', pose: 'lean' }, { at: [6, 4], face: 'SE', pose: 'lean' }],
  pier: [{ at: [4, 8], face: 'SW', pose: 'sit' }, { at: [4, 7], face: 'SW', pose: 'sit' }, { at: [4, 6], face: 'SW', pose: 'idle' }],
}
/** Side stations, one for each helper. */
export const SIDES: Tile[] = [[4, 5], [5, 4], [3, 5], [5, 5], [1, 6], [4, 4]]
export const LIFT: Tile = [2, 6]

/** The tile an actor is on, or is nearest to, at `now`. */
export function tileAt(clips: readonly Clip[], now: number): Tile {
  const c = clips.find(one => one.b === null || now < one.b) ?? clips[clips.length - 1]
  if (!c) return [4, 8]
  if (now < c.a || c.b === null) return now < c.a ? c.from : c.to
  const t = (now - c.a) / Math.max(1, c.b - c.a)
  const n = Math.max(Math.abs(c.to[0] - c.from[0]), Math.abs(c.to[1] - c.from[1]))
  const k = n === 0 ? 0 : Math.round(t * n) / n
  return [Math.round(c.from[0] + (c.to[0] - c.from[0]) * k), Math.round(c.from[1] + (c.to[1] - c.from[1]) * k)]
}

export function restOf(clips: readonly Clip[]): Clip | undefined {
  return clips[clips.length - 1]
}

type Trip = { now: number; cap: number; perTile?: number; isRide?: boolean; hold?: { pose: Pose; ms: number; face?: Face } }

/** The walk from wherever the actor is, ending without a resting clip. A long way is walked faster, never longer than `cap`. */
export function trip(clips: readonly Clip[], to: Tile, o: Trip): Clip[] {
  const from = tileAt(clips, o.now)
  const gate: Tile = [7, 6]
  const path = o.isRide ? [...route(from, gate, true), ...route(gate, to).slice(1)] : route(from, to)
  const out: Clip[] = []
  let t = o.now
  const second = path[1]
  if (o.hold) {
    out.push({ a: t, b: t + o.hold.ms, from, to: from, pose: o.hold.pose, face: o.hold.face ?? (second ? faceOf(from, second) : 'SE') })
    t += o.hold.ms
  }
  const steps = path.length - 1
  if (steps <= 0) return out
  const each = Math.min(o.perTile ?? 300, o.cap / steps)
  let k = 0
  while (k < steps) {
    const a = path[k]
    const b = path[k + 1]
    if (!a || !b) break
    const face = faceOf(a, b)
    const onTrack = TRACK.has(key(b)) || PIER.has(key(b)) || TRACK.has(key(a))
    let end = k + 1
    for (;;) {
      const p = path[end]
      const q = path[end + 1]
      if (!p || !q || faceOf(p, q) !== face || place(p)[1] - place(a)[1] !== slope(a, p) || place(q)[1] - place(p)[1] !== slope(p, q)) break
      end += 1
    }
    const last = path[end]
    if (!last) break
    const ms = Math.round(each * (end - k))
    out.push({ a: t, b: t + ms, from: a, to: last, pose: 'walk', face, ...(o.isRide && onTrack ? { ride: true } : {}) })
    t += ms
    k = end
  }
  return out
}
function slope(a: Tile, b: Tile): number {
  return (b[0] + b[1] - a[0] - a[1]) * 8
}

export function rest(clips: Clip[], at: Tile, face: Face, pose: Pose, now: number): Clip[] {
  const a = clips[clips.length - 1]?.b ?? now
  return [...clips, { a, b: null, from: at, to: at, pose, face }]
}
