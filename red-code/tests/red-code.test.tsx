import { describe, expect, mock, test } from 'claude-code/testing'

import { drawRoom } from '../hooks/scene'

const SITE = {
  plugin: 'red-code',
  component: 'Backdrop',
  props: { scene: 'red-code-house', plugin: 'red-code', glass: { blur: 12, opacity: 0.62 } },
} as const
const BAND = {
  plugin: 'red-code',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const
const RUN = { command: 'redcode', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as any
const BASE = { session_id: 's', transcript_path: '/t', cwd: '/p' }

// The world beneath the mod. A tool call is held open until the test settles it.
async function open($: any, on: any, o: { stored?: Record<string, unknown>; refusesStyle?: boolean; refusesCommand?: boolean } = {}) {
  const clock = mock.clock(on, { now: 1_000_000 } as any)
  const store = new Map<string, unknown>(Object.entries(o.stored ?? {}))
  on('store.get', (_: unknown, e: any) => ({ value: store.get(e.key) }))
  on('store.set', (_: unknown, e: any) => { store.set(e.key, e.value); return { value: undefined } })
  on('store.delete', (_: unknown, e: any) => { store.delete(e.key); return { value: undefined } })
  on('store.keys', () => ({ value: [...store.keys()] }))
  const held = new Map<string, (r: unknown) => void>()
  const opened = { panes: 0, closed: 0, cleared: 0, looks: [] as any[] }
  on('command.register', () => {
    if (o.refusesCommand) throw new Error('no commands here')
    return { value: { command: 'redcode' } }
  })
  on('ui.open', () => {
    opened.panes += 1
    return { value: { isPlaced: true } }
  })
  on('ui.close', () => {
    opened.closed += 1
    return { value: undefined }
  })
  on('theme.set', (_: unknown, e: any) => {
    if (o.refusesStyle && e.style) throw new Error('style is not known')
    opened.looks.push(e)
    return { value: { isDrawn: true, requestId: 'b' } }
  })
  on('theme.clear', () => {
    opened.cleared += 1
    return { value: { isDrawn: false, reason: 'cleared' } }
  })
  on('session.id', () => ({ value: 's1' }))
  on('session.repo', () => ({ value: null }))
  on('session.start', (_: unknown, e: any) => ({ cwd: e.cwd }))
  on('session.end', (_: unknown, e: any) => ({ sessionId: e.sessionId }))
  on('prompt.submit', (_: unknown, e: any) => (e.text === 'stopped' ? { drop: 'no' } : { text: e.text }))
  on('turn.start', (_: unknown, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', (_: unknown, e: any) => ({ text: e.answer }))
  on('agent.spawn', (_: unknown, e: any) => ({ model: 'm', agentId: e.prompt }))
  const agents: any[] = []
  on('agent.list', () => ({ value: agents }))
  on('agent.report', (_: unknown, e: any) => ({ text: e.text }))
  on('tool.call', (_: unknown, e: any) => new Promise(done => held.set(e.description ?? e.command ?? e.file_path ?? e.query ?? e.tool, done)))
  for (const name of ['PermissionRequest', 'MessageDisplay', 'Stop', 'Elicitation', 'ElicitationResult']) on(`classic.${name}`, () => ({}))
  await $.session.start({ cwd: '/p', surface: 'desktop', isInteractive: true })
  const ui = await $.ui.mount({ ...SITE, surface: 'desktop' })
  const status = async () => /lit room\. (.*?)\. Red Code/.exec(await alt())?.[1]
  const svg = async () => (await ui.find({ type: 'Svg' }))?.props.source as string
  const alt = async () => (await ui.find({ type: 'Svg' }))?.props.alt as string
  /** Starts a call and leaves it running. */
  const call = async (name: string, input: any) => {
    const ended = $.tool.call(input).catch(() => undefined)
    for (let k = 0; k < 400 && !held.has(name); k++) await Promise.resolve()
    expect(held.has(name)).toBe(true)
    return async (result: unknown = { result: {} }) => {
      held.get(name)?.(result)
      held.delete(name)
      await ended
    }
  }
  /** How many are drawn: each is named once, with what it is doing. */
  const count = async (name: RegExp) => [...(await alt()).matchAll(new RegExp(`(?:${name.source})(?: \\d)?: `, 'g'))].length
  return { agents, store, clock, ui, status, svg, alt, call, opened, count }
}

const submit = ($: any, text = 'hi', more = {}) => $.prompt.submit({ text, wait: false, origin: { kind: 'composer' }, ...more })
const start = ($: any, turnId = 't1', more = {}) => $.turn.start({ text: 'hi', turnId, ...more })
const complete = ($: any, turnId = 't1', more = {}) => $.turn.complete({ answer: 'done', turnId, reason: 'answer', durationMs: 1, isAborted: false, ...more })
const spawn = ($: any, id: string, more = {}) =>
  $.agent.spawn({ tool_use_id: `u-${id}`, prompt: id, description: 'look', subagentType: 'Explore', provider: { plugin: 'engine', tier: 'core' }, parentModel: 'm', fork: false, ...more })
const report = ($: any, id: string, status = 'completed', more = {}) =>
  $.agent.report({ agentId: id, subagentType: 'Explore', provider: { plugin: 'engine', tier: 'core' }, status, text: 'found', ...more })

describe('the house', () => {
  test('is the interface: one look behind the chat, no pane, and an old pane is closed', async ($, on) => {
    const t = await open($, on)
    expect(t.opened.panes).toBe(0)
    expect(t.opened.closed).toBe(1)
    expect(t.opened.looks.length).toBe(1)
    expect(t.opened.looks[0].backdrop.scene).toBe('red-code-house')
    expect(Object.keys(t.opened.looks[0].colors.inputs)).toEqual(['dark'])
    expect(await t.status()).toBe('The house is quiet')
    const svg = await t.svg()
    expect(svg.length < 131072).toBe(true)
    expect(svg.includes('prefers-reduced-motion')).toBe(true)
    expect(svg.includes('preserveAspectRatio="xMaxYMax slice"')).toBe(true)
    for (const banned of ['<image', 'data:', 'foreignObject', '@import', '@font-face', 'http://www.w3.org/1999']) expect(svg.includes(banned)).toBe(false)
  })

  test('launches once for an accepted prompt and not for a refused one', async ($, on) => {
    const t = await open($, on)
    await submit($, 'stopped')
    expect(await t.alt()).toMatch(/Red Code: Idle/)
    await submit($)
    expect(await t.alt()).toMatch(/Red Code: Starting/)
    expect((await t.svg()).includes('bikeSE')).toBe(true)
  })

  test('a read mid-launch lights the archive at once, and the end of the turn rests him', async ($, on) => {
    const t = await open($, on)
    await submit($)
    await start($)
    const end = await t.call('/a/notes.md', { tool: 'Read', file_path: '/a/notes.md' })
    expect(await t.status()).toBe('Archive · reading')
    expect(await t.alt()).toMatch(/Reading · notes\.md/)
    await end()
    await $.classic.MessageDisplay({ ...BASE, turn_id: 't1', message_id: 'm', index: 0, final: false, delta: 'a' })
    expect(await t.status()).toBe('Writing console · replying')
    await complete($)
    expect(await t.alt()).toMatch(/Red Code: Resting/)
  })

  test('overlapping calls light both stations and keep one sprite', async ($, on) => {
    const t = await open($, on)
    await start($)
    const one = await t.call('/a', { tool: 'Read', file_path: '/a' })
    const two = await t.call('/b', { tool: 'Read', file_path: '/b' })
    const sh = await t.call('build', { tool: 'Bash', command: 'build' })
    expect(await t.status()).toBe('Archive · reading 2 files  |  Core · command running')
    expect(await t.count(/Red Code/)).toBe(1)
    await sh()
    await one()
    expect(await t.status()).toBe('Archive · reading')
    await two()
    expect(await t.status()).toBe('Thinking')
  })

  test('failure, refusal and success are told apart', async ($, on) => {
    const t = await open($, on)
    await start($)
    await (await t.call('x', { tool: 'Bash', command: 'x' }))({ isError: true, result: 'exit 1', text: 'exit 1' })
    expect(await t.status()).toBe('Command failed')
    await (await t.call('y', { tool: 'Bash', command: 'y' }))({ deny: 'no' })
    expect(await t.status()).toBe('Command not allowed')
    await (await t.call('z', { tool: 'Bash', command: 'z' }))({ isError: true, result: 'x', text: 'Request interrupted by user' })
    expect(await t.status()).toBe('Command cancelled')
  })

  test('a duplicate end of a turn, and a call the turn left open, change nothing twice', async ($, on) => {
    const t = await open($, on)
    await start($)
    const late = await t.call('slow', { tool: 'Bash', command: 'slow' })
    await complete($, 't1', { reason: 'aborted', isAborted: true, answer: '' })
    expect(await t.status()).toBe('The house is quiet')
    await late()
    await complete($)
    expect(await t.status()).toBe('The house is quiet')
    expect(await t.alt()).toMatch(/Resting/)
  })

  test('an old turn ending does not stop the new one', async ($, on) => {
    const t = await open($, on)
    await start($, 't2')
    await t.call('/a', { tool: 'Read', file_path: '/a' })
    await complete($, 't1')
    expect(await t.status()).toBe('Archive · reading')
  })

  test('a permission request raises the disc until the call ends', async ($, on) => {
    const t = await open($, on)
    await start($)
    const end = await t.call('rm', { tool: 'Bash', command: 'rm' })
    await $.classic.PermissionRequest({ ...BASE, tool_name: 'Bash', tool_input: {} })
    expect(await t.status()).toMatch(/^Needs you/)
    const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await band.find({ type: 'Svg' })).toBe(undefined)
    await end()
    expect(await t.status()).toBe('Thinking')
  })

  test('a question waits on the person', async ($, on) => {
    const t = await open($, on)
    await start($)
    const end = await t.call('AskUserQuestion', { tool: 'AskUserQuestion', questions: [] })
    expect(await t.status()).toBe('Needs you')
    await end()
    expect(await t.status()).toBe('Thinking')
  })

  test('a background job keeps the turbine lit after the turn', async ($, on) => {
    const t = await open($, on)
    await start($)
    await $.classic.Stop({ ...BASE, stop_hook_active: false, background_tasks: [{ id: 'b1', type: 'shell', status: 'running', description: 'x' }] })
    await complete($)
    expect(await t.status()).toBe('Core · background job running')
    await submit($, '<task-id>b1</task-id>', { origin: { kind: 'task-notification' } })
    expect(await t.status()).toBe('The house is quiet')
  })
})

describe('helpers', () => {
  test('arrive, deliver to their own parent, and go', async ($, on) => {
    const t = await open($, on)
    await start($)
    await spawn($, 'h1')
    expect(await t.alt()).toMatch(/Explore 1: look/)
    await report($, 'h1')
    expect(await t.alt()).toMatch(/Delivering its result/)
    await t.clock.advance(12000)
    expect((await t.alt()).includes('Explore')).toBe(false)
  })

  test('a failed or stopped helper leaves with no delivery', async ($, on) => {
    const t = await open($, on)
    for (const [id, status] of [['h1', 'failed'], ['h2', 'stopped']] as const) {
      await spawn($, id)
      await report($, id, status)
      const alt = await t.alt()
      expect(alt.includes('Delivering')).toBe(false)
      expect(alt).toMatch(/Left without a confirmed result/)
    }
  })

  test('a report for another parent, or for an agent never seen, is no delivery', async ($, on) => {
    const t = await open($, on)
    await report($, 'ghost')
    expect((await t.alt()).includes('Delivering')).toBe(false)
    await spawn($, 'h1')
    await report($, 'h1', 'completed', { parentAgentId: 'someone-else' })
    expect((await t.alt()).includes('Delivering')).toBe(false)
  })

  test('a late end after the delivery is ignored', async ($, on) => {
    const t = await open($, on)
    await spawn($, 'h1')
    await report($, 'h1')
    await complete($, 'th', { agentId: 'h1' })
    await t.clock.advance(4100)
    expect((await t.alt()).includes('Left without')).toBe(false)
    await report($, 'h1')
    expect(await t.status()).toBe('The house is quiet')
  })

  test('its calls never move the parent', async ($, on) => {
    const t = await open($, on)
    await start($)
    await spawn($, 'h1')
    await t.call('/h', { tool: 'Read', file_path: '/h', agentId: 'h1' })
    expect(await t.alt()).toMatch(/Red Code: /)
    expect(await t.count(/Red Code|Explore/)).toBe(2)
  })
})

test('an agent that answered but still waits is not sent away; one that is gone is', async ($, on) => {
  const t = await open($, on)
  await spawn($, 'h1')
  t.agents.push({ id: 'h1', taskStatus: 'running' })
  await complete($, 'th', { agentId: 'h1' })
  await t.clock.advance(31000)
  expect((await t.alt()).includes('Left without')).toBe(false)
  t.agents.length = 0
  await complete($, 'th2', { agentId: 'h1' })
  await t.clock.advance(30000)
  expect(await t.alt()).toMatch(/Left without/)
})

test('after a long quiet he is back on the pier', async ($, on) => {
  const t = await open($, on)
  await start($)
  await complete($)
  await t.clock.advance(100000)
  expect(await t.alt()).toMatch(/Red Code: Idle/)
})

test('a full house with everything lit still fits in one drawing', async ($, on) => {
  const peer = (badge: number, station: string) => ({ project: '/p', badge, station, doing: 'Needs you', isWaiting: true, startedAt: badge, at: 1_000_000 })
  const t = await open($, on, { stored: { 'at:a': peer(1, 'turbine'), 'at:b': peer(2, 'beacon'), 'at:c': peer(3, 'console') } })
  await submit($)
  for (let k = 0; k < 6; k++) await spawn($, `h${k}`)
  await start($)
  await t.call('/a', { tool: 'Read', file_path: '/a' })
  await t.call('run', { tool: 'Bash', command: 'run', description: 'run' })
  await t.call('q', { tool: 'WebSearch', query: 'q' })
  let most = 0
  const look = async () => { most = Math.max(most, (await t.svg()).length) }
  for (let k = 0; k < 30; k++) { await look(); await t.clock.advance(250) }
  for (let k = 0; k < 6; k++) { await report($, `h${k}`); await look() }
  for (let k = 0; k < 20; k++) { await look(); await t.clock.advance(250) }
  expect(most).toBeGreaterThan(90000)
  expect(most).toBeLessThan(131072)
})

describe('sessions', () => {
  const other = (more = {}) => ({ project: '/p', badge: 1, station: 'turbine', doing: 'Command running', isWaiting: false, startedAt: 1, at: 1_000_000, ...more })

  test('another session in the project has its own badge and no helper of ours', async ($, on) => {
    const t = await open($, on, { stored: { 'at:s9': other() } })
    await t.clock.advance(8000)
    await spawn($, 'h1')
    const alt = await t.alt()
    expect(alt).toMatch(/Red Code 2: Idle/)
    expect(alt).toMatch(/Red Code 1: Command running/)
    expect(await t.count(/Explore/)).toBe(1)
  })

  test('other projects and silent sessions are not drawn', async ($, on) => {
    const t = await open($, on, { stored: { 'at:a': other({ project: '/elsewhere' }), 'at:b': other({ at: 1 }), 'at:c': 'junk' } })
    await t.clock.advance(8000)
    expect(await t.count(/Red Code/)).toBe(1)
  })

  test('what is shared names a place and a word, never a file', async ($, on) => {
    const t = await open($, on)
    await start($)
    await t.call('/a/secret.md', { tool: 'Read', file_path: '/a/secret.md' })
    await t.clock.advance(8000)
    const mine = JSON.stringify(t.store.get('at:s1'))
    expect(mine.includes('secret')).toBe(false)
    expect(mine).toMatch(/Reading/)
  })

  test('two that opened at once do not keep one badge: the later one moves', async ($, on) => {
    const t = await open($, on)
    t.store.set('at:s0', other({ badge: 1, startedAt: 5 }))
    await t.clock.advance(8000)
    expect((t.store.get('at:s1') as any).badge).toBe(2)
    expect(await t.alt()).toMatch(/Red Code 2: Idle/)
  })

  test('the earlier of two keeps its badge', async ($, on) => {
    const t = await open($, on)
    t.store.set('at:s9', other({ badge: 1, startedAt: 2_000_000 }))
    await t.clock.advance(8000)
    expect((t.store.get('at:s1') as any).badge).toBe(1)
  })
})

describe('every chat', () => {
  const put = async (t: any, view: string, motion = 'full') => {
    t.store.set('settings', { view, motion })
    await t.clock.advance(3000)
  }

  test('a new chat starts with the building on, with nothing typed', async ($, on) => {
    const t = await open($, on)
    expect(t.opened.looks.length).toBe(1)
  })

  test('off, on and motion set in another chat arrive here', async ($, on) => {
    const t = await open($, on)
    await put(t, 'off')
    expect(t.opened.cleared).toBe(1)
    expect(t.store.has('at:s1')).toBe(false)
    await put(t, 'room')
    expect(t.opened.looks.length).toBe(2)
    await put(t, 'room', 'still')
    expect((await t.svg()).includes('*{animation:none!important}</style>')).toBe(true)
    expect(t.opened.looks.length).toBe(2)
  })

  test('a chat that comes back on is seen by the others again', async ($, on) => {
    const t = await open($, on)
    await put(t, 'off')
    await put(t, 'room')
    await t.clock.advance(8000)
    expect(t.store.has('at:s1')).toBe(true)
  })

  test('nothing changed elsewhere draws nothing again', async ($, on) => {
    const t = await open($, on)
    await t.clock.advance(60000)
    await put(t, 'room')
    expect(t.opened.looks.length).toBe(1)
    expect(t.opened.cleared).toBe(0)
  })

  test("what is set here is saved for the others, and is not put back", async ($, on) => {
    const t = await open($, on)
    await $.command.run({ ...RUN, args: 'strip' })
    expect(t.store.get('settings')).toEqual({ view: 'strip', motion: 'full' })
    await t.clock.advance(9000)
    expect(t.opened.looks.length).toBe(1)
    expect(t.opened.cleared).toBe(1)
  })

  test('junk in the store leaves the building up', async ($, on) => {
    const t = await open($, on)
    t.store.set('settings', 'junk')
    await t.clock.advance(3000)
    expect(t.opened.cleared).toBe(0)
  })

  test('a chat that cannot register its command still wears the look', async ($, on) => {
    const t = await open($, on, { refusesCommand: true })
    expect(t.opened.looks.length).toBe(1)
  })
})

describe('settings', () => {
  test('strip, off and on', async ($, on) => {
    const t = await open($, on)
    const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
    expect(await band.find({ type: 'Svg' })).toBe(undefined)
    await $.command.run({ ...RUN, args: 'strip' })
    expect(t.opened.cleared).toBe(1)
    expect((await band.find({ type: 'Svg' }))?.props.alt).toMatch(/quiet/)
    await $.command.run({ ...RUN, args: 'off' })
    expect(await band.find({ type: 'Svg' })).toBe(undefined)
    // Its look was already gone, and whatever theme stands now is someone else's.
    expect(t.opened.cleared).toBe(1)
    await $.command.run({ ...RUN, args: '' })
    expect(t.opened.looks.length).toBe(2)
  })

  test('a build that takes no message style still gets the scene and the colors', async ($, on) => {
    const t = await open($, on, { refusesStyle: true })
    expect(t.opened.looks.length).toBe(1)
    expect(t.opened.looks[0].style).toBe(undefined)
    expect(t.opened.looks[0].backdrop.scene).toBe('red-code-house')
  })

  test("another mod's scene is left alone", async ($, on) => {
    on('ui.render', { component: 'Backdrop' }, ($u: any, e: any) => {
      const { Svg } = $u.ui.resolve(e)
      return <Svg source='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>' alt="lagoon" />
    })
    await open($, on)
    const other = await $.ui.mount({ ...SITE, props: { ...SITE.props, scene: 'lagoon', plugin: 'other' }, surface: 'desktop' })
    expect((await other.find({ type: 'Svg' }))?.props.alt).toBe('lagoon')
  })
  test('still motion draws no animation', async ($, on) => {
    const t = await open($, on, { stored: { settings: { view: 'room', motion: 'still' } } })
    expect((await t.svg()).includes('*{animation:none!important}</style>')).toBe(true)
  })

  test('off at the start opens nothing', async ($, on) => {
    const t = await open($, on, { stored: { settings: { view: 'off', motion: 'full' } } })
    expect(t.opened.looks.length).toBe(0)
    expect(t.opened.cleared).toBe(0)
  })
})

// ---- the playable room
// The engine raises `ui.pointer` only from the app, so these drive play.click, the one function that hook
// calls, with what the app would send: a click as fractions of the backdrop, in 1/64ths.

import { isFloor, place, tileAt } from '../hooks/map'
import * as play from '../hooks/play'
import * as W from '../hooks/world'

describe('the playable room', () => {
  const SHAPE = 1.6
  const T0 = 1_000_000
  const snap = (v: number) => Math.round(v * 64) / 64
  const at = (i: number, j: number) => play.toFraction(place([i, j]), SHAPE)
  const tap = (w: any, [x, y]: [number, number], now: number) => play.click(w, snap(x), snap(y), SHAPE, now)
  const red = (w: any) => w.actors.find((a: any) => a.id === 'main')
  const fresh = () => W.opened(W.EMPTY, 's', 1, T0)
  const CHAIR = play.toFraction([128 + 2 * 16, 104], SHAPE)
  const HOLO = play.toFraction([144, 118], SHAPE)
  const WINDOW = play.toFraction([146, 50], SHAPE)

  test('a click at 1/64 steps still finds the tile meant, on every clear tile and at every window shape', () => {
    for (const shape of [1.25, 1.6, 16 / 9, 2.2])
      for (let i = 0; i < 7; i++)
        for (let j = 0; j < 7; j++) {
          if (!isFloor([i, j])) continue
          const [x, y] = play.toFraction(place([i, j]), shape)
          const hit = play.pick(play.toRoom(snap(x), snap(y), shape))
          // a step of 1/64 is wider than half a tile on a small window: the next tile over is the most it may miss by
          expect(hit?.kind === 'tile' || hit?.kind === 'hologram' || hit?.kind === 'chair').toBe(true)
          if (hit?.kind === 'tile') expect(Math.abs(hit.tile[0] - i) + Math.abs(hit.tile[1] - j) <= 1).toBe(true)
        }
  })

  test('three quick clicks: he turns onto each new way at once and ends at the last', () => {
    let w = tap(fresh(), at(2, 2), T0)
    w = tap(w, at(5, 4), T0 + 300)
    const before = red(w)
    w = tap(w, at(1, 5), T0 + 600)
    const a = red(w)
    const last = a.clips.at(-1)
    expect(last).toMatchObject({ to: [1, 5], b: null })
    expect(a.clips[0].a).toBe(T0 + 600)
    expect(a.clips[0].from).toEqual(tileAt(before.clips, T0 + 600))
    expect(a.clips[0].from).not.toEqual(before.clips.at(-1).to)
    for (const c of a.clips) {
      expect(Math.abs(c.to[0] - c.from[0]) + Math.abs(c.to[1] - c.from[1]) <= 1).toBe(true)
      expect(isFloor(c.to)).toBe(true)
    }
    expect(a.doing).toBe('Walking where you asked')
  })

  test('the chair: he walks over, turns to the window and sits', () => {
    let w = tap(fresh(), at(5, 5), T0)
    w = tap(w, CHAIR, T0 + 400)
    const c = red(w).clips
    const n = c.length
    expect(c[n - 1]).toMatchObject({ from: [3, 1], to: [3, 1], pose: 'sit', face: 'NE', b: null })
    expect(c[n - 2]).toMatchObject({ from: [3, 2], to: [3, 1], pose: 'walk', face: 'NE' })
    expect(c[n - 3]).toMatchObject({ from: [3, 2], to: [3, 2], pose: 'idle', face: 'NE' })
    expect(c.slice(0, n - 3).every((k: any) => k.pose === 'walk' && isFloor(k.to))).toBe(true)
    expect(red(w).doing).toMatch(/In the chair/)
  })

  test('the window and the hologram each do their own thing', () => {
    const w1 = tap(fresh(), WINDOW, T0)
    expect(red(w1).clips.at(-1)).toMatchObject({ to: [2, 0], pose: 'lean', face: 'NE' })
    const w2 = tap(fresh(), HOLO, T0)
    expect(red(w2).clips.at(-1)).toMatchObject({ to: [4, 4], pose: 'type', face: 'NE' })
    expect(w2.holoBoost! > T0).toBe(true)
  })

  test('a click outranks the session; once it lapses he goes back to work', () => {
    let w = W.turnStarted(tap(fresh(), at(5, 5), T0), 't')
    const sent = red(w).clips.at(-1)
    const op = (key: string, a: number) => ({ key, actor: 'main', tool: 'Read', activity: 'read' as const, detail: 'a', a, isRunning: false })
    w = W.opStarted(w, op('a', T0 + 500), T0 + 500)
    expect(red(w).clips.at(-1)).toEqual(sent)
    expect(red(w).doing).toBe('Reading · a')
    w = W.opStarted(w, op('b', T0 + 40000), T0 + 40000)
    expect(red(w).station).toBe('archive')
  })

  test('left alone, he picks something to do in the room', () => {
    const w = tap(fresh(), at(5, 5), T0)
    expect(play.idle(w, T0 + 30000)).toBe(w)
    const later = play.idle(w, T0 + 120000)
    expect(red(later).doing).toMatch(/^Idle · /)
  })

  test('the hover shapes and the tower are drawn, and the room still fits', () => {
    const svg = drawRoom(W.launched(fresh(), T0), T0, { isStill: false })
    expect(svg.length <= 130000).toBe(true)
    expect(svg.includes('class="hot"')).toBe(true)
    expect(svg.includes('class="tw"')).toBe(true)
    expect(svg.includes('bikeSE')).toBe(true)
  })

  test('the megacity stands in fog at the tower’s scale: sheets between the rings, currents down between the blocks, lightning resting unseen', () => {
    const svg = drawRoom(fresh(), T0 + 120000, { isStill: false })
    // two crests, each also mirrored, sliding at their own speeds: no billows, and no one loop to see
    for (const id of ['va', 'vam', 'vb', 'vbm']) expect(svg.includes(`<use href="#s${id}" style="animation:v`)).toBe(true)
    expect(svg.includes('url(#sk')).toBe(false)
    // fog between the rings inside the tower's group, at the sea's own height, and in front of the tower
    expect(svg.split('<g class="cf">').length).toBe(4)
    expect(svg.includes('.cf{transform:translateY(')).toBe(true)
    // a set of currents for each gap and one across the tower, mist running down each
    for (const k of [0, 1, 2, 3]) expect(svg.includes(`<g mask="url(#vq${k})">`)).toBe(true)
    expect(svg.includes('animation:vr ')).toBe(true)
    // the neon in the fog, cyan and crimson
    expect(svg.includes('animation:vg ')).toBe(true)
    expect(svg.includes('<path fill="#4FE0F2" opacity=".11"')).toBe(true)
    expect(svg.includes('<path fill="#FF3355" opacity=".15"')).toBe(true)
    // the city is drawn inside the tower's group, the sea in its own group placed by the tower's bands
    expect(svg.includes('<g class="tw"><defs><pattern id="fr"')).toBe(true)
    expect(svg.includes('<path id="mL"')).toBe(true)
    // black finned towers, bands of white offices with someone walking, light running up the corners
    expect(svg.includes('fill="url(#of)"')).toBe(true)
    expect(svg.includes('animation:up ')).toBe(true)
    expect(svg).toMatch(/animation:pw[mn]\d+ /)
    expect(svg.includes('<g class="cs">')).toBe(true)
    expect(svg).toMatch(/\.cs\{transform:translate\(\d+px,\d+px\) scale\(0\.\d+\)/)
    expect(svg).toMatch(/<g style="opacity:0;animation:zap /)
    const still = drawRoom(fresh(), T0 + 120000, { isStill: true })
    for (const id of ['va', 'vam', 'vb', 'vbm']) expect(still.includes(`<use href="#s${id}"`)).toBe(true)
    expect(still.includes('animation:zap')).toBe(false)
  })

  test('a Stop powers the hologram down, and it comes back', async ($, on) => {
    on('session.stop', (_: unknown, e: any) => ({ isTurnRunning: e.isTurnRunning }))
    const t = await open($, on)
    await submit($)
    await start($)
    await $.session.stop({ isTurnRunning: true })
    await complete($, 't1', { reason: 'aborted', isAborted: true })
    const down = await t.svg()
    expect(down).toMatch(/animation:pd \.9s/)
    // the same drawing already brings it back, by its own clock, with nothing redrawn
    expect(down).toMatch(/animation:pu 1\.2s/)
    await t.clock.advance(20000)
    await start($, 't2')
    expect(await t.svg()).not.toMatch(/animation:p[du] /)
  })
})
