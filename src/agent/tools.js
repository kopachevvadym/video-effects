// Agent tools for the Gesture Flow editor, shared by:
//   • WebMCP (agents inside the browser)       → src/app/webmcp.js
//   • the local MCP server for Claude           → mcp/server.js (schemas only) + src/app/bridge.js (execution)
//
// This module must stay free of DOM / runtime imports so Node can load it.
// Each tool: { name, description, inputSchema, annotations?, run(ctx, args) → string }
// ctx = { api: editor state + setters, findNode, engine, runtime }
import { ALL_DEFS, CATALOG, inputsOf, outputsOf, nodeTypeOf, handleKind } from "../graph/catalog.js";
import { canonicalName } from "../graph/names.js";

const text = (v) => (typeof v === "string" ? v : JSON.stringify(v, null, 2));
const label = (l) => (typeof l === "string" ? l : l?.en ?? "");

function describeDef(d) {
  return {
    kind: d.kind,
    category: d.category,
    title: label(d.title),
    inputs: inputsOf(d).map((h) => `${h.id} (${h.kind})`),
    outputs: outputsOf(d).map((h) => `${h.id} (${h.kind})`),
    continuous: d.continuous || undefined,
    params: (d.params ?? []).map((p) => ({
      key: p.key,
      type: p.type,
      default: p.default,
      ...(p.options ? { options: p.options.map((o) => o.value) } : {}),
      ...(p.min != null ? { min: p.min, max: p.max } : {}),
    })),
  };
}

/** Default handles when an agent does not name them. */
function defaultHandles(src, tgt, sourceHandle, targetHandle) {
  const sd = CATALOG[src.data.kind];
  const td = CATALOG[tgt.data.kind];
  const tt = nodeTypeOf(td);
  let sh = sourceHandle;
  let th = targetHandle;
  if (!sh) sh = sd.category === "effect" ? (tt === "camera" ? "video" : "fired") : nodeTypeOf(sd) === "camera" ? "video" : "out";
  if (!th) th = tt === "camera" ? "video" : tt === "effect" ? "trigger" : inputsOf(td)[0]?.id;
  return { sh, th };
}

const HELP = `Gesture Flow — node editor for webcam effects.

Signal flow: gesture nodes → (logic / timing / state nodes) → reaction nodes → camera nodes.
- Gesture nodes (categories hand, face, handFace, object, input) output a signal while the gesture is held.
  Common params: hand = any | left | right | both, hold (frames, ~30 = 1 s), grace.
  Inputs: enable (node works only while it is on, if connected), block (node is off while it is on).
- Motion nodes (category motion) recognise movement over time and fire once per movement:
  swipe (dir up|down|left|right|any, hand, pose any|open|fist|point, distance in palm widths, maxMs),
  wave (swings, amplitude), circle (dir any|cw|ccw), push (dir push|pull, amount), handSpeed (continuous, minSpeed),
  headGesture (type nod|shake). Use one swipe node per direction to get different reactions per direction.
- Logic: and (inputs a,b,c; anchor = which input gives the position), or, not, sequence (a then b within windowMs),
  delay (ms), holdFor (ms), extend (ms), toggle, counter (every n-th).
- States: setVar (inputs on/off/toggle, param name) and getVar (outputs while the named state is true).
- Switch (kind "switch", category input): on by default; wire into 'enable' inputs; flip with gesture_flow_set_switch.
- Reactions (category effect): input trigger (+ enable, block); outputs video (→ camera) and fired (signal).
  Params: anchor (gesture|nose|forehead|mouth|leftEye|rightEye|center), scale, intensity, hue (0-360 or null),
  delayMs, cooldownMs, chance (one-shot only). Continuous ones run while the input is on.
  swoosh draws a glowing streak along a swipe (colour per direction unless hue is set); textPop shows params.text.
  switchCamera is an action (no video output): makes another camera active — target fingers (camera whose
  hotkey = hit.count from a fingerCount gesture), next, prev or "1".."9". fingerCount (count any|1..5, thumb,
  upright, steadyMs) fires once the finger count is held still.
  spawnProp creates an object (topHat, partyHat, crown, sunglasses, mustache) in hand / on head; clearProps removes them.
- Cameras (kind "camera"): input video accepts reactions and other cameras (merging them). One camera is active
  (sent to the OBS window); params name, resolution, background, hotkey (Alt+N), obsScene.

Examples:
- "Make a portal when I pinch with my left hand": gesture_flow_add_rule {gesture:"pinch", gestureParams:{hand:"left"}, reaction:"portal"}.
- "Laser only while I wink AND point": add wink + pointing, add 'and', connect both to a/b, connect and → laser.trigger, laser.video → camera.
- "Turn drawing on with two fists": fist {hand:"both"} → setVar{name:"drawing"}.toggle; getVar{name:"drawing"} → pointing.enable.
- "Swipe up = gold streak, swipe down = blue": two swipe nodes {dir:"up"} / {dir:"down"} → swoosh {hue:45} / swoosh {hue:205}.
- "Delay the explosion by 1 s": gesture_flow_update_node {node:<explosion id>, params:{delayMs:1000}}.
Call gesture_flow_list_node_types for all kinds and params, gesture_flow_get_graph for the current graph.`;

export const TOOLS = [
  {
    name: "gesture_flow_help",
    description: "Read first: how the Gesture Flow editor works (node categories, ports, signals, cameras, states, switches) with examples of typical edits.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    run: async () => HELP,
  },
  {
    name: "gesture_flow_set_switch",
    description: "Turn a Switch node on or off (by id or by its label). Switches feed 'enable' inputs, so turning one off disables the nodes behind it.",
    inputSchema: { type: "object", properties: { node: { type: "string" }, on: { type: "boolean" } }, required: ["node", "on"] },
    run: async (ctx, { node, on }) => {
      const n = ctx.findNode(node);
      if (!n || n.data.kind !== "switch") return `No switch "${node}"`;
      ctx.api.updateParams(n.id, { ...(n.data.params ?? {}), on: !!on });
      return `${n.data.params?.label || n.id}: ${on ? "ON" : "OFF"}`;
    },
  },
  {
    name: "gesture_flow_list_node_types",
    description:
      "List every node kind available in the Gesture Flow editor (gestures, logic/timing, states, reactions, camera) with their input/output ports and parameters. Call this before adding nodes.",
    inputSchema: { type: "object", properties: { category: { type: "string", description: "Optional filter: hand, face, motion, handFace, object, input, logic, state, effect, output" } } },
    annotations: { readOnlyHint: true },
    run: async (ctx, { category } = {}) => text(ALL_DEFS.filter((d) => !category || d.category === category).map(describeDef)),
  },
  {
    name: "gesture_flow_get_graph",
    description: "Get the current node graph: nodes (id, kind, params), edges (source/target with ports), cameras, the active camera and state variables.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    run: async (ctx) =>
      text({
        nodes: ctx.api.nodes.map((n) => ({ id: n.id, kind: n.data.kind, params: n.data.params ?? {} })),
        edges: ctx.api.edges.map((e) => ({ id: e.id, source: e.source, sourceHandle: e.sourceHandle, target: e.target, targetHandle: e.targetHandle })),
        activeCamera: ctx.api.activeCamera,
        states: Object.fromEntries(ctx.engine.vars),
      }),
  },
  {
    name: "gesture_flow_get_live_status",
    description: "What the camera sees right now: number of hands and their sides, whether a face is detected, wink/brow/mouth state, and which nodes are currently on.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    run: async (ctx) => {
      const f = ctx.runtime.face;
      // WebRTC stats of the program feed (OBS Browser Source), when running in the browser
      let program = null;
      const peers = typeof window !== "undefined" ? window.__gfProgramPeers : null;
      if (peers?.size) {
        program = [];
        for (const pc of peers.values()) {
          const r = await pc.getStats();
          r.forEach((x) => {
            if (x.type === "outbound-rtp" && x.kind === "video")
              program.push({ width: x.frameWidth, height: x.frameHeight, fps: x.framesPerSecond, limitedBy: x.qualityLimitationReason, encoder: x.encoderImplementation });
          });
        }
      }
      return text({
        status: ctx.runtime.status.key,
        fps: Math.round(ctx.runtime.fps),
        hidden: typeof document !== "undefined" ? document.hidden : undefined,
        cameraPump: !!ctx.runtime.frameSerial,
        program,
        hands: ctx.runtime.hands.map((h) => ({ side: h.side, modelGesture: h.gesture })),
        face: f
          ? { winking: f.winking, browsUp: f.brows.bothRaised, frown: f.brows.frown, mouthOpen: f.mouth.isOpen, smiling: f.mouth.isSmiling, gazeZone: f.zone }
          : null,
        activeNodes: [...ctx.engine.status].filter(([, s]) => s.on).map(([id]) => id),
        objects: ctx.runtime.props.objects.map((o) => ({ type: o.type, attached: o.attached })),
      });
    },
  },
  {
    name: "gesture_flow_add_node",
    description: "Add a node of the given kind with optional params and canvas position. Returns the new node id.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", description: "Node kind from list_node_types, e.g. okSign, wink, and, delay, portal, camera" },
        params: { type: "object", description: "Parameter values by key (see list_node_types)" },
        x: { type: "number" },
        y: { type: "number" },
      },
      required: ["kind"],
    },
    run: async (ctx, { kind, params = {}, x, y }) => {
      if (!CATALOG[kind]) return `Unknown kind "${kind}". Use gesture_flow_list_node_types.`;
      const id = ctx.api.addNode(kind, x != null && y != null ? { x, y } : undefined, params);
      return `Added ${kind} as ${id}`;
    },
  },
  {
    name: "gesture_flow_update_node",
    description: "Change parameters of a node (merged into existing params). Node can be given by id or, for cameras, by name.",
    inputSchema: {
      type: "object",
      properties: { node: { type: "string" }, params: { type: "object" } },
      required: ["node", "params"],
    },
    run: async (ctx, { node, params }) => {
      const n = ctx.findNode(node);
      if (!n) return `No node "${node}"`;
      ctx.api.updateParams(n.id, { ...(n.data.params ?? {}), ...params });
      return `Updated ${n.id}`;
    },
  },
  {
    name: "gesture_flow_remove_node",
    description: "Delete a node and its connections.",
    inputSchema: { type: "object", properties: { node: { type: "string" } }, required: ["node"] },
    annotations: { consequentialHint: true },
    run: async (ctx, { node }) => {
      const n = ctx.findNode(node);
      if (!n) return `No node "${node}"`;
      ctx.api.deleteNode(n.id);
      return `Removed ${n.id}`;
    },
  },
  {
    name: "gesture_flow_connect",
    description:
      "Connect two nodes. Signal ports connect gestures/logic/states to inputs (trigger, enable, block, a, b, c, in, on, off, toggle); video ports connect reactions or cameras into a camera. Ports are guessed when omitted (gesture→reaction uses trigger, reaction→camera uses video).",
    inputSchema: {
      type: "object",
      properties: {
        source: { type: "string" },
        target: { type: "string" },
        sourceHandle: { type: "string" },
        targetHandle: { type: "string" },
      },
      required: ["source", "target"],
    },
    run: async (ctx, { source, target, sourceHandle, targetHandle }) => {
      const s = ctx.findNode(source);
      const t = ctx.findNode(target);
      if (!s || !t) return `Unknown node ${!s ? source : target}`;
      const { sh, th } = defaultHandles(s, t, sourceHandle, targetHandle);
      const sk = handleKind(CATALOG[s.data.kind], sh, "source");
      const tk = handleKind(CATALOG[t.data.kind], th, "target");
      if (sk !== tk) return `Port kinds differ: ${s.id}.${sh} is ${sk}, ${t.id}.${th} is ${tk}`;
      ctx.api.connect({ source: s.id, target: t.id, sourceHandle: sh, targetHandle: th });
      return `Connected ${s.id}.${sh} → ${t.id}.${th}`;
    },
  },
  {
    name: "gesture_flow_disconnect",
    description: "Remove connections between two nodes (all ports), or one edge by id.",
    inputSchema: { type: "object", properties: { edge: { type: "string" }, source: { type: "string" }, target: { type: "string" } } },
    run: async (ctx, { edge, source, target }) => {
      const n = ctx.api.removeEdges((e) => (edge ? e.id === edge : e.source === ctx.findNode(source)?.id && e.target === ctx.findNode(target)?.id));
      return `Removed ${n} connection(s)`;
    },
  },
  {
    name: "gesture_flow_add_rule",
    description:
      "Shortcut: create a gesture node and a reaction node, connect them, and route the reaction into a camera (by id or name; defaults to the active camera). Returns the new node ids.",
    inputSchema: {
      type: "object",
      properties: {
        gesture: { type: "string", description: "Gesture kind, e.g. okSign" },
        gestureParams: { type: "object" },
        reaction: { type: "string", description: "Reaction kind, e.g. portal" },
        reactionParams: { type: "object" },
        camera: { type: "string" },
      },
      required: ["gesture", "reaction"],
    },
    run: async (ctx, { gesture, gestureParams = {}, reaction, reactionParams = {}, camera }) => {
      if (!CATALOG[gesture] || nodeTypeOf(CATALOG[gesture]) !== "gesture") return `"${gesture}" is not a gesture kind`;
      if (!CATALOG[reaction] || CATALOG[reaction].category !== "effect") return `"${reaction}" is not a reaction kind`;
      const cam = ctx.findNode(camera ?? ctx.api.activeCamera);
      const g = ctx.api.addNode(gesture, undefined, gestureParams);
      const r = ctx.api.addNode(reaction, undefined, reactionParams);
      ctx.api.connect({ source: g, target: r, sourceHandle: "out", targetHandle: "trigger" });
      if (cam && !CATALOG[reaction].action) ctx.api.connect({ source: r, target: cam.id, sourceHandle: "video", targetHandle: "video" });
      return `Created ${g} → ${r}${cam ? ` → ${cam.id}` : " (no camera found)"}`;
    },
  },
  {
    name: "gesture_flow_set_active_camera",
    description: "Make a camera the active one (sent to the OBS window). Camera by id or name.",
    inputSchema: { type: "object", properties: { camera: { type: "string" } }, required: ["camera"] },
    run: async (ctx, { camera }) => {
      const n = ctx.findNode(camera);
      if (!n || n.data.kind !== "camera") return `No camera "${camera}"`;
      ctx.api.setActiveCamera(n.id);
      return `Active camera: ${n.data.params?.name ?? n.id}`;
    },
  },
  {
    name: "gesture_flow_set_state",
    description: "Set a named true/false state variable (creates it if missing).",
    inputSchema: { type: "object", properties: { name: { type: "string" }, value: { type: "boolean" } }, required: ["name", "value"] },
    run: async (ctx, { name, value }) => {
      ctx.engine.vars.set(name, !!value);
      return `${name} = ${!!value}`;
    },
  },
  {
    name: "gesture_flow_test_reaction",
    description: "Fire a reaction node once (or for 1.5 s if continuous) without the gesture, to preview it.",
    inputSchema: { type: "object", properties: { node: { type: "string" } }, required: ["node"] },
    run: async (ctx, { node }) => {
      const n = ctx.findNode(node);
      if (!n || CATALOG[n.data.kind]?.category !== "effect") return `No reaction node "${node}"`;
      ctx.engine.test(n.id, performance.now());
      return `Fired ${n.id}`;
    },
  },
];

/** Builds the ctx and runs a tool by name. */
export async function runTool(name, args, { api, engine, runtime }) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return `Unknown tool ${name}`;
  const key = (v) => (v ? canonicalName(String(v)).toLowerCase() : null);
  const findNode = (idOrName) =>
    api.nodes.find((n) => n.id === idOrName) ??
    api.nodes.find((n) => [n.data.params?.name, n.data.params?.label].some((v) => v && key(v) === key(idOrName)));
  return tool.run({ api, engine, runtime, findNode }, args ?? {});
}

/** Schemas only (for listing tools without running them). */
export const TOOL_SCHEMAS = TOOLS.map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, annotations }));
