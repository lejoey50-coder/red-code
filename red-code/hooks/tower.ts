// The room is the top floor of a tall tower. Below the floor's slab the tower is one black shaft that steps
// out into a wider podium and goes down into the fog (fog.ts). It has no windows: its light is let into it.
// Trenches are cut into the black, a broad core of light runs in each and lights the trench's own walls and
// the face beside it, thin circuits branch off at the wall's own 45 degrees, and a band of light runs round
// the foot of the shaft where it meets the podium's ledge. The corner's spine and the circuits turn crimson
// while Red Code works and go back to cyan when he rests.
// Wisps pass behind the room, so a few show through its windows. The tower stands beside the chat: as the
// window narrows it grows smaller and keeps to the right edge (play.ts's placement, by the window's shape).

import { placementCss } from './play'
import { ROOM_INK as C, hash } from './room'

/** Seconds, for a delay that puts a loop of `ms` at the clock's place in it. */
const at = (now: number, ms: number) => `${-(now % ms) / 1000}s`
const sec = (ms: number) => `${Math.round(ms) / 1000}s`

// ---- the tower's own inks

const K = {
  // black surfaces: the left face in shadow, the right face a tone lighter, the cut of a trench darker than both
  obs: '#060B10', lit: '#0A1219', pit: '#020508', ledge: '#0E1820', ledge2: '#132029', bevel: '#1B2A35',
  // light: a white core, cyan round it, and the blue it leaves on the walls of its trench
  core: '#E8FAFF', ice: '#8EEFFF', cyan: '#00CFFF', deep: '#075B80', deep2: '#05334A',
  // the same, while he works
  red: '#FF1744', pink: '#FFD9DF', ember: '#7A0B22',
}

// ---- the faces
//
// Each face is drawn in its own (u, v): u along the wall towards the corner, v down it. The left wall runs
// down to the right at one pixel in two and the right wall mirrors it, so a shear puts a plain rectangle
// where the wall is: left, x = 16 + u and y = 139 + v + u/2; right, x = 240 - u and the same y.
const LEFT = 'matrix(1 .5 0 1 16 139)'
const RIGHT = 'matrix(-1 .5 0 1 240 139)'

/** How far down a face is drawn: far below the window's foot. */
const DEEP = 780
/** Where the shaft meets the podium's ledge, and how far the podium stands out from it. */
const STEP = 146
const OUT = 12
/** The corner, in the tower's own pixels. */
const EDGE = { x: 128, y: 195 }

const r = (u: number, v: number, w: number, h: number) => `M${u} ${v}h${w}v${h}h${-w}z`
/** A strip from `a` to `b` whose top is cut at the wall's 45 degrees, lowest at `a`; `B` and `v` fix the cut. */
const cut = (a: number, b: number, B: number, v: number, end: number) => `M${a} ${v + B - a}L${b} ${v + B - b}V${end}H${a}z`

/** Shapes by colour: one path for each ink, in the order the inks were first used. */
class Ink {
  private by = new Map<string, string>()
  add(ink: string, d: string): this {
    this.by.set(ink, (this.by.get(ink) ?? '') + d)
    return this
  }
  svg(): string {
    return [...this.by].map(([ink, d]) => `<path fill="${ink}" d="${d}"/>`).join('')
  }
}

/**
 * A trench with a core of light in it: the cut, the blue on its two walls, then cyan, ice and the white core.
 * The core is `w` wide from `u`, the trench `t` wider each side; it runs from `v` to `end`, its top cut at
 * the wall's 45 degrees, or square when `isFlat`.
 */
function channel(p: Ink, u: number, w: number, t: number, v: number, end: number, isFlat = false): void {
  const B = u + w + t
  const strip = (a: number, b: number) => (isFlat ? r(a, v, b - a, end - v) : cut(a, b, B, v, end))
  const mid = w > 5 ? 2 : 1
  p.add(K.pit, strip(u - t, B))
  p.add(K.deep2, strip(u - 4, u + w + 4))
  p.add(K.deep, strip(u - 2, u + w + 2))
  p.add(K.cyan, strip(u, u + w))
  if (w > 5) p.add(K.ice, strip(u + 1, u + w - 1))
  p.add(K.core, strip(u + mid, u + w - mid))
}

/** The main trench of each face: where its core starts, how wide, and where it begins. */
const L1 = { u: 32, w: 6, t: 6, v: 30 }
const R1 = { u: 44, w: 8, t: 6, v: 12 }
/** The outside lift's trench in the left face. */
const SHAFT = { u: 70, w: 16 }

/** The left face: black, with the main trench, the lift's trench and the ledge. */
function leftFace(isLean: boolean): string {
  const p = new Ink()
  const { u, w, t, v } = L1
  p.add(K.obs, r(0, 0, 112, DEEP) + r(-OUT, STEP + OUT, 112 + OUT, DEEP))
  p.add(K.ledge, `M0 ${STEP}h112v${OUT}H${-OUT}z`)
  // a bevel down each outer edge and along the podium's lip, and one recessed panel in the podium
  p.add(K.bevel, r(0, 0, 1, STEP) + r(-OUT, STEP + OUT, 1, DEEP) + r(-OUT, STEP + OUT, 112 + OUT, 1))
  p.add(K.pit, r(42, STEP + 34, 20, DEEP) + r(SHAFT.u, 26, SHAFT.w, DEEP))
  let out = p.svg()
  // what the light leaves on the black beside it: the main core, the corner's spine, the band at the ledge
  if (!isLean)
    out +=
      // one shape to a path: the light is laid across each shape's own width
      `<path fill="url(#tgx)" d="${r(u - 20, 0, w + 40, STEP)}"/><path fill="url(#tgx)" d="${r(u - OUT - 20, STEP + OUT, w + 40, DEEP)}"/>` +
      `<path fill="url(#tgy)" d="${r(0, STEP - 22, SHAFT.u, 22)}${r(SHAFT.u + SHAFT.w, STEP - 22, 112 - SHAFT.u - SHAFT.w, 22)}"/>`
  const q = new Ink()
  channel(q, u, w, t, v, STEP)
  channel(q, u - OUT, w, t, STEP + OUT, DEEP, true)
  // the core crosses the ledge at 45 degrees, on its way from the shaft down the podium
  q.add(K.cyan, `M${u} ${STEP}h${w}l${-OUT} ${OUT}h${-w}z`).add(K.core, `M${u + 2} ${STEP}h${w - 4}l${-OUT} ${OUT}h${-w + 4}z`)
  // the band of light round the foot of the shaft, broken by the lift
  for (const [a, b] of [[0, SHAFT.u], [SHAFT.u + SHAFT.w, 112]] as const) q.add(K.cyan, r(a, STEP - 3, b - a, 3)).add(K.core, r(a, STEP - 2, b - a, 2))
  // the lift's trench: a lit lip on the side the spine lights
  q.add(K.bevel, r(SHAFT.u + SHAFT.w, 26, 1, STEP - 29) + r(SHAFT.u + SHAFT.w, STEP + OUT, 1, DEEP))
  return out + q.svg()
}

/** The right face: a tone lighter, with a broad core, three unlit fins and a narrow channel in the podium. */
function rightFace(isLean: boolean): string {
  const p = new Ink()
  const { u, w, t, v } = R1
  p.add(K.lit, r(0, 0, 112, DEEP) + r(-OUT, STEP + OUT, 112 + OUT, DEEP) + `M-5 30l5 -6v${STEP - 24}h-5z`)
  p.add(K.ledge2, `M0 ${STEP}h112v${OUT}H${-OUT}z`)
  p.add(K.bevel, r(0, 0, 1, STEP) + r(-OUT, STEP + OUT, 1, DEEP) + r(-OUT, STEP + OUT, 112 + OUT, 1) + r(-5, 30, 1, STEP - 30))
  // fins near the outer edge: a lit edge and its shadow
  for (const f of [8, 16, 24]) p.add(K.bevel, r(f, 8 + f, 2, STEP - 11 - f)).add(K.pit, r(f - 2, 8 + f, 2, STEP - 11 - f))
  p.add(K.pit, r(30, STEP + 30, 34, DEEP))
  let out = p.svg()
  if (!isLean)
    out +=
      `<path fill="url(#tgx)" d="${r(u - 18, 0, w + 36, STEP)}"/><path fill="url(#tgx)" d="${r(66, STEP + 40, 34, DEEP)}"/>` +
      `<path fill="url(#tgy)" d="${r(0, STEP - 22, 112, 22)}"/>`
  const q = new Ink()
  channel(q, u, w, t, v, STEP)
  channel(q, 81, 4, 5, STEP + 40, DEEP)
  q.add(K.cyan, r(0, STEP - 3, 112, 3)).add(K.core, r(0, STEP - 2, 112, 2))
  return out + q.svg()
}

/** Whether Red Code is working, and when that last changed (0 when it is not known). */
export type Power = { isOn: boolean; at: number }
/** How long the crimson takes to come and to go. */
const TURN = 1400
/** How long the light takes to run down the tower when he starts. */
const CASCADE = 2600

/** How far into the turn to crimson or back to cyan the drawing is, or -1 when the colour is settled. */
const turning = (now: number, power: Power) => (power.at > 0 && now >= power.at && now - power.at < TURN ? now - power.at : -1)

/** What turns crimson, shown while he works: it fades in when he starts and out when he stops. */
function crimson(now: number, power: Power, inner: string): string {
  const since = turning(now, power)
  if (since < 0) return power.isOn ? inner : ''
  return `<g style="${power.isOn ? '' : 'opacity:0;'}animation:${power.isOn ? 'tc' : 'tk'} ${sec(TURN)} steps(7) ${sec(-since)} both">${inner}</g>`
}

/** The thin circuits that branch off the cores, turning at the wall's own 45 degrees: [face, width, path]. */
const CIRCUITS: ReadonlyArray<readonly ['L' | 'R', number, string]> = [
  ['L', 1, 'M38 52.5h14l6 6v26m-1 0h3v3h-3z'],
  ['R', 1, 'M52 40.5h16l6 6v50l6 6h24'],
  ['L', 2, 'M38 75h10l5 5v24l5 5h8'],
  // these two run down into the band at the ledge
  ['R', 1, `M44 84.5h-10l-5 5v${STEP - 92.5}`],
  ['L', 1, `M25 62.5h-7l-6 6v${STEP - 71.5}`],
]
/** How long the circuits take to come on, one after another, hold, and dim again. */
const SEQ = 16000

/** One face's circuits, each coming on a little after the one before: cyan, and crimson while he works. */
function circuits(face: 'L' | 'R', now: number, power: Power): string {
  const since = turning(now, power)
  const turn = since < 0 ? '' : ` style="animation:${power.isOn ? 'ti' : 'to'} ${sec(TURN)} steps(7) ${sec(-since)} both"`
  return (
    `<g stroke="${power.isOn ? K.red : K.cyan}"${turn}>` +
    CIRCUITS.map(([f, w, d], k) => (f === face ? `<path${w > 1 ? ` stroke-width="${w}"` : ''} style="animation:tq ${SEQ / 1000}s linear ${sec(-(now % SEQ) - SEQ + k * 1400)} infinite" d="${d}"/>` : '')).join('') +
    '</g>'
  )
}

/** The corner's spine where it lies in a face: the blue (or crimson) it leaves on the wall beside it. */
function spineWall(isRed: boolean, isLean: boolean): string {
  return (
    (isLean ? '' : `<path fill="url(#${isRed ? 'tgr' : 'tgh'})" d="${r(80, 0, 32, DEEP)}"/>`) +
    `<path fill="${isRed ? K.ember : K.deep2}" d="${r(104, 0, 8, DEEP)}"/><path fill="${isRed ? '#B01030' : K.deep}" d="${r(107, 0, 5, DEEP)}"/>`
  )
}
/** The spine's core down the corner itself: the broadest in the tower. */
function spineCore(isRed: boolean): string {
  const bar = (half: number, ink: string) => `<path fill="${ink}" d="M${EDGE.x - half} ${EDGE.y - 2}h${half * 2}V${EDGE.y + DEEP}h${-half * 2}z"/>`
  return bar(4, isRed ? K.red : K.cyan) + bar(3, isRed ? '#FF6F86' : K.ice) + bar(2, isRed ? K.pink : K.core)
}

/** A slow pulse of energy, or a packet: hidden until its loop shows it. */
const pulse = (key: string, ms: number, now: number, inner: string) => `<g style="opacity:0;animation:${key} ${ms / 1000}s linear ${sec(-(now % ms))} infinite">${inner}</g>`
/** A pulse's shape: white over the core's own width, ice flaring a little past it, and a tail behind. */
const slug = (u: number, w: number, tail: number) =>
  `<path fill="${K.ice}" opacity=".7" d="${r(u - 1, 1, w + 2, 8)}"/><path fill="#FFFFFF" d="${r(u, 0, w, 10)}${r(u + 1, tail < 0 ? tail : 10, w - 2, Math.abs(tail))}"/>`

/** When he starts, light runs down each core in turn: the spine first, then the right face, then the left. */
function cascade(now: number, power: Power, k: number, u: number, w: number): string {
  const since = now - power.at
  if (!power.isOn || power.at <= 0 || since < 0 || since > CASCADE + 1200) return ''
  return `<g style="opacity:0;animation:tx ${sec(CASCADE)} linear ${sec(k * 400 - since)} both"><path fill="${K.core}" d="${r(u, -40, w, 40)}"/><path fill="${K.ice}" opacity=".45" d="${r(u - 3, -90, w + 6, 90)}"/></g>`
}

/** Where the tower's spine goes under the fog, for the fog to hold some of its light: [x, crimson or cyan]. */
export const fogLights = (power: Power): Array<[number, boolean]> => [[EDGE.x, power.isOn]]

/** The tower's outline below the room, for the haze that takes its foot. */
const OUTLINE = `M16 139l112 56l112 -56V${139 + STEP}l${OUT} ${OUT / 2}V960H${16 - OUT}V${139 + STEP + OUT / 2}l${OUT} ${-OUT / 2}z`

const DEFS =
  // light on the black each side of a core; from the corner outwards, cyan and crimson; up the wall from the ledge
  `<linearGradient id="tgx"><stop stop-color="${K.cyan}" stop-opacity="0"/><stop offset=".5" stop-color="${K.cyan}" stop-opacity=".3"/><stop offset="1" stop-color="${K.cyan}" stop-opacity="0"/></linearGradient>` +
  `<linearGradient id="tgh"><stop stop-color="${K.cyan}" stop-opacity="0"/><stop offset="1" stop-color="${K.cyan}" stop-opacity=".34"/></linearGradient>` +
  `<linearGradient id="tgr"><stop stop-color="${K.red}" stop-opacity="0"/><stop offset="1" stop-color="${K.red}" stop-opacity=".4"/></linearGradient>` +
  `<linearGradient id="tgy" x2="0" y2="1"><stop stop-color="${K.cyan}" stop-opacity="0"/><stop offset="1" stop-color="${K.cyan}" stop-opacity=".3"/></linearGradient>` +
  // the haze the foot of the tower goes into
  `<linearGradient id="thz" gradientUnits="userSpaceOnUse" x2="0" y1="372" y2="760"><stop stop-color="#0B2630" stop-opacity="0"/><stop offset="1" stop-color="#0B2630" stop-opacity=".92"/></linearGradient>`

/**
 * The tower under the room: its black faces and ledge, the light let into them, and the haze at its foot.
 * Drawn before the room. `isLean` leaves out what the light does round itself and everything that moves.
 */
export function walls(now: number, isLean = false, power: Power = { isOn: false, at: 0 }): string {
  const isLeft = (face: 'L' | 'R') => face === 'L'
  const side = (face: 'L' | 'R') =>
    `<g transform="${isLeft(face) ? LEFT : RIGHT}">` +
    (isLeft(face) ? leftFace(isLean) : rightFace(isLean)) +
    spineWall(false, isLean) +
    crimson(now, power, spineWall(true, isLean)) +
    (isLean
      ? ''
      : circuits(face, now, power) +
        (isLeft(face)
          ? // pulses down the left core: down the shaft, across the ledge with it, and on down the podium
            pulse('te', 11000, now, slug(L1.u, L1.w, -10)) + pulse('te', 11000, now + 6300, slug(L1.u, L1.w, -10)) + cascade(now, power, 2, L1.u - 1, L1.w + 2)
          : // a packet along the band, from the right core to the corner
            pulse('tp', 17000, now, `<path fill="#FFFFFF" d="${r(-3, STEP - 4, 5, 4)}"/>`) + cascade(now, power, 1, R1.u - 1, R1.w + 2))) +
    '</g>'
  return (
    `<defs>${DEFS}</defs>` +
    side('L') +
    side('R') +
    spineCore(false) +
    crimson(now, power, spineCore(true)) +
    // pulses up the spine, to the room
    (isLean ? '' : `<g transform="translate(${EDGE.x} 0)">${pulse('ts', 13000, now, slug(-3, 6, 12))}${pulse('ts', 13000, now + 5100, slug(-3, 6, 12))}<g transform="translate(0 ${EDGE.y})">${cascade(now, power, 0, -5, 10)}</g></g>`) +
    `<path fill="url(#thz)" d="${OUTLINE}"/>`
  )
}

/** The outside lift in its trench in the left wall: its rails and a lit car that rides down into the fog and back. */
export function lift(now: number): string {
  const car =
    `<path fill="${C.void}" d="M0 0l10 5v14l-10 -5z"/><path fill="${K.cyan}" d="M1 3l8 4v9l-8 -4z"/>` +
    `<path fill="${K.core}" d="M2 5l2 1v5l-2 -1z"/><path fill="${K.bevel}" d="M0 0l10 5v1l-10 -5z"/><path fill="${K.red}" d="M4 1h2v1h-2z"/>`
  return (
    `<path stroke="${K.bevel}" d="M88.5 202V900M99.5 208V900"/>` +
    `<g style="transform:translate(89px,228px);animation:ride 76s ease-in-out ${at(now, 76000)} infinite">${car}</g>`
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
  '@keyframes ride{0%,10%{transform:translate(89px,228px)}48%,58%{transform:translate(89px,640px)}96%,100%{transform:translate(89px,228px)}}' +
  '@keyframes wisp{from{transform:translateX(-26px)}to{transform:translateX(30px)}}' +
  // a pulse down the left core: down the shaft, across the ledge, down the podium and out in the haze
  `@keyframes te{0%{opacity:0;transform:translate(0,${L1.v + 14}px)}4%{opacity:1}22%{transform:translate(0,${STEP - 7}px)}25%{transform:translate(${-OUT}px,${STEP + OUT}px)}80%{opacity:1}100%{opacity:0;transform:translate(${-OUT}px,470px)}}` +
  // a pulse up the spine
  `@keyframes ts{0%{opacity:0;transform:translateY(560px)}25%{opacity:1}94%{opacity:1}100%{opacity:0;transform:translateY(${EDGE.y}px)}}` +
  // a packet along the band, quick, and then a long wait
  `@keyframes tp{0%,78%{opacity:0;transform:translateX(${R1.u}px)}80%{opacity:1}97%{opacity:1}100%{opacity:0;transform:translateX(104px)}}` +
  // the circuits: on, held, dimmed
  '@keyframes tq{0%,100%{opacity:.22}9%,60%{opacity:1}72%{opacity:.22}}' +
  // crimson coming and going, and the light that runs down when he starts
  `@keyframes tc{from{opacity:0}}@keyframes tk{from{opacity:1}}@keyframes ti{from{stroke:${K.cyan}}}@keyframes to{from{stroke:${K.red}}}` +
  '@keyframes tx{0%{opacity:0;transform:translateY(0)}8%{opacity:.9}70%{opacity:.9}100%{opacity:0;transform:translateY(520px)}}'
