# Gesture Flow

Real-time webcam effects triggered by hand gestures and facial expressions, configured in a node editor built with [React Flow](https://reactflow.dev). Gestures are wired to reactions, combined with logic and timing nodes, and routed into one or more virtual cameras; the active camera is sent to OBS and on to Zoom / Meet / Telegram.

The UI is available in Ukrainian and English (click the flag) with light and dark themes (☀️ / 🌙). Claude can edit the graph with prompts through a local MCP server, and in-browser agents through WebMCP.

## Running

1. Double-click `start.command` (first run installs dependencies), or run `npm install && npm run dev`.
2. `http://localhost:8001` opens. Allow camera access.
3. The first run downloads the hand and face models (~12 MB) from the internet.

Requires Node.js 18+. If macOS refuses to run `start.command`: right-click → Open.

## How the editor works

```
[gesture] ──signal──▶ [logic] ──signal──▶ [reaction] ──video──▶ [camera] ──video──▶ [camera (merge)]
```

- **Gesture nodes** (hands, face, hands + face, objects, manual) watch the camera and output a signal while the gesture is held. Each has `hold` (frames to hold before it counts; ~30 frames = 1 s) and `dropout tolerance`.
- **Hand selection**: every single-hand gesture has *Hand: any / left / right / both*. `both` means both hands must show the gesture. If left and right are swapped on your camera, flip *Settings → Swap left and right hand*.
- **Logic & timing**: AND (together), OR, NOT, *Combo: A then B* (within a time window), Delay, Hold at least, Extend, Toggle, Every Nth time.
- **Switches**: a *Switch* node is on by default; click it on the node (or press its key) to turn off everything wired to its `enable` output. Default graph: *Mouth* (key `M`) disables the three mouth reactions, *Hat* disables hat spawning.
- **States**: named true/false variables shared by the whole graph. *Set state* turns a state on / off / toggles it; *State is on?* outputs a signal while it is on. The states bar at the top shows current values; click a chip to flip it manually.
- **enable / block inputs**: every gesture and reaction has them. If `enable` is connected, the node only works while that signal is on; while `block` is on, it is off. Example from the default graph: finger drawing only works while the `drawing` state is on (toggled with two fists), and it is blocked while you aim the laser or touch your nose.
- **Reactions** fire once per gesture (with delay, cooldown and chance) or run continuously while the signal is on (energy ball, laser, light trail, fire, bubbles). Common settings: where (gesture point, nose, forehead, mouth, eyes, frame center), size, intensity, color. The **▶ Test** button fires a reaction without a gesture. The `fired` output lets one reaction trigger the next.
- **Cameras**: a reaction is visible only in the cameras it is connected to (red dashed links). A node can feed several cameras. Connecting a camera into another camera **merges** them: the target shows its own reactions plus everything from its inputs. One camera is active (**ON AIR**) — switch with `Alt+1…9` (set per camera), the chips in the top bar, or *Make active*. Each camera has its own resolution, background (camera / green screen / black), fullscreen, recording.

Live status: a yellow dot and glowing links show signals that are on; the progress bar shows how long a gesture has been held. *Settings → Show hand and face points* also prints each node's measured values (e.g. `pinch=0.22`) for tuning thresholds.

**Rules view** (the *Editor / Rules* switch in the top bar) lists every reaction as a readable card: what triggers it (combinations, sequences and timing spelled out), *only if* / *not while* conditions, how to turn on a state it needs, which cameras show it, and timing (once / continuous, delay, cooldown). Each card says whether it is available right now; gestures light up while they are detected. Switches can be flipped there, cards can be tested, and *Open in editor* jumps to the nodes. **⚙ Edit** on a card (or a click on any gesture / condition in it) opens the settings of every node in that rule right in the card; changes apply immediately.

**Saved setups** (💾 in the top bar): save the whole setup under a name and load it back later — nodes, links, values, states, active camera and settings. They are JSON files in `presets/` in the project folder (written by the dev server, local requests only), so they survive clearing the browser and can be committed. The button shows the current setup and a yellow dot when there are unsaved changes. Without the dev server they are kept in the browser.

The graph autosaves in the browser. The **⋯** menu has **Export / Import** (JSON) and **Reset** (restores the default graph).

## Motions

Gesture nodes look at one frame (a pose). **Motion** nodes look at the last fraction of a second of movement and fire once per movement:

| Node | What it detects | Main settings |
|---|---|---|
| 👋 Hand swipe | a fast straight move up / down / left / right | direction, hand, hand pose (any / open / fist / index finger), length in palm widths, max time |
| 🙋 Wave hand | an open palm going left-right several times | swings, swing size |
| 🔄 Hand circle | drawing a circle (by default with the index finger) | clockwise / counter-clockwise / any, min radius |
| 🫸 Push / pull | the hand moving toward / away from the camera (it grows / shrinks) | direction, size change |
| 💨 Fast hand movement | continuous: on while the hand moves faster than a threshold | speed |
| 🙂 Head nod / shake | "yes" (pitch) or "no" (yaw) head movement | sensitivity, number of movements |

Distances are measured in palm widths, so a swipe works the same close to the camera and far from it. To get **different reactions per direction**, add one *Hand swipe* node per direction. After a swipe, the hand's way back (the opposite direction within 0.6 s) is ignored, so swiping up does not also fire "down".

Two reactions are made for motions: **Swipe swoosh** (a glowing streak along the actual path of the hand; gold / blue / pink / green per direction unless a color is set) and **Text / emoji** (any text, e.g. `👋 Hi!`).

## Switching cameras with fingers

*Finger count* fires when you show 1–5 fingers (thumb optional) and hold the hand still for a moment (0.6 s by default, fingers up). The *Switch camera (scene)* action then makes the camera with that `Alt+N` hotkey active — the same as pressing the hotkey, including the OBS scene set on that camera. It can also go to the next / previous camera or a fixed one. The camera's name flashes at the top of the frame. Changing the number of fingers switches again; keeping them up does not. In the default graph it is paused while aiming the laser, drawing, or touching the nose / temple.

## Objects (hats & co.)

*Spawn object* creates a top hat, party hat, crown, sunglasses or mustache — in your hand, right on your head, or at the gesture point. Bring an object in your hand close to its place on the head and it snaps on (hat → top of the head, glasses → eyes, mustache → upper lip) and follows the head: position, tilt and size. Pinch it to take it back. If you let go away from the head it floats, falls or vanishes (setting of the node). *Object on head* / *Object in hand* are gesture nodes, so wearing a hat can trigger other reactions. *Remove objects* clears them.

Default graph: 🤟 spawns a top hat in your hand; wearing it makes a glint; closing both eyes for a second removes objects.

## Sending to Zoom / Meet / Telegram (OBS)

A browser cannot register a system camera by itself, so the active camera goes through OBS:

1. In OBS, add a **Browser** source with URL `http://localhost:8001/program.html` (the **OBS** panel in the editor has a copy button), size 1280×720 or 1920×1080, then *Transform → Fit to screen*.
2. The page receives the active camera over WebRTC from the open editor tab (peer-to-peer on this machine, H.264 hardware encoding where available). Only one editor tab streams; others show *standby* and can take over.
3. Click **Start Virtual Camera** in OBS and choose **OBS Virtual Camera** in Zoom / Meet / Telegram / a browser call (reload the call page after starting the virtual camera).

Optional: connect the editor to OBS WebSocket (**Tools → WebSocket Server Settings**, then **OBS → Connect** in the editor) to start the virtual camera from the editor and to set an *OBS scene* on each camera node — switching the active camera then also switches the OBS scene.

The editor keeps processing while its tab is hidden or on another desktop (camera frames are pulled with `MediaStreamTrackProcessor`, timers run in a worker), so the OBS feed does not freeze.

## Controlling it with Claude (MCP)

`mcp/server.js` is a local [MCP](https://modelcontextprotocol.io) server. Claude starts it, and it forwards tool calls to the open editor over a local WebSocket (`127.0.0.1:8789`, only pages from this machine may connect):

```
Claude Desktop / Claude Code ──MCP (stdio)──▶ mcp/server.js ──WebSocket──▶ editor tab (http://localhost:8001)
```

**Claude Desktop:** run `npm run mcp:install-desktop` once (adds `gesture-flow` to `claude_desktop_config.json`, with a backup), restart Claude Desktop.
**Claude Code:** `claude mcp add gesture-flow -- node /absolute/path/to/mcp/server.js`.

Then keep the editor open — the top bar shows **✳ Claude** when connected — and ask in plain language, for example:

- “In Gesture Flow, make a portal appear when I pinch with my left hand.”
- “Add a camera called Stream that merges Hands and Face and make it active.”
- “Delay the explosion by one second and make it twice as big.”
- “Turn off the mouth effects.”

Tools: `gesture_flow_help`, `list_node_types`, `get_graph`, `get_live_status`, `add_node`, `update_node`, `remove_node`, `connect`, `disconnect`, `add_rule`, `set_active_camera`, `set_state`, `set_switch`, `test_reaction` (all prefixed `gesture_flow_`). They are defined once in `src/agent/tools.js`. *Settings → Allow control from Claude (MCP)* turns the bridge off.

claude.ai in the browser cannot reach a server on your computer; use Claude Desktop or Claude Code.

## WebMCP (agents inside the browser)

The same tools are registered with [WebMCP](https://developer.chrome.com/docs/ai/webmcp/imperative-api) (`document.modelContext.registerTool`) when the browser supports it — Chrome with `chrome://flags/#enable-webmcp-testing` or the origin trial. A **🤖 WebMCP** badge appears in the top bar. The API is still a draft and may change.

## Default graph

| Gesture | Reaction | Camera |
|---|---|---|
| 🤲 Two palms apart | Energy ball | Hands |
| 😉 Wink **AND** ☝️ index finger | Eye laser | Hands |
| ✊→🖐 Fist, snap open | Explosion | Hands |
| 👌 OK sign | Portal | Hands |
| 🤙 Shaka | Shooting stars | Hands |
| ✊✊ Two fists | Toggle the `drawing` state | — |
| ☝️ Index finger (only while `drawing` is on) | Light trail | Hands |
| 🤟 I love you | Top hat in your hand | Hands |
| 🎩 Object on head | Glint on the forehead | Hands |
| 😌 Both eyes closed ~1 s | Remove objects | Hands |
| 👃 Touch nose | Clown nose | Face |
| 🤦 Palm on forehead | Sorrow (tears) | Face |
| 🫡 Index finger to the temple | Mind waves | Face |
| 😉 Wink left / right | Gold / turquoise glint | Face |
| 😲 Both eyebrows up | "!!" | Face |
| 🤨 Left / right eyebrow up | "?" | Face |
| 😠 Frown | Anger | Face |
| 😮 Mouth wide open | Fire breath | Face |
| 😁 Big smile | Sun rays | Face |
| 😗 Pucker | Bubbles | Face |
| ⬆️ Swipe up / ⬇️ down / ⬅️ left / ➡️ right | Swoosh: gold / blue / pink / green | Hands |
| 🙋 Wave | "👋 Hi!" | Hands |
| 🔄 Circle with the index finger | Portal | Hands |
| 🫸 Push toward the camera | Small explosion | Hands |
| 🙂 Nod / shake the head | "✓ Yes" / "✗ No" | Face |
| 🔢 Show 1–5 fingers, held still | Switch to the camera with `Alt+1…5` | — |

Switches: **Mouth** (`M`) → the three mouth gestures, **Hat** → the 🤟 hat gesture, **Motions** (`N`) → all motion nodes, **Scenes** (`S`) → switching cameras with fingers. Hand motions also pause while `drawing` is on.

Cameras: **Hands** (`Alt+1`), **Face** (`Alt+2`) and **All together** (`Alt+3`, merges the two, active by default).

Gestures that exist in macOS built-in **Reactions** (heart, 👍/👎, ✌️, two-hand rock-on) are not used by default. If Reactions are enabled (Control Center → Video Effects), macOS draws its own effects into the camera feed, so they show up here too.

## Project structure

```
src/
  app/               React UI: editor, nodes, panels, i18n, storage
  graph/
    catalog.js       registry of node kinds, ports
    gestures.js      gesture nodes (detect → hit or null)
    motion.js        motion nodes (swipe, wave, circle, push, speed, nod / shake)
    logic.js         logic, timing and state nodes
    effects.js       reaction nodes and the camera node
    engine.js        runs the graph every frame
    defaultGraph.js  the graph you get on first launch
  runtime/
    runtime.js       camera, MediaPipe, per-camera rendering, program window, recording
    tracker.js       MediaPipe hands + face
    face.js          eyes, eyebrows, mouth, head pose, gaze
    props.js         attachable objects (+ propsArt.js drawings)
    effects/         the visual effects (Canvas 2D)
    obs.js           obs-websocket v5 client
  agent/tools.js     tools for Claude (MCP) and WebMCP
mcp/
  server.js          MCP server for Claude Desktop / Code (stdio ↔ WebSocket bridge)
  install-claude-desktop.mjs
test/
  engine.test.mjs    graph engine tests with synthetic hands (npm test)
  mcp-e2e.mjs        MCP client → server → browser editor (needs Playwright)
```

## Adding a new gesture node

Add an object to `GESTURES` in `src/graph/gestures.js` — it appears in the palette automatically:

```js
const thumbsSideways = {
  kind: "thumbsSideways",
  category: "hand",
  icon: "👉",
  title: { uk: "Палець убік", en: "Thumb sideways" },
  params: [handParam(), num("min", { uk: "Поріг", en: "Threshold" }, 0.6, 0.1, 2)],
  hold: 6,
  detect: ({ hands }, p, state, debug) =>
    forHands(hands, p.hand, (h) => {
      const dx = (h.points[4].x - h.points[2].x) / h.size;
      debug.push(`dx=${dx.toFixed(2)}`);
      return Math.abs(dx) > p.min ? { ...h.points[4], size: h.size } : null;
    }),
};
```

`detect` receives `{ hands, face, now, W, H, keys, props, vars }`. Each hand has `side` (`left`/`right`), 21 `points` in pixels (mirrored) and `size` (palm length). The face object is described at the top of `src/runtime/face.js` (`winking`, `brows`, `mouth`, `yaw/pitch/roll`, `gaze`, `blend` with 52 MediaPipe expression scores).

New reactions go to `src/graph/effects.js`: an effect is `trigger(fxLayer, hit)` that adds particles with `update(dt)` / `draw(ctx)` (see `src/runtime/effects/portal.js`).

## Notes

- **Gaze** from a regular webcam is head rotation plus pupil offset — good for screen zones, not for a specific button. Calibrate with *Settings → Calibrate*.
- **Ears** are not in the face model; their positions are estimated from the face outline.
- Hand left/right comes from MediaPipe's handedness; verify it with *Show hand and face points* (L / R labels) and use *Swap* if needed.
