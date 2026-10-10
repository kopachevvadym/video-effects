// Node-side tests for the graph engine with synthetic hands/face.
import { GraphEngine } from "../src/graph/engine.js";
import { createDefaultGraph } from "../src/graph/defaultGraph.js";
import { PropSystem } from "../src/runtime/props.js";
import { resolveCamera } from "../src/graph/effects.js";
import { buildRules, availability } from "../src/graph/rules.js";

globalThis.innerWidth = 1280; globalThis.innerHeight = 720;
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exitCode = 1; } else console.log("ok  ", m); };

// fake layers that record effect calls
class Layer { constructor(){ this.items=[]; this.pending=[]; this.state=new Map(); this.shake=0; this.face=null; this.hands=[]; } add(i){ this.pending.push(i); } }
const MCP = { index: [-30, -90], middle: [-5, -100], ring: [20, -95], pinky: [40, -85] };
const fin = ([mx, my], e) => (e ? [[mx, my], [mx, my - 35], [mx, my - 60], [mx, my - 80]] : [[mx, my], [mx, my - 30], [mx, my - 10], [mx, my + 10]]);
function hand(side, ox, oy, f = {}) {
  const { index = true, middle = true, ring = true, pinky = true, thumb = [-85, -80] } = f;
  const pts = [[0, 0], [-30, -20], [-55, -40], [-70, -60], thumb, ...fin(MCP.index, index), ...fin(MCP.middle, middle), ...fin(MCP.ring, ring), ...fin(MCP.pinky, pinky)]
    .map(([x, y]) => ({ x: x + ox, y: y + oy }));
  return { id: side, side, points: pts, size: Math.hypot(pts[9].x - pts[0].x, pts[9].y - pts[0].y), gesture: "None", gestureScore: 0 };
}
const fistF = { index: false, middle: false, ring: false, pinky: false, thumb: [-10, -60] };
const pointF = { middle: false, ring: false, pinky: false, thumb: [-10, -60] };

const g = createDefaultGraph();
const eng = new GraphEngine();
eng.load(g);
assert(eng.order.length === g.nodes.length, `all ${g.nodes.length} nodes ordered`);
assert(eng.effectCams.get("fx-ball").has("cam-hands") && eng.effectCams.get("fx-ball").has("cam-all") && !eng.effectCams.get("fx-ball").has("cam-face"), "energy ball reaches hands + merged camera, not face camera");
assert(eng.effectCams.get("fx-nose").has("cam-all") && eng.effectCams.get("fx-nose").has("cam-face"), "nose effect reaches face + merged camera");

const layers = new Map(eng.cameras.map((c) => [c, new Layer()]));
const props = new PropSystem();
let t = 0;
const step = (hands, face = null, keys = new Set()) => { t += 33; return eng.step({ hands, face, now: t, dt: 0.033, W: 1280, H: 720, keys, props }, layers); };
const fired = (cam) => layers.get(cam).pending.length;
const reset = () => layers.forEach((l) => { l.pending = []; l.state = new Map(); });

for (let i = 0; i < 5; i++) step([]);
assert(fired("cam-all") === 0, "nothing fires with no hands");

// two open palms apart → energy ball in hands + merged cameras
for (let i = 0; i < 8; i++) step([hand("left", 400, 500), hand("right", 800, 500)]);
assert(layers.get("cam-hands").state.has("energyBall") && layers.get("cam-all").state.has("energyBall"), "energy ball created in cam-hands and cam-all");
assert(!layers.get("cam-face").state.has("energyBall"), "no energy ball in cam-face");
reset();

// drawing is off by default: pointing does not draw
for (let i = 0; i < 10; i++) step([hand("right", 700, 500, pointF)]);
assert(!layers.get("cam-hands").state.has("magicTrail"), "pointing does not draw while state 'drawing' is off");
// both fists → toggle drawing on
for (let i = 0; i < 10; i++) step([hand("left", 400, 500, fistF), hand("right", 800, 500, fistF)]);
assert(eng.vars.get("drawing") === true, "two fists toggled 'drawing' on");
for (let i = 0; i < 4; i++) step([]);
for (let i = 0; i < 10; i++) step([hand("right", 700, 500, pointF)]);
assert(layers.get("cam-hands").state.has("magicTrail"), "pointing draws after the state is on");
reset();
// toggle off again
for (let i = 0; i < 10; i++) step([hand("left", 400, 500, fistF), hand("right", 800, 500, fistF)]);
assert(eng.vars.get("drawing") === false, "two fists toggled 'drawing' off");
for (let i = 0; i < 4; i++) step([]);
reset();

// hand selection: left-only gesture ignores the right hand
eng.load({ ...g, nodes: [...g.nodes, { id: "t-left", data: { kind: "fist", params: { hand: "left" } } }] });
for (let i = 0; i < 10; i++) step([hand("right", 700, 500, fistF)]);
assert(!eng.cur.get("t-left").on, "left-hand fist node ignores a right fist");
for (let i = 0; i < 10; i++) step([hand("left", 400, 500, fistF)]);
assert(eng.cur.get("t-left").on, "left-hand fist node fires on a left fist");

// sequence + delay nodes
const seqGraph = {
  nodes: [
    { id: "a", data: { kind: "keyPress", params: { key: "KeyA" } } },
    { id: "b", data: { kind: "keyPress", params: { key: "KeyB" } } },
    { id: "s", data: { kind: "sequence", params: { windowMs: 500 } } },
    { id: "d", data: { kind: "delay", params: { ms: 200 } } },
  ],
  edges: [
    { source: "a", target: "s", sourceHandle: "out", targetHandle: "a" },
    { source: "b", target: "s", sourceHandle: "out", targetHandle: "b" },
    { source: "s", target: "d", sourceHandle: "out", targetHandle: "in" },
  ],
};
const e2 = new GraphEngine(); e2.load(seqGraph);
const st2 = (keys) => { t += 33; e2.step({ hands: [], face: null, now: t, dt: 0.033, W: 1280, H: 720, keys, props }, new Map()); };
st2(new Set(["KeyA"])); st2(new Set()); st2(new Set(["KeyB"]));
assert(e2.cur.get("s").on, "sequence A then B (within window) is on");
assert(!e2.cur.get("d").on, "delay output still off right away");
for (let i = 0; i < 8; i++) st2(new Set(["KeyB"]));
assert(e2.cur.get("d").on, "delay output on after 200 ms");
st2(new Set()); for (let i = 0; i < 20; i++) st2(new Set());
st2(new Set(["KeyB"]));
assert(!e2.cur.get("s").on, "B alone (no A before) does not trigger the sequence");

// ---------- motions ----------
{
  const e3 = new GraphEngine();
  e3.load(createDefaultGraph());
  const L3 = new Map(e3.cameras.map((c) => [c, new Layer()]));
  const fires = new Map();
  const st3 = (hands, face = null) => {
    t += 33;
    const cur = e3.step({ hands, face, now: t, dt: 0.033, W: 1280, H: 720, keys: new Set(), props }, L3);
    for (const [id, v] of cur) if (v.on && id.startsWith("fx-")) fires.set(id, (fires.get(id) ?? 0) + 1);
  };
  const idle = (n = 30) => { for (let i = 0; i < n; i++) st3([]); };
  const move = (x0, y0, x1, y1, frames, f) => { for (let i = 0; i <= frames; i++) st3([hand("right", x0 + ((x1 - x0) * i) / frames, y0 + ((y1 - y0) * i) / frames, f)]); };
  const half = { index: true, middle: true, ring: false, pinky: false, thumb: [-10, -60] }; // a neutral pose (not open, not a fist)

  idle();
  move(700, 650, 700, 300, 8, half); // fast swipe up
  assert(fires.get("fx-swipe-up") === 1 && !fires.get("fx-swipe-down"), "swipe up fires the 'up' reaction only");
  assert(e3.effectCams.get("fx-swipe-up").has("cam-hands") && !e3.effectCams.get("fx-swipe-up").has("cam-face"), "swipe reaction goes to the hands camera");
  move(700, 300, 700, 650, 8, half); // hand comes back down right away
  assert(!fires.get("fx-swipe-down"), "the return stroke right after a swipe up is ignored");
  idle(25);
  move(700, 300, 700, 650, 8, half); // a real swipe down
  assert(fires.get("fx-swipe-down") === 1, "a separate swipe down fires the 'down' reaction");
  idle(25);
  move(400, 500, 800, 500, 8, half);
  assert(fires.get("fx-swipe-right") === 1 && !fires.get("fx-swipe-left"), "swipe right fires the 'right' reaction");
  idle(25);
  fires.clear();
  move(700, 650, 700, 560, 30, half); // slow, short movement
  assert(![...fires.keys()].some((k) => k.startsWith("fx-swipe")), "a slow small movement is not a swipe");
  idle(25);
  // wave: open palm going left-right
  fires.clear();
  for (let i = 0; i < 40; i++) st3([hand("right", 700 + Math.sin(i * 0.9) * 90, 450)]);
  assert(fires.get("fx-wave") >= 1, "waving an open palm fires the wave reaction");
  idle(25);
  // the Motions switch turns them all off
  e3.load({ ...createDefaultGraph(), nodes: createDefaultGraph().nodes.map((n) => (n.id === "sw-motion" ? { ...n, data: { ...n.data, params: { ...n.data.params, on: false } } } : n)) });
  fires.clear();
  idle(5);
  move(700, 650, 700, 300, 8, half);
  assert(!fires.get("fx-swipe-up"), "Motions switch off → swipe does nothing");
  // head nod
  e3.load(createDefaultGraph());
  fires.clear();
  const face = (pitch, yaw = 0) => ({ pitch, yaw, size: 250, nose: { x: 640, y: 360 }, top: { x: 640, y: 250 }, temples: [], eyes: {}, blend: {} });
  for (let i = 0; i < 40; i++) st3([], face(Math.sin(i * 0.8) * 0.08));
  assert(fires.get("fx-nod") >= 1 && !fires.get("fx-shake"), "nodding fires 'yes', not 'no'");
  fires.clear();
  for (let i = 0; i < 40; i++) st3([], face(0, Math.sin(i * 0.8) * 0.08));
  assert(fires.get("fx-shake") >= 1 && !fires.get("fx-nod"), "shaking the head fires 'no', not 'yes'");
}

// ---------- index finger to the temple ----------
{
  const e4 = new GraphEngine();
  e4.load(createDefaultGraph());
  const L4 = new Map(e4.cameras.map((c) => [c, new Layer()]));
  const face = { size: 250, pitch: 0, yaw: 0, nose: { x: 640, y: 400 }, top: { x: 640, y: 250 }, temple: { left: { x: 520, y: 330 }, right: { x: 760, y: 330 } } };
  const run = (hands, n = 10) => { let on = 0; for (let i = 0; i < n; i++) { t += 33; const cur = e4.step({ hands, face, now: t, dt: 0.033, W: 1280, H: 720, keys: new Set(), props }, L4); if (cur.get("fx-temple").on) on++; } return on; };
  // hand() places the index tip at (ox - 30, oy - 170)
  const atTemple = (f) => [hand("right", 760 + 30, 330 + 170, f)];
  assert(run(atTemple(pointF)) === 1, "index finger at the temple fires mind waves once");
  assert(e4.cur.get("g-temple").hit.temple === "right", "…and knows which temple");
  run([], 30);
  assert(run(atTemple()) === 0, "an open hand at the temple does not count (pose = only the index finger)");
  run([], 30);
  assert(run([hand("right", 640 + 30, 600 + 170, pointF)]) === 0, "pointing away from the head does not fire");
  assert(L4.get("cam-face").pending.length > 0 && e4.effectCams.get("fx-temple").has("cam-all"), "mind waves go to the face and merged cameras");
}

// ---------- show 1–5 fingers → switch camera ----------
{
  const e5 = new GraphEngine();
  e5.load(createDefaultGraph());
  const L5 = new Map(e5.cameras.map((c) => [c, new Layer()]));
  const actions = [];
  e5.onAction = (a) => actions.push(a);
  const run = (hands, n) => { for (let i = 0; i < n; i++) { t += 33; e5.step({ hands, face: null, now: t, dt: 0.033, W: 1280, H: 720, keys: new Set(), props }, L5); } };
  const fingers = (n) => {
    const f = { index: n >= 1, middle: n >= 2, ring: n >= 3, pinky: n >= 4, thumb: n >= 5 ? [-105, -75] : [-10, -60] };
    return hand("left", 400, 500, f);
  };
  run([], 10);
  run([fingers(2)], 10);
  assert(actions.length === 0, "2 fingers for 0.3 s: not yet (must be held still ~0.6 s)");
  run([fingers(2)], 15);
  assert(actions.length === 1 && actions[0].hit.count === 2 && actions[0].params.target === "fingers", "2 fingers held still → one switch action with count 2");
  run([fingers(2)], 30);
  assert(actions.length === 1, "keeping the fingers up does not switch again");
  run([fingers(3)], 30);
  assert(actions.length === 2 && actions[1].hit.count === 3, "changing to 3 fingers switches again");
  for (const n of [1, 4, 5]) { run([], 10); run([fingers(n)], 30); }
  assert(actions.slice(2).map((a) => a.hit.count).join() === "1,4,5", "1, 4 and 5 fingers are counted right");
  run([], 10);
  const before = actions.length;
  for (let i = 0; i < 40; i++) run([hand("left", 300 + i * 12, 500, { index: true, middle: true, ring: false, pinky: false, thumb: [-10, -60] })], 1);
  assert(actions.length === before, "a moving hand never switches");
  run([], 10);
  run([{ ...fingers(2), points: fingers(2).points.map((q) => ({ x: q.x, y: 1000 - q.y })) }], 40);
  assert(actions.length === before, "fingers pointing down do not count (upright only)");
  e5.vars.set("drawing", true);
  run([], 10); run([fingers(3)], 40);
  assert(actions.length === before, "no switching while drawing is on");
  e5.vars.set("drawing", false);
  const cams = [{ id: "a", hotkey: "1" }, { id: "b", hotkey: "2" }, { id: "c", hotkey: "3" }, { id: "d", hotkey: "" }];
  assert(resolveCamera(cams, "a", "fingers", 2) === "b" && resolveCamera(cams, "a", "fingers", 5) === null, "count → camera with that Alt+N; none for a missing one");
  assert(resolveCamera(cams, "c", "next") === "a" && resolveCamera(cams, "a", "prev") === "c" && resolveCamera(cams, "a", "3") === "c", "next / prev wrap around, fixed hotkey works");
}

// ---------- Rules view model ----------
{
  const { rules, switches } = buildRules(createDefaultGraph());
  const on = new Map(switches.map((s) => [s.id, s.on]));
  const r = (id) => rules.find((x) => x.id === id);
  assert(r("fx-laser").group === "combo" && r("fx-laser").triggers[0].kind === "and", "laser = wink AND pointing, grouped as a combination");
  assert(r("fx-ball").cameras.includes("cam-hands") && r("fx-ball").cameras.includes("cam-all"), "rule lists the cameras incl. merged ones");
  assert(availability(r("fx-trail"), on, { drawing: false }).status === "waiting" && availability(r("fx-trail"), on, { drawing: true }).status === "ready", "light trail waits for the 'drawing' state");
  assert(availability(r("fx-swipe-up"), new Map([...on, ["sw-motion", false]]), {}).status === "off", "Motions switch off → swipe rules are off");
  assert(rules.some((x) => x.type === "state" && x.params.name === "drawing" && x.port === "toggle"), "two fists → toggles 'drawing' is listed as a state rule");
}
console.log(process.exitCode ? "SOME TESTS FAILED" : "ALL PASSED");
