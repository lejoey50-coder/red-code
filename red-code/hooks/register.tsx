import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeSetArgs } from 'claude-code'

import type { Actor, Outcome, Presence, RedCodeSettings, RoomView, World } from '../types'
import { makeColors } from './make-colors.js'
import { drawRoom, drawStrip } from './scene'
import * as play from './play'
import * as world from './world'
import { RED } from './world'

const SCENE = 'red-code-house'
/** The pane an earlier version opened beside the chat. */
const OLD_PANE = 'red-code'
const VIEWS: RoomView[] = ['room', 'strip', 'off']
const DEFAULTS: RedCodeSettings = { view: 'room', motion: 'full' }
/** A session not heard from in this long is not drawn. */
const STALE = 80000
const BEAT = 8000
/** How often a session looks for a setting changed in another. */
const LISTEN = 3000

const settings = atom({ plugin: 'red-code', key: 'settings' } as const, DEFAULTS, { shape: 'settings-1' })
const state = atom({ plugin: 'red-code', key: 'world' } as const, world.EMPTY, { shape: 'world-1' })

// ---- the look: black water and dark stone, cyan for what can be pressed, red for what is the person's own

const { theme } = makeColors({
  label: 'Red Code',
  only: 'dark',
  roles: { accent: '#3FC3D6', danger: '#F0564A', success: '#4FC08E', warning: '#E9A94A', pro: '#A58BE0' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#060B10',
        'surface-1': '#0A1219',
        'surface-2': '#0F1921',
        'surface-3': '#14202A',
        'text-primary': '#EAF2F5',
        'text-secondary': '#BDCCD3',
        'text-muted': '#91A4AE',
      },
    },
  },
})

const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: SCENE, glass: { blur: 12, tint: '#060B10', opacity: 0.62 } },
  overrideColorScheme: 'dark',
}
/** The messages: dark plates with square corners, so the words never sit on the picture itself. */
const PLATES: ThemeSetArgs['style'] = {
  Heading: { color: '#FFC2C8' },
  UserMessage: { color: '#FFE9EB', backgroundColor: '#2A0B14F0', borderColor: '#EE344D', borderWidth: 1, radius: 4, paddingX: 14, paddingY: 10 },
  AssistantMessage: { color: '#EAF2F5', backgroundColor: '#070C11EB', borderColor: '#1C2E38', borderWidth: 1, radius: 4, paddingX: 14, paddingY: 10 },
  ToolUse: { color: '#BDCCD3', backgroundColor: '#070C11E0', radius: 3, paddingX: 8 },
}

/** Puts the building behind the chat. A build that takes no `style` still gets the scene and the colors. It never throws. */
async function dress($: EngineInterface): Promise<void> {
  try {
    await $.theme.set({ ...LOOK, style: PLATES })
  } catch (error) {
    $.ui.log(`Red Code drew without message plates: ${String(error).slice(0, 200)}`)
    await $.theme.set(LOOK).catch(e => $.ui.log(`Red Code could not draw: ${String(e).slice(0, 200)}`))
  }
}
function clean(value: unknown): RedCodeSettings {
  const v = (value ?? {}) as Partial<RedCodeSettings>
  return { view: VIEWS.includes(v.view as RoomView) ? (v.view as RoomView) : DEFAULTS.view, motion: v.motion === 'still' ? 'still' : 'full' }
}

function isPresence(v: unknown): v is Presence {
  const p = (v ?? {}) as Partial<Presence>
  return typeof p.project === 'string' && typeof p.badge === 'number' && typeof p.station === 'string' && typeof p.doing === 'string' && typeof p.at === 'number'
}

/** A change to the room. It never throws: a picture must not stand in the way of a prompt or a call. */
async function note($: EngineInterface, fn: (w: World, now: number) => World): Promise<void> {
  try {
    const now = await $.clock.now()
    await update($, state, w => world.swept(fn(w, now), now))
  } catch {
    // The room stays as it last was.
  }
}

const MINE = new Set(['composer', 'bridge', 'sdk', 'unclassified'])

// This load's own facts. Each is found again at session.start.
let me = ''
let project = ''
let badge = 1
let startedAt = 0
let wroteAt = 0
let said = ''
/** Counts this session's own changes, so a setting read just before one is not put back over it. */
let changes = 0
/** The window's shape, width over height, for placing a click: told by /redcode size, else the engine's measure. */
let told = 0
let measured = 0
const shapeNow = () => told || measured || 1.6
/** When typing was last noted, so a keystroke does not redraw the room. */
let typedAt = 0

// ---- the other sessions in this project: a place and a word each, through the mod's own store

async function others($: EngineInterface, now: number): Promise<Map<string, Presence>> {
  const seen = new Map<string, Presence>()
  for (const key of await $.store.keys()) {
    if (!key.startsWith('at:') || key === `at:${me}`) continue
    const p = await $.store.get(key)
    if (!isPresence(p) || now - p.at > STALE) {
      // Whoever it was stopped without a word. The record is this mod's own, so it goes.
      if (!isPresence(p) || now - p.at > STALE * 20) await $.store.delete(key)
      continue
    }
    if (p.project === project) seen.set(key.slice(3), p)
  }
  return new Map([...seen].sort((a, b) => a[1].startedAt - b[1].startedAt))
}

async function beat($: EngineInterface): Promise<void> {
  try {
    if (me === '' || (await read($, settings)).view === 'off') return
    const now = await $.clock.now()
    const seen = await others($, now)
    // Two that opened at once can hold one badge: the later of them takes another.
    const isTaken = [...seen].some(([id, p]) => p.badge === badge && (p.startedAt < startedAt || (p.startedAt === startedAt && id < me)))
    if (isTaken) {
      badge = world.freeBadge(seen.values())
      said = ''
      await note($, x => world.rebadged(x, badge))
    }
    const w = await read($, state)
    const red = w.actors.find(a => a.id === RED)
    if (!red) return
    const doing = w.waits.length > 0 ? 'Needs you' : word(red)
    const line = `${red.station}|${doing}`
    if (line !== said || now - wroteAt > STALE / 3) {
      said = line
      wroteAt = now
      const mine: Presence = { project, badge, station: red.station, doing, isWaiting: w.waits.length > 0, startedAt, at: now }
      await $.store.set(`at:${me}`, mine)
    }
    const next = world.swept(play.idle(world.homeward(world.peers(w, seen, now), now), now), now)
    if (next !== w) await note($, (x, t) => play.idle(world.homeward(world.peers(x, seen, t), t), t))
  } catch {
    // Nothing heard this time.
  }
}

/** An agent that answered but whose report never came: it goes once the engine says it is no longer running. */
async function checkHelper($: EngineInterface, id: string): Promise<void> {
  try {
    const one = (await $.agent.list()).find(a => a.id === id)
    if (one !== undefined && (one.taskStatus === 'running' || one.taskStatus === 'pending' || one.taskStatus === 'paused')) return
    await note($, (w, t) => world.helperLeft(w, id, null, false, t))
  } catch {
    // Not known, so it stays where it was last seen.
  }
}

async function change($: EngineInterface, patch: Partial<RedCodeSettings>): Promise<RedCodeSettings> {
  changes += 1
  const before = await read($, settings)
  const next = clean({ ...before, ...patch })
  await $.store.set('settings', next)
  await update($, settings, () => next)
  if (patch.view !== undefined) await show($, before, next)
  return next
}

/** The look that goes with a setting. */
async function show($: EngineInterface, before: RedCodeSettings, next: RedCodeSettings): Promise<void> {
  if (next.view === 'room') await dress($)
  // There is one theme, whoever set it, so it is cleared only when it was this one.
  else if (before.view === 'room') await $.theme.clear()
  said = ''
  if (next.view === 'off' && me !== '') await $.store.delete(`at:${me}`)
}

/** Takes up a setting the person changed in another chat. */
async function listen($: EngineInterface): Promise<void> {
  try {
    const at = changes
    const stored = await $.store.get('settings')
    const before = await read($, settings)
    if (stored === undefined || at !== changes) return
    const next = clean(stored)
    if (next.view === before.view && next.motion === before.motion) return
    changes += 1
    await update($, settings, () => next)
    if (next.view !== before.view) await show($, before, next)
  } catch {
    // Not heard this time.
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // The look first, and by itself: a new chat wears it even where something after it fails.
    try {
      const shape = await $.store.get('shape').catch(() => undefined)
      if (typeof shape === 'number' && shape > 0.4 && shape < 5) told = shape
      const saved = clean(await $.store.get('settings').catch(() => undefined))
      await update($, settings, () => saved)
      if (saved.view === 'room') await dress($)
    } catch (error) {
      $.ui.log(`Red Code did not dress this chat: ${String(error).slice(0, 200)}`)
    }
    try {
      $.clock.every(LISTEN, () => void listen($))
      await $.command.register({
        name: 'redcode',
        description: 'Red Code: the building as your interface, or /redcode strip | off | motion full | motion still | size 1600x900',
      })
      const now = await $.clock.now()
      me = await $.session.id()
      const repo = await $.session.repo().catch(() => null)
      project = repo?.root ?? e.cwd
      startedAt = now
      badge = world.freeBadge((await others($, now)).values())
      await note($, (w, t) => world.opened(w, me, badge, t))
      await $.ui.close({ id: OLD_PANE }).catch(() => undefined)
      $.clock.every(BEAT, () => void beat($))
      void beat($)
    } catch (error) {
      $.ui.log(`Red Code did not start: ${String(error).slice(0, 200)}`)
    }
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    try {
      await $.store.delete(`at:${e.sessionId}`)
      if (e.reason === 'clear') {
        await note($, (w, t) => world.opened({ ...w, session: '' }, me, badge, t))
      }
    } catch {
      // The record goes stale by itself.
    }
    return next(e)
  })

  // ---- the turn

  on('prompt.submit', async ($, e, next) => {
    const result = await next(e)
    if (e.origin.kind === 'task-notification') {
      // A background job spoke. If it names itself, its light goes out now; the turn's end checks the rest.
      const id = /<task-id>([^<]+)<\/task-id>/.exec(e.text)?.[1]
      if (id) await note($, w => world.backgrounds(w, w.background.filter(b => b.id !== id)))
    }
    const isDropped = 'drop' in result && result.drop !== undefined
    if (!e.isMeta && e.command === undefined && e.turnId === undefined && MINE.has(e.origin.kind) && !isDropped) {
      // The turn may have begun beneath: a file read already under way keeps its place.
      await note($, (w, t) => (w.ops.length > 0 || w.waits.length > 0 || w.isReplying ? w : world.launched(w, t)))
    }
    return result
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      // A /clear goes on under another id, and no session.start says so.
      const id = await $.session.id().catch(() => me)
      if (id !== me) me = id
      await note($, (w, t) => world.turnStarted(w.session === me ? w : world.opened(w, me, badge, t), e.turnId))
    }
    return next(e)
  })

  on('classic.MessageDisplay', async ($, e, next) => {
    if (e.index === 0 && e.agent_id === undefined) await note($, (w, t) => world.replying(w, t))
    return next(e)
  })

  on('classic.Stop', async ($, e, next) => {
    if (e.agent_id === undefined && e.background_tasks !== undefined) {
      const list = e.background_tasks
        .filter(b => b.type !== 'subagent' && b.type !== 'teammate')
        .map(b => ({ id: b.id, label: b.type, a: 0 }))
      await note($, w => world.backgrounds(w, list))
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const isStopped = e.reason === 'aborted' || e.isAborted === true
      await note($, (w, t) => world.turnEnded(isStopped ? play.stopped(w, t) : w, e.turnId, t, !isStopped))
      void beat($)
    } else {
      // Its report says how it went. One that was cut off leaves with nothing; one that answered may still
      // be waiting on work of its own, so it is asked after before it goes.
      const id = e.agentId
      if (e.reason === 'answer') $.clock.after(30000, () => void checkHelper($, id))
      else $.clock.after(4000, () => void note($, (w, t) => world.helperLeft(w, id, null, false, t)))
    }
    return next(e)
  })

  // ---- calls

  on('tool.call', async ($, e, next) => {
    const key = `${me}:${e.tool_use_id}`
    const actor = e.agentId ?? RED
    const activity = world.activityOf(e.tool)
    const detail = world.detailOf(e.tool, e as unknown as Record<string, unknown>)
    await note($, (w, t) => world.opStarted(w, { key, actor, tool: e.tool, activity, detail, a: t, isRunning: false }, t))
    let outcome: Outcome = 'cancelled'
    try {
      const ran = await next(e)
      if (ran.deny !== undefined) outcome = 'denied'
      else if (ran.isError) outcome = next.signal.aborted || /interrupted|aborted|rejected|doesn't want/i.test(ran.text ?? '') ? 'cancelled' : 'failed'
      else outcome = 'ok'
      return ran
    } finally {
      await note($, (w, t) => world.opEnded(w, key, outcome, t))
    }
  })

  // The call was allowed and is about to run: whatever it waited on is over.
  on('tool.run', async ($, e, next) => {
    await note($, (w, t) => world.opRunning(w, `${me}:${e.tool_use_id}`, t))
    return next(e)
  })

  // ---- waiting on the person

  on('classic.PermissionRequest', async ($, e, next) => {
    const key = `allow:${e.agent_id ?? RED}:${e.tool_name}`
    await note($, (w, t) => world.waiting(w, key, t))
    return next(e)
  })
  on('classic.Elicitation', async ($, e, next) => {
    await note($, (w, t) => world.waiting(w, `form:${e.mcp_server_name}`, t))
    return next(e)
  })
  on('classic.ElicitationResult', async ($, e, next) => {
    await note($, (w, t) => world.answered(w, `form:${e.mcp_server_name}`, t))
    return next(e)
  })

  // ---- helpers: each one on screen is a real agent, owned by the loop that spawned it

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    if (result.deny === undefined && result.agentId !== undefined) {
      const id = result.agentId
      await note($, (w, t) => world.helperCame(w, id, e.parentAgentId ?? null, e.subagentType, e.description, t))
    }
    return result
  })

  on('agent.report', async ($, e, next) => {
    const result = await next(e)
    await note($, (w, t) => world.helperLeft(w, e.agentId, e.parentAgentId ?? null, e.status === 'completed', t))
    // Once it has walked out, its row goes too.
    $.clock.after(6000, () => void note($, w => w))
    return result
  })

  // ---- the person, seen from the room

  // Typing in the message box: he looks up. Noted once in a while, not at every key.
  on('prompt.edit', async ($, e, next) => {
    const result = await next(e)
    try {
      const now = await $.clock.now()
      if (now - typedAt > 8000) {
        typedAt = now
        await note($, (w, t) => play.noticed(w, t))
      }
    } catch {
      // Not seen this time.
    }
    return result
  })

  // The Stop: the hologram powers down. Noted before anything awaits, as the Stop goes on regardless.
  on('session.stop', async ($, e, next) => {
    const stop = note($, (w, t) => play.stopped(w, t))
    const result = await next(e)
    await stop
    return result
  })

  // A click on the backdrop: a tile to walk to, or a thing to use. It outranks the session for a while.
  on('ui.pointer', async ($, e, next) => {
    if (e.scene !== SCENE) return next(e)
    const set = await read($, settings)
    const shape = shapeNow()
    if (set.view === 'room') await note($, (w, t) => play.click(w, e.x, e.y, shape, t))
    return next(e)
  })

  // ---- /redcode

  on('command.run', { command: 'redcode' }, async ($, e) => {
    const [first = '', second = ''] = e.args.trim().toLowerCase().split(/\s+/)
    if (first === '' || first === 'room' || first === 'on') {
      await change($, { view: 'room' })
      return { text: 'Red Code: the building is your interface.' }
    }
    if (first === 'strip') {
      await change($, { view: 'strip' })
      return { text: 'Red Code: compact strip above the message box.' }
    }
    if (first === 'off') {
      await change($, { view: 'off' })
      return { text: 'Red Code is off, and the app has its own look again, in every chat. /redcode brings it back.' }
    }
    if (first === 'motion' && (second === 'full' || second === 'still')) {
      await change($, { motion: second })
      return { text: `Red Code: motion ${second}.` }
    }
    if (first === 'size') {
      const m = /^(\d{3,5})\s*[x:*]\s*(\d{3,5})$/.exec(e.args.trim().toLowerCase().replace(/^size\s+/, ''))
      if (!m) return { text: 'Red Code: give the window as width x height, such as /redcode size 1600x900, so clicks land on the right tile.' }
      told = Number(m[1]) / Number(m[2])
      await $.store.set('shape', told)
      return { text: `Red Code: clicks read for a ${m[1]} x ${m[2]} window.` }
    }
    return { text: 'Try /redcode, /redcode strip, /redcode off, /redcode motion full or /redcode motion still, or /redcode size 1600x900.' }
  })

  // ---- the picture

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || e.props.scene !== SCENE) return next(e)
    const set = await read($, settings)
    const w = await read($, state)
    const now = await $.clock.now()
    const { Svg } = $.ui.resolve(e)
    // Cells of the code font: about 0.6 of a line's height wide over a 1.5 line. Used only if it is sane.
    const v = e.viewport
    if (v && v.columns > 0 && v.rows > 0) {
      const guess = (v.columns * 0.6) / (v.rows * 1.5)
      measured = guess > 0.9 && guess < 3.2 ? guess : 0
    }

    return <Svg source={drawRoom(w, now, { isStill: set.motion === 'still' })} alt={altOf(w, world.statusOf(w, now))} isInteractive />
  })
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const set = await read($, settings)
    if (set.view !== 'strip' || e.props.hasSurvey || e.surface === 'terminal') return next(e)
    const w = await read($, state)
    const now = await $.clock.now()
    const status = world.statusOf(w, now)
    const { Box, Svg, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Svg source={drawStrip(w, now, { isStill: set.motion === 'still' })} alt={`Red Code. ${status}`} width={128} height={56} />
        <Text {...(w.waits.length > 0 ? { color: '#FFC36A', bold: true } : {})}>{status}</Text>
      </Box>
    )
  })
}

/** What another session may say of itself: never a file name. */
function word(a: Actor): string {
  return a.doing.split(' · ')[0] ?? ''
}

function nameOf(a: Actor, w: World): string {
  const isMany = w.actors.filter(x => x.kind !== 'helper').length > 1
  if (a.kind === 'helper') return `${a.role} ${a.mark + 1}`
  return isMany ? `Red Code ${a.badge}` : 'Red Code'
}

function altOf(w: World, status: string): string {
  const who = w.actors.map(a => `${nameOf(a, w)}: ${a.doing}`).join('. ')
  return `A city at night, and a pixel-art building cut away to show one lit room. ${status}. ${who}.`
}
