export type Face = 'SE' | 'SW' | 'NE' | 'NW'
export type Pose =
  | 'idle' | 'walk' | 'sit' | 'reach' | 'read' | 'insert' | 'type' | 'raise' | 'catch'
  | 'handoff' | 'lever' | 'wheel' | 'lean' | 'polish'
export type Tile = [number, number]
/** A stretch of one actor's time. `b` null is the resting clip that lasts until something happens. */
export type Clip = { a: number; b: number | null; from: Tile; to: Tile; pose: Pose; face: Face; ride?: boolean }

export type Station = 'archive' | 'turbine' | 'beacon' | 'console' | 'lift' | 'rail' | 'pier'
export type Activity = 'read' | 'write' | 'web' | 'shell' | 'generic' | 'spawn' | 'ask'
export type Outcome = 'ok' | 'failed' | 'cancelled' | 'denied'

/** One running call. `key` is session + operation, so a repeat of either end is ignored. */
export type Op = { key: string; actor: string; tool: string; activity: Activity; detail: string; a: number; isRunning: boolean }
export type Background = { id: string; label: string; a: number }
export type Actor = {
  id: string
  kind: 'red' | 'helper' | 'peer'
  parent: string | null
  role: string
  badge: number
  mark: number
  clips: Clip[]
  station: Station
  doing: string
  doingAt: number
  phase: 'here' | 'delivering' | 'leaving'
}
export type Mark = { station: Station; kind: 'failed' | 'cancelled'; text: string; until: number }
export type World = {
  session: string
  badge: number
  turn: string | null
  isReplying: boolean
  isWaking: boolean
  /** Set after a reload: what was running is unknown until something new is heard. */
  isUnknown: boolean
  actors: Actor[]
  ops: Op[]
  done: string[]
  waits: string[]
  background: Background[]
  mark: Mark | null
  /** Until when a click of the person's outranks what the session would have him do. */
  userUntil?: number
  /** Until when the hologram runs bright, after he works it. */
  holoBoost?: number
  /** When a Stop powered the hologram down. */
  holoDown?: number
  /** When the person last started typing. */
  typingAt?: number
}

/** 
oom is the building behind the chat, strip the small row above the message box. */
export type RoomView = 'room' | 'strip' | 'off'
export type RedCodeSettings = { view: RoomView; motion: 'full' | 'still' }

/** What one session tells the others in its project: a place and a word, never any content. */
export type Presence = { project: string; badge: number; station: Station; doing: string; isWaiting: boolean; startedAt: number; at: number }

declare module 'claude-code' {
  interface PluginState {
    'red-code': {
      settings: Shaped<RedCodeSettings>
      world: Shaped<World>
    }
  }
}
