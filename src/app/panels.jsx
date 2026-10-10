// Side panels: node palette, inspector, settings, states, OBS.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { FullscreenBox } from "./nodes.jsx";
import { ALL_DEFS, CATALOG, CATEGORIES, nodeTypeOf } from "../graph/catalog.js";
import { useI18n } from "./i18n.jsx";
import { ParamField } from "./params.jsx";
import { engine, obs, runtime, useVars } from "./core.js";

// ---------- palette ----------

export function Palette({ onAdd }) {
  const { L, t } = useI18n();
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const m = new Map();
    for (const d of ALL_DEFS) {
      const text = `${d.title.uk} ${d.title.en} ${d.kind}`.toLowerCase();
      if (ql && !text.includes(ql)) continue;
      if (!m.has(d.category)) m.set(d.category, []);
      m.get(d.category).push(d);
    }
    return [...m];
  }, [q]);

  return (
    <aside className="panel palette">
      <h2>{t("palette")}</h2>
      <input className="search" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="palette-list">
        {groups.map(([cat, defs]) => (
          <section key={cat}>
            <h3 style={{ color: CATEGORIES[cat].color }}>{L(CATEGORIES[cat])}</h3>
            {defs.map((d) => (
              <div
                key={d.kind}
                className="palette-item"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/gesture-node", d.kind);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDoubleClick={() => onAdd(d.kind)}
                title={L(d.title)}
                style={{ "--cat": CATEGORIES[cat].color }}
              >
                <span className="pi-icon">{d.icon}</span>
                <span>{L(d.title)}</span>
                <button className="pi-add" onClick={() => onAdd(d.kind)} aria-label={t("add")} title={t("add")}>
                  +
                </button>
              </div>
            ))}
          </section>
        ))}
      </div>
      <p className="hint">{t("dropHint")}</p>
    </aside>
  );
}

// ---------- inspector ----------

/** All parameter fields of one node (+ hold / grace for gestures). Used by the inspector and the Rules view. */
export function NodeParams({ node, onParams, compact = false }) {
  const { t, N } = useI18n();
  const obsState = useObs();
  const def = CATALOG[node.data.kind];
  const params = node.data.params ?? {};
  const set = (key, v) => onParams(node.id, { ...params, [key]: v });
  const isGesture = nodeTypeOf(def) === "gesture";
  return (
    <div className={`params ${compact ? "compact" : ""}`}>
      {(def.params ?? []).map((p) => (
        <ParamField
          key={p.key}
          idPrefix={node.id}
          param={p}
          value={p.type === "text" ? N(params[p.key] ?? p.default) : params[p.key] ?? p.default}
          onChange={(v) => set(p.key, v)}
          obsScenes={obsState.scenes}
        />
      ))}
      {isGesture && (
        <>
          <ParamField
            idPrefix={node.id}
            param={{ key: "hold", type: "number", label: t("hold"), min: 1, max: 90, step: 1, default: def.hold ?? 6 }}
            value={params.hold ?? def.hold ?? 6}
            onChange={(v) => set("hold", v)}
          />
          <ParamField
            idPrefix={node.id}
            param={{ key: "grace", type: "number", label: t("grace"), min: 0, max: 15, step: 1, default: def.grace ?? 2 }}
            value={params.grace ?? def.grace ?? 2}
            onChange={(v) => set("grace", v)}
          />
          {!compact && <p className="hint">{t("holdHint")}</p>}
        </>
      )}
    </div>
  );
}

export function Inspector({ node, onParams, onDelete, onDuplicate }) {
  const { L, t } = useI18n();
  if (!node) {
    return (
      <aside className="inspector">
        <h2>{t("inspector")}</h2>
        <p className="hint">{t("noSelection")}</p>
        <p className="hint">{t("edgeHint")}</p>
      </aside>
    );
  }
  const def = CATALOG[node.data.kind];
  return (
    <aside className="inspector">
      <h2>
        <span style={{ color: CATEGORIES[def.category].color }}>{def.icon}</span> {L(def.title)}
      </h2>
      <NodeParams node={node} onParams={onParams} />
      <div className="row-btns">
        <button onClick={() => onDuplicate(node.id)}>{t("duplicate")}</button>
        <button className="danger" onClick={() => onDelete(node.id)}>
          {t("delete")}
        </button>
      </div>
    </aside>
  );
}

// ---------- settings popover ----------

export function SettingsPanel({ settings, onChange }) {
  const { t } = useI18n();
  const set = (k, v) => onChange({ ...settings, [k]: v });
  return (
    <div className="popover">
      <label className="inline">
        <input type="checkbox" checked={!!settings.swapHands} onChange={(e) => set("swapHands", e.target.checked)} /> {t("swapHands")}
      </label>
      <label className="inline">
        <input type="checkbox" checked={!!settings.debug} onChange={(e) => set("debug", e.target.checked)} /> {t("showPoints")}
      </label>
      <label className="inline">
        <input type="checkbox" checked={!!settings.gaze} onChange={(e) => set("gaze", e.target.checked)} /> {t("showGaze")}
      </label>
      <div className="param">
        <label>{t("smoothing")}</label>
        <input type="range" min={0.1} max={1} step={0.05} value={settings.smoothing ?? 0.55} onChange={(e) => set("smoothing", Number(e.target.value))} />
      </div>
      <button onClick={() => runtime.calibrate()}>{t("calibrate")}</button>
      <label className="inline">
        <input type="checkbox" checked={settings.claudeBridge !== false} onChange={(e) => set("claudeBridge", e.target.checked)} /> {t("claudeBridge")}
      </label>
    </div>
  );
}

// ---------- state variables ----------

export function StatesBar({ onAddState }) {
  const { t, N } = useI18n();
  const vars = useVars();
  return (
    <div className="states-bar">
      <span className="label">{t("states")}:</span>
      {Object.entries(vars).map(([name, v]) => (
        <button key={name} className={`state-chip ${v ? "on" : ""}`} onClick={() => engine.vars.set(name, !v)} title={name}>
          <span className="dot" /> {N(name)}
        </button>
      ))}
      <button className="state-chip add" onClick={onAddState}>
        {t("addState")}
      </button>
    </div>
  );
}

// ---------- OBS ----------

const subscribeObs = (fn) => obs.subscribe(fn);
let obsSnap = obs.snapshot();
obs.subscribe((s) => (obsSnap = s));
export const useObs = () => useSyncExternalStore(subscribeObs, () => obsSnap);

export function ObsPanel({ viewers = 0 }) {
  const { t } = useI18n();
  const s = useObs();
  const [cfg, setCfg] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("gesture-flow-obs") ?? "") ?? {};
    } catch {
      return {};
    }
  });
  const host = cfg.host ?? "127.0.0.1";
  const port = cfg.port ?? 4455;
  const password = cfg.password ?? "";
  useEffect(() => {
    try {
      localStorage.setItem("gesture-flow-obs", JSON.stringify(cfg));
    } catch {}
  }, [cfg]);
  const err = s.error === "auth" ? t("obsAuthError") : s.error === "unreachable" ? t("obsUnreachable") : s.error;
  return (
    <div className="popover obs-panel">
      <h3>{t("obsTitle")}</h3>
      <div className="obs-feed">
        <label>
          {t("obsBrowserUrl")}
          <div className="copy-row">
            <input readOnly value={`${location.origin}/program.html`} onFocus={(e) => e.target.select()} />
            <button onClick={() => navigator.clipboard?.writeText(`${location.origin}/program.html`)}>{t("copy")}</button>
          </div>
        </label>
        <div className="obs-status">
          <span className={`dot ${viewers ? "on" : ""}`} /> {viewers ? t("obsFeedOn") : t("obsFeedOff")}
        </div>
      </div>
      <div className="obs-row">
        <label>
          {t("obsHost")}
          <input value={host} onChange={(e) => setCfg({ ...cfg, host: e.target.value })} />
        </label>
        <label>
          {t("obsPort")}
          <input type="number" value={port} onChange={(e) => setCfg({ ...cfg, port: Number(e.target.value) })} />
        </label>
      </div>
      <label>
        {t("obsPassword")}
        <input type="password" value={password} onChange={(e) => setCfg({ ...cfg, password: e.target.value })} />
      </label>
      <div className="obs-status">
        <span className={`dot ${s.state === "connected" ? "on" : ""}`} /> {t(`obs_${s.state}`)}
        {s.state === "error" && err && <em> — {err}</em>}
      </div>
      <div className="row-btns">
        {s.state === "connected" ? (
          <button onClick={() => obs.disconnect()}>{t("obsDisconnect")}</button>
        ) : (
          <button onClick={() => obs.connect({ host, port, password })}>{t("obsConnect")}</button>
        )}
        <button onClick={() => runtime.openProgram()}>📺 {t("program")}</button>
      </div>
      {s.state === "connected" && (
        <div className="row-btns">
          <button className={s.virtualCam ? "danger" : "primary"} onClick={() => obs.setVirtualCam(!s.virtualCam).catch(() => {})}>
            {s.virtualCam ? t("obsStopVcam") : t("obsStartVcam")}
          </button>
          {s.virtualCam && <span className="ok">● {t("obsVcamOn")}</span>}
        </div>
      )}
      <pre className="steps">{t("obsSteps")}</pre>
    </div>
  );
}

// ---------- preview of the last clicked camera ----------

export function CameraPreviewPanel({ cameraId, name, active, onMakeActive }) {
  const { t } = useI18n();
  const box = useRef(null);
  const canvas = useRef(null);

  // copy the camera's canvas every frame (a canvas element can only live in one place)
  useEffect(() => {
    let raf;
    const draw = () => {
      const src = runtime.canvasOf(cameraId);
      const dst = canvas.current;
      if (src && dst) {
        if (dst.width !== src.width || dst.height !== src.height) {
          dst.width = src.width;
          dst.height = src.height;
        }
        dst.getContext("2d").drawImage(src, 0, 0);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [cameraId]);

  return (
    <section className="preview-panel">
      <div className="preview-head">
        <h2>{t("preview")}</h2>
        {cameraId && <span className="preview-name">🎥 {name}</span>}
        {cameraId && (active ? <span className="on-air">{t("onAir")}</span> : <button className="mini-btn" onClick={onMakeActive}>{t("makeActive")}</button>)}
      </div>
      {cameraId ? (
        <>
          <FullscreenBox className="preview-box" boxRef={box}>
            <canvas ref={canvas} className="camera-canvas" />
          </FullscreenBox>
          <div className="row-btns">
            <button onClick={() => box.current?.requestFullscreen?.()}>⛶ {t("fullscreen")}</button>
            <button onClick={() => runtime.openProgram()}>📺 {t("program")}</button>
          </div>
        </>
      ) : (
        <p className="hint">{t("previewHint")}</p>
      )}
    </section>
  );
}
