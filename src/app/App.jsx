import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, addEdge, useEdgesState, useNodesState, useReactFlow, MarkerType,
} from "@xyflow/react";
import { CATALOG, CATEGORIES, nodeTypeOf, handleKind, withDefaults } from "../graph/catalog.js";
import { useI18n, LangFlag } from "./i18n.jsx";
import { engine, obs, runtime, useTick } from "./core.js";
import { EditorContext, nodeTypes, edgeTypes } from "./nodes.jsx";
import { Palette, Inspector, SettingsPanel, StatesBar, ObsPanel, useObs, CameraPreviewPanel } from "./panels.jsx";
import { useWebMcp, webMcpAvailable } from "./webmcp.js";
import { useTheme } from "./theme.jsx";
import { useClaudeBridge } from "./bridge.js";
import { useProgramStream } from "./programStream.js";
import { loadGraph, saveGraph, defaultGraph, downloadJson, readJsonFile, serialize } from "./storage.js";

const initial = loadGraph();
const DEFAULT_SETTINGS = { swapHands: false, smoothing: 0.55, debug: false, gaze: false, claudeBridge: true };
let uid = Date.now() % 100000;
const newId = (kind) => `${kind}-${(uid++).toString(36)}`;

export default function App() {
  const { t, L, N } = useI18n();
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [variables, setVariables] = useState(initial.variables ?? {});
  const [activeCamera, setActiveCameraState] = useState(initial.activeCamera ?? null);
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, ...(initial.settings ?? {}) });
  const [status, setStatus] = useState(runtime.status);
  const [popover, setPopover] = useState(null); // "settings" | "obs" | null
  const [showPalette, setShowPalette] = useState(true);
  const [previewCamera, setPreviewCamera] = useState(initial.activeCamera ?? null);
  const obsState = useObs();
  const program = useProgramStream();
  const programViewers = program.viewers;
  const flow = useReactFlow();
  const fileInput = useRef(null);
  const [theme, toggleTheme] = useTheme();
  useTick();

  // ---------- runtime sync ----------

  useEffect(() => {
    runtime.start();
    return runtime.onStatus(setStatus);
  }, []);

  useEffect(() => {
    Object.assign(runtime.settings, settings);
  }, [settings]);

  // push graph changes to the engine (debounced) and autosave
  const graph = useMemo(() => ({ nodes, edges, variables, activeCamera, settings }), [nodes, edges, variables, activeCamera, settings]);
  useEffect(() => {
    const id = setTimeout(() => {
      runtime.setGraph(serialize(graph));
      if (!runtime.outputs.has(activeCamera)) setActiveCameraState(runtime.activeCamera);
      else runtime.setActive(activeCamera);
      saveGraph(graph);
    }, 60);
    return () => clearTimeout(id);
  }, [graph, activeCamera]);

  const cameraNodes = nodes.filter((n) => n.data.kind === "camera");
  useEffect(() => {
    runtime.previewCamera = previewCamera;
  }, [previewCamera]);

  const setActiveCamera = useCallback(
    (id) => {
      setActiveCameraState(id);
      runtime.setActive(id);
      const scene = nodes.find((n) => n.id === id)?.data.params?.obsScene;
      if (scene && obs.state === "connected") obs.setScene(scene).catch(() => {});
    },
    [nodes],
  );

  // Alt+1…9 switches the active camera
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey || !/^Digit[1-9]$/.test(e.code)) return;
      const n = e.code.slice(5);
      const cam = cameraNodes.find((c) => String(c.data.params?.hotkey ?? "") === n);
      if (cam) {
        e.preventDefault();
        setActiveCamera(cam.id);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [cameraNodes, setActiveCamera]);

  // switch nodes with a toggle key
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey || e.metaKey || e.ctrlKey || e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      const sw = nodes.filter((n) => n.data.kind === "switch" && n.data.params?.key === e.code);
      if (!sw.length) return;
      setNodes((ns) => ns.map((n) => (sw.some((s) => s.id === n.id) ? { ...n, data: { ...n.data, params: { ...n.data.params, on: !(n.data.params?.on ?? true) } } } : n)));
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [nodes, setNodes]);

  // ---------- editing ----------

  const isValidConnection = useCallback(
    (c) => {
      if (c.source === c.target) return false;
      const s = nodes.find((n) => n.id === c.source);
      const tg = nodes.find((n) => n.id === c.target);
      if (!s || !tg) return false;
      return handleKind(CATALOG[s.data.kind], c.sourceHandle, "source") === handleKind(CATALOG[tg.data.kind], c.targetHandle, "target");
    },
    [nodes],
  );

  const onConnect = useCallback((c) => setEdges((eds) => addEdge({ ...c, type: "flow" }, eds)), [setEdges]);

  const addNode = useCallback(
    (kind, position, extraParams = {}) => {
      const def = CATALOG[kind];
      const pos = position ?? flow.screenToFlowPosition({ x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight / 2 + (Math.random() - 0.5) * 120 });
      const params = {};
      if (kind === "camera") {
        const used = new Set(cameraNodes.map((c) => String(c.data.params?.hotkey ?? "")));
        params.name = `Camera ${cameraNodes.length + 1}`; // stored in English, shown localized
        params.hotkey = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].find((k) => !used.has(k)) ?? "";
      }
      Object.assign(params, extraParams);
      const node = {
        id: newId(kind),
        type: nodeTypeOf(def),
        position: pos,
        data: { kind, params },
        selected: true,
        ...(kind === "camera" ? { style: { width: 320 } } : {}),
      };
      setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), node]);
      return node.id;
    },
    [flow, setNodes, cameraNodes, L],
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      const kind = e.dataTransfer.getData("application/gesture-node");
      if (kind && CATALOG[kind]) addNode(kind, flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
    },
    [addNode, flow],
  );

  const updateParams = useCallback(
    (id, params) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, params } } : n))),
    [setNodes],
  );

  const deleteNode = useCallback(
    (id) => {
      setNodes((ns) => ns.filter((n) => n.id !== id));
      setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    },
    [setNodes, setEdges],
  );

  const duplicateNode = useCallback(
    (id) => {
      const n = nodes.find((x) => x.id === id);
      if (!n) return;
      const copy = { ...n, id: newId(n.data.kind), position: { x: n.position.x + 40, y: n.position.y + 40 }, selected: true, data: structuredClone(n.data) };
      setNodes((ns) => [...ns.map((x) => ({ ...x, selected: false })), copy]);
    },
    [nodes, setNodes],
  );

  const selected = nodes.find((n) => n.selected) ?? null;

  // AI agents: in the browser (WebMCP) and Claude Desktop / Code (local MCP server bridge)
  const agentApi = {
    nodes,
    edges,
    activeCamera,
    addNode,
    updateParams,
    deleteNode,
    setActiveCamera,
    connect: (c) => setEdges((eds) => addEdge({ ...c, type: "flow" }, eds)),
    removeEdges: (pred) => {
      const n = edges.filter(pred).length;
      setEdges((es) => es.filter((e) => !pred(e)));
      return n;
    },
  };
  useWebMcp(agentApi);
  const bridge = useClaudeBridge(agentApi, settings.claudeBridge);
  const hasWebMcp = webMcpAvailable();

  const replaceGraph = (g) => {
    setNodes(g.nodes);
    setEdges(g.edges);
    setVariables(g.variables ?? {});
    engine.vars.clear();
    setActiveCameraState(g.activeCamera ?? null);
    if (g.settings) setSettings({ ...DEFAULT_SETTINGS, ...g.settings });
    setTimeout(() => flow.fitView({ padding: 0.1 }), 50);
  };

  const addState = () => {
    const name = prompt(t("states"), "")?.trim();
    if (!name) return;
    setVariables((v) => ({ ...v, [name]: false }));
    engine.vars.set(name, false);
  };

  const editor = useMemo(
    () => ({
      activeCamera,
      setActiveCamera,
      test: (id) => engine.test(id, performance.now()),
      openProgram: () => runtime.openProgram(),
      updateParams,
      showDebug: settings.debug,
    }),
    [activeCamera, setActiveCamera, settings.debug, updateParams],
  );

  const statusText = t(`st_${status.key}`) + (status.detail ? `: ${status.detail}` : "");
  const statusOk = status.key === "ready";

  return (
    <EditorContext.Provider value={editor}>
      <div className="app">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setShowPalette((v) => !v)} title={t("palette")}>
            ☰
          </button>
          <strong className="brand">{t("appTitle")}</strong>
          <span className={`status-pill ${statusOk ? "ok" : status.key.endsWith("Error") ? "err" : ""}`} title={statusText}>
            {statusText}
            {statusOk && ` · ${Math.round(runtime.fps)} fps`}
          </span>
          <StatesBar onAddState={addState} />
          <div className="spacer" />
          <label className="cam-select" title={t("activeCamera")}>
            <span className="on-air-dot" aria-hidden="true" />
            <select
              value={activeCamera ?? ""}
              aria-label={t("activeCamera")}
              onChange={(e) => {
                setActiveCamera(e.target.value);
                setPreviewCamera(e.target.value);
              }}
            >
              {cameraNodes.map((c) => (
                <option key={c.id} value={c.id}>
                  🎥 {N(c.data.params?.name) || t("camera")}
                  {c.data.params?.hotkey ? `  (Alt+${c.data.params.hotkey})` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="pop-wrap">
            <button className={obsState.virtualCam ? "live" : ""} onClick={() => setPopover(popover === "obs" ? null : "obs")} title={programViewers ? t("obsFeedOn") : undefined}>
              {obsState.virtualCam ? "● " : programViewers ? "📡 " : ""}
              {t("obs")}
            </button>
            {popover === "obs" && <ObsPanel viewers={programViewers} />}
          </div>
          <div className="pop-wrap">
            <button onClick={() => setPopover(popover === "settings" ? null : "settings")}>⚙ {t("settings")}</button>
            {popover === "settings" && <SettingsPanel settings={settings} onChange={setSettings} />}
          </div>
          {program.role === "standby" && (
            <button className="standby-chip" onClick={program.claim} title={t("standbyHint")}>
              ⚠ {t("standby")}
            </button>
          )}
          {bridge === "connected" && (
            <span className="webmcp-badge claude" title={t("claudeHint")}>
              ✳ Claude
            </span>
          )}
          {hasWebMcp && (
            <span className="webmcp-badge" title={t("webmcpHint")}>
              🤖 WebMCP
            </span>
          )}
          <div className="pop-wrap">
            <button onClick={() => setPopover(popover === "file" ? null : "file")} aria-label={t("menu")} title={t("menu")}>
              ⋯
            </button>
            {popover === "file" && (
              <div className="popover menu">
                <button onClick={() => { downloadJson(graph); setPopover(null); }}>⬇ {t("exportJson")}</button>
                <button onClick={() => { fileInput.current?.click(); setPopover(null); }}>⬆ {t("importJson")}</button>
                <button className="danger" onClick={() => { setPopover(null); if (confirm(t("resetConfirm"))) replaceGraph(defaultGraph()); }}>↺ {t("reset")}</button>
              </div>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readJsonFile(f).then(replaceGraph).catch((err) => alert(`${t("importError")}: ${err.message}`));
              e.target.value = "";
            }}
          />
          <button className="theme-btn" onClick={toggleTheme} title={theme === "dark" ? t("lightTheme") : t("darkTheme")} aria-label={theme === "dark" ? t("lightTheme") : t("darkTheme")}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <LangFlag />
        </header>

        <div className="workspace">
          {showPalette && <Palette onAdd={(k) => addNode(k)} />}
          <main className="canvas" onDragOver={(e) => e.preventDefault()} onDrop={onDrop} onClick={() => popover && setPopover(null)}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onNodeClick={(_, n) => n.data.kind === "camera" && setPreviewCamera(n.id)}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              defaultEdgeOptions={{ type: "flow", markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 } }}
              fitView
              fitViewOptions={{ padding: 0.1 }}
              minZoom={0.1}
              deleteKeyCode={["Backspace", "Delete"]}
              proOptions={{ hideAttribution: false }}
              colorMode={theme}
            >
              <Background gap={24} color={theme === "dark" ? "#2a2f3a" : "#cfd4dd"} />
              <Controls />
              <MiniMap pannable zoomable nodeColor={(n) => CATEGORIES[CATALOG[n.data.kind]?.category]?.color ?? "#888"} maskColor={theme === "dark" ? "rgba(10,12,16,0.7)" : "rgba(240,242,246,0.7)"} />
            </ReactFlow>
          </main>
          <div className="panel right-col">
            {(() => {
              const cam = cameraNodes.find((c) => c.id === previewCamera) ?? cameraNodes.find((c) => c.id === activeCamera);
              return (
                <CameraPreviewPanel
                  cameraId={cam?.id ?? null}
                  name={N(cam?.data.params?.name) || t("camera")}
                  active={cam?.id === activeCamera}
                  onMakeActive={() => cam && setActiveCamera(cam.id)}
                />
              );
            })()}
            <Inspector node={selected} onParams={updateParams} onDelete={deleteNode} onDuplicate={duplicateNode} />
          </div>
        </div>
      </div>
    </EditorContext.Provider>
  );
}
