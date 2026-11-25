// The sprite sheet, as source. Every body is built from parts on a 16 x 24 grid,
// feet at (8, 23), so one change to a part reaches every pose and facing.

import { get, grid, mirror, paths, set as dot, stamp as print } from './pixels'
import type { Grid } from './pixels'
import type { Face, Pose } from '../types'

export const INK = {
  water: '#090F19',
  platform: '#182532',
  steel: '#526579',
  sail: '#CCD8D8',
  crimson: '#EE344D',
  hot: '#FF9295',
  amber: '#FFC36A',
} as const

export type Kind = 'red' | 'helper'

// The body is 16 x 24; the cell has room around it for a raised disc and a reaching hand.
export const CELL = { w: 20, h: 32, x: 2, y: 8 } as const
const stamp = (g: Grid, rows: readonly string[], x: number, y: number) => print(g, rows, x + CELL.x, y + CELL.y)
const set = (g: Grid, x: number, y: number, c: string) => dot(g, x + CELL.x, y + CELL.y, c)

const RED: Record<string, string> = {
  K: '#04070C', d: '#4A1020', r: '#8C1B31', m: '#B4233D', h: '#D62F48',
  k: '#12060B', V: INK.crimson, v: INK.hot, S: INK.hot, s: '#B4233D',
  D: INK.sail, o: INK.crimson, b: '#2A0D16', x: INK.crimson, w: '#FFFFFF',
}
const HELPER: Record<string, string> = {
  K: '#04070C', d: '#5B6E7D', r: '#9DB0B8', m: '#B7C7CB', h: INK.sail,
  k: '#0B1720', V: '#4FE0F2', v: '#B8F6FF', S: INK.sail, s: '#B7C7CB',
  D: '#4FE0F2', o: '#1C8EA3', b: '#31444F', x: '#4FE0F2', w: '#FFFFFF',
}
export const inkOf = (kind: Kind) => (key: string): string | undefined => (kind === 'red' ? RED : HELPER)[key]

// ---- parts

const HEAD_FRONT = [
  '.KKKKKKKK.',
  'KhhhhhhhhK',
  'KrmmmmmmhK',
  'KrkkkkkkkK',
  'KrkVVkVVvK',
  'KrkkkkkkkK',
  'KdrrrrrrmK',
  '.KKKKKKKK.',
]
const HEAD_BACK = [
  '.KKKKKKKK.',
  'KhhhhhhhhK',
  'KmmmmmmmhK',
  'KrrrrrrrmK',
  'KrrbbbbrmK',
  'KrrrrrrrmK',
  'KddrrrrrrK',
  '.KKKKKKKK.',
]
const TORSO = [
  '.KmmmmmmK.',
  '.KrmmmmmK.',
  '.KrrxxmmK.',
  '.KdrrrrrK.',
  '.KdrrrrrK.',
  '.KKddddKK.',
  '.KdrrrrrK.',
  '.KddrrrrK.',
]
const TORSO_BACK = [
  '.KmmmmmmK.',
  '.KrrrrrmK.',
  '.KrrrrrmK.',
  '.KdrrrrrK.',
  '.KdrrrrrK.',
  '.KKddddKK.',
  '.KdrrrrrK.',
  '.KddrrrrK.',
]
const LEG = ['KrrK', 'KrrK', 'KddK', 'KddK', 'KrrK', 'KVVK', 'KddK', 'KKKK']
const ARM = ['KrK', 'KrK', 'KrK', 'KmK', 'KvK']
const MARKS: ReadonlyArray<readonly string[]> = [['V', 'V'], ['VVV'], ['V.V'], ['.V.', 'VVV']]

function legs(g: Grid, frame: number, isWalking: boolean): void {
  const shift = !isWalking ? [0, 0, 0, 0] : ([[1, 1, -1, -1], [0, 0, 0, -2], [-1, -1, 1, 1], [0, -2, 0, 0]][frame % 4] ?? [0, 0, 0, 0])
  const [lx = 0, ly = 0, rx = 0, ry = 0] = shift
  // A foot that lifts shows less leg; the sole never leaves the 24 rows.
  stamp(g, LEG.slice(Math.max(0, -ly)), 4 + lx, 16)
  stamp(g, LEG.slice(Math.max(0, -ry)), 8 + rx, 16)
}

/** The body before shoulders and disc, facing right. */
function body(view: 'F' | 'B', pose: Pose, frame: number): Grid {
  const g = grid(CELL.w, CELL.h)
  const isWalking = pose === 'walk'
  const bob = (pose === 'idle' || pose === 'lean' || pose === 'sit') && frame % 2 === 1 ? 1 : 0
  const lift = isWalking && frame % 2 === 1 ? -1 : 0

  if (pose === 'sit') {
    stamp(g, ['KrrrrrrK', 'KddKKddK', 'KVVKKVVK', 'KddKKddK', 'KKKK.KKK'], 5, 18)
  } else {
    legs(g, frame, isWalking)
  }
  const drop = (pose === 'sit' ? 3 : 0) + lift
  stamp(g, view === 'F' ? TORSO : TORSO_BACK, 3, 8 + drop)

  // The far and near arms. A reaching hand keeps a clear pixel between it and the torso.
  const armY = 9 + drop
  const swing = isWalking ? ([1, 0, -1, 0][frame % 4] ?? 0) : 0
  const near = () => stamp(g, ARM, 10, armY + swing)
  const far = () => stamp(g, ARM, 3, armY - swing)
  const out = (dy: number, carry: 'none' | 'flat' | 'tilt') => {
    stamp(g, ['KKK', 'mmv', 'KKK'], 11, armY + dy)
    if (carry === 'flat') stamp(g, ['.DD', 'DoD', 'DD.'], 13, armY + dy - 3)
    if (carry === 'tilt') stamp(g, ['.D', 'Do', 'Do', '.D'], 14, armY + dy - 4)
  }

  if (pose === 'reach' || pose === 'read') {
    far()
    out(frame % 2, pose === 'read' ? 'tilt' : 'none')
  } else if (pose === 'insert') {
    far()
    out(frame % 2 === 0 ? -1 : 1, 'flat')
  } else if (pose === 'handoff') {
    far()
    out(0, 'flat')
  } else if (pose === 'type') {
    stamp(g, ['KKK', 'mvK', 'KKK'], 11, armY + 1 + (frame % 2))
    stamp(g, ['KKK', 'mvK', 'KKK'], 10, armY + 2 - (frame % 2))
  } else if (pose === 'lever' || pose === 'wheel') {
    far()
    stamp(g, frame % 2 === 0 ? ['.vK', 'Kmv', 'KmK'] : ['KmK', 'Kmv', '.vK'], 11, armY - 3 + (frame % 2) * 4)
  } else if (pose === 'raise' || pose === 'catch') {
    far()
    const high = pose === 'raise' ? 0 : 3
    stamp(g, ['KvK', 'KmK', 'KmK', 'KmK', 'KmK', 'KmK', 'KrK'], 12, (pose === 'raise' ? -1 : 2) + drop + high)
  } else if (pose === 'lean') {
    stamp(g, ['KKKK', 'mmmv', 'KKKK'], 10, armY + 3)
    far()
  } else if (pose === 'polish') {
    far()
    stamp(g, ['KvK', 'KmK', 'KrK'], 11, armY - 4 + (frame % 2))
  } else {
    near()
    far()
  }

  stamp(g, view === 'F' ? HEAD_FRONT : HEAD_BACK, 3, 0 + drop + bob)
  if (pose === 'raise') stamp(g, ['.KKKKK.', 'KKDDDKK', 'KDDDDDK', 'KDDoDDK', 'KDDDDDK', 'KKDDDKK', '.KKKKK.'], 9, -8)

  return g
}

/** Shoulder and disc are asymmetric, so they go on after any mirroring. */
function dress(g: Grid, view: 'F' | 'B', pose: Pose, frame: number, kind: Kind, mark: number, isFlipped: boolean): void {
  const drop = (pose === 'sit' ? 3 : 0) + (pose === 'walk' && frame % 2 === 1 ? -1 : 0)
  const y = 8 + drop
  // His right shoulder is the bright one: at our left from the front, at our right from behind.
  const x = view === 'F' ? 3 : 10
  stamp(g, ['KSSK', 'SSSS', 'KSSK'], x - (view === 'F' ? 1 : 0), y)
  if (view === 'B' && pose !== 'raise' && pose !== 'catch' && pose !== 'handoff' && pose !== 'insert' && pose !== 'read') {
    // Off-centre, toward his left, and hung low enough to read from behind.
    stamp(g, ['.DDD.', 'DkkkD', 'DkokD', 'DkkkD', '.DDD.'], 4, y + 2)
  }
  if (view === 'F' && pose !== 'raise' && pose !== 'catch' && pose !== 'handoff' && pose !== 'insert' && pose !== 'read') {
    stamp(g, ['DD', '.D', '.D', 'DD'], isFlipped ? 0 : 1, y + 2)
    set(g, isFlipped ? 13 : 12, y, 'D')
  }
  if (kind === 'helper') markOn(g, mark, drop)
}
function markOn(g: Grid, mark: number, drop: number): void {
  const m = MARKS[mark % MARKS.length] ?? MARKS[0]
  if (m) stamp(g, m, 6, 1 + drop)
}

/** A figure in three parts, so a drawing holds each part once: the body facing right, what is worn on one side, the helper's mark. */
export function parts(face: Face, pose: Pose, frame: number): { view: 'F' | 'B'; isFlipped: boolean; body: Grid; worn: Grid } {
  const view = face === 'SE' || face === 'SW' ? 'F' : 'B'
  const isFlipped = face === 'SW' || face === 'NW'
  const worn = grid(CELL.w, CELL.h)
  dress(worn, view, pose, frame, 'red', 0, isFlipped)
  return { view, isFlipped, body: body(view, pose, frame), worn }
}
export function markOf(mark: number, pose: Pose, frame: number): Grid {
  const g = grid(CELL.w, CELL.h)
  markOn(g, mark, (pose === 'sit' ? 3 : 0) + (pose === 'walk' && frame % 2 === 1 ? -1 : 0))
  return g
}

export function frames(pose: Pose): number {
  return pose === 'walk' ? 4 : pose === 'raise' || pose === 'catch' || pose === 'handoff' ? 1 : 2
}

export function sprite(kind: Kind, face: Face, pose: Pose, frame: number, mark = 0): Grid {
  const view = face === 'SE' || face === 'SW' ? 'F' : 'B'
  const isFlipped = face === 'SW' || face === 'NW'
  const base = body(view, pose, frame)
  const g = isFlipped ? mirror(base) : base
  dress(g, view, pose, frame, kind, mark, isFlipped)
  return g
}

// ---- the cycle, drawn on the same two-across-one-up slope

const CYCLE_F = [
  '..........KKKKKK..........',
  '........KKhhhhhhKK........',
  '.......KhmmkkkkkvhK.......',
  '.KKKK.KhmmkVVkVVvkhK......',
  'KddddKKrmmmmkkkkkkhKK.....',
  'KdVVddKrrmmmmmmmmmmhhK....',
  'KdVkVddKrrrxxmmmmmmmmhKK..',
  'KdVVVddKdrrrxxxmmmmmmmhhK.',
  '.KddddKKKdrrrrxxxmmmKKKKKK',
  '..KKKKK..KKdrrrrrxmKddddvK',
  '...........KKKdrrrKddVVddK',
  '..............KKKKKdVkVVdK',
  '..................KddVVddK',
  '...................KddddK.',
  '....................KKKK..',
]
const CYCLE_B = [
  '....................KKKK..',
  '...................KddddK.',
  '........KKKKKK....KddVVddK',
  '.......KhhhhhhKKKKKdVkVVdK',
  '......KhmmmmmmhmmmKddVVddK',
  '.....KrmmDDDmmmmmmmKddddK.',
  '..KKKrrrDkkkDmmmmmhKKKKK..',
  '.KddKrrrDkokDmmmxxK.......',
  'KddddKrrDkkkDxxxrK........',
  'KdVVddKrrDDDxrrrK.........',
  'KdVkVdKdrrxxrrKK..........',
  'KdVVVdKKKKKKKK............',
  '.KddddK...................',
  '..KKKK....................',
]

export function cycle(face: Face): Grid {
  const rows = face === 'SE' || face === 'SW' ? CYCLE_F : CYCLE_B
  const g = grid(26, 15)
  print(g, rows, 0, 0)
  return face === 'SW' || face === 'NW' ? mirror(g) : g
}

// ---- small marks and letters

const GLYPHS: Record<string, readonly string[]> = {
  N: ['#.#', '###', '###', '###', '#.#'],
  E: ['###', '#..', '##.', '#..', '###'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  S: ['###', '#..', '###', '..#', '###'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  '?': ['###', '..#', '.##', '...', '.#.'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
}

export function words(g: Grid, text: string, x: number, y: number, c: string): void {
  let at = x
  for (const ch of text) {
    const rows = GLYPHS[ch]
    if (rows) rows.forEach((row, j) => [...row].forEach((p, i) => p === '#' && dot(g, at + i, y + j, c)))
    at += rows ? 4 : 3
  }
}

export function art(g: Grid, kind: Kind): string {
  return paths(g, inkOf(kind))
}

export function isDrawn(g: Grid): boolean {
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (get(g, x, y) !== '') return true
  return false
}
