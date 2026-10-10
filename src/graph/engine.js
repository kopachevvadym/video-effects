// Runs a node graph every frame.
//
// Signal model: every node outputs { on, hit } per frame; `rise` / `fall` are
// derived from the previous frame. Gesture nodes add stabilization (hold / grace
// frames). Effect nodes fire on a rising edge (one-shot effects) or every frame
// while on (continuous effects) into the cameras they are connected to —
// directly, or through other cameras (a camera fed by cameras merges them).
import { CATALOG, nodeTypeOf, withDefaults, handleKind } from "./catalog.js";
import { localizeName } from "./names.js";
import { runtimeLang } from "../runtime/lang.js";
import { facePoint } from "./gestures.js";

const OFF = { on: false, hit: null, rise: false, fall: false };

export class GraphEngine {
  constructor() {
    this.nodes = [];
    this.byId = new Map();
    this.order = [];
    this.inEdges = new Map(); // nodeId → Map(handle → [sourceId])
    this.effectCams = new Map(); // effectId → Set(cameraId)
    this.cameras = [];
    this.states = new Map(); // nodeId → { kind, state }
    this.cur = new Map();
    this.prev = new Map();
    this.status = new Map();
    this.vars = new Map();
    this.manual = new Map(); // nodeId → until timestamp (test button)
    this.onAction = null; // (action) => void, set by the app
  }

  /** (Re)load a graph. Node state survives if the node kept its id and kind. */
  load(graph) {
    const nodes = [];
    for (const n of graph.nodes ?? []) {
      const def = CATALOG[n.data?.kind];
      if (!def) continue;
      nodes.push({ id: n.id, def, type: nodeTypeOf(def), params: withDefaults(def, n.data.params) });
    }
    this.nodes = nodes;
    this.byId = new Map(nodes.map((n) => [n.id, n]));
    this.cameras = nodes.filter((n) => n.type === "camera").map((n) => n.id);

    // keep per-node runtime state when possible
    const states = new Map();
    for (const n of nodes) {
      const old = this.states.get(n.id);
      states.set(n.id, old && old.kind === n.def.kind ? old : { kind: n.def.kind, state: {} });
    }
    this.states = states;

    // edges
    const signalEdges = [];
    const videoEdges = [];
    this.inEdges = new Map();
    for (const e of graph.edges ?? []) {
      const s = this.byId.get(e.source);
      const t = this.byId.get(e.target);
      if (!s || !t) continue;
      const sk = handleKind(s.def, e.sourceHandle, "source");
      const tk = handleKind(t.def, e.targetHandle, "target");
      if (sk !== tk) continue;
      if (sk === "video") videoEdges.push(e);
      else {
        signalEdges.push(e);
        if (!this.inEdges.has(e.target)) this.inEdges.set(e.target, new Map());
        const m = this.inEdges.get(e.target);
        const h = e.targetHandle ?? "in";
        if (!m.has(h)) m.set(h, []);
        m.get(h).push(e.source);
      }
    }

    // topological order over signal edges (nodes in cycles go last and read last frame's value)
    const indeg = new Map(nodes.map((n) => [n.id, 0]));
    const outs = new Map(nodes.map((n) => [n.id, []]));
    for (const e of signalEdges) {
      indeg.set(e.target, indeg.get(e.target) + 1);
      outs.get(e.source).push(e.target);
    }
    const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
    const order = [];
    while (queue.length) {
      const id = queue.shift();
      order.push(id);
      for (const t of outs.get(id)) {
        indeg.set(t, indeg.get(t) - 1);
        if (indeg.get(t) === 0) queue.push(t);
      }
    }
    for (const n of nodes) if (!order.includes(n.id)) order.push(n.id);
    this.order = order;

    // which cameras each effect reaches (effect → camera → camera …)
    const videoOut = new Map();
    for (const e of videoEdges) {
      if (!videoOut.has(e.source)) videoOut.set(e.source, []);
      videoOut.get(e.source).push(e.target);
    }
    this.effectCams = new Map();
    for (const n of nodes) {
      if (n.type !== "effect") continue;
      const seen = new Set();
      const stack = [...(videoOut.get(n.id) ?? [])];
      while (stack.length) {
        const id = stack.pop();
        if (seen.has(id)) continue;
        seen.add(id);
        stack.push(...(videoOut.get(id) ?? []));
      }
      this.effectCams.set(n.id, new Set([...seen].filter((id) => this.byId.get(id)?.type === "camera")));
    }

    // state variables: declared initial values, keep current ones
    for (const [name, value] of Object.entries(graph.variables ?? {})) if (!this.vars.has(name)) this.vars.set(name, !!value);
    for (const n of nodes) if (n.params.name && n.def.category === "state" && !this.vars.has(n.params.name)) this.vars.set(n.params.name, false);
  }

  /** Signal arriving at a handle: OR of all connected sources. undefined if nothing is connected. */
  input(nodeId, handle) {
    const srcs = this.inEdges.get(nodeId)?.get(handle);
    if (!srcs?.length) return undefined;
    let res = null;
    for (const s of srcs) {
      const sig = this.cur.get(s) ?? this.prev.get(s) ?? OFF;
      if (!res) res = { ...sig };
      else if (sig.on && !res.on) res = { ...sig };
      else res.rise = res.rise || sig.rise;
    }
    return res;
  }

  /** Test button: pretend the effect's input is on. */
  test(nodeId, now) {
    const n = this.byId.get(nodeId);
    if (!n) return;
    this.manual.set(nodeId, { from: now, until: now + (n.def.continuous ? 1500 : 50), pending: true }); // pending: never miss it at low fps
  }

  /**
   * @param world  { hands, face, now, dt, W, H, keys, props, vars }
   * @param layers Map(cameraId → FxLayer)
   */
  step(world, layers) {
    world.vars = this.vars;
    this.prev = this.cur;
    this.cur = new Map();
    const { now } = world;

    for (const id of this.order) {
      const n = this.byId.get(id);
      const st = this.states.get(id).state;
      const debug = [];
      let on = false;
      let hit = null;
      let progress = null;

      if (n.type === "gesture") {
        const enable = this.input(id, "enable");
        const block = this.input(id, "block");
        const allowed = (!enable || enable.on) && !block?.on;
        let raw = null;
        try {
          raw = allowed ? n.def.detect(world, n.params, st, debug) : null;
        } catch (err) {
          debug.push(String(err.message ?? err));
        }
        st.count ??= 0;
        st.misses ??= 0;
        if (raw) {
          st.count++;
          st.misses = 0;
          st.lastHit = raw;
        } else if (st.count > 0 && ++st.misses > n.params.grace) {
          st.count = 0;
          st.misses = 0;
        }
        if (!allowed) st.count = 0;
        on = st.count >= n.params.hold;
        hit = on ? raw ?? st.lastHit : null;
        progress = Math.min(1, st.count / Math.max(1, n.params.hold));
      } else if (n.type === "logic") {
        const inputs = {};
        for (const h of n.def.inputs ?? []) inputs[h.id] = this.input(id, h.id);
        const out = n.def.compute(inputs, n.params, st, world);
        on = out.on;
        hit = out.hit;
      } else if (n.type === "effect") {
        const fired = this.runEffect(n, st, world, layers);
        on = fired.on;
        hit = fired.hit;
        if (fired.active) debug.push("▶");
      }

      const prevOn = this.prev.get(id)?.on ?? false;
      this.cur.set(id, { on, hit, rise: on && !prevOn, fall: !on && prevOn });
      this.status.set(id, { on, progress, debug: debug.join(" ") });
    }
    return this.cur;
  }

  runEffect(n, st, world, layers) {
    const { now } = world;
    const p = n.params;
    let input = this.input(n.id, "trigger") ?? { ...OFF };
    const enable = this.input(n.id, "enable");
    const block = this.input(n.id, "block");

    const m = this.manual.get(n.id);
    if (m && (now <= m.until || m.pending)) {
      m.pending = false;
      const prevManual = st.manualOn;
      input = { on: true, rise: !prevManual, hit: defaultHit(world) };
      st.manualOn = true;
    } else {
      st.manualOn = false;
      if ((enable && !enable.on) || block?.on) input = { ...OFF };
    }

    let firedHit = null;
    if (n.def.continuous) {
      if (input.on) {
        firedHit = input.hit ?? defaultHit(world);
        this.fire(n, firedHit, world, layers);
      }
      return { on: !!firedHit, hit: firedHit, active: !!firedHit };
    }

    // one-shot: rising edge → (cooldown, chance) → queue with delay
    st.queue ??= [];
    if (input.rise && now - (st.lastAccepted ?? -Infinity) >= (p.cooldownMs ?? 0)) {
      st.lastAccepted = now;
      if (Math.random() * 100 < (p.chance ?? 100)) st.queue.push({ at: now + (p.delayMs ?? 0), hit: input.hit ?? defaultHit(world) });
    }
    while (st.queue.length && st.queue[0].at <= now) {
      firedHit = st.queue.shift().hit;
      this.fire(n, firedHit, world, layers);
    }
    return { on: !!firedHit, hit: firedHit, active: st.queue.length > 0 };
  }

  fire(n, rawHit, world, layers) {
    const cams = this.effectCams.get(n.id) ?? new Set();
    const p = n.params;
    const face = world.face;
    let hit = { ...rawHit };
    // where the effect appears
    if (p.anchor && p.anchor !== "gesture") {
      const pt = p.anchor === "center" || !face ? { x: world.W / 2, y: world.H / 2 } : facePoint(face, p.anchor === "forehead" ? "forehead" : p.anchor);
      hit.x = pt.x;
      hit.y = pt.y;
      if (face && !hit.size) hit.size = face.size;
    }
    // context some effects use when the trigger did not provide it
    if (face) {
      hit.yaw ??= face.yaw;
      hit.pitch ??= face.pitch;
      hit.temples ??= face.temples;
      hit.face ??= face.nose;
    }
    hit.size = (hit.size ?? 120) * (p.scale ?? 1);
    if (p.intensity != null) hit.intensity = p.intensity;
    if (p.hue != null) hit.hue = p.hue;
    if (p.text != null) hit.text = localizeName(p.text, runtimeLang.current);

    if (n.def.action) {
      // non-visual actions (e.g. switching the active camera) are carried out by the app
      this.onAction?.({ type: n.def.action, node: n.id, params: p, hit });
      return;
    }
    if (n.def.kind === "spawnProp") {
      world.props?.spawn({ type: p.type, place: p.place, hit, outputs: cams, release: p.release, replace: true }, world);
      return;
    }
    if (n.def.kind === "clearProps") {
      world.props?.clear(p.type);
      return;
    }
    for (const cam of cams) {
      const layer = layers.get(cam);
      if (layer) n.def.run(layer, { ...hit });
    }
  }
}

function defaultHit(world) {
  const f = world.face;
  return f ? { ...f.nose, size: f.size } : { x: world.W / 2, y: world.H / 2, size: 250 };
}
