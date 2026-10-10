// Logic nodes: combine / reshape signals in time.
// A signal is { on: boolean, hit: object | null } per frame.

const num = (key, label, def, min, max, step = 1) => ({ key, type: "number", label, default: def, min, max, step });
const opt = (value, uk, en) => ({ value, label: { uk, en } });

const ABC = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
  { id: "c", label: "C" },
];

const anchorParam = {
  key: "anchor",
  type: "select",
  label: { uk: "Позиція з", en: "Position from" },
  options: [opt("a", "A", "A"), opt("b", "B", "B"), opt("c", "C", "C"), opt("mid", "Середнє", "Average")],
  default: "a",
};

const midHit = (hits) => {
  const hs = hits.filter(Boolean);
  if (!hs.length) return null;
  const x = hs.reduce((a, h) => a + h.x, 0) / hs.length;
  const y = hs.reduce((a, h) => a + h.y, 0) / hs.length;
  return { ...Object.assign({}, ...hs), x, y };
};

/** Merges hits of the active inputs; position comes from the chosen input. */
function mergeHits(inputs, anchor) {
  const hits = ABC.map((p) => inputs[p.id]?.hit ?? null);
  const merged = Object.assign({}, ...hits.filter(Boolean).reverse()); // A wins on conflicts
  if (anchor === "mid") return midHit(hits) && { ...merged, ...midHit(hits) };
  const pos = inputs[anchor]?.hit;
  return pos ? { ...merged, x: pos.x, y: pos.y, size: pos.size ?? merged.size } : hits.find(Boolean) ?? null;
}

const and = {
  kind: "and",
  category: "logic",
  icon: "∧",
  title: { uk: "І (одночасно)", en: "AND (together)" },
  inputs: ABC,
  params: [anchorParam],
  compute(inputs, p) {
    const connected = ABC.filter((x) => inputs[x.id]);
    const on = connected.length > 0 && connected.every((x) => inputs[x.id].on);
    return { on, hit: on ? mergeHits(inputs, p.anchor) : null };
  },
};

const or = {
  kind: "or",
  category: "logic",
  icon: "∨",
  title: { uk: "АБО (будь-який)", en: "OR (any)" },
  inputs: ABC,
  params: [],
  compute(inputs) {
    const first = ABC.map((x) => inputs[x.id]).find((s) => s?.on);
    return { on: !!first, hit: first?.hit ?? null };
  },
};

const not = {
  kind: "not",
  category: "logic",
  icon: "¬",
  title: { uk: "НЕ (інверсія)", en: "NOT" },
  inputs: [{ id: "in", label: "" }],
  params: [],
  compute(inputs) {
    return { on: !inputs.in?.on, hit: null };
  },
};

const sequence = {
  kind: "sequence",
  category: "logic",
  icon: "→",
  title: { uk: "Комбо: A, потім B", en: "Combo: A then B" },
  inputs: [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
  ],
  params: [num("windowMs", { uk: "Вікно, мс", en: "Window, ms" }, 1500, 100, 10000, 100)],
  compute(inputs, p, state, { now }) {
    const a = inputs.a;
    const b = inputs.b;
    if (a?.rise) state.aAt = now;
    if (b?.rise && now - (state.aAt ?? -Infinity) <= p.windowMs) {
      state.active = true;
      state.aAt = -Infinity;
    }
    if (!b?.on) state.active = false;
    return { on: !!state.active, hit: state.active ? b.hit : null };
  },
};

/** Queue-based time shift: output = input as it was `ms` ago. */
const delay = {
  kind: "delay",
  category: "logic",
  icon: "⏱",
  title: { uk: "Затримка", en: "Delay" },
  inputs: [{ id: "in", label: "" }],
  params: [num("ms", { uk: "Затримка, мс", en: "Delay, ms" }, 500, 0, 10000, 50)],
  compute(inputs, p, state, { now }) {
    state.q ??= [];
    state.q.push({ t: now, on: !!inputs.in?.on, hit: inputs.in?.hit ?? null });
    let out = { on: false, hit: null };
    while (state.q.length && state.q[0].t <= now - p.ms) out = state.q.shift();
    if (out.t != null) state.last = out;
    const last = state.last ?? { on: false, hit: null };
    return { on: last.on, hit: last.hit };
  },
};

const holdFor = {
  kind: "holdFor",
  category: "logic",
  icon: "⏳",
  title: { uk: "Утримувати не менше", en: "Hold at least" },
  inputs: [{ id: "in", label: "" }],
  params: [num("ms", { uk: "Тривалість, мс", en: "Duration, ms" }, 1000, 0, 10000, 50)],
  compute(inputs, p, state, { now }) {
    if (inputs.in?.on) state.since ??= now;
    else state.since = null;
    const on = state.since != null && now - state.since >= p.ms;
    return { on, hit: on ? inputs.in.hit : null };
  },
};

const extend = {
  kind: "extend",
  category: "logic",
  icon: "↦",
  title: { uk: "Подовжити", en: "Extend" },
  inputs: [{ id: "in", label: "" }],
  params: [num("ms", { uk: "Ще, мс", en: "Extra, ms" }, 1000, 0, 20000, 100)],
  compute(inputs, p, state, { now }) {
    if (inputs.in?.on) {
      state.until = now + p.ms;
      state.hit = inputs.in.hit;
    }
    const on = now < (state.until ?? -Infinity);
    return { on, hit: on ? state.hit : null };
  },
};

const toggle = {
  kind: "toggle",
  category: "logic",
  icon: "⇄",
  title: { uk: "Перемикач", en: "Toggle" },
  inputs: [{ id: "in", label: "" }],
  params: [],
  compute(inputs, p, state) {
    if (inputs.in?.rise) {
      state.on = !state.on;
      state.hit = inputs.in.hit;
    }
    if (inputs.in?.hit) state.hit = inputs.in.hit;
    return { on: !!state.on, hit: state.on ? state.hit : null };
  },
};

const counter = {
  kind: "counter",
  category: "logic",
  icon: "#",
  title: { uk: "Кожен N-й раз", en: "Every Nth time" },
  inputs: [{ id: "in", label: "" }],
  params: [num("n", { uk: "N", en: "N" }, 3, 1, 50, 1)],
  compute(inputs, p, state) {
    let on = false;
    if (inputs.in?.rise) {
      state.c = (state.c ?? 0) + 1;
      if (state.c >= p.n) {
        state.c = 0;
        on = true;
      }
    }
    return { on, hit: on ? inputs.in.hit : null };
  },
};

export const LOGIC = [and, or, not, sequence, delay, holdFor, extend, toggle, counter];

// ---------- state variables (shared by name across the whole graph) ----------

const varName = { key: "name", type: "var", label: { uk: "Стан", en: "State" }, default: "drawing" };

const setVar = {
  kind: "setVar",
  category: "state",
  icon: "🔘",
  title: { uk: "Змінити стан", en: "Set state" },
  inputs: [
    { id: "on", label: { uk: "увімкнути", en: "turn on" } },
    { id: "off", label: { uk: "вимкнути", en: "turn off" } },
    { id: "toggle", label: { uk: "перемкнути", en: "toggle" } },
  ],
  params: [varName],
  compute(inputs, p, state, { vars }) {
    if (inputs.on?.rise) vars.set(p.name, true);
    if (inputs.off?.rise) vars.set(p.name, false);
    if (inputs.toggle?.rise) vars.set(p.name, !vars.get(p.name));
    const on = !!vars.get(p.name);
    return { on, hit: null };
  },
};

const getVar = {
  kind: "getVar",
  category: "state",
  icon: "🟢",
  title: { uk: "Стан увімкнений?", en: "State is on?" },
  inputs: [],
  params: [
    varName,
    {
      key: "invert",
      type: "bool",
      label: { uk: "Навпаки (вимкнений)", en: "Inverted (is off)" },
      default: false,
    },
  ],
  compute(inputs, p, state, { vars }) {
    const v = !!vars.get(p.name);
    return { on: p.invert ? !v : v, hit: null };
  },
};

LOGIC.push(setVar, getVar);
