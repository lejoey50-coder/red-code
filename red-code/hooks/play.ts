// The room you can play: a click on a clear floor tile walks Red Code there from wherever he is, by the
// floor's own routes round the furniture; the window, the chair and the hologram each do a thing of their
// own. A click outranks what the session would have him do, for a while after he gets there; then he goes
// back to the work, or, with nothing to do, picks something to do in the room by himself.
//
// The app tells a mod where a click landed as a fraction of the backdrop, not in pixels. The backdrop is
// pinned to its right and bottom edges and covers the window, so turning the fraction into the room's own
// pixels needs the window's shape: the engine's measure of it when there is one, else what /redcode size
// was told, else 16:10. The tower's size and place hang on the same shape, so the drawing and the click
// read the same numbers.

import { faceOf, isFloor, rest, route, tileAt } from './map'
import { RED } from './world'
import type { Actor, Clip, Face, Pose, Tile, World } from '../types'

// ---- where the tower stands, by the window's shape

/** From the widest band down: at least this wide for its height, the tower at this scale. */
export const BANDS: Array<{ min: number; ratio: string; s: number; widest: number }> = [
  { min: 2, ratio: '2/1', s: 0.78, widest: 2.4 },
  { min: 16 / 9, ratio: '16/9', s: 0.66, widest: 2 },
  { min: 1.6, ratio: '8/5', s: 0.58, widest: 16 / 9 },
  { min: 4 / 3, ratio: '4/3', s: 0.42, widest: 1.6 },
  { min: 0, ratio: '', s: 0.38, widest: 4 / 3 },
]

/** The tower's scale and offset in the scene for a window this many times as wide as it is high. */
export function placement(aspect: number): { s: number; tx: number; ty: number } {
  const band = BANDS.find(b => aspect >= b.min) ?? BANDS[BANDS.length - 1]!
  const s = band.s
  // A window wider than 16:9 shows the scene's full width and crops its top: keep the mast in view.
  const top = band.widest > 16 / 9 ? 360 - 640 / band.widest : 0
  return { s, tx: Math.round(640 - 250 * s), ty: Math.round(top + 6 + 34 * s) }
}

/** The CSS that puts the tower where `placement` says, band by band. */
export function placementCss(): string {
  const rule = (a: number) => {
    const p = placement(a)
    return `.tw{transform:translate(${p.tx}px,${p.ty}px) scale(${p.s})}`
  }
  return [...BANDS]
    .reverse()
    .map(b => (b.ratio === '' ? rule(0) : `@media (min-aspect-ratio:${b.ratio}){${rule(b.min)}}`))
    .join('')
}

/** A click's place in the room's own pixels. */
export function toRoom(fx: number, fy: number, aspect: number): [number, number] {
  const wide = aspect >= 16 / 9
  const x = wide ? fx * 640 : 640 - (1 - fx) * 360 * aspect
  const y = wide ? 360 - (1 - fy) * (640 / aspect) : fy * 360
  const p = placement(aspect)
  return [(x - p.tx) / p.s, (y - p.ty) / p.s]
}

// ---- what can be used

/** A corner of the floor grid, `z` up from the floor, in the room's pixels (building.ts's P). */
const P = (i: number, j: number, z = 0): [number, number] => [128 + (i - j) * 16, 72 + (i + j) * 8 - z]
/** The outline of a block standing on the floor, as seen. */
function outline(i0: number, j0: number, i1: number, j1: number, z: number): Array<[number, number]> {
  return [P(i0, j0, z), P(i1, j0, z), P(i1, j0, 0), P(i1, j1, 0), P(i0, j1, 0), P(i0, j1, z)]
}
/** The right wall's windows, left half and right half: which glass he goes to. */
const PANES = ([[5, 63], [69, 109]] as const).map(([a, b]): Array<[number, number]> => [
  [128 + a, 25 + a / 2], [128 + b, 25 + b / 2], [128 + b, 57 + b / 2], [128 + a, 57 + a / 2],
])

export type Thing = 'window' | 'chair' | 'hologram'
export const THINGS: Record<Thing, Array<Array<[number, number]>>> = {
  chair: [outline(3.12, 1.1, 3.88, 1.9, 15)],
  hologram: [outline(3.6, 2.6, 4.4, 3.4, 24)],
  window: PANES,
}

function inside(pt: [number, number], poly: Array<[number, number]>): boolean {
  let isIn = false
  for (let k = 0, m = poly.length - 1; k < poly.length; m = k++) {
    const [xi, yi] = poly[k]!
    const [xj, yj] = poly[m]!
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) isIn = !isIn
  }
  return isIn
}

export type Pick = { kind: 'tile'; tile: Tile } | { kind: Thing; pane?: number } | null

/** What a click in the room's pixels lands on: a thing first, then the nearest clear tile, else nothing. */
export function pick([x, y]: [number, number]): Pick {
  for (const kind of ['hologram', 'chair', 'window'] as const) {
    const pane = THINGS[kind].findIndex(poly => inside([x, y], poly))
    if (pane >= 0) return kind === 'window' ? { kind, pane } : { kind }
  }
  // The floor point under the click: tile centres stand at place([i, j]).
  const d = (x - 128) / 16
  const sum = (y - 80) / 8
  const fi = (sum + d) / 2
  const fj = (sum - d) / 2
  let best: Tile | null = null
  let far = 1.3
  for (let i = 0; i < 7; i++)
    for (let j = 0; j < 7; j++) {
      if (!isFloor([i, j])) continue
      const dist = Math.hypot(i - fi, j - fj)
      if (dist < far) {
        far = dist
        best = [i, j]
      }
    }
  return best ? { kind: 'tile', tile: best } : null
}

// ---- what a click does

/** How long a click outranks the session after he arrives. */
export const HOLD = 20000
const PER_TILE = 250

const swap = (w: World, fn: (a: Actor) => Actor): World => ({ ...w, actors: w.actors.map(a => (a.id === RED ? fn(a) : a)) })
const end = (clips: Clip[], now: number) => clips[clips.length - 1]?.b ?? now

/** The walk from where he is right now: he turns at once onto the new way. */
function walk(a: Actor, to: Tile, now: number): Clip[] {
  const from = tileAt(a.clips, now)
  const path = route(from, to)
  const out: Clip[] = []
  let t = now
  for (let k = 0; k + 1 < path.length; k++) {
    const p = path[k]!
    const q = path[k + 1]!
    out.push({ a: t, b: t + PER_TILE, from: p, to: q, pose: 'walk', face: faceOf(p, q) })
    t += PER_TILE
  }
  return out
}

function after(w: World, a: Actor, clips: Clip[], doing: string, now: number): World {
  return { ...swap(w, () => ({ ...a, clips, doing, doingAt: now })), userUntil: end(clips, now) + HOLD }
}

/** Walk to a tile and stand there, facing the way he came. */
export function goTo(w: World, tile: Tile, now: number): World {
  const a = w.actors.find(x => x.id === RED)
  if (!a) return w
  const way = walk(a, tile, now)
  const face = way[way.length - 1]?.face ?? restFace(a)
  return after(w, a, rest(way, tile, face, 'idle', now), 'Walking where you asked', now)
}

/** The chair: over to it, a turn to face the window, a step in, and down. */
export function sit(w: World, now: number): World {
  const a = w.actors.find(x => x.id === RED)
  if (!a) return w
  const front: Tile = [3, 2]
  const seat: Tile = [3, 1]
  const way = walk(a, front, now)
  let t = end(way, now)
  way.push({ a: t, b: t + 280, from: front, to: front, pose: 'idle', face: 'NE' })
  t += 280
  way.push({ a: t, b: t + PER_TILE, from: front, to: seat, pose: 'walk', face: 'NE' })
  return after(w, a, rest(way, seat, 'NE', 'sit', now), 'In the chair, looking out', now)
}

/** The window: to the glass nearest the pane clicked, and lean there looking out. */
export function lookOut(w: World, pane: number, now: number): World {
  const a = w.actors.find(x => x.id === RED)
  if (!a) return w
  const spot: Tile = pane === 0 ? [2, 0] : [6, 2]
  const way = walk(a, spot, now)
  return after(w, a, rest(way, spot, 'NE', 'lean', now), 'At the window', now)
}

/** The hologram: to its panel, and work it; it turns faster and brighter while he does. */
export function tend(w: World, now: number): World {
  const a = w.actors.find(x => x.id === RED)
  if (!a) return w
  const spot: Tile = [4, 4]
  const way = walk(a, spot, now)
  const there = end(way, now)
  return { ...after(w, a, rest(way, spot, 'NE', 'type', now), 'Working the hologram', now), holoBoost: there + 8000 }
}

function restFace(a: Actor): Face {
  return a.clips[a.clips.length - 1]?.face ?? 'SE'
}

/** True while a click still outranks the session. */
export const isHeld = (w: World, now: number) => (w.userUntil ?? 0) > now

// ---- left alone: something to do in the room

const IDLE: Array<(w: World, now: number) => World> = [
  (w, now) => sit(w, now),
  (w, now) => lookOut(w, 0, now),
  (w, now) => lookOut(w, 1, now),
  (w, now) => tend(w, now),
]
/** After a quiet spell with no click, he picks something to do; the pick lasts a while. */
export function idle(w: World, now: number): World {
  const a = w.actors.find(x => x.id === RED)
  const isQuiet = w.turn === null && !w.isWaking && w.ops.length === 0 && w.waits.length === 0 && !w.actors.some(x => x.kind === 'helper')
  if (!a || !isQuiet || isHeld(w, now) || now - Math.max(a.doingAt, w.userUntil ?? 0) < 45000) return w
  const choose = IDLE[Math.floor(now / 1000) % IDLE.length]!
  const next = choose(w, now)
  // A pick he makes himself does not hold off the session.
  return { ...next, userUntil: w.userUntil ?? 0, actors: next.actors.map(x => (x.id === RED ? { ...x, doing: `Idle · ${x.doing.toLowerCase()}` } : x)) }
}

// ---- the chat, seen from the room

/** You started typing: he looks up from where he is, turned toward you. */
export function noticed(w: World, now: number): World {
  const a = w.actors.find(x => x.id === RED)
  if (!a || isHeld(w, now) || w.turn !== null) return { ...w, typingAt: now }
  const here = tileAt(a.clips, now)
  const pose: Pose = a.clips[a.clips.length - 1]?.pose === 'sit' ? 'sit' : 'idle'
  return { ...swap(w, x => ({ ...x, clips: rest([], here, 'SE', pose, now), doing: 'Listening', doingAt: now })), typingAt: now }
}

/** Claude finished: a short cheer where he stands before he rests. */
export function cheer(w: World, now: number): World {
  const a = w.actors.find(x => x.id === RED)
  if (!a || isHeld(w, now)) return w
  const last = a.clips[a.clips.length - 1]
  if (!last) return w
  const at = last.b === null ? Math.max(now, last.a) : last.b
  const head = last.b === null ? a.clips.slice(0, -1) : a.clips
  const clips: Clip[] = [...head, { a: at, b: at + 1100, from: last.to, to: last.to, pose: 'raise', face: 'SE' }]
  return swap(w, x => ({ ...x, clips: [...clips, ...shift(x.clips.slice(-1), at + 1100)] }))
}
/** The resting clip, moved to start after the cheer. */
function shift(clips: Clip[], at: number): Clip[] {
  return clips.map(c => ({ ...c, a: Math.max(c.a, at) }))
}

/** You stopped the reply: the hologram powers down for a while. */
export function stopped(w: World, now: number): World {
  return { ...w, holoDown: now, holoBoost: 0 }
}

/** How long the hologram stays down after a Stop. */
export const HOLO_DOWN = 14000

export function hoverCss(): string {
  return 'svg *{pointer-events:none}.hot{fill:#4FE0F2;fill-opacity:0;stroke:#4FE0F2;stroke-opacity:0;stroke-width:1;pointer-events:all;cursor:pointer;transition:fill-opacity .25s,stroke-opacity .25s}.hot:hover{fill-opacity:.1;stroke-opacity:.55}'
}

/** Hover shapes over the three things you can use, in the room's pixels; drawn last, so they take the hover. */
export function hotspots(): string {
  const shape = (polys: Array<Array<[number, number]>>) => polys.map(p => `M${p.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join('L')}z`).join('')
  return (['window', 'chair', 'hologram'] as const).map(k => `<path class="hot" d="${shape(THINGS[k])}"/>`).join('')
}

/** Where on the backdrop, as fractions, a point in the room's pixels is drawn: `toRoom` backwards. */
export function toFraction([hx, hy]: [number, number], aspect: number): [number, number] {
  const p = placement(aspect)
  const x = hx * p.s + p.tx
  const y = hy * p.s + p.ty
  const wide = aspect >= 16 / 9
  return wide ? [x / 640, 1 - (360 - y) / (640 / aspect)] : [1 - (640 - x) / (360 * aspect), y / 360]
}

/** A click on the backdrop at (fx, fy), for a window of this shape: what it does to the room. */
export function click(w: World, fx: number, fy: number, aspect: number, now: number): World {
  const hit = pick(toRoom(fx, fy, aspect))
  if (hit === null) return w
  if (hit.kind === 'tile') return goTo(w, hit.tile, now)
  if (hit.kind === 'chair') return sit(w, now)
  if (hit.kind === 'hologram') return tend(w, now)
  return lookOut(w, hit.pane ?? 0, now)
}
