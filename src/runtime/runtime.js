// The live pipeline: camera → MediaPipe → hands/face in world pixels → graph →
// effects rendered separately for every camera node → program window for OBS.
//
// World space = the camera frame, mirrored (like a mirror), in pixels of the
// video (usually 1280×720). Every camera output draws the world scaled to its
// own resolution (object-fit: cover).
import { createTracker } from "./tracker.js";
import { FaceTracker, FACE_DRAW_IDS } from "./face.js";
import { FxLayer, view } from "./fx.js";
import { PropSystem } from "./props.js";
import { HAND_CONNECTIONS, dist } from "./geometry.js";

const DEFAULT_W = 1280;
const DEFAULT_H = 720;

export class Runtime {
  constructor(engine) {
    this.engine = engine;
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.playsInline = true;
    this.settings = { swapHands: false, smoothing: 0.55, debug: false, gaze: false };
    this.outputs = new Map(); // cameraId → { canvas, ctx, fx, params }
    this.activeCamera = null;
    this.props = new PropSystem();
    this.keys = new Set();
    this.hands = [];
    this.face = null;
    this.faceTracker = new FaceTracker();
    this.smooth = new Map();
    this.statusListeners = new Set();
    this.status = { key: "starting" };
    this.program = null;
    this.recorders = new Map();
    this.lastVideoTime = -1;
    this.lastFrame = performance.now();
    this.fps = 0;
    this.W = DEFAULT_W;
    this.H = DEFAULT_H;
    this.running = false;
  }

  // ---------- status ----------

  onStatus(fn) {
    this.statusListeners.add(fn);
    fn(this.status);
    return () => this.statusListeners.delete(fn);
  }

  setStatus(key, detail = "") {
    this.status = { key, detail };
    for (const fn of this.statusListeners) fn(this.status);
  }

  // ---------- lifecycle ----------

  async start() {
    if (this.running) return;
    this.running = true;
    this.startLoop();
    this.listenKeys();
    try {
      this.setStatus("camera");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      this.video.srcObject = stream;
      await this.video.play();
      this.startFramePump(stream.getVideoTracks()[0]);
    } catch (err) {
      console.error(err);
      this.setStatus("cameraError", err.message);
      return;
    }
    try {
      this.setStatus("models");
      this.tracker = await createTracker();
      this.setStatus(this.tracker.hasFace ? "ready" : "noFace");
    } catch (err) {
      console.error(err);
      this.setStatus("modelError", err.message);
    }
  }

  /**
   * Camera frames via MediaStreamTrackProcessor (Chrome / Arc / Edge): every new camera
   * frame drives detection + rendering, so it keeps working while the editor window is
   * hidden, covered or on another desktop (rAF and timers are throttled there).
   * Other browsers fall back to the <video> element.
   */
  startFramePump(track) {
    if (!track || typeof window.MediaStreamTrackProcessor !== "function") return;
    let reader;
    try {
      reader = new window.MediaStreamTrackProcessor({ track }).readable.getReader();
    } catch (err) {
      console.warn("MediaStreamTrackProcessor unavailable, using <video>", err);
      return;
    }
    this.frameCanvas = document.createElement("canvas");
    this.frameCtx = this.frameCanvas.getContext("2d", { alpha: false, desynchronized: true });
    this.frameSerial = 0;
    const pump = async () => {
      for (;;) {
        const { value: vf, done } = await reader.read();
        if (done) return;
        const w = vf.displayWidth;
        const h = vf.displayHeight;
        if (this.frameCanvas.width !== w || this.frameCanvas.height !== h) {
          this.frameCanvas.width = w;
          this.frameCanvas.height = h;
        }
        this.frameCtx.drawImage(vf, 0, 0, w, h);
        vf.close();
        this.frameSerial++;
        // when visible, rAF also renders between camera frames (smoother effects)
        this.frame(performance.now(), true);
      }
    };
    pump().catch((err) => console.warn("frame pump stopped", err));
  }

  /** Current camera image (canvas fed by the frame pump, or the <video> element). */
  get source() {
    return this.frameCanvas && this.frameSerial ? this.frameCanvas : this.video;
  }

  get sourceReady() {
    return this.frameCanvas && this.frameSerial ? true : this.video.readyState >= 2;
  }

  get sourceSize() {
    return this.frameCanvas && this.frameSerial
      ? { w: this.frameCanvas.width, h: this.frameCanvas.height }
      : { w: this.video.videoWidth, h: this.video.videoHeight };
  }

  /** rAF while visible; a worker-driven tick keeps frames flowing when the window is hidden (OBS capture). */
  startLoop() {
    const raf = (t) => {
      if (!document.hidden) this.frame(t);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
    const blob = new Blob(["setInterval(() => postMessage(0), 33);"], { type: "text/javascript" });
    this.ticker = new Worker(URL.createObjectURL(blob));
    this.ticker.onmessage = () => {
      // the frame pump drives hidden frames when available
      if (document.hidden && !this.frameSerial) this.frame(performance.now());
    };
  }

  listenKeys() {
    const typing = (e) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
    addEventListener("keydown", (e) => {
      if (!typing(e) && !e.altKey && !e.metaKey && !e.ctrlKey) this.keys.add(e.code);
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => this.keys.clear());
  }

  // ---------- graph / outputs ----------

  setGraph(graph) {
    this.engine.load(graph);
    const cams = graph.nodes.filter((n) => n.data?.kind === "camera");
    const ids = new Set(cams.map((n) => n.id));
    for (const id of [...this.outputs.keys()]) if (!ids.has(id)) this.outputs.delete(id);
    for (const n of cams) {
      let out = this.outputs.get(n.id);
      if (!out) {
        const canvas = document.createElement("canvas");
        canvas.className = "camera-canvas";
        out = { canvas, ctx: canvas.getContext("2d"), fx: new FxLayer(), params: {} };
        this.outputs.set(n.id, out);
      }
      out.params = { ...this.engine.byId.get(n.id)?.params };
      const [w, h] = String(out.params.resolution ?? "1280x720").split("x").map(Number);
      if (out.canvas.width !== w || out.canvas.height !== h) {
        out.canvas.width = w;
        out.canvas.height = h;
      }
    }
    if (!this.outputs.has(this.activeCamera)) this.activeCamera = cams[0]?.id ?? null;
  }

  canvasOf(cameraId) {
    return this.outputs.get(cameraId)?.canvas ?? null;
  }

  setActive(cameraId) {
    if (this.outputs.has(cameraId)) this.activeCamera = cameraId;
  }

  // ---------- per frame ----------

  frame(now, fromCamera = false) {
    if (!fromCamera && now - this.lastFrame < 12) return; // both drivers may fire in the same frame
    if (fromCamera && now - this.lastFrame < 4) return;
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.fps = this.fps * 0.9 + (1 / Math.max(dt, 0.001)) * 0.1;
    this.lastFrame = now;

    const size = this.sourceSize;
    if (size.w && (this.W !== size.w || this.H !== size.h)) {
      this.W = size.w;
      this.H = size.h;
    }
    view.W = this.W;
    view.H = this.H;

    const stamp = this.frameSerial ? this.frameSerial : this.video.currentTime;
    if (this.tracker && this.sourceReady && stamp !== this.lastVideoTime) {
      this.lastVideoTime = stamp;
      const res = this.tracker.detect(this.source, now);
      this.hands = this.toWorldHands(res.hands);
      this.face = this.faceTracker.update(res.face, (p) => ({ x: (1 - p.x) * this.W, y: p.y * this.H }), this.W, this.H);
    }

    const layers = new Map([...this.outputs].map(([id, o]) => [id, o.fx]));
    for (const o of this.outputs.values()) {
      o.fx.face = this.face;
      o.fx.hands = this.hands;
    }
    const world = {
      hands: this.hands,
      face: this.face,
      now,
      dt,
      W: this.W,
      H: this.H,
      keys: this.keys,
      props: this.props,
    };
    this.engine.step(world, layers);
    this.props.update({ hands: this.hands, face: this.face, dt, now, H: this.H });

    // full rate for the camera on air and the one in the preview panel; others at ~1/3 rate
    this.frameNo = (this.frameNo ?? 0) + 1;
    for (const [id, o] of this.outputs) {
      o.fx.update(dt);
      const important = id === this.activeCamera || id === this.previewCamera;
      if (important || this.frameNo % 3 === 0) this.render(id, o, now);
    }
    this.copyToProgram();
  }

  toWorldHands(raw) {
    const k = this.settings.smoothing;
    const seen = new Set();
    const out = raw.map((h, i) => {
      let side = String(h.handedness).toLowerCase().startsWith("l") ? "left" : "right";
      if (this.settings.swapHands) side = side === "left" ? "right" : "left";
      let id = side;
      if (seen.has(id)) id = `${side}-${i}`;
      seen.add(id);
      const target = h.landmarks.map((p) => ({ x: (1 - p.x) * this.W, y: p.y * this.H }));
      const prev = this.smooth.get(id);
      const points = prev ? target.map((p, j) => ({ x: prev[j].x + (p.x - prev[j].x) * k, y: prev[j].y + (p.y - prev[j].y) * k })) : target;
      this.smooth.set(id, points);
      return { id, side, points, size: dist(points[0], points[9]), gesture: h.gesture, gestureScore: h.gestureScore };
    });
    for (const id of this.smooth.keys()) if (!seen.has(id)) this.smooth.delete(id);
    return out;
  }

  render(id, o, now) {
    const { canvas, ctx, fx } = o;
    const cw = canvas.width;
    const ch = canvas.height;
    const bg = o.params.background ?? "camera";
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bg === "green" ? "#00b140" : "#000";
    ctx.fillRect(0, 0, cw, ch);

    const s = Math.max(cw / this.W, ch / this.H);
    const ox = (cw - this.W * s) / 2;
    const oy = (ch - this.H * s) / 2;
    const shake = fx.shake ? (Math.random() - 0.5) * 2 * fx.shake * s : 0;
    const shake2 = fx.shake ? (Math.random() - 0.5) * 2 * fx.shake * s : 0;
    ctx.setTransform(s, 0, 0, s, ox + shake, oy + shake2);

    if (bg === "camera" && this.sourceReady) {
      ctx.save();
      ctx.translate(this.W, 0);
      ctx.scale(-1, 1);
      const z = fx.shake ? 1 + (2 * fx.shake) / this.W : 1;
      ctx.drawImage(this.source, (-(z - 1) * this.W) / 2, (-(z - 1) * this.H) / 2, this.W * z, this.H * z);
      ctx.restore();
    }
    this.props.draw(ctx, id);
    fx.draw(ctx);
    if (this.settings.debug) this.drawDebug(ctx);
    if (this.settings.gaze) this.drawGaze(ctx, now);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  drawDebug(ctx) {
    ctx.save();
    for (const h of this.hands) {
      ctx.strokeStyle = "rgba(0,255,170,0.85)";
      ctx.lineWidth = 2;
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(h.points[a].x, h.points[a].y);
        ctx.lineTo(h.points[b].x, h.points[b].y);
        ctx.stroke();
      }
      ctx.fillStyle = "#fff";
      for (const p of h.points) ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      ctx.font = "bold 16px ui-monospace, monospace";
      ctx.fillStyle = h.side === "left" ? "#60a5fa" : "#f472b6";
      ctx.fillText(`${h.side === "left" ? "L" : "R"} ${h.gesture}`, h.points[0].x - 20, h.points[0].y + 22);
    }
    const f = this.face;
    if (f) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      for (let i = 0; i < f.points.length; i += 3) ctx.fillRect(f.points[i].x - 1, f.points[i].y - 1, 2, 2);
      for (const e of [f.leftEye, f.rightEye]) {
        ctx.strokeStyle = e.closed ? "#ff3b6b" : "#00ffaa";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(e.center.x, e.center.y, e.width * 0.6, e.width * Math.max(0.08, e.ear), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const ids of [FACE_DRAW_IDS.BROW_A, FACE_DRAW_IDS.BROW_B]) {
        ctx.strokeStyle = "#c792ff";
        ctx.beginPath();
        ids.forEach((i, j) => (j ? ctx.lineTo(f.points[i].x, f.points[i].y) : ctx.moveTo(f.points[i].x, f.points[i].y)));
        ctx.stroke();
      }
      const M = FACE_DRAW_IDS.MOUTH;
      ctx.strokeStyle = f.mouth.isOpen ? "#ff9f1c" : f.mouth.isSmiling ? "#ffd60a" : f.mouth.isPuckered ? "#5ee7ff" : "#00ffaa";
      ctx.beginPath();
      for (const [j, i] of [M.cornerA, M.top, M.cornerB, M.bottom].entries()) j ? ctx.lineTo(f.points[i].x, f.points[i].y) : ctx.moveTo(f.points[i].x, f.points[i].y);
      ctx.closePath();
      ctx.stroke();
      for (const e of [f.ears.left, f.ears.right]) {
        ctx.fillStyle = "#ffd36b";
        ctx.beginPath();
        ctx.arc(e.x, e.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawGaze(ctx, now) {
    if (!this.face) return;
    const { x, y } = this.face.gaze;
    const r = 26 * (1 + 0.12 * Math.sin(now / 180));
    ctx.save();
    ctx.strokeStyle = "rgba(160,235,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.beginPath();
      ctx.moveTo(x + dx * 34, y + dy * 34);
      ctx.lineTo(x + dx * 46, y + dy * 46);
      ctx.stroke();
    }
    ctx.restore();
  }

  calibrate() {
    this.faceTracker.calibrate();
  }

  // ---------- program window (what OBS captures) ----------

  openProgram() {
    if (this.program && !this.program.win.closed) {
      this.program.win.focus();
      return;
    }
    const src = this.canvasOf(this.activeCamera);
    const w = src?.width ?? 1280;
    const h = src?.height ?? 720;
    const win = window.open("", "gesture-effects-program", `width=${w},height=${h}`);
    if (!win) return false;
    win.document.title = "Gesture Effects — Program";
    win.document.body.style.cssText = "margin:0;background:#000;overflow:hidden;";
    const canvas = win.document.createElement("canvas");
    canvas.style.cssText = "width:100vw;height:100vh;object-fit:contain;display:block;";
    win.document.body.appendChild(canvas);
    this.program = { win, canvas, ctx: canvas.getContext("2d") };
    return true;
  }

  /** Program feed = the active camera, copied every frame (OBS window, WebRTC stream). */
  copyToProgram() {
    const src = this.canvasOf(this.activeCamera);
    if (!src) return;
    if (this.programCanvas) {
      const pc = this.programCanvas;
      if (pc.width !== src.width || pc.height !== src.height) {
        pc.width = src.width;
        pc.height = src.height;
      }
      this.programCtx.drawImage(src, 0, 0);
    }
    const p = this.program;
    if (!p) return;
    if (p.win.closed) {
      this.program = null;
      return;
    }
    if (p.canvas.width !== src.width || p.canvas.height !== src.height) {
      p.canvas.width = src.width;
      p.canvas.height = src.height;
    }
    p.ctx.drawImage(src, 0, 0);
  }

  /** MediaStream of the program feed (for WebRTC to program.html / OBS Browser Source). */
  programStream() {
    if (!this.programCanvas) {
      this.programCanvas = document.createElement("canvas");
      this.programCanvas.width = 1280;
      this.programCanvas.height = 720;
      this.programCtx = this.programCanvas.getContext("2d");
      this.programMedia = this.programCanvas.captureStream(30);
    }
    return this.programMedia;
  }

  // ---------- recording ----------

  isRecording(cameraId) {
    return this.recorders.has(cameraId);
  }

  toggleRecording(cameraId, name = "camera") {
    const rec = this.recorders.get(cameraId);
    if (rec) {
      rec.stop();
      return false;
    }
    const canvas = this.canvasOf(cameraId);
    if (!canvas) return false;
    const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
    const mimeType = types.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) ?? "";
    const chunks = [];
    const r = new MediaRecorder(canvas.captureStream(30), mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : {});
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      this.recorders.delete(cameraId);
      const type = r.mimeType || mimeType || "video/webm";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(chunks, { type }));
      a.download = `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.${type.includes("mp4") ? "mp4" : "webm"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    };
    r.start(250);
    this.recorders.set(cameraId, r);
    return true;
  }
}
