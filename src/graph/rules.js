// Turns the node graph into a list of human-readable "rules": for every reaction
// (and every state change) — what triggers it, under which conditions, and where
// it shows up. Pure: used by the Rules view and by tests.
import { CATALOG, nodeTypeOf, handleKind, withDefaults } from "./catalog.js";

/**
 * Expression trees:
 *  { t: "leaf",  id, kind, params, conds }       gesture / motion / switch / key … (conds = its own enable / block)
 *  { t: "state", id, name, invert }              "state X is on" (getVar)
 *  { t: "op",    id, kind, params, args: [{ port, exprs: [expr] }] }   logic node
 *  { t: "fired", id, kind }                       another reaction's "fired" output
 *  { t: "loop",  id }                             cycle guard
 */
export function buildRules(graph) {
  const nodes = new Map();
  for (const n of graph.nodes ?? []) {
    const def = CATALOG[n.data?.kind];
    if (def) nodes.set(n.id, { id: n.id, kind: def.kind, def, type: nodeTypeOf(def), params: withDefaults(def, n.data.params) });
  }
  const signalIn = new Map(); // targetId → [{ port, source, sourceHandle }]
  const videoOut = new Map(); // sourceId → [targetId]
  for (const e of graph.edges ?? []) {
    const s = nodes.get(e.source);
    const t = nodes.get(e.target);
    if (!s || !t) continue;
    if (handleKind(s.def, e.sourceHandle, "source") === "video") {
      if (!videoOut.has(e.source)) videoOut.set(e.source, []);
      videoOut.get(e.source).push(e.target);
    } else {
      if (!signalIn.has(e.target)) signalIn.set(e.target, []);
      signalIn.get(e.target).push({ port: e.targetHandle, source: e.source, sourceHandle: e.sourceHandle });
    }
  }
  const sourcesOf = (id, port) => (signalIn.get(id) ?? []).filter((x) => x.port === port);

  const condsOf = (id, seen) => {
    const out = [];
    for (const type of ["enable", "block"]) for (const src of sourcesOf(id, type)) out.push({ type, expr: expr(src, seen) });
    return out;
  };

  function expr(src, seen = new Set()) {
    const n = nodes.get(src.source);
    if (seen.has(n.id)) return { t: "loop", id: n.id };
    const next = new Set(seen).add(n.id);
    if (n.type === "effect") return { t: "fired", id: n.id, kind: n.kind };
    if (n.kind === "getVar") return { t: "state", id: n.id, name: n.params.name, invert: !!n.params.invert };
    if (n.type === "logic") {
      const args = (n.def.inputs ?? []).map((i) => ({ port: i.id, exprs: sourcesOf(n.id, i.id).map((s) => expr(s, next)) }));
      return { t: "op", id: n.id, kind: n.kind, params: n.params, args };
    }
    return { t: "leaf", id: n.id, kind: n.kind, params: n.params, conds: condsOf(n.id, next) };
  }

  // cameras a node's video reaches, following camera → camera merges
  const camerasOf = (id) => {
    const out = [];
    const stack = [...(videoOut.get(id) ?? [])];
    while (stack.length) {
      const c = stack.pop();
      if (out.includes(c) || nodes.get(c)?.type !== "camera") continue;
      out.push(c);
      stack.push(...(videoOut.get(c) ?? []));
    }
    return out;
  };

  const rules = [];
  for (const n of nodes.values()) {
    if (n.type === "effect") {
      const triggers = sourcesOf(n.id, "trigger").map((s) => expr(s, new Set([n.id])));
      rules.push({
        id: n.id,
        type: n.def.action ? "action" : n.def.isProp ? "object" : "effect",
        kind: n.kind,
        params: n.params,
        continuous: !!n.def.continuous,
        triggers, // OR of these
        conds: condsOf(n.id, new Set([n.id])),
        cameras: camerasOf(n.id),
        group: groupOf(triggers),
      });
    } else if (n.kind === "setVar") {
      for (const port of ["on", "off", "toggle"]) {
        const triggers = sourcesOf(n.id, port).map((s) => expr(s, new Set([n.id])));
        if (!triggers.length) continue;
        rules.push({ id: n.id, port, type: "state", kind: n.kind, params: n.params, triggers, conds: [], cameras: [], group: "state" });
      }
    }
  }
  const switches = [...nodes.values()].filter((n) => n.kind === "switch").map((n) => ({ id: n.id, label: n.params.label, on: n.params.on !== false, key: n.params.key }));
  return { rules, switches };
}

/** Gesture category of the trigger ("what can I do with my hands"); several categories → "combo". */
function groupOf(triggers) {
  const cats = new Set();
  const stack = [...triggers];
  while (stack.length) {
    const e = stack.shift();
    if (e.t === "leaf") cats.add(CATALOG[e.kind].category);
    if (e.t === "op") for (const a of e.args) stack.push(...a.exprs);
  }
  if (cats.size > 1) return "combo";
  return cats.size ? [...cats][0] : triggers.length ? "other" : "unconnected";
}

/** Switches / states a rule depends on (its own and its gestures' enable / block inputs). */
export function requirements(rule) {
  const out = [];
  const visit = (conds) => {
    for (const c of conds) {
      const e = c.expr;
      if (e.t === "leaf" && e.kind === "switch") out.push({ type: c.type, switchId: e.id });
      else if (e.t === "state") out.push({ type: c.type, state: e.name, invert: e.invert });
    }
  };
  visit(rule.conds);
  const stack = [...rule.triggers];
  while (stack.length) {
    const e = stack.shift();
    if (e.t === "leaf") visit(e.conds);
    if (e.t === "op") for (const a of e.args) stack.push(...a.exprs);
  }
  return out;
}

/**
 * Can this rule fire right now? "ready" | "off" (a switch is off) | "waiting" (needs a state)
 * | "blocked" (a switch / state blocks it) | "unconnected".
 */
export function availability(rule, switchesOn, vars) {
  if (!rule.triggers.length) return { status: "unconnected" };
  for (const r of requirements(rule)) {
    const value = r.switchId ? switchesOn.get(r.switchId) !== false : !!vars[r.state] !== !!r.invert;
    if (r.type === "enable" && !value) return r.switchId ? { status: "off", switchId: r.switchId } : { status: "waiting", state: r.state, invert: r.invert };
    if (r.type === "block" && value && (r.switchId || r.state)) return { status: "blocked", ...r };
  }
  return { status: "ready" };
}
