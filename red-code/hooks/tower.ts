// The room is the top floor of a tall tower. Below the storeys the walls carry on down at the room's own
// isometric angles, with the same rows of windows, past an outside lift, into the fog (fog.ts).
// Wisps pass behind the room, so a few show through its windows. The tower stands beside the chat: as the
// window narrows it grows smaller and keeps to the right edge (play.ts's placement, by the window's shape).

import { placementCss } from './play'
import { ROOM_INK as C, hash } from './room'

/** Seconds, for a delay that puts a loop of `ms` at the clock's place in it. */
const at = (now: number, ms: number) => `${-(now % ms) / 1000}s`

// ---- the walls

// One storey window as building.ts draws them: 14 across, 18 high, a frame, a rim and dark glass,
// then a band and a dark line between floors. `p` runs across the window, `v` down it.
const tile = (band: string) =>
  `<path fill="${C.void}" d="M3 4h9v10h-9zM0 17h14v1h-14z"/><path fill="${C.rim}" d="M4 4h8v1h-8z"/><path fill="#0A161C" d="M4 5h8v8h-8z"/><path fill="${band}" d="M0 16h14v1h-14z"/>`

/** Lit glass in a few windows of a block 11 windows across and 7 floors down, by the storeys' own colours. */
function litTile(seed: number): string {
  const by = new Map<string, string>()
  for (let r = 0; r < 7; r++)
    for (let c = 0; c < 11; c++) {
      const n = hash(c * 7 + seed, r * 5 + seed * 3) % 17
      if (n > 2) continue
      const ink = n === 0 ? '#6FB9C2' : n === 1 ? '#2A7585' : hash(c, r + seed) % 5 === 0 ? C.ember : '#4E9AA5'
      by.set(ink, `${by.get(ink) ?? ''}M${c * 14 + 4} ${r * 18 + 9}h8`)
    }
  return [...by].map(([ink, d]) => `<path stroke="${ink}" stroke-width="8" d="${d}"/>`).join('')
}

// The left wall runs down to the right at one pixel in two, the right wall up. A pattern laid in the
// wall's own (u, v) and sheared by the same slope puts each window where the storeys put theirs:
// left, x = 16 + u and y = 141 + v + u/2; right, x = 239 - u and the same y.
const L = 'patternTransform="matrix(1 .5 0 1 0 0)" x="16" y="133"'
const R = 'patternTransform="matrix(-1 .5 0 1 0 0)" x="-239" y="261"'
const DEFS =
  `<pattern id="wl" width="14" height="18" patternUnits="userSpaceOnUse" ${L}>${tile(C.slab2)}</pattern>` +
  `<pattern id="wr" href="#wl" ${R}/>` +
  `<pattern id="la" width="154" height="126" patternUnits="userSpaceOnUse" ${L}>${litTile(5)}</pattern>` +
  `<pattern id="lb" href="#la" x="93" y="187"/>` +
  `<pattern id="ra" href="#la" ${R}/><pattern id="rb" href="#lb" ${R}/>`

/** Where the storeys end and the plain tower begins, in the building's pixels; far below the window's foot. */
const FOOT = 900
const LEFT = `M16 181l112 56V${FOOT}H16z`
const RIGHT = `M128 237l112 -56V${FOOT}H128z`

/** The walls under the storeys: cladding, windows, some lit, the corner and its light. Drawn before the room. */
export function walls(now: number, isLean = false): string {
  return (
    `<defs>${DEFS}</defs>` +
    `<path fill="${C.ink}" d="${LEFT}"/><path fill="${C.slab}" d="${RIGHT}"/>` +
    `<path fill="url(#wl)" d="${LEFT}"/><path fill="url(#wr)" d="${RIGHT}"/>` +
    (isLean ? '' : `<path fill="url(#la)" d="${LEFT}"/><path fill="url(#ra)" d="${RIGHT}"/>`) +
    // a second set of lit windows that comes and goes, slowly, as floors empty and fill
    (isLean ? '' : `<g style="animation:fl 67s linear ${at(now, 67000)} infinite"><path fill="url(#lb)" d="${LEFT}"/><path fill="url(#rb)" d="${RIGHT}"/></g>`) +
    // the corner, carried down: a slab each side and its cyan line, and the teal seams
    `<path fill="${C.slab}" d="M124 235h4V${FOOT}h-4z"/><path fill="${C.slab2}" d="M128 235h4V${FOOT}h-4z"/>` +
    `<path stroke="${C.cyan}" d="M125.5 235V${FOOT}M130.5 235V${FOOT}"/><path stroke="${C.teal}" d="M72.5 209V${FOOT}M183.5 209V${FOOT}"/>`
  )
}

/** The outside lift on the left wall: its rails and a lit car that rides down into the fog and back. */
export function lift(now: number): string {
  const car =
    `<path fill="${C.void}" d="M0 0l10 5v14l-10 -5z"/><path fill="#6FB9C2" d="M1 3l8 4v9l-8 -4z"/>` +
    `<path fill="#B8F6FF" d="M2 5l2 1v5l-2 -1z"/><path fill="${C.rim}" d="M0 0l10 5v1l-10 -5z"/><path fill="${C.red}" d="M4 1h2v1h-2z"/>`
  return (
    `<path stroke="${C.edge}" d="M87.5 222V${FOOT}M98.5 228V${FOOT}"/>` +
    `<g style="transform:translate(88px,228px);animation:ride 76s ease-in-out ${at(now, 76000)} infinite">${car}</g>`
  )
}

/** Thin cloud passing behind the room: seen through its windows and against the sky round it. */
export function wisps(now: number): string {
  let d = ''
  for (let k = 0; k < 9; k++) {
    const x = 8 + ((hash(k, 4) * 5) % 210)
    const y = 4 + k * 8 + (hash(k, 9) % 5)
    d += `M${x} ${y}.5h${18 + (hash(k, 2) % 34)}`
  }
  return `<g style="animation:wisp 48s ease-in-out ${at(now, 96000)} infinite alternate"><path stroke="#1F3A45" opacity=".8" d="${d}"/></g>`
}

/** Where the tower stands, band by band. */
export const PLACE_CSS = placementCss()
/** The tower's motion. */
export const TOWER_KEYS =
  '@keyframes fl{0%,40%{opacity:1}50%,85%{opacity:0}95%,100%{opacity:1}}' +
  '@keyframes ride{0%,10%{transform:translate(88px,228px)}48%,58%{transform:translate(88px,640px)}96%,100%{transform:translate(88px,228px)}}' +
  '@keyframes wisp{from{transform:translateX(-26px)}to{transform:translateX(30px)}}'
