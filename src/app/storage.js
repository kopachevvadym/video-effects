// Saving / loading the graph (localStorage + JSON files).
import { createDefaultGraph } from "../graph/defaultGraph.js";
import { CATALOG, nodeTypeOf } from "../graph/catalog.js";

const KEY = "gesture-flow-graph-v1";

/**
 * New default nodes added after a graph was saved are merged in once, so an
 * update does not require "Reset" (which would lose the user's own changes).
 * Each entry: id + which default nodes it brings. Graphs saved by this version
 * list all ids in `migrations`, so a deleted node does not come back.
 */
const MIGRATIONS = [
  { id: "motions-1", nodes: (id) => id === "sw-motion" || /^(m|fx)-(swipe|wave|circle|push|nod|shake)/.test(id) },
  { id: "temple-1", nodes: (id) => id === "g-temple" || id === "fx-temple" },
  { id: "scenes-1", nodes: (id) => ["sw-scenes", "g-fingers", "act-scene"].includes(id) },
];

function migrate(graph) {
  const done = new Set(graph.migrations ?? []);
  let { nodes = [], edges = [] } = graph;
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    const def = createDefaultGraph();
    const have = new Set(nodes.map((n) => n.id));
    const add = def.nodes.filter((n) => m.nodes(n.id) && !have.has(n.id));
    if (add.length) {
      const top = Math.min(...add.map((n) => n.position.y));
      const bottom = Math.max(0, ...nodes.map((n) => n.position.y)) + 200;
      nodes = [...nodes, ...add.map((n) => ({ ...n, position: { x: n.position.x, y: n.position.y - top + bottom } }))];
      const ids = new Set(nodes.map((n) => n.id));
      const edgeIds = new Set(edges.map((e) => e.id));
      edges = [...edges, ...def.edges.filter((e) => (m.nodes(e.source) || m.nodes(e.target)) && ids.has(e.source) && ids.has(e.target) && !edgeIds.has(e.id))];
    }
  }
  return { ...graph, nodes, edges };
}

/** React Flow nodes need a `type`; derive it from the node kind. */
export function hydrate(graph) {
  return {
    ...graph,
    nodes: (graph.nodes ?? [])
      .filter((n) => CATALOG[n.data?.kind])
      .map((n) => ({ ...n, type: nodeTypeOf(CATALOG[n.data.kind]), ...(n.data.kind === "camera" ? { style: { width: n.style?.width ?? 320 } } : {}) })),
    edges: (graph.edges ?? []).map((e) => ({ ...e, type: "flow" })),
    variables: graph.variables ?? {},
  };
}

export function loadGraph() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return hydrate(migrate(JSON.parse(raw)));
  } catch {}
  return hydrate(createDefaultGraph());
}

export const defaultGraph = () => hydrate(createDefaultGraph());

/** A saved / imported graph → ready for the editor (applies migrations). */
export const fromJson = (obj) => hydrate(migrate(obj));

/** Strip React Flow runtime fields before saving. */
export function serialize({ nodes, edges, variables, activeCamera, settings }) {
  return {
    version: 1,
    migrations: MIGRATIONS.map((m) => m.id),
    nodes: nodes.map(({ id, position, data, style }) => ({ id, position, data, ...(style?.width ? { style: { width: style.width } } : {}) })),
    edges: edges.map(({ id, source, target, sourceHandle, targetHandle }) => ({ id, source, target, sourceHandle, targetHandle })),
    variables,
    activeCamera,
    settings,
  };
}

export function saveGraph(g) {
  try {
    localStorage.setItem(KEY, JSON.stringify(serialize(g)));
  } catch {}
}

export function downloadJson(g) {
  const blob = new Blob([JSON.stringify(serialize(g), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `gesture-flow-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

export function readJsonFile(file) {
  return file.text().then((t) => hydrate(migrate(JSON.parse(t))));
}
