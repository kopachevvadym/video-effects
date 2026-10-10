// Custom React Flow nodes and edges.
import { createContext, memo, useContext, useEffect, useRef } from "react";
import { Handle, Position, NodeResizer, BaseEdge, getBezierPath } from "@xyflow/react";
import { CATALOG, CATEGORIES, inputsOf, outputsOf } from "../graph/catalog.js";
import { useI18n } from "./i18n.jsx";
import { useNodeStatus, useTick, runtime } from "./core.js";
import { paramSummary } from "./params.jsx";

/** Actions and shared state the nodes need from the App. */
export const EditorContext = createContext(null);
export const useEditor = () => useContext(EditorContext);

function Handles({ def }) {
  const { L } = useI18n();
  const ins = inputsOf(def);
  const outs = outputsOf(def);
  return (
    <div className="ports">
      <div className="ports-in">
        {ins.map((h) => (
          <div className={`port port-${h.kind}`} key={h.id}>
            <Handle type="target" position={Position.Left} id={h.id} className={`handle handle-${h.kind}`} />
            <span>{L(h.label)}</span>
          </div>
        ))}
      </div>
      <div className="ports-out">
        {outs.map((h) => (
          <div className={`port port-${h.kind}`} key={h.id}>
            <span>{L(h.label)}</span>
            <Handle type="source" position={Position.Right} id={h.id} className={`handle handle-${h.kind}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowNodeInner({ id, data, selected }) {
  const { L, t, N } = useI18n();
  const editor = useEditor();
  const def = CATALOG[data.kind];
  const st = useNodeStatus(id);
  if (!def) return null;
  const cat = CATEGORIES[def.category];
  const summary = N(def.kind === "switch" ? data.params?.label ?? "" : paramSummary(def, data.params, L, N));
  const switchOn = def.kind === "switch" ? (data.params?.on ?? true) : null;
  const isEffect = def.category === "effect";
  return (
    <div className={`fnode ${st.on ? "is-on" : ""} ${selected ? "is-selected" : ""}`} style={{ "--cat": cat.color }}>
      <div className="fnode-head">
        <span className="fnode-icon">{def.icon}</span>
        <span className="fnode-title">{L(def.title)}</span>
        <span className={`dot ${st.on ? "on" : ""}`} />
      </div>
      {summary && <div className="fnode-summary">{summary}</div>}
      {switchOn != null && (
        <button
          className={`nodrag switch ${switchOn ? "on" : ""}`}
          role="switch"
          aria-checked={switchOn}
          onClick={() => editor.updateParams(id, { ...(data.params ?? {}), on: !switchOn })}
        >
          <i />
          <span>{switchOn ? t("switchOn") : t("switchOff")}</span>
          {data.params?.key && <kbd>{data.params.key.replace("Key", "")}</kbd>}
        </button>
      )}
      {st.progress != null && (
        <div className="fnode-progress">
          <i style={{ width: `${st.progress * 100}%` }} />
        </div>
      )}
      {editor.showDebug && st.debug && <div className="fnode-debug">{st.debug}</div>}
      <Handles def={def} />
      {isEffect && (
        <button className="nodrag test-btn" title={t("test")} onClick={() => editor.test(id)}>
          ▶ {t("test")}
        </button>
      )}
    </div>
  );
}

export const FlowNode = memo(FlowNodeInner);

function CameraNodeInner({ id, data, selected }) {
  const { t, N } = useI18n();
  const editor = useEditor();
  const box = useRef(null);
  useTick(); // refresh recording state
  const def = CATALOG.camera;
  const active = editor.activeCamera === id;
  const name = N(data.params?.name) || t("camera");
  const hotkey = data.params?.hotkey;

  // attach the runtime's canvas for this camera
  useEffect(() => {
    let raf;
    const attach = () => {
      const c = runtime.canvasOf(id);
      if (c && box.current && c.parentElement !== box.current) box.current.prepend(c);
      if (!c) raf = requestAnimationFrame(attach);
    };
    attach();
    return () => cancelAnimationFrame(raf);
  });

  const recording = runtime.isRecording(id);
  return (
    <div className={`fnode cam-node ${active ? "is-active" : ""} ${selected ? "is-selected" : ""}`} style={{ "--cat": CATEGORIES.output.color }}>
      <NodeResizer isVisible={selected} minWidth={240} minHeight={200} keepAspectRatio={false} lineClassName="resize-line" handleClassName="resize-handle" />
      <div className="fnode-head">
        <span className="fnode-icon">🎥</span>
        <span className="fnode-title">{name}</span>
        {hotkey && <kbd>Alt+{hotkey}</kbd>}
        {active ? <span className="on-air">{t("onAir")}</span> : (
          <button className="nodrag mini-btn" onClick={() => editor.setActiveCamera(id)}>
            {t("makeActive")}
          </button>
        )}
      </div>
      <FullscreenBox className="cam-preview nodrag" boxRef={box} />
      <div className="cam-actions nodrag">
        <button onClick={() => box.current?.requestFullscreen?.()}>⛶ {t("fullscreen")}</button>
        <button onClick={() => editor.openProgram()}>📺 {t("program")}</button>
        <button className={recording ? "rec" : ""} onClick={() => runtime.toggleRecording(id, name)}>
          {recording ? `■ ${t("stop")}` : `● ${t("record")}`}
        </button>
      </div>
      <Handles def={def} />
    </div>
  );
}

export const CameraNode = memo(CameraNodeInner);

/**
 * Box that can go fullscreen (double-click or the ⛶ button outside).
 * In fullscreen an "Exit fullscreen" button is shown on top of the video.
 */
export function FullscreenBox({ className, boxRef, children }) {
  const { t } = useI18n();
  return (
    <div className={`fs-box ${className ?? ""}`} ref={boxRef} onDoubleClick={() => (document.fullscreenElement ? document.exitFullscreen() : boxRef.current?.requestFullscreen?.())}>
      {children}
      <button
        className="fs-exit"
        onClick={(e) => {
          e.stopPropagation();
          document.exitFullscreen?.();
        }}
      >
        ✕ {t("exitFullscreen")} <kbd>Esc</kbd>
      </button>
    </div>
  );
}

export const nodeTypes = { gesture: FlowNode, logic: FlowNode, effect: FlowNode, camera: CameraNode };

/** Edge colored by kind; signal edges light up while their source is on. */
function FlowEdgeInner(props) {
  const { source, sourceHandleId, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, selected } = props;
  const st = useNodeStatus(source);
  const video = sourceHandleId === "video";
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const cls = video ? "edge-video" : st.on ? "edge-signal is-on" : "edge-signal";
  return <BaseEdge path={path} markerEnd={markerEnd} className={`${cls} ${selected ? "is-selected" : ""}`} />;
}

export const edgeTypes = { flow: memo(FlowEdgeInner) };
