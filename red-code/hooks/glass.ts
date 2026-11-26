// Floor-to-ceiling glass for the megacity's offices, as one tile of pixel art laid on every face.
//
// The tile is two bays across and four floors down, 18 pixels a floor like the tower's own storeys.
// Each bay is an office seen through the glass: a cool white ceiling light, a lit back wall, desks,
// monitors, chairs and plants, or a dim or dark room after hours; one floor holds a conference table
// across both bays. It is drawn once and sheared to each face at the room's two-across-one-up slope, so
// a whole tower of offices costs a few characters. A second tile switches some offices off and on, slowly,
// as people come and go.

import { grid, paths, rect, set } from './pixels'
import type { Grid } from './pixels'

/** A floor's height and a bay's width, the tower's own storey lattice. */
export const FLOOR = 18
export const BAY = 14
const W = BAY * 2
const H = FLOOR * 4

/** The room behind the glass where nothing is drawn: the face's own fill shows there. */
export const GLASS_BACK = '#0B1720'

const INK = {
  slab: '#070C10', mullion: '#101C23',
  ceil: '#7FEAF6', ceil2: '#1C8EA3', wall: '#103039', wall2: '#0C242C', floor: '#081A20',
  dimCeil: '#16707F', dimWall: '#0A1C23',
  desk: '#0C171D', screen: '#B8F6FF', screen2: '#4FE0F2', chair: '#14242C',
  leaf: '#3FA673', leaf2: '#26734D', glint: '#2A4B57',
}

type Room = 'lit' | 'dim' | 'dark' | 'meet'

/** One office, `x` its left edge and `y` its floor's top: a slab, then the room seen through the glass. */
function office(g: Grid, x: number, y: number, room: Room, seed: number): void {
  rect(g, x, y, BAY, 1, INK.slab)
  if (room === 'dark') {
    // only the glass's own sheen
    set(g, x + 3 + (seed % 5), y + 7, INK.glint)
    set(g, x + 4 + (seed % 5), y + 6, INK.glint)
    set(g, x + 5 + (seed % 5), y + 5, INK.glint)
  } else if (room === 'dim') {
    rect(g, x + 1, y + 1, BAY - 1, 1, INK.dimCeil)
    rect(g, x + 1, y + 2, BAY - 1, 12, INK.dimWall)
    rect(g, x + 2, y + 13, 7, 1, INK.desk)
    rect(g, x + 4, y + 11, 2, 2, INK.screen2)
  } else {
    // cool white light from the ceiling, falling off toward the floor
    rect(g, x + 1, y + 1, BAY - 1, 1, INK.ceil)
    rect(g, x + 1, y + 2, BAY - 1, 1, INK.ceil2)
    rect(g, x + 1, y + 3, BAY - 1, 7, INK.wall)
    rect(g, x + 1, y + 10, BAY - 1, 6, INK.wall2)
    rect(g, x + 1, y + 16, BAY - 1, 2, INK.floor)
    if (room === 'lit') {
      // a desk, its monitor, a chair, and now and then a plant
      rect(g, x + 2, y + 13, 7, 1, INK.desk)
      rect(g, x + 3, y + 14, 1, 2, INK.desk)
      rect(g, x + 7, y + 14, 1, 2, INK.desk)
      rect(g, x + 4, y + 10, 3, 2, INK.screen)
      set(g, x + 5, y + 12, INK.desk)
      rect(g, x + 10, y + 11, 2, 2, INK.chair)
      rect(g, x + 10, y + 13, 1, 3, INK.chair)
      if (seed % 2 === 0) {
        rect(g, x + 12, y + 12, 1, 4, INK.leaf2)
        set(g, x + 11, y + 11, INK.leaf)
        set(g, x + 13, y + 12, INK.leaf)
        set(g, x + 12, y + 11, INK.leaf)
      }
    }
  }
  // the mullion between panes, floor to ceiling
  rect(g, x, y + 1, 1, FLOOR - 1, INK.mullion)
}

/** The conference room: one long table across both bays, chairs along it, a screen on the wall. */
function meeting(g: Grid, y: number): void {
  office(g, 0, y, 'meet', 0)
  office(g, BAY, y, 'meet', 0)
  rect(g, 3, y + 13, W - 6, 1, INK.desk)
  for (let x = 4; x < W - 4; x += 3) set(g, x, y + 12, INK.chair)
  rect(g, 10, y + 5, 8, 4, INK.screen2)
  rect(g, 11, y + 6, 6, 2, INK.screen)
}

let tile = ''
/** The office tile, as paths in its own unsheared pixels. */
function officeTile(): string {
  if (tile !== '') return tile
  const g = grid(W, H)
  const rooms: Array<[Room, Room]> = [['lit', 'lit'], ['dim', 'lit'], ['meet', 'meet'], ['lit', 'dim']]
  rooms.forEach(([a, b], f) => {
    if (a === 'meet') meeting(g, f * FLOOR)
    else {
      office(g, 0, f * FLOOR, a, f)
      office(g, BAY, f * FLOOR, b, f + 1)
    }
  })
  tile = paths(g)
  return tile
}

/** Dark offices over a lattice `bays` across and `floors` down, at the cells given: their own period, so they fall unevenly over the office tile. */
function offTile(cells: ReadonlyArray<readonly [number, number]>): string {
  let d = ''
  for (const [bx, fy] of cells) d += `M${bx * BAY + 1} ${fy * FLOOR + 1}h${BAY - 1}v${FLOOR - 1}h${-(BAY - 1)}z`
  return `<path fill="#08121A" d="${d}"/>`
}
/** Offices dark all night, every fifth bay and sixth floor over. */
const NIGHT = [[0, 0], [2, 1], [4, 2], [1, 3], [3, 4], [0, 5], [2, 5], [4, 0]] as const
/** Offices that go dark and light again, every seventh. */
const SWITCH = [[0, 1], [3, 0], [1, 4], [5, 2], [2, 6], [6, 5], [4, 3]] as const

/**
 * The glass patterns, laid at the room's slope: `gL` and `gR` the offices on left and right faces, `nL`
 * and `nR` the ones dark all night, `oL` and `oR` the ones that switch off and on. Their lattice is the tower's (pattern origin 2, 7), so a
 * block snapped to that lattice shows whole floors.
 */
export function glassDefs(): string {
  const L = 'patternTransform="matrix(1 .5 0 1 0 0)" x="2" y="7"'
  const R = 'patternTransform="matrix(-1 .5 0 1 0 0)" x="-2" y="7"'
  return (
    `<pattern id="gL" width="${W}" height="${H}" patternUnits="userSpaceOnUse" ${L}>${officeTile()}</pattern>` +
    `<pattern id="gR" href="#gL" ${R}/>` +
    `<pattern id="oL" width="${BAY * 7}" height="${FLOOR * 7}" patternUnits="userSpaceOnUse" ${L}>${offTile(SWITCH)}</pattern>` +
    `<pattern id="nL" width="${BAY * 5}" height="${FLOOR * 6}" patternUnits="userSpaceOnUse" ${L}>${offTile(NIGHT)}</pattern>` +
    `<pattern id="nR" href="#nL" ${R}/>` +
    `<pattern id="oR" href="#oL" ${R}/>`
  )
}
