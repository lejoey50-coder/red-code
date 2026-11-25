// Draws the atlas and the fixture scenes from the art source in ../hooks. Needs Node 24 or later, nothing else.
// Run from the mod's folder: node art/make.mjs
// The scenes are FIXTURES: hand-made states drawn by the real scene code. They are not captures of the app.
import { registerHooks } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath, pathToFileURL } from 'node:url'

registerHooks({
  resolve: (spec, ctx, next) => next(spec.startsWith('.') && !/\.\w+$/.test(spec) ? `${spec}.ts` : spec, ctx),
})
const here = path.dirname(fileURLToPath(import.meta.url))
const load = f => import(pathToFileURL(path.join(here, '..', 'hooks', f)).href)
const W = await load('world.ts')
const S = await load('scene.ts')
const P = await load('sprites.ts')

// ---- the atlas, one pixel to a pixel

const POSES = ['idle', 'walk', 'sit', 'reach', 'read', 'insert', 'type', 'raise', 'catch', 'handoff', 'lever', 'wheel', 'lean', 'polish']
const FACES = ['SE', 'SW', 'NE', 'NW']
const cols = POSES.reduce((n, p) => n + P.frames(p), 0)
const cw = P.CELL.w + 2
const ch = P.CELL.h + 2
const width = cols * cw
const height = FACES.length * 2 * ch + 17
const rgba = Buffer.alloc(width * height * 4)
const index = { cell: { w: P.CELL.w, h: P.CELL.h, feet: [10, 31] }, sprites: [] }

function put(g, kind, x0, y0) {
  const ink = P.inkOf(kind)
  for (let y = 0; y < g.h; y++)
    for (let x = 0; x < g.w; x++) {
      const key = g.at[y * g.w + x]
      const c = key ? ink(key) : undefined
      if (!c) continue
      const o = ((y0 + y) * width + x0 + x) * 4
      rgba[o] = parseInt(c.slice(1, 3), 16)
      rgba[o + 1] = parseInt(c.slice(3, 5), 16)
      rgba[o + 2] = parseInt(c.slice(5, 7), 16)
      rgba[o + 3] = 255
    }
}

let row = 0
for (const kind of ['red', 'helper'])
  for (const face of FACES) {
    let col = 0
    for (const pose of POSES)
      for (let frame = 0; frame < P.frames(pose); frame++) {
        const x = col * cw + 1
        const y = row * ch + 1
        put(P.sprite(kind, face, pose, frame, 1), kind, x, y)
        index.sprites.push({ kind, face, pose, frame, x, y })
        col++
      }
    row++
  }
FACES.forEach((face, k) => {
  const x = k * 28 + 1
  const y = row * ch + 1
  put(P.cycle(face), 'red', x, y)
  index.sprites.push({ kind: 'ride', face, pose: 'ride', frame: 0, x, y, w: 26, h: 15 })
})

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  const len = Buffer.alloc(4)
  const crc = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  crc.writeUInt32BE(zlib.crc32(body))
  return Buffer.concat([len, body, crc])
}
const head = Buffer.alloc(13)
head.writeUInt32BE(width, 0)
head.writeUInt32BE(height, 4)
head.set([8, 6, 0, 0, 0], 8)
const raw = Buffer.alloc((width * 4 + 1) * height)
for (let y = 0; y < height; y++) rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
fs.writeFileSync(
  path.join(here, 'atlas.png'),
  Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]),
)
fs.writeFileSync(path.join(here, 'atlas.json'), JSON.stringify(index))

// ---- three fixture scenes

const t = 1_800_000_000_000
const op = (key, tool) => ({ key, actor: 'main', tool, activity: W.activityOf(tool), detail: '', a: t, isRunning: true })
const idle = W.opened(W.EMPTY, 's', 1, t)
const read = W.opStarted(W.turnStarted(W.launched(idle, t), 't'), op('a', 'Read'), t + 6000)
let helpers = W.helperCame(read, 'h1', null, 'Explore', 'look', t + 12000)
helpers = W.helperCame(helpers, 'h2', null, 'Plan', 'plan', t + 12100)
const scenes = {
  'fixture-launch': [W.launched(idle, t), t + 1500],
  'fixture-needs-you': [W.waiting(read, 'allow:main:Bash', t + 12000), t + 20000],
  'fixture-helpers': [helpers, t + 20000],
}
for (const [name, [world, now]] of Object.entries(scenes)) fs.writeFileSync(path.join(here, `${name}.svg`), S.drawRoom(world, now, { isStill: true, width: 512 }))
console.log(`atlas ${width} x ${height}, ${index.sprites.length} sprites`)
