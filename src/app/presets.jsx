// Saved settings ("presets"): named snapshots of the whole setup (nodes, links,
// states, active camera, settings). Stored as JSON files in the project's
// presets/ folder by the dev server (vite.config.js); falls back to this
// browser's storage when that API is not available.
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "./i18n.jsx";

const API = "/gf-api/presets";
const LOCAL_KEY = "gesture-flow-presets-local";
const CURRENT_KEY = "gesture-flow-current-preset";

const T = {
  title: { uk: "Збережені налаштування", en: "Saved setups" },
  hint: {
    uk: "Зберігає все: вузли, зв'язки, значення, стани, активну камеру й налаштування. Зміни й так автоматично зберігаються в браузері — тут можна зробити іменовані версії й повертатися до них.",
    en: "Saves everything: nodes, links, values, states, the active camera and settings. Changes are autosaved in the browser anyway — here you keep named versions and switch between them.",
  },
  name: { uk: "Назва", en: "Name" },
  save: { uk: "💾 Зберегти", en: "💾 Save" },
  saveOver: { uk: "Перезаписати", en: "Overwrite" },
  load: { uk: "Завантажити", en: "Load" },
  del: { uk: "Видалити", en: "Delete" },
  empty: { uk: "Ще нічого не збережено", en: "Nothing saved yet" },
  inFolder: { uk: "Файли в папці проєкту: presets/", en: "Files in the project folder: presets/" },
  inBrowser: { uk: "Сервер недоступний — зберігаю лише в цьому браузері", en: "Server not available — saving in this browser only" },
  confirmLoad: { uk: "Завантажити «{0}»? Поточні незбережені зміни буде замінено.", en: "Load “{0}”? Current unsaved changes will be replaced." },
  confirmDel: { uk: "Видалити «{0}»?", en: "Delete “{0}”?" },
  confirmOver: { uk: "Перезаписати «{0}» поточними налаштуваннями?", en: "Overwrite “{0}” with the current setup?" },
  current: { uk: "поточне", en: "current" },
  unsaved: { uk: "є незбережені зміни", en: "unsaved changes" },
  saved: { uk: "збережено", en: "saved" },
  error: { uk: "Помилка", en: "Error" },
};
const fmt = (s, ...a) => a.reduce((acc, v, i) => acc.replace(`{${i}}`, v), s);

const readLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
};
const writeLocal = (all) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
  } catch {}
};

/** Storage backend: the dev-server folder, or localStorage as a fallback. */
export const presetStore = {
  server: null, // null = unknown, true / false after the first list()
  async list() {
    try {
      const r = await fetch(API);
      if (!r.ok) throw new Error(r.status);
      this.server = true;
      return await r.json();
    } catch {
      this.server = false;
      return Object.entries(readLocal())
        .map(([name, v]) => ({ name, savedAt: v.savedAt }))
        .sort((a, b) => b.savedAt - a.savedAt);
    }
  },
  async get(name) {
    if (this.server) {
      const r = await fetch(`${API}/${encodeURIComponent(name)}`);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? r.status);
      return r.json();
    }
    const v = readLocal()[name];
    if (!v) throw new Error("not found");
    return v.graph;
  },
  async save(name, graph) {
    if (this.server) {
      const r = await fetch(`${API}/${encodeURIComponent(name)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(graph) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? r.status);
      return (await r.json()).name;
    }
    const all = readLocal();
    all[name] = { savedAt: Date.now(), graph };
    writeLocal(all);
    return name;
  },
  async remove(name) {
    if (this.server) {
      const r = await fetch(`${API}/${encodeURIComponent(name)}`, { method: "DELETE" });
      if (!r.ok) throw new Error(r.status);
      return;
    }
    const all = readLocal();
    delete all[name];
    writeLocal(all);
  },
};

/** Name + fingerprint of the last saved / loaded preset, to show "unsaved changes". */
export function useCurrentPreset() {
  const [cur, setCur] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(CURRENT_KEY) ?? "null");
    } catch {
      return null;
    }
  });
  const set = useCallback((v) => {
    setCur(v);
    try {
      localStorage.setItem(CURRENT_KEY, JSON.stringify(v));
    } catch {}
  }, []);
  return [cur, set];
}

/** Fingerprint of what matters in a setup (node positions excluded: moving a node is not a change of settings). */
export const fingerprint = (g) =>
  JSON.stringify({
    n: g.nodes.map((n) => [n.id, n.data]),
    e: g.edges.map((e) => [e.source, e.sourceHandle, e.target, e.targetHandle]),
    v: g.variables,
    s: g.settings,
  });

export function PresetsPanel({ serialized, current, setCurrent, onLoad }) {
  const { L } = useI18n();
  const [list, setList] = useState([]);
  const [name, setName] = useState(current?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const refresh = useCallback(() => presetStore.list().then(setList), []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = async (fn) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setMsg(`${L(T.error)}: ${err.message ?? err}`);
    } finally {
      setBusy(false);
    }
  };
  const save = (n) =>
    run(async () => {
      const saved = await presetStore.save(n, serialized);
      setCurrent({ name: saved, fp: fingerprint(serialized) });
      setName(saved);
      setMsg(`✓ ${L(T.saved)}: ${saved}`);
    });
  const load = (n) => {
    if (current && current.fp !== fingerprint(serialized) && !confirm(fmt(L(T.confirmLoad), n))) return;
    run(async () => {
      const g = await presetStore.get(n);
      const loaded = onLoad(g);
      setCurrent({ name: n, fp: fingerprint(loaded) });
      setName(n);
    });
  };
  const dirty = current && current.fp !== fingerprint(serialized);
  const exists = list.some((p) => p.name === name.trim());

  return (
    <div className="popover presets-panel">
      <h3>{L(T.title)}</h3>
      <p className="hint">{L(T.hint)}</p>
      <form
        className="copy-row"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n || busy) return;
          if (exists && !confirm(fmt(L(T.confirmOver), n))) return;
          save(n);
        }}
      >
        <input placeholder={L(T.name)} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <button className="primary" disabled={!name.trim() || busy}>
          {L(T.save)}
        </button>
      </form>
      {msg && <p className="hint">{msg}</p>}
      <ul className="preset-list">
        {list.length === 0 && <li className="hint">{L(T.empty)}</li>}
        {list.map((p) => (
          <li key={p.name} className={current?.name === p.name ? "is-current" : ""}>
            <div className="preset-name">
              <strong>{p.name}</strong>
              <span className="hint">
                {p.savedAt ? new Date(p.savedAt).toLocaleString() : ""}
                {current?.name === p.name && ` · ${L(T.current)}${dirty ? ` · ● ${L(T.unsaved)}` : ""}`}
              </span>
            </div>
            <button disabled={busy} onClick={() => load(p.name)}>
              {L(T.load)}
            </button>
            <button disabled={busy} onClick={() => confirm(fmt(L(T.confirmOver), p.name)) && save(p.name)} title={L(T.saveOver)}>
              💾
            </button>
            <button
              className="danger"
              disabled={busy}
              title={L(T.del)}
              onClick={() =>
                confirm(fmt(L(T.confirmDel), p.name)) &&
                run(async () => {
                  await presetStore.remove(p.name);
                  if (current?.name === p.name) setCurrent(null);
                })
              }
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <p className="hint">{presetStore.server === false ? `⚠ ${L(T.inBrowser)}` : L(T.inFolder)}</p>
    </div>
  );
}
