// "Rules" view: every reaction in the graph as a readable card — what triggers it,
// under which conditions, where it appears — with live status, so you can see
// at a glance what you can use right now and how.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CATALOG, CATEGORIES, nodeTypeOf } from "../graph/catalog.js";
import { ANCHORS } from "../graph/effects.js";
import { buildRules, availability, requirements } from "../graph/rules.js";
import { useI18n } from "./i18n.jsx";
import { paramSummary } from "./params.jsx";
import { NodeParams } from "./panels.jsx";
import { useNodeStatus, useVars } from "./core.js";

const T = {
  title: { uk: "Правила", en: "Rules" },
  intro: {
    uk: "Усі реакції графа: що їх запускає, за яких умов і в яких камерах їх видно. Підсвічені жести зараз розпізнаються.",
    en: "Every reaction in the graph: what triggers it, under which conditions, and in which cameras it appears. Highlighted gestures are being detected right now.",
  },
  search: { uk: "Пошук правил…", en: "Search rules…" },
  onlyReady: { uk: "Лише доступні зараз", en: "Only available now" },
  switches: { uk: "Вимикачі", en: "Switches" },
  states: { uk: "Стани", en: "States" },
  when: { uk: "Коли", en: "When" },
  onlyIf: { uk: "Лише якщо", en: "Only if" },
  notWhile: { uk: "Не спрацює, поки", en: "Not while" },
  shows: { uk: "Видно в", en: "Shows in" },
  noCamera: { uk: "не підключено до жодної камери — ефект не видно", en: "not connected to any camera — it is invisible" },
  test: { uk: "▶ Тест", en: "▶ Test" },
  open: { uk: "Відкрити в редакторі ↗", en: "Open in editor ↗" },
  ready: { uk: "Доступно", en: "Available" },
  off: { uk: "Вимкнено", en: "Off" },
  waiting: { uk: "Чекає стану", en: "Needs state" },
  blocked: { uk: "Заблоковано", en: "Blocked" },
  unconnected: { uk: "Нічим не запускається", en: "No trigger" },
  liveNow: { uk: "зараз", en: "now" },
  or: { uk: "або", en: "or" },
  plus: { uk: "+", en: "+" },
  together: { uk: "одночасно", en: "at the same time" },
  not: { uk: "НЕ", en: "NOT" },
  then: { uk: "потім", en: "then" },
  within: { uk: "протягом", en: "within" },
  after: { uk: "і через", en: "and after" },
  heldFor: { uk: "утримувати", en: "held for" },
  extend: { uk: "і ще", en: "plus" },
  toggles: { uk: "кожен раз перемикає увімк./вимк.", en: "each time flips on / off" },
  every: { uk: "кожен", en: "every" },
  nth: { uk: "-й раз", en: "th time" },
  stateOn: { uk: "стан «{0}» увімкнено", en: "state “{0}” is on" },
  stateOff: { uk: "стан «{0}» вимкнено", en: "state “{0}” is off" },
  firedAfter: { uk: "спрацювала реакція «{0}»", en: "reaction “{0}” fired" },
  notConnected: { uk: "(нічого не підключено)", en: "(nothing connected)" },
  once: { uk: "Один раз на жест", en: "Once per gesture" },
  whileOn: { uk: "Весь час, поки жест триває", en: "For as long as the gesture lasts" },
  delay: { uk: "через {0} мс", en: "after {0} ms" },
  cooldown: { uk: "потім пауза {0} мс", en: "then rests {0} ms" },
  chance: { uk: "шанс {0}%", en: "{0}% chance" },
  at: { uk: "місце: {0}", en: "at: {0}" },
  setOn: { uk: "Вмикає стан «{0}»", en: "Turns state “{0}” on" },
  setOff: { uk: "Вимикає стан «{0}»", en: "Turns state “{0}” off" },
  setToggle: { uk: "Перемикає стан «{0}» (увімк. ↔ вимк.)", en: "Flips state “{0}” (on ↔ off)" },
  camAction: { uk: "Робить активною камеру: {0}", en: "Makes this camera active: {0}" },
  camByFingers: { uk: "з Alt+N, де N — кількість пальців", en: "the one with Alt+N, N = number of fingers" },
  camNext: { uk: "наступну", en: "the next one" },
  camPrev: { uk: "попередню", en: "the previous one" },
  camKey: { uk: "з Alt+{0}", en: "the one with Alt+{0}" },
  objectSpawn: { uk: "Створює об'єкт", en: "Spawns an object" },
  objectClear: { uk: "Прибирає об'єкти", en: "Removes objects" },
  key: { uk: "клавіша", en: "key" },
  count: { uk: "{0} з {1}", en: "{0} of {1}" },
  edit: { uk: "⚙ Налаштувати", en: "⚙ Edit" },
  editDone: { uk: "Готово", en: "Done" },
  editHint: { uk: "Зміни застосовуються одразу. Клікни будь-який жест чи умову вище, щоб перейти до його налаштувань.", en: "Changes apply right away. Click any gesture or condition above to jump to its settings." },
  roleReaction: { uk: "реакція", en: "reaction" },
  roleTrigger: { uk: "запуск", en: "trigger" },
  roleLogic: { uk: "логіка", en: "logic" },
  roleCond: { uk: "умова", en: "condition" },
  noParams: { uk: "Без налаштувань", en: "No settings" },
  empty: { uk: "Нічого не знайдено", en: "Nothing found" },
  howOn: { uk: "Як увімкнути «{0}»", en: "To turn “{0}” on" },
  howOff: { uk: "Як вимкнути «{0}»", en: "To turn “{0}” off" },
  noSetter: { uk: "нічим — лише вручну (клік на стан угорі)", en: "nothing in the graph — only by hand (click the state at the top)" },
  portOn: { uk: "вмикає", en: "turns on" },
  portOff: { uk: "вимикає", en: "turns off" },
  portToggle: { uk: "перемикає", en: "flips" },
  combo: { uk: "Комбінації", en: "Combinations" },
  stateGroup: { uk: "Зміни станів", en: "State changes" },
  other: { uk: "Інше", en: "Other" },
  unconnectedGroup: { uk: "Не підключені", en: "Not connected" },
};
/** Clicking a pill (gesture, logic, state…) opens that node's settings inside its card. */
const PickCtx = createContext(null);
const usePick = (id) => {
  const pick = useContext(PickCtx);
  return pick && id
    ? {
        onClick: (ev) => {
          ev.stopPropagation();
          pick(id);
        },
        role: "button",
        tabIndex: 0,
      }
    : {};
};

const fmt = (s, ...a) => a.reduce((acc, v, i) => acc.replace(`{${i}}`, v), s);
const GROUP_ORDER = ["hand", "motion", "face", "handFace", "combo", "object", "input", "state", "other", "unconnected"];

export function RulesView({ nodes, edges, activeCamera, selectedId, onSelect, onOpen, onToggleSwitch, onTest, onParams }) {
  const { L, N } = useI18n();
  const vars = useVars();
  const [q, setQ] = useState("");
  const [onlyReady, setOnlyReady] = useState(false);
  const { rules, switches } = useMemo(() => buildRules({ nodes, edges }), [nodes, edges]);
  const switchesOn = useMemo(() => new Map(switches.map((s) => [s.id, s.on])), [switches]);
  const cameraName = (id) => {
    const c = nodes.find((n) => n.id === id);
    return N(c?.data.params?.name) || id;
  };
  const switchLabel = (id) => N(switches.find((s) => s.id === id)?.label) || id;
  // state name → the rules that change it ("how do I turn drawing on?")
  const setters = useMemo(() => {
    const m = new Map();
    for (const r of rules) if (r.type === "state") m.set(r.params.name, [...(m.get(r.params.name) ?? []), r]);
    return m;
  }, [rules]);

  const items = rules.map((r) => ({ rule: r, avail: availability(r, switchesOn, vars), text: searchText(r, L, N) }));
  const ql = q.trim().toLowerCase();
  const shown = items.filter((it) => (!ql || it.text.includes(ql)) && (!onlyReady || it.avail.status === "ready"));
  const groups = GROUP_ORDER.map((g) => [g, shown.filter((it) => it.rule.group === g)]).filter(([, list]) => list.length);
  const groupTitle = (g) =>
    g === "combo" ? L(T.combo) : g === "state" ? L(T.stateGroup) : g === "other" ? L(T.other) : g === "unconnected" ? L(T.unconnectedGroup) : L(CATEGORIES[g]);

  return (
    <div className="rules-view">
      <div className="rules-head">
        <div>
          <h1>{L(T.title)}</h1>
          <p className="hint">{L(T.intro)}</p>
        </div>
        <div className="rules-tools">
          <input className="search" placeholder={L(T.search)} value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="inline">
            <input type="checkbox" checked={onlyReady} onChange={(e) => setOnlyReady(e.target.checked)} /> {L(T.onlyReady)}
          </label>
          <span className="hint">{fmt(L(T.count), shown.length, items.length)}</span>
        </div>
      </div>

      {(switches.length > 0 || Object.keys(vars).length > 0) && (
        <div className="rules-switches">
          {switches.length > 0 && <span className="label">{L(T.switches)}:</span>}
          {switches.map((s) => (
            <button key={s.id} className={`state-chip ${s.on ? "on" : ""}`} onClick={() => onToggleSwitch(s.id)}>
              <span className="dot" /> ⏻ {N(s.label) || s.id}
              {s.key && <kbd>{s.key.replace(/^Key/, "")}</kbd>}
            </button>
          ))}
          {Object.keys(vars).length > 0 && <span className="label">{L(T.states)}:</span>}
          {Object.entries(vars).map(([name, v]) => (
            <span key={name} className={`state-chip ${v ? "on" : ""}`}>
              <span className="dot" /> {N(name)}
            </span>
          ))}
        </div>
      )}

      {groups.length === 0 && <p className="hint rules-empty">{L(T.empty)}</p>}
      {groups.map(([g, list]) => (
        <section key={g} className="rules-group">
          <h2 style={{ color: CATEGORIES[g]?.color }}>
            {groupTitle(g)} <span className="hint">{list.length}</span>
          </h2>
          <div className="rules-grid">
            {list.map(({ rule, avail }) => (
              <RuleCard
                key={`${rule.id}-${rule.port ?? ""}`}
                rule={rule}
                avail={avail}
                selected={selectedId === rule.id}
                activeCamera={activeCamera}
                cameraName={cameraName}
                switchLabel={switchLabel}
                setters={setters}
                nodes={nodes}
                onParams={onParams}
                onSelect={onSelect}
                onOpen={onOpen}
                onTest={onTest}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function RuleCard({ rule, avail, selected, activeCamera, cameraName, switchLabel, setters, nodes, onParams, onSelect, onOpen, onTest }) {
  const [editing, setEditing] = useState(false);
  const [focusId, setFocusId] = useState(null);
  const pick = (id) => {
    setEditing(true);
    setFocusId(id);
    onSelect(id);
  };
  const { L, N } = useI18n();
  const status = useNodeStatus(rule.id);
  const def = CATALOG[rule.kind];
  const cat = CATEGORIES[def.category];

  // conditions of the reaction itself + those on its gestures, without duplicates
  const conds = [];
  const seen = new Set();
  const addConds = (list) => {
    for (const c of list) {
      const k = `${c.type}:${c.expr.id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      conds.push(c);
    }
  };
  addConds(rule.conds);
  const stack = [...rule.triggers];
  while (stack.length) {
    const e = stack.shift();
    if (e.t === "leaf") addConds(e.conds);
    if (e.t === "op") for (const a of e.args) stack.push(...a.exprs);
  }
  const enables = conds.filter((c) => c.type === "enable");
  const blocks = conds.filter((c) => c.type === "block");

  const badge = {
    ready: [L(T.ready), "ok"],
    off: [`${L(T.off)}: ⏻ ${switchLabel(avail.switchId)}`, "off"],
    waiting: [`${L(T.waiting)} «${N(avail.state)}»`, "wait"],
    blocked: [`${L(T.blocked)}: ${avail.switchId ? `⏻ ${switchLabel(avail.switchId)}` : `«${N(avail.state ?? "")}»`}`, "off"],
    unconnected: [L(T.unconnected), "off"],
  }[avail.status];

  const p = rule.params;
  let title = L(def.title);
  let what = null;
  if (rule.type === "state") {
    what = fmt(L(rule.port === "on" ? T.setOn : rule.port === "off" ? T.setOff : T.setToggle), N(p.name));
    title = what;
  } else if (rule.type === "action") {
    const target = p.target === "fingers" ? L(T.camByFingers) : p.target === "next" ? L(T.camNext) : p.target === "prev" ? L(T.camPrev) : fmt(L(T.camKey), p.target);
    what = fmt(L(T.camAction), target);
  } else if (rule.type === "object") {
    what = `${rule.kind === "clearProps" ? L(T.objectClear) : L(T.objectSpawn)}: ${paramSummary(def, p, L, N)}`;
  }

  const timing = [];
  if (rule.type !== "state") {
    timing.push(rule.continuous ? L(T.whileOn) : L(T.once));
    if (!rule.continuous && p.delayMs) timing.push(fmt(L(T.delay), p.delayMs));
    if (!rule.continuous && p.cooldownMs) timing.push(fmt(L(T.cooldown), p.cooldownMs));
    if (!rule.continuous && p.chance != null && p.chance < 100) timing.push(fmt(L(T.chance), p.chance));
    if (p.anchor && p.anchor !== "gesture") timing.push(fmt(L(T.at), L(ANCHORS.find((a) => a.value === p.anchor)?.label) ?? p.anchor));
  }

  return (
    <PickCtx.Provider value={pick}>
    <article
      data-rule={rule.id}
      className={`rule-card ${editing ? "is-editing" : ""} ${selected ? "is-selected" : ""} ${status.on ? "is-on" : ""} ${avail.status !== "ready" ? "is-dim" : ""}`}
      style={{ "--cat": cat.color }}
      onClick={() => onSelect(rule.id)}
    >
      <header>
        <span className="rule-icon">{rule.type === "state" ? "🔀" : def.icon}</span>
        <strong className="rule-title">{title}</strong>
        {status.on && <span className="rule-live">● {L(T.liveNow)}</span>}
        <span className={`rule-badge ${badge[1]}`}>{badge[0]}</span>
      </header>

      <div className="rule-row">
        <span className="rule-label">{L(T.when)}</span>
        <div className="rule-expr">
          {rule.triggers.length ? <Or exprs={rule.triggers} /> : <span className="hint">{L(T.notConnected)}</span>}
        </div>
      </div>
      {enables.length > 0 && (
        <div className="rule-row">
          <span className="rule-label">{L(T.onlyIf)}</span>
          <div className="rule-expr">
            {enables.map((c, i) => (
              <Expr key={i} e={c.expr} />
            ))}
          </div>
        </div>
      )}
      {blocks.length > 0 && (
        <div className="rule-row">
          <span className="rule-label">{L(T.notWhile)}</span>
          <div className="rule-expr">
            {blocks.map((c, i) => (
              <Expr key={i} e={c.expr} />
            ))}
          </div>
        </div>
      )}
      {avail.status === "waiting" && (
        <div className="rule-row how">
          <span className="rule-label">{fmt(L(avail.invert ? T.howOff : T.howOn), N(avail.state))}</span>
          <div className="rule-expr">
            {(setters.get(avail.state) ?? []).filter((r) => r.port === "toggle" || r.port === (avail.invert ? "off" : "on")).length ? (
              (setters.get(avail.state) ?? [])
                .filter((r) => r.port === "toggle" || r.port === (avail.invert ? "off" : "on"))
                .map((r, i) => (
                  <span key={i} className="expr-part">
                    {i > 0 && <span className="op-word">{L(T.or)}</span>}
                    <Or exprs={r.triggers} />
                    <span className="op-note">({L(r.port === "toggle" ? T.portToggle : r.port === "on" ? T.portOn : T.portOff)})</span>
                  </span>
                ))
            ) : (
              <span className="hint">{L(T.noSetter)}</span>
            )}
          </div>
        </div>
      )}
      {what && rule.type !== "state" && <p className="rule-what">{what}</p>}
      {rule.type === "effect" || rule.type === "object" ? (
        <div className="rule-row">
          <span className="rule-label">{L(T.shows)}</span>
          <div className="rule-expr">
            {rule.cameras.length ? (
              rule.cameras.map((c) => (
                <span key={c} className={`cam-tag ${c === activeCamera ? "on-air" : ""}`}>
                  🎥 {cameraName(c)}
                </span>
              ))
            ) : (
              <span className="rule-warn">⚠ {L(T.noCamera)}</span>
            )}
          </div>
        </div>
      ) : null}
      {timing.length > 0 && <p className="rule-timing">{timing.join(" · ")}</p>}

      {editing && (
        <RuleEditor rule={rule} conds={conds} nodes={nodes} onParams={onParams} focusId={focusId} onClose={() => setEditing(false)} />
      )}

      <footer>
        <button
          className={`mini-btn ${editing ? "active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            setEditing((v) => !v);
            setFocusId(rule.id);
          }}
        >
          {editing ? L(T.editDone) : L(T.edit)}
        </button>
        {rule.type !== "state" && (
          <button
            className="mini-btn"
            onClick={(e) => {
              e.stopPropagation();
              onTest(rule.id);
            }}
          >
            {L(T.test)}
          </button>
        )}
        <button
          className="mini-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(rule.id, leafIds(rule));
          }}
        >
          {L(T.open)}
        </button>
      </footer>
    </article>
    </PickCtx.Provider>
  );
}

/** Settings of every node in a rule: the reaction, its gestures / logic, and its conditions. */
function RuleEditor({ rule, conds, nodes, onParams, focusId }) {
  const { L } = useI18n();
  const box = useRef(null);
  const items = [];
  const seen = new Set();
  const add = (id, role) => {
    if (!id || seen.has(id)) return;
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    seen.add(id);
    items.push({ node, role });
  };
  add(rule.id, rule.type === "state" ? T.roleLogic : T.roleReaction);
  const stack = [...rule.triggers];
  while (stack.length) {
    const e = stack.shift();
    if (e.t === "leaf") add(e.id, T.roleTrigger);
    else if (e.t === "op") {
      add(e.id, T.roleLogic);
      for (const a of e.args) stack.push(...a.exprs);
    } else if (e.t === "state") add(e.id, T.roleCond);
  }
  for (const c of conds) add(c.expr.id, T.roleCond);

  useEffect(() => {
    if (focusId) box.current?.querySelector(`[data-edit="${CSS.escape(focusId)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusId]);

  return (
    <div className="rule-editor" ref={box} onClick={(e) => e.stopPropagation()}>
      <p className="hint">{L(T.editHint)}</p>
      {items.map(({ node, role }) => {
        const def = CATALOG[node.data.kind];
        const hasFields = (def.params ?? []).length > 0 || nodeTypeOf(def) === "gesture";
        return (
          <section key={node.id} data-edit={node.id} className={`edit-node ${focusId === node.id ? "is-focus" : ""}`} style={{ "--cat": CATEGORIES[def.category].color }}>
            <h4>
              <span>{def.icon}</span> {L(def.title)} <span className="edit-role">{L(role)}</span>
            </h4>
            {hasFields ? <NodeParams node={node} onParams={onParams} compact /> : <p className="hint">{L(T.noParams)}</p>}
          </section>
        );
      })}
    </div>
  );
}

const leafIds = (rule) => {
  const ids = [];
  const stack = [...rule.triggers];
  while (stack.length) {
    const e = stack.shift();
    ids.push(e.id);
    if (e.t === "op") for (const a of e.args) stack.push(...a.exprs);
  }
  return ids;
};

function Or({ exprs }) {
  const { L } = useI18n();
  if (!exprs.length) return <span className="hint">{L(T.notConnected)}</span>;
  return exprs.map((e, i) => (
    <span key={i} className="expr-part">
      {i > 0 && <span className="op-word">{L(T.or)}</span>}
      <Expr e={e} />
    </span>
  ));
}

function Expr({ e }) {
  const { L, N } = useI18n();
  const vars = useVars();
  if (e.t === "leaf") return <Leaf e={e} />;
  if (e.t === "state") {
    const on = !!vars[e.name] !== e.invert;
    return <StatePill e={e} on={on} text={`🔀 ${fmt(L(e.invert ? T.stateOff : T.stateOn), N(e.name))}`} />;
  }
  if (e.t === "fired") return <StatePill e={e} text={`${CATALOG[e.kind].icon} ${fmt(L(T.firedAfter), L(CATALOG[e.kind].title))}`} plain />;
  if (e.t === "loop") return <span className="pill">↻</span>;
  return <OpClick e={e} />;
}

function StatePill({ e, on, text, plain }) {
  const click = usePick(e.id);
  return (
    <span className={`pill clickable ${plain ? "" : "state"} ${on ? "lit" : ""}`} {...click}>
      {text}
    </span>
  );
}

function OpClick({ e }) {
  const click = usePick(e.id);
  return (
    <span className="op-click" {...click}>
      <OpBody e={e} />
    </span>
  );
}

function OpBody({ e }) {
  const { L } = useI18n();
  // logic operators
  const arg = (port) => <Or exprs={e.args.find((a) => a.port === port)?.exprs ?? []} />;
  const p = e.params ?? {};
  const s = (ms) => `${(ms / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} s`;
  switch (e.kind) {
    case "and": {
      const parts = e.args.filter((a) => a.exprs.length);
      return (
        <span className="group">
          {parts.map((a, i) => (
            <span key={a.port} className="expr-part">
              {i > 0 && <span className="op-word">{L(T.plus)}</span>}
              <Or exprs={a.exprs} />
            </span>
          ))}
          <span className="op-note">{L(T.together)}</span>
        </span>
      );
    }
    case "or":
      return (
        <span className="group">
          <Or exprs={e.args.flatMap((a) => a.exprs)} />
        </span>
      );
    case "not":
      return (
        <span className="group">
          <span className="op-word">{L(T.not)}</span> {arg("in")}
        </span>
      );
    case "sequence":
      return (
        <span className="group">
          {arg("a")} <span className="op-word">{L(T.then)}</span> {arg("b")} <span className="op-note">{L(T.within)} {s(p.windowMs)}</span>
        </span>
      );
    case "delay":
      return (
        <span className="group">
          {arg("in")} <span className="op-note">{L(T.after)} {s(p.ms)}</span>
        </span>
      );
    case "holdFor":
      return (
        <span className="group">
          {arg("in")} <span className="op-note">{L(T.heldFor)} {s(p.ms)}</span>
        </span>
      );
    case "extend":
      return (
        <span className="group">
          {arg("in")} <span className="op-note">{L(T.extend)} {s(p.ms)}</span>
        </span>
      );
    case "toggle":
      return (
        <span className="group">
          {arg("in")} <span className="op-note">{L(T.toggles)}</span>
        </span>
      );
    case "counter":
      return (
        <span className="group">
          <span className="op-note">
            {L(T.every)} {p.n}
            {L(T.nth)}
          </span>{" "}
          {arg("in")}
        </span>
      );
    default:
      return (
        <span className="group">
          {CATALOG[e.kind].icon} {L(CATALOG[e.kind].title)}: {e.args.map((a) => <Or key={a.port} exprs={a.exprs} />)}
        </span>
      );
  }
}

function Leaf({ e }) {
  const { L, N } = useI18n();
  const click = usePick(e.id);
  const st = useNodeStatus(e.id);
  const def = CATALOG[e.kind];
  let sub = paramSummary(def, e.params, L, N);
  if (e.kind === "switch") sub = N(e.params.label);
  if (e.kind === "keyPress") sub = String(e.params.key ?? "").replace(/^Key/, "");
  const progress = !st.on && st.progress > 0 && st.progress < 1 ? st.progress : 0;
  if (e.kind === "switch")
    return (
      <span className={`pill clickable state ${e.params.on !== false ? "lit" : ""}`} {...click}>
        ⏻ {L(def.title)} «{sub}» {e.params.on !== false ? "ON" : "OFF"}
      </span>
    );
  return (
    <span className={`pill leaf clickable ${st.on ? "lit" : ""}`} style={{ "--cat": CATEGORIES[def.category].color }} title={st.debug || undefined} {...click}>
      <span className="pill-icon">{def.icon}</span>
      <span className="pill-title">{L(def.title)}</span>
      {sub && <span className="pill-sub">{sub}</span>}
      {progress > 0 && <span className="pill-progress" style={{ width: `${progress * 100}%` }} />}
    </span>
  );
}

/** Everything a rule mentions, lower-cased, for the search box. */
function searchText(rule, L, N) {
  const words = [L(CATALOG[rule.kind].title), rule.kind, N(rule.params?.name ?? ""), N(rule.params?.text ?? "")];
  const stack = [...rule.triggers, ...rule.conds.map((c) => c.expr)];
  while (stack.length) {
    const e = stack.shift();
    if (e.t === "leaf") {
      const d = CATALOG[e.kind];
      words.push(L(d.title), e.kind, paramSummary(d, e.params, L, N), N(e.params?.label ?? ""));
      stack.push(...e.conds.map((c) => c.expr));
    } else if (e.t === "state") words.push(N(e.name));
    else if (e.t === "op") for (const a of e.args) stack.push(...a.exprs);
  }
  for (const r of requirements(rule)) if (r.state) words.push(N(r.state));
  return words.join(" ").toLowerCase();
}
