// Singletons shared by the React UI: graph engine, live runtime, OBS client,
// and a throttled store with per-node live status for the editor.
import { useSyncExternalStore } from "react";
import { GraphEngine } from "../graph/engine.js";
import { Runtime } from "../runtime/runtime.js";
import { ObsClient } from "../runtime/obs.js";

export const engine = new GraphEngine();
export const runtime = new Runtime(engine);
export const obs = new ObsClient();

// ---------- live node status (10 Hz) ----------

let snapshot = new Map();
let varsSnapshot = {};
const listeners = new Set();

setInterval(() => {
  snapshot = new Map(engine.status);
  const vars = Object.fromEntries(engine.vars);
  if (JSON.stringify(vars) !== JSON.stringify(varsSnapshot)) varsSnapshot = vars;
  for (const fn of listeners) fn();
}, 100);

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

const EMPTY = { on: false, progress: null, debug: "" };

/** Live status of one node: { on, progress, debug }. */
export const useNodeStatus = (id) => useSyncExternalStore(subscribe, () => snapshot.get(id) ?? EMPTY);

/** Live values of state variables. */
export const useVars = () => useSyncExternalStore(subscribe, () => varsSnapshot);

/** Runtime "tick" for things like FPS and recording state. */
let tick = 0;
setInterval(() => tick++, 500);
export const useTick = () => useSyncExternalStore(subscribe, () => tick);
