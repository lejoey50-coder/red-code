// The room as one SVG: a pure function of the world and the time. All motion is CSS inside
// it, so nothing redraws on a timer and the app stops it while the window is hidden. Delays are
// taken from the clock, so a redraw picks the motion up where it was. With reduced motion (or the
// Still setting) each moving part stands at its resting place.

import { VIEW, place, tileAt } from './map'
import * as building from './building'
import { LINE, SCENE, city, column, flyer, road } from './city'
import { grid, paths, rect } from './pixels'
import type { Grid } from './pixels'
import * as room from './room'
import { INK, art, cycle, frames, markOf, parts, words } from './sprites'
import { lightsOf } from './world'
import { HOLO_DOWN, hotspots, hoverCss } from './play'
import { PLACE_CSS, TOWER_KEYS, cloudBank, lift as liftShaft, walls, wisps } from './tower'
import type { Actor, Clip, Face, Pose, World } from '../types'

const cache = new Map<string, string>()
function once(key: string, draw: () => Grid): string {
  let got = cache.get(key)
  if (got === undefined) {
    got = paths(draw())
    cache.set(key, got)
  }
  return got
}

function base(): Grid {
  const g = building.shell()
  room.archive(g)
  building.decor(g)
  room.beacon(g)
  room.turbine(g)
  room.lift(g)
  return g
}


/** Seconds, for CSS, with no float noise. */
const s = (ms: number) => `${Math.round(ms) / 1000}s`

type Pen = { defs: Map<string, string>; css: string[]; now: number; isStill: boolean; n: number }

/** Puts a part in the drawing once, whoever wears it. */
function part(pen: Pen, id: string, kind: 'red' | 'helper', draw: () => Grid): string {
  if (!pen.defs.has(id)) pen.defs.set(id, `<g id="${id}">${art(draw(), kind)}</g>`)
  return `<use href="#${id}"/>`
}

/** An actor in one pose, feet at 0,0, with its short dim copy in the glass below. */
function body(pen: Pen, a: Actor, pose: Pose, face: Face): string {
  const kind = a.kind === 'helper' ? 'helper' : 'red'
  const count = frames(pose)
  const fps = pose === 'walk' ? 8 : pose === 'idle' || pose === 'sit' || pose === 'lean' ? 1 : 4
  const beat = (count * 1000) / fps
  const k = kind[0] ?? 'r'
  const id = `${k}${kind === 'helper' ? a.mark % 4 : ''}${face}${pose}`
  if (!pen.defs.has(id)) {
    let out = ''
    for (let f = 0; f < count; f++) {
      const p = parts(face, pose, f)
      const base = part(pen, `${k}${p.view}${pose}${f}`, kind, () => p.body)
      let one = (p.isFlipped ? `<g transform="matrix(-1 0 0 1 20 0)">${base}</g>` : base) + part(pen, `${k}w${face}${pose}${f}`, kind, () => p.worn)
      if (kind === 'helper') one += part(pen, `m${a.mark % 4}${pose === 'sit' ? 's' : pose === 'walk' && f % 2 === 1 ? 'w' : ''}`, kind, () => markOf(a.mark, pose, f))
      out += count === 1 ? one : `<g class="f${count}${f}" style="animation-duration:${s(beat)};animation-delay:${s(-beat + (beat * f) / count)}">${one}</g>`
    }
    pen.defs.set(id, `<g id="${id}" transform="translate(-10 -31)">${out}</g>`)
  }
  return `<use href="#${id}"/><g clip-path="url(#rf)" opacity=".2"><use href="#${id}" transform="matrix(1 0 0 -1 0 2)"/></g>`
}
function bike(pen: Pen, face: Face): string {
  const id = `bike${face}`
  if (!pen.defs.has(id)) pen.defs.set(id, `<g id="${id}">${art(cycle(face), 'red')}</g>`)
  return `<use href="#${id}" x="-13" y="-13"/>`
}

/** Wraps a part so it shows from `a` to `b` alone (b null: from `a` on, and whenever motion is off). */
function during(pen: Pen, a: number, b: number | null, inner: string): string {
  const from = a - pen.now
  if (b === null) return from <= 0 || pen.isStill ? inner : `<g style="animation:off ${s(from)} linear">${inner}</g>`
  if (pen.isStill) return ''
  if (b <= pen.now) return ''
  return `<g class="h" style="animation:on ${s(b - a)} linear ${s(from)}">${inner}</g>`
}

type Layer = { z: number; svg: string }

function actorLayers(pen: Pen, a: Actor, w: World): Layer[] {
  const out: Layer[] = []
  const isFaded = a.kind === 'peer'
  const last = a.clips[a.clips.length - 1]
  a.clips.forEach((c, k) => {
    if (c.b !== null && c.b <= pen.now) return
    const [x0, y0] = place(c.from)
    const [x1, y1] = place(c.to)
    // A helper at its side station works at a small panel of its own.
    const panel = a.kind === 'helper' && c.pose === 'type' ? '<path stroke="#04070C" d="M8 -15.5h8m-8 1h8m-8 1h8m-8 1h8m-8 1h8m-8 1h8"/><path stroke="#1C8EA3" d="M9 -14.5h6m-6 2h3"/><path stroke="#4FE0F2" d="M9 -12.5h4m-4 -1h6"/><path stroke="#526579" d="M11 -9.5h2m-2 1h2m-2 1h2m-2 1h2m-2 1h2m-3 1h4"/>' : ''
    const inner = (c.ride ? bike(pen, c.face) : body(pen, a, c.pose, c.face)) + panel
    let move: string
    if (c.b !== null && (x0 !== x1 || y0 !== y1) && !pen.isStill) {
      const name = `m${pen.n++}`
      const steps = Math.max(2, Math.round(Math.abs(x1 - x0) / 2))
      pen.css.push(`@keyframes ${name}{from{transform:translate(${x0}px,${y0}px)}to{transform:translate(${x1}px,${y1}px)}}`)
      move = `<g style="transform:translate(${x1}px,${y1}px);animation:${name} ${s(c.b - c.a)} steps(${steps}) ${s(c.a - pen.now)} both">${inner}</g>`
    } else {
      move = `<g transform="translate(${x1} ${y1})">${inner}</g>`
    }
    const z = Math.max(c.from[0] + c.from[1], c.to[0] + c.to[1])
    const svg = during(pen, c.a, c === last && a.phase !== 'here' ? (c.b ?? null) : c.b, move)
    out.push({ z, svg: isFaded ? `<g opacity=".72">${svg}</g>` : svg })
    if (k === a.clips.length - 1) {
      const top = tags(a, w, x1, y1)
      if (top !== '') out.push({ z: 90, svg: during(pen, c.a, c.b, top) })
    }
  })
  return out
}

/** The mark over a head: a badge where there is more than one Red Code, and the amber question. */
function tags(a: Actor, w: World, x: number, y: number): string {
  const isMany = w.actors.filter(one => one.kind !== 'helper').length > 1
  const isWaiting = a.kind === 'red' ? w.waits.length > 0 : a.kind === 'peer' && a.doing === 'Needs you'
  let out = ''
  if (isWaiting) {
    const g = grid(40, 18)
    rect(g, 14, 0, 11, 11, '#04070C')
    rect(g, 15, 1, 9, 9, INK.amber)
    words(g, '?', 18, 3, '#1A1206')
    if (a.kind === 'red') {
      rect(g, 0, 11, 37, 7, '#04070C')
      words(g, 'NEEDS YOU', 1, 12, INK.amber)
    }
    out += `<g transform="translate(${x - 19} ${y - 53})">${paths(g)}</g>`
  }
  if (isMany && a.kind !== 'helper') {
    const g = grid(7, 7)
    rect(g, 0, 0, 7, 7, '#04070C')
    words(g, String(a.badge), 2, 1, a.kind === 'red' ? INK.hot : INK.sail)
    out += `<g transform="translate(${x + 7} ${y - 8})">${paths(g)}</g>`
  }
  return out
}

/** The solid band behind the cycle, which breaks into three short segments as it fades. */
function ribbon(pen: Pen, clips: readonly Clip[]): string {
  const rides = clips.filter(c => c.ride && c.b !== null)
  const end = rides[rides.length - 1]?.b
  if (end === null || end === undefined || pen.isStill || end + 1100 <= pen.now) return ''
  let out = ''
  rides.forEach(c => {
    if (c.b === null) return
    const [x0, y0] = place(c.from)
    const [x1, y1] = place(c.to)
    const n = Math.max(1, Math.abs(x1 - x0))
    // One thick stroke for each stretch of the band, on the same line the 3-pixel steps took.
    const dots = (from: number, to: number) => {
      const p = (k: number) => `${Math.round(x0 + ((x1 - x0) * k) / n) + 0.5} ${Math.round(y0 + ((y1 - y0) * k) / n) - 3.5}`
      return `M${p(Math.round(n * from))}L${p(Math.round(n * to))}`
    }
    const span = c.b - c.a
    for (let t = 0; t < 4; t++) {
      out += during(pen, c.a + (span * (t + 1)) / 4, end + 350, `<path stroke="${INK.crimson}" stroke-width="3" d="${dots(t / 4, (t + 1) / 4)}"/>`)
    }
    const broken = dots(0.06, 0.2) + dots(0.42, 0.56) + dots(0.78, 0.92)
    out += during(pen, end + 350, end + 800, `<path stroke="${INK.crimson}" stroke-width="3" d="${broken}"/>`)
    out += during(pen, end + 800, end + 1100, `<path stroke="#7A2233" stroke-width="3" d="${broken}"/>`)
  })
  return out
}

/** The headlight: three wet tiles and then the pillar, each shown as the cycle reaches it. */
function headlight(pen: Pen, clips: readonly Clip[]): { tiles: string; pillar: string } {
  let tiles = ''
  let pillar = ''
  for (const c of clips) {
    if (!c.ride || c.b === null || c.b + 600 <= pen.now) continue
    const n = Math.max(Math.abs(c.to[0] - c.from[0]), Math.abs(c.to[1] - c.from[1]), 1)
    for (let k = 1; k <= n; k++) {
      const t: [number, number] = [c.from[0] + ((c.to[0] - c.from[0]) * k) / n, c.from[1] + ((c.to[1] - c.from[1]) * k) / n]
      const at = c.a + ((c.b - c.a) * (k - 1)) / n
      const [x, y] = place(t)
      if (!pen.defs.has('wt')) pen.defs.set('wt', `<g id="wt">${once('wet', room.wetTile)}</g>`)
      tiles += during(pen, at, at + 520, `<use href="#wt" x="${x - 16}" y="${y - 8}"/>`)
      if (t[0] === 7 && t[1] === 7) pillar += during(pen, at, at + 700, once('pillarLit', room.pillarLit))
    }
  }
  return { tiles, pillar }
}

/** The disc he skips from the pier, out over the water and back, when there is nothing to do. */
function skipping(pen: Pen, a: Actor | undefined): string {
  if (!a || a.station !== 'pier' || a.clips.length > 1 || pen.isStill) return ''
  const [x, y] = place(tileAt(a.clips, pen.now))
  const T = 11000
  const phase = -(pen.now % T)
  const hop = [[-6, -14, 60], [-22, -6, 63], [-30, -14, 66], [-40, -4, 69], [-46, -10, 72], [-52, -2, 75], [-46, -12, 80], [-28, -18, 85], [-8, -15, 90]] as const
  pen.css.push(
    `@keyframes skip{0%,59%{opacity:0;transform:translate(${x - 6}px,${y - 14}px)}${hop
      .map(([dx, dy, p]) => `${p}%{opacity:1;transform:translate(${x + dx}px,${y + dy}px)}`)
      .join('')}91%,100%{opacity:0;transform:translate(${x - 8}px,${y - 15}px)}}`,
  )
  return `<g style="opacity:0;animation:skip ${s(T)} steps(4) ${s(phase)} infinite"><path stroke="${INK.sail}" d="M-2 -1.5h5M-3 -.5h7M-2 .5h5"/><path stroke="${INK.crimson}" d="M-1 -.5h3"/></g>`
}

/** Two idle Red Codes trade a practice throw. */
function practice(pen: Pen, w: World): string {
  const quiet = w.actors.filter(a => a.kind !== 'helper' && (a.station === 'rail' || a.station === 'pier') && a.clips.length === 1 && a.doing !== 'Needs you')
  const [p, q] = quiet
  if (!p || !q || w.ops.length > 0 || pen.isStill) return ''
  const [x0, y0] = place(tileAt(p.clips, pen.now))
  const [x1, y1] = place(tileAt(q.clips, pen.now))
  const T = 16000
  pen.css.push(
    `@keyframes toss{0%,79%{opacity:0;transform:translate(${x0}px,${y0 - 14}px)}80%{opacity:1;transform:translate(${x0}px,${y0 - 14}px)}85%{transform:translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 30}px)}90%{opacity:1;transform:translate(${x1}px,${y1 - 14}px)}95%{transform:translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 26}px)}99%{opacity:1;transform:translate(${x0}px,${y0 - 14}px)}100%{opacity:0}}`,
  )
  return `<g style="opacity:0;animation:toss ${s(T)} steps(6) ${s(-(pen.now % T))} infinite"><path stroke="${INK.sail}" d="M-2 -1.5h5M-3 -.5h7M-2 .5h5"/></g>`
}

const CSS = `
.h{visibility:hidden}
@keyframes on{0%,100%{visibility:visible}}
@keyframes off{0%,100%{visibility:hidden}}
@keyframes a2{0%{opacity:1}50%,100%{opacity:0}}
@keyframes a4{0%{opacity:1}25%,100%{opacity:0}}
.f20,.f21{animation:a2 1s step-end infinite}.f40,.f41,.f42,.f43{animation:a4 1s step-end infinite}
.f21,.f41,.f42,.f43{opacity:0}
@keyframes east{from{transform:translate(-60px,${LINE - 2}px)}to{transform:translate(650px,${LINE - 2}px)}}
@keyframes west{from{transform:translate(700px,${LINE - 1}px) scaleX(-1)}to{transform:translate(-10px,${LINE - 1}px) scaleX(-1)}}
@keyframes fly{from{transform:translateX(-20px)}to{transform:translateX(660px)}}
@keyframes yif{from{transform:translateX(660px) scaleX(-1)}to{transform:translateX(-20px) scaleX(-1)}}
@keyframes flow{from{transform:translate(0,0)}to{transform:translate(112px,-56px)}}
@media (max-aspect-ratio:11/10){.veil{opacity:.62}}
@keyframes rip{0%,100%{transform:translateX(0)}25%{transform:translateX(2px)}50%{transform:translateX(-1px)}75%{transform:translateX(-3px)}}
@keyframes hover{0%,100%{transform:translate(96px,64px)}20%{transform:translate(100px,58px)}45%{transform:translate(150px,72px)}60%{transform:translate(152px,68px)}80%{transform:translate(112px,60px)}}
@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:.25}}
@keyframes pulse{0%{transform:translateY(0);opacity:1}85%{opacity:1}100%{transform:translateY(-36px);opacity:0}}
@keyframes glint{0%,100%{opacity:.15}50%{opacity:.9}}
@keyframes pd{0%{opacity:1;transform:none}60%{opacity:.5;transform:scaleY(.35)}100%{opacity:0;transform:scaleY(0)}}
@keyframes pu{0%{opacity:0;transform:scaleY(0)}100%{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
${PLACE_CSS}${hoverCss()}`

/** The top of the roof's mast. */
const ROOF_LAMP = -10
/** Where the beacon's beam goes up. */
const BEAM = place([1, 0])[0]
const EAST = 74000
const WEST = 112000

/** The style for a drawing that does not move: every keyframe left out, as nothing plays them. */
let stillCached = ''
function stillCss(): string {
  if (stillCached === '') stillCached = CSS.replace(/@keyframes [^{]+\{(?:[^{}]*\{[^{}]*\})*\}/g, '')
  return stillCached
}

/** The most the app takes in one drawing, with room to spare. */
const MOST = 130000

export function drawRoom(w: World, now: number, o: { isStill: boolean }): string {
  const full = draw(w, now, o)
  if (full.length <= MOST) return full
  // Too many on the move at once: everyone but Red Code stands where they are going.
  const calm = draw({ ...w, actors: w.actors.map(a => (a.kind === 'red' ? a : { ...a, clips: a.clips.slice(-1) })) }, now, o)
  if (calm.length <= MOST) return calm
  const still = draw({ ...w, actors: w.actors.map(a => ({ ...a, clips: a.clips.slice(-1) })) }, now, { ...o, isStill: true })
  if (still.length <= MOST) return still
  // Still too much: the tower's ornaments go (wisps, lift, lit windows, the far cloud), the room stays whole.
  return draw({ ...w, actors: w.actors.map(a => ({ ...a, clips: a.clips.slice(-1) })) }, now, { ...o, isStill: true, isLean: true })
}

function draw(w: World, now: number, o: { isStill: boolean; isLean?: boolean }): string {
  const lean = o.isLean === true
  const pen: Pen = { defs: new Map(), css: [], now, isStill: o.isStill, n: 0 }
  const lit = lightsOf(w)
  const red = w.actors.find(a => a.kind === 'red')

  const layers: Layer[] = []
  for (const a of w.actors) layers.push(...actorLayers(pen, a, w))

  const [dx, dy] = place([2, 3])
  layers.push({
    z: 5.5,
    svg: `<g transform="translate(${dx - 18} ${dy - 30})">${once('desk', room.desk)}${lit.console ? `<g class="p" style="animation:blink 1s step-end infinite">${once('deskLit', room.deskLit)}</g>` : ''}</g>`,
  })
  for (let j = 1; j < 5; j++) {
    const [x, y] = place([6, j])
    layers.push({ z: 6.4 + j, svg: `<g transform="translate(${x} ${y - 4})">${once('rail', room.railPiece)}</g>` })
  }
  // The hologram: faster and brighter while he works it, and powered down for a while after a Stop.
  const isBoost = (w.holoBoost ?? 0) > now
  const spinMs = isBoost ? 600 : 1600
  const turn = [0, 1, 2, 3].map(f => `<g class="f4${f}" style="animation-duration:${s(spinMs)};animation-delay:${s(-spinMs + (spinMs / 4) * f - (now % spinMs))}">${once(`globe${f}`, () => building.globe(f))}</g>`).join('')
  const holo = `<g opacity="${isBoost ? 1 : 0.85}">${turn}</g>` + (isBoost ? '<path stroke="#4FE0F2" opacity=".55" d="M6 33.5h24M10 35.5h16"/>' : '')
  const down = w.holoDown
  const globe =
    down !== undefined && now < down + HOLO_DOWN
      ? during(pen, down, down + 900, `<g style="transform-box:fill-box;transform-origin:50% 100%;animation:pd .9s steps(6) ${s(down - now)} forwards">${holo}</g>`) +
        during(pen, down + HOLO_DOWN, null, `<g style="transform-box:fill-box;transform-origin:50% 100%;animation:pu 1.2s steps(6) ${s(down + HOLO_DOWN - now)} both">${holo}</g>`)
      : holo
  const [gx, gy] = place([4, 3])
  layers.push({ z: 7, svg: `<g transform="translate(${gx - 18} ${gy - 38})">${once('projector', building.projector)}${globe}</g>` })
  layers.push({ z: 11.2, svg: once('planter', building.planter) })
  layers.push({ z: 10.6, svg: once('doorL', () => building.doorway(true)) })
  layers.push({ z: 11.4, svg: once('doorR', () => building.doorway(false)) })
  const light = red ? headlight(pen, red.clips) : { tiles: '', pillar: '' }
  layers.push({ z: 80, svg: `<g transform="translate(118 148)">${once('pillar', room.pillar)}${light.pillar}</g>` })
  layers.sort((p, q) => p.z - q.z)

  const spin = [0, 1, 2, 3]
    .map(f => `<g class="f4${f}" style="animation-duration:.5s;animation-delay:${s(-500 + 125 * f)}">${once(`rotor${f}`, () => room.rotor(f, true))}</g>`)
    .join('')
  const rotor = lit.turbine ? spin : ''
  const at = { archive: [62, 70], turbine: [208, 62], beacon: [144, 36], console: [112, 78], lift: [64, 116], rail: [192, 120], pier: [64, 140] } as const
  const mark = w.mark && w.mark.until > now ? w.mark : null
  const sign = mark ? during(pen, now, pen.isStill ? null : mark.until, `<g transform="translate(${at[mark.station][0] - 6} ${at[mark.station][1] - 6})">${once(`ring${mark.kind}`, () => room.brokenRing(mark.kind === 'cancelled'))}</g>`) : ''


  const beamUp = lit.beacon ? `<g opacity=".85"><g style="animation:blink 2.4s steps(3) infinite"><path fill="#1C6E7E" d="M${BEAM - 4} -800h9V${VIEW.y}h-9z"/><path fill="#B8F6FF" d="M${BEAM - 1} -800h3V${VIEW.y}h-3z"/><path fill="#FFFFFF" d="M${BEAM} -800h1V${VIEW.y}h-1z"/><g transform="translate(0 ${VIEW.y})">${once('beam', room.beam)}</g></g></g>` : ''
  const house =
    (lean ? '' : wisps(now)) +
    walls(now, lean) +
    (lean ? '' : liftShaft(now)) +
    (lit.beacon ? beamUp : '') +
    once('base', base) +
    `<g mask="url(#rd)">${once('road', road)}</g>` +
    `<path stroke="#FF9295" stroke-dasharray="10 102" style="animation:flow 2.8s steps(28) ${s(-(now % 2800))} infinite" d="M-96 310.5h1M-95 309.5h2M-93 308.5h2M-91 307.5h2M-89 306.5h2"/>` +
    (lit.archive ? once(`arch${lit.isWriting}`, () => room.archiveLit(lit.isWriting)) : '') +
    (lit.isWriting ? `<g style="animation:pulse 1.2s steps(9) infinite"><path stroke="${INK.crimson}" d="M34 129.5h8M34 128.5h8M42 125.5h8M42 124.5h8M50 121.5h8M50 120.5h8"/></g>` : '') +
    (lit.turbine ? once('turb', room.turbineLit) : '') +
    rotor +
    (lit.beacon ? once('beaconLit', room.beaconLit) : '') +
    (lit.lift ? once('liftLit', room.liftLit) : '') +
    `<g transform="translate(0 ${VIEW.y})">${once('roof', building.roof)}</g>` +
    `<path stroke="#FF9295" style="animation:blink 2s step-end infinite" d="M127 ${ROOF_LAMP}.5h3"/>` +
    [0, 1].map(f => `<g class="f2${f}" style="animation-duration:2.4s;animation-delay:${s(-2400 + 1200 * f)}">${once(`screen${f}`, () => building.screen(f))}${once(`arcade${f}`, () => building.arcade(f))}</g>`).join('') +
    light.tiles +
    (red ? ribbon(pen, red.clips) : '') +
    layers.map(l => l.svg).join('') +
    skipping(pen, red) +
    practice(pen, w) +
    (lean ? '' : `<g style="transform:translate(96px,64px);animation:hover 24s steps(96) ${s(-(now % 24000))} infinite">${once('drone', building.drone)}</g>`) +
    sign +
    (lean ? '' : hotspots())
  const flight = (y: number, ms: number, way: 'fly' | 'yif', x: number, ink: string) =>
    `<g transform="translate(0 ${y})"><g style="transform:translateX(${x}px)${way === 'yif' ? ' scaleX(-1)' : ''};animation:${way} ${s(ms)} steps(340) ${s(-(now % ms))} infinite">${flyer(ink)}</g></g>`
  const all =
    city() +
    `<g style="animation:rip 4.9s steps(2) infinite">${column(lit.beacon)}</g>` +
    (lean ? '' : flight(46, 64000, 'fly', 130, room.ROOM_INK.cyan) + flight(84, 91000, 'yif', 250, room.ROOM_INK.red) + flight(118, 120000, 'fly', 60, room.ROOM_INK.ice)) +
    (lean ? '' : `<g style="transform:translate(150px,${LINE - 2}px);animation:east ${s(EAST)} steps(355) ${s(-(now % EAST))} infinite">${once('trainEast', () => building.train(room.ROOM_INK.cyan))}</g>` +
    `<g style="transform:translate(340px,${LINE - 1}px) scaleX(-1);animation:west ${s(WEST)} steps(355) ${s(-(now % WEST))} infinite">${once('trainWest', () => building.train(room.ROOM_INK.red))}</g>`) +
    `<g class="tw">${house}</g>` +
    cloudBank(now, lean) +
    // Smoke over the middle, where the words are; over everything on a tall screen.
    `<rect x="170" width="300" height="${SCENE.h}" fill="url(#smoke)"/><rect class="veil" width="${SCENE.w}" height="${SCENE.h}" fill="#05090E" opacity="0"/>`

  const still = o.isStill ? '*{animation:none!important}' : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SCENE.w} ${SCENE.h}" preserveAspectRatio="xMaxYMax slice" shape-rendering="crispEdges" fill="none" stroke-width="1">` +
    `<style>${o.isStill ? stillCss() : CSS + TOWER_KEYS}${pen.css.join('')}${still}</style><defs><clipPath id="rf"><rect x="-10" y="1" width="20" height="9"/></clipPath>` +
    `<linearGradient id="rf2" x1="1" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#fff"/><stop offset=".8" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="rd" maskUnits="userSpaceOnUse" x="-200" y="0" width="460" height="400"><rect x="-200" width="460" height="400" fill="url(#rf2)"/></mask>` +
    `<linearGradient id="smoke"><stop offset="0" stop-color="#05090E" stop-opacity="0"/><stop offset=".22" stop-color="#05090E" stop-opacity=".6"/><stop offset=".74" stop-color="#05090E" stop-opacity=".6"/><stop offset="1" stop-color="#05090E" stop-opacity="0"/></linearGradient>` +
    `${[...pen.defs.values()].join('')}</defs>${all}</svg>`
  )
}
/** The compact strip: Red Code, the address he is at, and the water. */
export function drawStrip(w: World, now: number, o: { isStill: boolean }): string {
  const pen: Pen = { defs: new Map(), css: [], now, isStill: o.isStill, n: 0 }
  const red = w.actors.find(a => a.kind === 'red')
  const lit = lightsOf(w)
  const rest = red?.clips[red.clips.length - 1]
  const pose = w.waits.length > 0 ? 'idle' : (rest?.pose ?? 'idle')
  const where = w.waits.length > 0 ? 'rail' : (red?.station ?? 'pier')
  const icon = once(`icon${where}`, () => stationIcon(where))
  const isOn = where !== 'rail' && where !== 'pier' && lit[where]
  const inner =
    `<rect width="64" height="28" fill="${INK.water}"/>` +
    `<path stroke="#122033" d="M2 24.5h12m6 0h9m7 0h14m5 0h6M6 26.5h16m9 0h11m8 0h9"/>` +
    `<rect x="0" y="22" width="64" height="2" fill="${INK.platform}"/>` +
    (red ? `<g transform="translate(14 24)">${body(pen, red, pose === 'walk' ? 'idle' : pose, 'SE')}</g>` : '') +
    `<g transform="translate(40 3)" opacity="${isOn || w.waits.length > 0 ? 1 : 0.6}">${w.waits.length > 0 ? once('iconask', () => askIcon()) : icon}</g>`
  const still = o.isStill ? '*{animation:none!important}' : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 28" width="128" height="56" shape-rendering="crispEdges" fill="none" stroke-width="1"><style>${CSS}${still}</style><defs><clipPath id="rf"><rect x="-10" y="1" width="20" height="3"/></clipPath>${[...pen.defs.values()].join('')}</defs>${inner}</svg>`
}

function askIcon(): Grid {
  const g = grid(18, 18)
  rect(g, 2, 2, 13, 13, INK.amber)
  words(g, '?', 7, 6, '#1A1206')
  return g
}
function stationIcon(where: string): Grid {
  const g = grid(18, 18)
  if (where === 'archive') {
    for (let k = 0; k < 3; k++) {
      rect(g, 1, 5 + k * 5, 16, 1, INK.steel)
      for (let x = 0; x < 4; x++) rect(g, 2 + x * 4, 2 + k * 5, 2, 2, INK.sail)
    }
  } else if (where === 'turbine') {
    for (let k = 0; k < 4; k++) {
      rect(g, 2 + (3 - k), 13 - k * 4, 14 - (3 - k) * 2, 2, k % 2 === 0 ? INK.sail : '#4FE0F2')
    }
    rect(g, 8, 0, 2, 17, INK.steel)
  } else if (where === 'beacon') {
    rect(g, 7, 6, 3, 11, INK.steel)
    rect(g, 5, 1, 7, 5, INK.sail)
    rect(g, 12, 2, 6, 1, '#FFFFFF')
    rect(g, 12, 4, 5, 1, '#FFFFFF')
  } else if (where === 'console' || where === 'lift') {
    rect(g, 2, 3, 14, 9, INK.steel)
    rect(g, 3, 4, 12, 7, INK.water)
    rect(g, 4, 6, 8, 1, INK.sail)
    rect(g, 4, 8, 5, 1, INK.hot)
    rect(g, 7, 12, 4, 3, INK.steel)
  } else {
    for (let x = 0; x < 18; x += 5) rect(g, x, 7, 1, 8, INK.steel)
    rect(g, 0, 6, 18, 1, INK.sail)
  }
  return g
}
