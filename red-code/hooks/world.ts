// What is happening, as a value. Every function takes a world and the time and
// returns the next world: nothing here calls Claude, and nothing is guessed.

import { ANCHORS, LIFT, SIDES, rest, restOf, tileAt, trip } from './map'
import type { Activity, Actor, Background, Clip, Face, Op, Outcome, Pose, Presence, Station, Tile, World } from '../types'

export const RED = 'main'

export const EMPTY: World = {
  session: '', badge: 1, turn: null, isReplying: false, isWaking: false, isUnknown: false,
  actors: [], ops: [], done: [], waits: [], background: [], mark: null,
}

// ---- which address a tool belongs to

const READS = new Set(['Read', 'Glob', 'Grep', 'LS', 'NotebookRead'])
const WRITES = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])
const SHELLS = new Set(['Bash', 'PowerShell', 'BashOutput', 'KillShell', 'Monitor'])
const WEBS = new Set(['WebSearch', 'WebFetch'])
const ASKS = new Set(['AskUserQuestion', 'ExitPlanMode'])
const SPAWNS = new Set(['Agent', 'Task'])

export function activityOf(tool: string): Activity {
  if (READS.has(tool)) return 'read'
  if (WRITES.has(tool)) return 'write'
  if (SHELLS.has(tool)) return 'shell'
  if (WEBS.has(tool)) return 'web'
  if (ASKS.has(tool)) return 'ask'
  if (SPAWNS.has(tool)) return 'spawn'
  const m = /^mcp__(.+?)__(.+)$/.exec(tool)
  if (m && /filesystem|desktop-commander/i.test(m[1] ?? '')) {
    const name = m[2] ?? ''
    if (/process/i.test(name)) return 'shell'
    if (/write|edit|create|move|copy|append/i.test(name)) return 'write'
    if (/read|list|search|tree|get_file/i.test(name)) return 'read'
  }
  return 'generic'
}

const HOME: Record<Activity, Station> = {
  read: 'archive', write: 'archive', shell: 'turbine', web: 'beacon', generic: 'console', spawn: 'console', ask: 'rail',
}
export const stationOf = (a: Activity): Station => HOME[a]

const WORDS: Record<Activity, string> = {
  read: 'Reading', write: 'Writing', shell: 'Command running', web: 'Searching the web', generic: 'Tool active', spawn: 'Starting a helper', ask: 'Needs you',
}
export const wordsOf = (a: Activity): string => WORDS[a]

/** The short label a row shows: a file's own name and no more of its path, never a command. */
export function detailOf(tool: string, input: Record<string, unknown>): string {
  const path = input['file_path'] ?? input['path'] ?? input['notebook_path']
  if (typeof path === 'string' && activityOf(tool) !== 'shell') return path.split(/[\\/]/).filter(Boolean).pop()?.slice(0, 40) ?? ''
  const m = /^mcp__(.+?)__(.+)$/.exec(tool)
  return m ? (m[2] ?? '').slice(0, 40) : activityOf(tool) === 'generic' ? tool.slice(0, 40) : ''
}

// ---- actors

function still(at: Tile, face: Face, pose: Pose, now: number): Clip[] {
  return rest([], at, face, pose, now)
}

export function newRed(badge: number, now: number): Actor {
  const home = ANCHORS.pier[0]
  return {
    id: RED, kind: 'red', parent: null, role: 'Red Code', badge, mark: 0,
    clips: still(home?.at ?? [4, 8], home?.face ?? 'SW', 'sit', now),
    station: 'pier', doing: 'Idle', doingAt: now, phase: 'here',
  }
}

const swap = (w: World, id: string, fn: (a: Actor) => Actor): World => ({ ...w, actors: w.actors.map(a => (a.id === id ? fn(a) : a)) })

type Go = { cap?: number; isRide?: boolean; pose?: Pose; hold?: { pose: Pose; ms: number }; seat?: number }

function send(a: Actor, station: Station, now: number, o: Go = {}): Actor {
  const spots = ANCHORS[station]
  const anchor = spots[o.seat ?? 0] ?? spots[0]
  if (!anchor) return a
  const pose = o.pose ?? anchor.pose
  const last = restOf(a.clips)
  const isThere = last !== undefined && last.to[0] === anchor.at[0] && last.to[1] === anchor.at[1]
  if (isThere && last.pose === pose) return { ...a, station }
  const here = tileAt(a.clips, now)
  if (isThere && last.b === null && now < last.a) {
    // Already on the way there: keep the walk, change only what happens on arrival.
    return { ...a, station, clips: [...a.clips.slice(0, -1), { ...last, pose, face: anchor.face }] }
  }
  if (here[0] === anchor.at[0] && here[1] === anchor.at[1] && isThere) {
    return { ...a, station, clips: still(anchor.at, anchor.face, pose, now) }
  }
  const way = trip(a.clips, anchor.at, { now, cap: o.cap ?? 1800, ...(o.isRide ? { isRide: true, perTile: 220 } : {}), ...(o.hold ? { hold: o.hold } : {}) })
  return { ...a, station, clips: rest(way, anchor.at, anchor.face, pose, now) }
}

// ---- where Red Code should be

/** While a click outranks the session: he stays where he was sent, and only what he is doing is said. */
function words(w: World, now: number): World {
  const op = w.ops.filter(o => o.actor === RED).pop()
  const doing = w.waits.length > 0 ? 'Needs you' : op ? [wordsOf(op.activity), op.detail].filter(Boolean).join(' · ') : w.isReplying ? 'Writing a reply' : null
  return doing === null ? w : swap(w, RED, a => ({ ...a, doing, doingAt: now }))
}

/** The newest call he has running, the pose for it, or what the turn itself asks of him. */
function aim(w: World, now: number): World {
  if ((w.userUntil ?? 0) > now) return words(w, now)
  if (w.waits.length > 0) {
    return swap(w, RED, a => ({ ...send(a, 'rail', now, { pose: 'raise', cap: 900 }), doing: 'Needs you', doingAt: now }))
  }
  const mine = w.ops.filter(o => o.actor === RED)
  const op = mine[mine.length - 1]
  if (op) {
    const pose = op.activity === 'write' ? 'insert' : undefined
    return swap(w, RED, a => ({
      ...send(a, HOME[op.activity], now, { cap: w.isWaking ? 1000 : 1600, ...(pose ? { pose } : {}) }),
      doing: [wordsOf(op.activity), op.detail].filter(Boolean).join(' · '),
      doingAt: now,
    }))
  }
  if (w.isReplying) return swap(w, RED, a => ({ ...send(a, 'console', now), doing: 'Writing a reply', doingAt: now }))
  // Between calls he stays where he was, so a burst of reads is one visit.
  return w
}

function calm(w: World, now: number): World {
  if ((w.userUntil ?? 0) > now) return w
  return swap(w, RED, a => ({ ...send(a, 'rail', now), doing: w.background.length > 0 ? 'Resting · background work running' : 'Resting', doingAt: now }))
}

/** After a long quiet he walks back out to the pier. */
export function homeward(w: World, now: number): World {
  const red = w.actors.find(a => a.id === RED)
  const isQuiet = w.turn === null && !w.isWaking && w.ops.length === 0 && w.waits.length === 0 && w.background.length === 0 && !w.actors.some(a => a.kind === 'helper')
  if (!red || !isQuiet || red.station !== 'rail' || now - red.doingAt < 90000 || (w.userUntil ?? 0) > now) return w
  return swap(w, RED, a => ({ ...send(a, 'pier', now, { cap: 3600 }), doing: 'Idle', doingAt: now }))
}

// ---- events

export function opened(w: World, session: string, badge: number, now: number): World {
  const isSame = w.session === session && w.actors.some(a => a.id === RED)
  if (!isSame) return { ...EMPTY, session, badge, actors: [newRed(badge, now)] }
  // The same session in a fresh copy of this code: what was in flight was not watched, so it is unknown.
  const wasBusy = w.turn !== null || w.ops.length > 0
  const at: World = { ...w, badge, ops: [], waits: [], isReplying: false, isWaking: false, isUnknown: wasBusy, mark: null }
  return swap(at, RED, a => ({ ...a, badge, doing: wasBusy ? 'Unknown' : a.doing, doingAt: now }))
}

/** Another number on the same session's back. */
export function rebadged(w: World, badge: number): World {
  return swap({ ...w, badge }, RED, a => ({ ...a, badge }))
}

/** An accepted prompt: catch the disc, snap it on, take the lower track in. */
/** Is Red Code at work: a turn running or waking, a call open, or a reply being written. */
export const isWorking = (w: World): boolean => w.turn !== null || w.isWaking || w.isReplying || w.ops.length > 0

/** The tower's power: whether he is at work, and when that last changed (0 when it was not seen to). */
export const powerOf = (w: World): { isOn: boolean; at: number } => (isWorking(w) ? { isOn: true, at: w.workAt ?? 0 } : { isOn: false, at: w.restAt ?? 0 })

export function launched(w: World, now: number): World {
  const at: World = { ...w, isWaking: true, mark: null, ...(isWorking(w) ? {} : { workAt: now }) }
  if ((w.userUntil ?? 0) > now) return swap(at, RED, a => ({ ...a, doing: 'Starting', doingAt: now }))
  return swap(at, RED, a => {
    const fromPier = a.station === 'pier'
    return {
      ...send(a, 'console', now, { cap: fromPier ? 2800 : 1200, ...(fromPier ? { isRide: true, hold: { pose: 'catch' as Pose, ms: 420 } } : {}), pose: 'type' }),
      doing: 'Starting', doingAt: now,
    }
  })
}

export function turnStarted(w: World, id: string): World {
  return { ...w, turn: id, isReplying: false, isUnknown: false }
}

export function replying(w: World, now: number): World {
  if (w.isReplying && w.ops.every(o => o.actor !== RED)) return w
  return aim({ ...w, isReplying: true, isWaking: false, isUnknown: false }, now)
}

/** The turn is over; `isCheered` false after a Stop, which gets no cheer. */
export function turnEnded(w: World, id: string, now: number, isCheered = true): World {
  if (w.turn !== null && w.turn !== id) return w
  // A call the turn left open did not finish where it could be seen: it is over, and it did not succeed.
  const at: World = { ...w, turn: null, isReplying: false, isWaking: false, isUnknown: false, ops: w.ops.filter(o => o.actor !== RED), waits: [], restAt: now }
  if ((w.userUntil ?? 0) > now || !isCheered) return calm(at, now)
  // Claude finished: a short cheer where he stands, then off to rest.
  const red = at.actors.find(a => a.id === RED)
  if (!red) return calm(at, now)
  const here = tileAt(red.clips, now)
  const rested = calm(swap(at, RED, a => ({ ...a, clips: [{ a: now, b: null, from: here, to: here, pose: 'raise', face: 'SE' }] })), now + 1100)
  return swap(rested, RED, a => ({ ...a, clips: [{ a: now, b: now + 1100, from: here, to: here, pose: 'raise', face: 'SE' }, ...a.clips] }))
}


export function opStarted(w: World, op: Op, now: number): World {
  if (w.ops.some(o => o.key === op.key) || w.done.includes(op.key)) return w
  const waits = op.activity === 'ask' ? [...w.waits, `op:${op.key}`] : w.waits
  const at: World = { ...w, ops: [...w.ops, op].slice(-64), waits, isUnknown: false }
  if (op.actor !== RED) {
    return swap(at, op.actor, a => ({ ...a, doing: [wordsOf(op.activity), op.detail].filter(Boolean).join(' · '), doingAt: now }))
  }
  return aim(at, now)
}

export function opRunning(w: World, key: string, now: number): World {
  const op = w.ops.find(o => o.key === key)
  if (!op) return w
  const waits = w.waits.filter(x => x !== `allow:${op.actor}:${op.tool}`)
  const at: World = { ...w, waits, ops: w.ops.map(o => (o.key === key ? { ...o, isRunning: true } : o)) }
  return waits.length !== w.waits.length ? aim(at, now) : at
}

export function opEnded(w: World, key: string, outcome: Outcome, now: number): World {
  const op = w.ops.find(o => o.key === key)
  if (!op || w.done.includes(key)) return w
  const done = [...w.done, key].slice(-200)
  const ops = w.ops.filter(o => o.key !== key)
  const waits = w.waits.filter(x => x !== `op:${key}` && x !== `allow:${op.actor}:${op.tool}`)
  const isBad = outcome === 'failed' || outcome === 'cancelled' || outcome === 'denied'
  const said: Record<Outcome, string> = { ok: '', failed: 'failed', cancelled: 'cancelled', denied: 'not allowed' }
  const name: Record<Activity, string> = { read: 'Read', write: 'Write', shell: 'Command', web: 'Web request', generic: 'Tool call', spawn: 'Helper', ask: 'Question' }
  const mark = isBad && op.activity !== 'ask'
    ? { station: HOME[op.activity], kind: outcome === 'failed' ? ('failed' as const) : ('cancelled' as const), text: `${name[op.activity]} ${said[outcome]}`, until: now + 8000 }
    : w.mark && w.mark.until > now ? w.mark : null
  const at: World = { ...w, ops, done, waits, mark }
  return op.actor === RED ? aim(at, now) : at
}

// ---- waiting on the person

export function waiting(w: World, key: string, now: number): World {
  if (w.waits.includes(key)) return w
  return aim({ ...w, waits: [...w.waits, key], isUnknown: false }, now)
}
export function answered(w: World, key: string, now: number): World {
  if (!w.waits.includes(key)) return w
  return aim({ ...w, waits: w.waits.filter(x => x !== key) }, now)
}

// ---- background work

export function backgrounds(w: World, list: Background[]): World {
  return { ...w, background: list }
}

// ---- helpers

export function helperCame(w: World, id: string, parent: string | null, role: string, what: string, now: number): World {
  if (w.actors.some(a => a.id === id) || w.actors.filter(a => a.kind === 'helper').length >= SIDES.length) return w
  const taken = w.actors.filter(a => a.kind === 'helper').map(a => a.mark)
  const mark = SIDES.findIndex((_, k) => !taken.includes(k))
  const spot = SIDES[mark] ?? LIFT
  const way = trip(still(LIFT, 'SE', 'idle', now), spot, { now, cap: 1800, hold: { pose: 'idle', ms: 600 } })
  const helper: Actor = {
    id, kind: 'helper', parent: parent ?? RED, role: role || 'Helper', badge: 0, mark,
    clips: rest(way, spot, 'SE', 'type', now), station: 'lift', doing: what.slice(0, 60) || 'Working', doingAt: now, phase: 'here',
  }
  return { ...w, actors: [...w.actors, helper] }
}

const GONE = 400

/** The helper's own end. Only a confirmed success with its parent in the room carries a disc across. */
export function helperLeft(w: World, id: string, parent: string | null, isSuccess: boolean, now: number): World {
  const h = w.actors.find(a => a.id === id && a.kind === 'helper')
  if (!h || h.phase !== 'here') return w
  const owner = w.actors.find(a => a.id === h.parent && a.kind !== 'peer')
  const isMatch = isSuccess && owner !== undefined && (parent ?? RED) === h.parent
  let clips: Clip[]
  if (isMatch) {
    const meet = beside(tileAt(owner.clips, now))
    const there = trip(h.clips, meet.at, { now, cap: 1500 })
    const t = there[there.length - 1]?.b ?? now
    const give: Clip = { a: t, b: t + 1000, from: meet.at, to: meet.at, pose: 'handoff', face: meet.face }
    clips = [...there, give, ...trip([{ ...give, b: null }], LIFT, { now: t + 1000, cap: 1500 })]
  } else {
    clips = trip(h.clips, LIFT, { now, cap: 1500 })
    if (clips.length === 0) clips = [{ a: now, b: now + GONE, from: LIFT, to: LIFT, pose: 'idle', face: 'SE' }]
  }
  return swap({ ...w, ops: w.ops.filter(o => o.actor !== id) }, id, a => ({
    ...a, clips, phase: isMatch ? 'delivering' : 'leaving', doing: isMatch ? 'Delivering its result' : 'Left without a confirmed result', doingAt: now,
  }))
}

/** A free tile next to the parent, and the way to face it. */
function beside(at: Tile): { at: Tile; face: Face } {
  const [i, j] = at
  const tries: Array<{ at: Tile; face: Face }> = [
    { at: [i, j + 1], face: 'NE' }, { at: [i + 1, j], face: 'NW' }, { at: [i, j - 1], face: 'SW' }, { at: [i - 1, j], face: 'SE' },
  ]
  return tries.find(t => trip(still([3, 5], 'SE', 'idle', 0), t.at, { now: 0, cap: 1, perTile: 1 }).length > 0 && inside(t.at)) ?? { at: [3, 5], face: 'NE' }
}
function inside([i, j]: Tile): boolean {
  return i >= 1 && j >= 1 && i < 7 && j < 7 && !(i === 2 && j === 3) && !(i >= 4 && j === 1)
}

export function lastMoment(a: Actor): number {
  return a.clips.reduce((t, c) => Math.max(t, c.b ?? c.a), 0)
}
/** Clears what has finished leaving. */
export function swept(w: World, now: number): World {
  const actors = w.actors.filter(a => !(a.kind === 'helper' && a.phase !== 'here' && now >= lastMoment(a)))
  const mark = w.mark && w.mark.until <= now ? null : w.mark
  return actors.length === w.actors.length && mark === w.mark ? w : { ...w, actors, mark }
}

// ---- the other sessions in this project

export function peers(w: World, seen: ReadonlyMap<string, Presence>, now: number): World {
  const ids = [...seen.keys()].slice(0, 3)
  const kept = w.actors.filter(a => a.kind !== 'peer' || ids.includes(a.id))
  let isChanged = kept.length !== w.actors.length
  const next = kept.map(a => {
    const p = a.kind === 'peer' ? seen.get(a.id) : undefined
    if (!p || (p.station === a.station && p.doing === a.doing && p.badge === a.badge)) return a
    isChanged = true
    const seat = 1 + (ids.indexOf(a.id) % 2)
    return { ...send(a, p.station, now, { seat, ...(p.isWaiting ? { pose: 'raise' as Pose } : {}) }), badge: p.badge, doing: p.doing, doingAt: p.at }
  })
  for (const id of ids) {
    const p = seen.get(id)
    if (!p || next.some(a => a.id === id)) continue
    isChanged = true
    const spots = ANCHORS[p.station]
    const spot = spots[1 + (ids.indexOf(id) % 2)] ?? spots[0]
    if (!spot) continue
    next.push({
      id, kind: 'peer', parent: null, role: 'Red Code', badge: p.badge, mark: 0,
      clips: still(spot.at, spot.face, p.isWaiting ? 'raise' : spot.pose, now), station: p.station, doing: p.doing, doingAt: p.at, phase: 'here',
    })
  }
  return isChanged ? { ...w, actors: next } : w
}

/** The lowest badge no other live session in the project holds. */
export function freeBadge(seen: Iterable<Presence>): number {
  const held = new Set([...seen].map(p => p.badge))
  for (let n = 1; n < 10; n++) if (!held.has(n)) return n
  return 9
}

// ---- what is lit, and the words for it

export type Lights = Record<Station, boolean> & { isWriting: boolean; isBackground: boolean }

export function lightsOf(w: World): Lights {
  const on = (s: Station) => w.ops.some(o => HOME[o.activity] === s)
  return {
    archive: on('archive'), turbine: on('turbine') || w.background.length > 0, beacon: on('beacon'),
    console: on('console') || w.isReplying, lift: w.actors.some(a => a.kind === 'helper'), rail: w.waits.length > 0, pier: false,
    isWriting: w.ops.some(o => o.activity === 'write'), isBackground: w.background.length > 0,
  }
}

export function statusOf(w: World, now: number): string {
  const parts: string[] = []
  const count = (a: Activity) => w.ops.filter(o => o.activity === a).length
  if (w.waits.length > 0) parts.push('Needs you')
  if (w.isUnknown) parts.push('Activity unknown since reload')
  const reads = count('read')
  const writes = count('write')
  const shells = count('shell')
  const webs = count('web')
  if (reads > 0) parts.push(`Archive · reading${reads > 1 ? ` ${reads} files` : ''}`)
  if (writes > 0) parts.push(`Archive · writing${writes > 1 ? ` ${writes} files` : ''}`)
  if (shells > 0) parts.push(`Core · ${shells > 1 ? `${shells} commands` : 'command'} running`)
  if (webs > 0) parts.push('Beacon · searching the web')
  if (count('generic') > 0) parts.push('Tool active')
  if (count('spawn') > 0) parts.push(count('spawn') > 1 ? `${count('spawn')} helpers out` : 'Helper out')
  if (w.background.length > 0) parts.push('Core · background job running')
  if (w.mark && w.mark.until > now) parts.push(w.mark.text)
  if (w.isReplying && parts.length === 0) parts.push('Writing console · replying')
  if (parts.length === 0) parts.push(w.turn !== null || w.isWaking ? 'Thinking' : 'The house is quiet')
  return parts.join('  |  ')
}
