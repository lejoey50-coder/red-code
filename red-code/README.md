# Red Code

Your interface as a place: an isometric megacity at night behind the whole window, drawn at the room's own angle and pixel size, and on the right a tall tower whose top floor is cut away to show one room you can play in. Every building is smooth black with no windows: its light is let into it. Broad cores of light, white inside cyan, run in trenches cut into the black and leave a soft light on the face beside them; thin circuits branch off them and turn at the wall's own 45 degrees; lit slots cross the faces where floors meet. No two towers of the city carry their light the same way: a spine down the front corner, a blade down one face, a core that runs only from the roof to the first slot. Some have fins, grooves, louvres, a mast or a landing mark on the roof, and a handful are crimson. Two elevated rail lines with trains run on the room's diagonals and flyers cross above the roofs. Below the room the tower is one black shaft that steps out into a wider podium, with a band of light round the ledge between them, a spine of light down its corner and an outside lift in a trench of its own. Slow pulses of energy run in its cores. It goes down into fog that fills the foot of the window, edge to edge: thin sheets of mist drifting at their own speeds between the rings of towers, currents of it coming down between the blocks and across the tower, cyan and crimson light pooling on it, and once every few minutes a faint blue flash of far lightning inside it. Red Code, a small crimson program, acts out what the session is really doing. Helpers appear only when real agents are running. It opens no pane. It sets the app's colors, its backdrop and the plates behind messages, for dark mode.

## Controls

| Type or press | What it does |
| --- | --- |
| `/redcode` | The building as your interface |
| `/redcode strip` | The app's own look, with a small strip above the message box |
| `/redcode off` | Off in every chat, until `/redcode` |
| `/redcode motion still` / `full` | Stops or restores movement. The Windows reduced-motion setting also stops it |
| `/redcode size 1600x900` | Tells Red Code your window's size, if clicks land a tile off |

It starts by itself in every new chat. Each of these changes reaches the other open chats within a few seconds.

## Playing in the room

| You | He |
| --- | --- |
| Click a clear floor tile | Walks there from wherever he is, round the furniture. A new click while he walks turns him at once |
| Click the chair | Walks over, turns to the window and sits |
| Click the window | Goes to the glass and leans there, looking out |
| Click the hologram | Works its panel; it spins faster and brighter for a while |
| Hover the window, chair or hologram | A faint cyan outline shows it can be used |
| Leave him alone | After about 45 quiet seconds he picks one of those by himself |
| Start typing | He stops and looks up at you |
| Send | He operates the console |
| Claude finishes | A short cheer, then he rests |
| Stop a reply | The hologram powers down for about 14 seconds |

A click outranks the session for 20 seconds after he arrives; then he goes back to whatever the session is doing. Clicks reach the mod only on the bare backdrop, so click the tower beside the chat, not through it. The app reports a click in steps of 1/64 of the window, so on a small window a click can land one tile over.

The tower keeps to the right edge and shrinks as the window gets narrower, so on a wide window it stands beside the chat. Below about 1700 pixels wide there is no room beside a centred chat, and part of it sits under the frosted chat panel.

## What you see

| Real event | In the room |
| --- | --- |
| Your prompt is accepted | He rides in from the landing on a ribbon of light, and light runs down the tower's three cores |
| Claude is working (a turn, a call or a reply) | The tower's spine and circuits turn crimson; they go back to cyan when the turn ends |
| Read, search | He works at the archive |
| Write, edit | He files a disc in the archive, lit red |
| Shell command, background job | Light climbs the core while it runs |
| Web search or fetch | He is at the beacon and its beam goes up |
| Any other tool | He is at the console |
| Claude is replying | The console writes |
| Permission request or question | Amber "Needs you" at the rail |
| An agent starts | A pale helper comes up by the lift |
| An agent reports success | It hands a disc to its own parent, then leaves |
| An agent fails or is stopped | It leaves with no disc |
| A call fails | A ring at that station, and the word |

## Windows: install, reload, disable

This mod is for Claude Code 2.1.330 in the Windows desktop app. It needs no admin rights and installs no other software.

**Install.** `claude plugin marketplace add <folder that holds .claude-plugin/marketplace.json>`, then `claude plugin install red-code@red-code-mods`. Start a new session.

**Update.** Replace the files in that folder, then `claude plugin update red-code@red-code-mods`. Chats already open took up the last update by themselves; if one does not, reopen it.

**Turn it off.** `/redcode off` in any session. Every other open chat follows, and new ones stay off until `/redcode`.

**Disable or remove it.** `claude plugin disable red-code@red-code-mods`, or `uninstall`.

**Other looks.** The app has one theme at a time, the last one set. Run Red Code or Ember, not both. Turning Red Code off clears the theme only if it was the one showing its own.
**Try it from the folder, without saving it.** In a terminal where `claude` runs: `claude --plugin-dir <this folder>`. A terminal shows words, not the room.

## Signals

| Signal | Status |
| --- | --- |
| Prompt accepted or refused | Implemented |
| Turn start, end, duplicate or late end | Implemented |
| Tool call start, running, success, failure, refusal, cancel | Implemented. Cancel and failure are told apart from the result text, so an unusual message can be filed as a failure |
| Overlapping calls | Implemented: both stations light, one sprite |
| Permission request, question, connector form | Implemented |
| Reply being written | Implemented, from the first text shown |
| Agent start, report, parent, outcome | Implemented, up to 6 drawn. If very many move at once, helpers stand in place instead of walking |
| Background jobs | Implemented. The list is refreshed at each turn's end, so a light can stay on until the next turn |
| Other sessions in the same project | Implemented through this mod's own store, up to 3 drawn; a silent session goes after 80 seconds |
| Which session is selected in the sidebar | Not available. Each session draws itself in front |
| Other sessions' helpers | Not shared, so not drawn |
| Clicking the room | Implemented, on the bare backdrop: tiles, the window, the chair and the hologram |
| Names and last activity | In the picture's description, for screen readers. The name buttons went with the pane |
| New Session screen | Not expected to draw before the first message |
| Work done while the app was disconnected | Not available. It shows as unknown |
| A room per project kept between launches | Not implemented. The room is drawn fresh; only your settings are kept |

## What it reads, stores and sends

It reads event types, tool names, and the last part of a file name. It stores its settings on this PC, and for each open session: the project folder path, a badge number, a station and one word. It removes a session's record when the session ends. It sends nothing anywhere, and it cannot block or change a prompt or a tool call.

## Art

The megacity is in `hooks/megacity.ts`, drawn inside the tower's own group so it shares the tower's scale and place at every window shape. Three rings of blocks, far to near, are thinned by haze with distance, as an orthographic camera shows depth. Each tower is placed by hand and given a form (`shed`, `step`, `cant`, `cham`) and a way of carrying light (`spine`, `drop`, `stub`, `blade`, `left`, `trace`). A core's ends are cut at the slope of the wall it is in, so it meets a roof line or a slot along that line, and everything that runs down a tower stops where a nearer tower stands in front of it. The sky above it is in `hooks/city.ts`.

The fog is in `hooks/fog.ts`, drawn at the tower's scale and dropped so its top stays at the same height on screen. It is thin sheets of mist, not billows: each sheet is two long low crests of different lengths sliding at different speeds, both see-through, so the outline they make together never comes round the same way and no loop shows. The sheets lie between the rings of towers and in front of the tower, so every block stands in fog to a different height. Currents of mist come down between the blocks in an S and run out into the fog, and the city's cyan and crimson light pools on it where a lit corner goes under. With motion off it rests whole, and the lightning stays hidden. When a drawing nears the app's size limit, the city's currents and the lightning go first, then the last current and the neon's light, then the far ring of the city with the fog behind it and the light round the tower's channels, before anyone in the room stops moving. The sheets of fog in front of the middle ring are never dropped.

The tower below the room (`hooks/tower.ts`) and the playable room (`hooks/play.ts`) are drawn as shapes sheared to the room's own two-across-one-up slope, so they meet the pixel art at its angles. The tower's light is in layers: the black faces, the trenches and their lit walls, the cores, and the soft light on the black beside them. Its crimson follows the session: `workAt` and `restAt` in the world say when work last started and ended, and the spine fades between cyan and crimson from those. `hooks/pixels.ts` turns the pixel art into SVG runs; a column one or two pixels wide is one stroke down, which keeps a drawing under the app's size limit.

All original, drawn for this mod. The source is `hooks/sprites.ts` (figures) and `hooks/room.ts` (stations) and `hooks/building.ts` (building, furniture) and `hooks/city.ts` (the city). `art/atlas.png` is the sprite sheet at one pixel to a pixel and `art/atlas.json` names each cell. `node art/make.mjs` draws them again. Files named `art/fixture-*.svg` are fixture previews from hand-made states, not captures of the app.

## Checks

`claude plugin validate <this folder>` and `claude plugin test <this folder>`.
