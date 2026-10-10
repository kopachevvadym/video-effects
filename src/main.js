import { createTracker } from "./tracker.js";
import { GestureEngine } from "./engine.js";
import { FxLayer } from "./fx.js";
import { bindings } from "./config.js";
import { HAND_CONNECTIONS, dist } from "./geometry.js";
import { FaceTracker, FACE_DRAW_IDS } from "./face.js";

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const hud = document.getElementById("hud");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("gesture-list");
const debugInfoEl = document.getElementById("debug-info");
const debugChk = document.getElementById("chk-debug");
const recordBtn = document.getElementById("btn-record");
const gazeChk = document.getElementById("chk-gaze");
const faceInfoEl = document.getElementById("face-info");

const SMOOTHING = 0.55; // 0..1: менше — плавніше, але з затримкою; більше — швидше, але тремтить

const engine = new GestureEngine(bindings);
const fx = new FxLayer();
let tracker = null;
let hands = [];
let face = null;
const faceTracker = new FaceTracker();
let W = 0;
let H = 0;
let lastVideoTime = -1;
let lastFrame = performance.now();
const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
const heldKeys = new Set();
const flashUntil = new Array(bindings.length).fill(0);

// ---------- Панель ----------

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

// клавіші для запуску ефектів без жесту (за фізичною клавішею — працює з будь-якою розкладкою)
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "Q", "W", "E", "R", "T", "Y", "U", "I"];
const keyIndex = (code) => KEYS.findIndex((k) => code === `Digit${k}` || code === `Key${k}`);

bindings.forEach((b, i) => {
  const li = document.createElement("li");
  li.innerHTML = `<span class="key">${KEYS[i] ?? ""}</span><span></span><span class="bar"><i></i></span>`;
  li.children[1].textContent = b.gesture.label ?? b.gesture.name;
  listEl.appendChild(li);
});
const bars = [...listEl.querySelectorAll(".bar i")];
const rows = [...listEl.children];

// ---------- Полотно ----------

function resize() {
  const dpr = window.devicePixelRatio || 1;
  W = innerWidth;
  H = innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", resize);
resize();

/** Як відео вписується в екран (object-fit: cover). */
function videoLayout() {
  const vw = video.videoWidth || 16;
  const vh = video.videoHeight || 9;
  const s = Math.max(W / vw, H / vh);
  const dw = vw * s;
  const dh = vh * s;
  return { ox: (W - dw) / 2, oy: (H - dh) / 2, dw, dh };
}

/** Нормалізована точка камери → пікселі екрана (дзеркально). */
function makeToScreen() {
  const { ox, oy, dw, dh } = videoLayout();
  return (p) => ({ x: ox + (1 - p.x) * dw, y: oy + p.y * dh });
}

// ---------- Руки: нормалізовані точки → пікселі екрана + згладжування ----------

const smoothState = new Map();

function toScreenHands(raw) {
  const toScreen = makeToScreen();
  const seen = new Set();
  const out = raw.map((h, i) => {
    let id = h.handedness;
    if (seen.has(id)) id = `${id}-${i}`;
    seen.add(id);

    const target = h.landmarks.map(toScreen);
    const prev = smoothState.get(id);
    const points = prev
      ? target.map((p, j) => ({
          x: prev[j].x + (p.x - prev[j].x) * SMOOTHING,
          y: prev[j].y + (p.y - prev[j].y) * SMOOTHING,
        }))
      : target;
    smoothState.set(id, points);

    return { id, points, size: dist(points[0], points[9]), gesture: h.gesture, gestureScore: h.gestureScore };
  });
  for (const id of smoothState.keys()) if (!seen.has(id)) smoothState.delete(id);
  return out;
}

// ---------- Запуск ----------

async function startCamera() {
  setStatus("Запит доступу до камери…");
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
}

async function start() {
  requestAnimationFrame(loop);

  try {
    await startCamera();
  } catch (err) {
    console.error(err);
    setStatus(`Камера недоступна: ${err.message}. Ефекти можна запускати клавішами зі списку.`, true);
    return;
  }

  try {
    setStatus("Завантаження моделей рук і обличчя…");
    tracker = await createTracker();
    setStatus(tracker.hasFace ? "Готово — покажи жест 👋" : "Руки готові, модель обличчя не завантажилась (див. консоль)", !tracker.hasFace);
  } catch (err) {
    console.error(err);
    setStatus("Не вдалося завантажити модель рук — потрібен інтернет (деталі в консолі браузера).", true);
  }
}

// ---------- Головний цикл ----------

function loop(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  // 1. Розпізнавання (лише коли прийшов новий кадр камери)
  if (tracker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = tracker.detect(video, now);
    hands = toScreenHands(result.hands);
    face = faceTracker.update(result.face, makeToScreen(), W, H);
    fx.face = face;
    fx.hands = hands;
    for (const { binding, hit } of engine.update(hands, now, face)) {
      const idx = engine.items.indexOf(binding);
      binding.effect.trigger(fx, hit);
      flashUntil[idx] = now + 400;
    }
  }

  // 2. Ручний запуск ефектів з клавіатури (для тестування без жестів)
  for (const i of heldKeys) {
    const b = bindings[i];
    if ((b.gesture.mode ?? "trigger") === "continuous") {
      b.effect.trigger(fx, { x: mouse.x, y: mouse.y, size: 120 });
    }
  }

  // 3. Малювання: відео (дзеркально) → ефекти → точки рук
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  fx.update(dt);
  const sx = fx.shake ? (Math.random() - 0.5) * 2 * fx.shake : 0;
  const sy = fx.shake ? (Math.random() - 0.5) * 2 * fx.shake : 0;
  ctx.save();
  ctx.translate(sx, sy);
  if (video.readyState >= 2) {
    const { ox, oy, dw, dh } = videoLayout();
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    // трохи збільшуємо кадр під час струсу, щоб не було видно чорних країв
    const z = fx.shake ? 1 + (2 * fx.shake) / W : 1;
    ctx.drawImage(video, ox - (dw * (z - 1)) / 2, oy - (dh * (z - 1)) / 2, dw * z, dh * z);
    ctx.restore();
  }
  fx.draw(ctx);
  ctx.restore();

  if (gazeChk.checked) drawGaze(now);
  if (debugChk.checked) drawDebug();
  updateHud(now);

  requestAnimationFrame(loop);
}

// ---------- Налагодження ----------

function drawDebug() {
  ctx.save();
  for (const h of hands) {
    ctx.strokeStyle = "rgba(0, 255, 170, 0.8)";
    ctx.lineWidth = 2;
    for (const [a, b] of HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(h.points[a].x, h.points[a].y);
      ctx.lineTo(h.points[b].x, h.points[b].y);
      ctx.stroke();
    }
    h.points.forEach((p, i) => {
      ctx.fillStyle = i === 4 || i === 8 ? "#ff3b6b" : "#fff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#fff";
    ctx.font = "13px ui-monospace, monospace";
    ctx.fillText(`${h.id} · ${h.gesture} ${h.gestureScore.toFixed(2)}`, h.points[0].x - 40, h.points[0].y + 24);
  }
  if (face) drawFaceDebug();
  ctx.restore();

  debugInfoEl.textContent =
    `рук: ${hands.length}\n` +
    (face
      ? `очі L=${face.leftEye.ear.toFixed(2)} R=${face.rightEye.ear.toFixed(2)}${face.blink ? " (моргання)" : ""}\n` +
        `голова yaw=${face.yaw.toFixed(2)} pitch=${face.pitch.toFixed(2)} roll=${face.roll.toFixed(0)}°\n` +
        `брови L=${face.brows.left.raise.toFixed(2)} R=${face.brows.right.raise.toFixed(2)} насуплення=${face.brows.frownScore.toFixed(2)}\n` +
        `рот відкритий=${face.mouth.open.toFixed(2)} усмішка=${face.mouth.smile.toFixed(2)} трубочка=${face.mouth.pucker.toFixed(2)}\n`
      : "обличчя: —\n") +
    engine.items
      .map((it) => {
        const d = Object.entries(it.debug)
          .map(([k, v]) => `${k}=${v}`)
          .join(" ");
        return `${it.g.name}: ${it.count}/${it.g.holdFrames}${d ? "  " + d : ""}`;
      })
      .join("\n");
}

function drawFaceDebug() {
  const P = face.points;
  const { EYE_A, EYE_B, NOSE, FOREHEAD, CHIN, CHEEK_A, CHEEK_B } = FACE_DRAW_IDS;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (let i = 0; i < P.length; i += 3) ctx.fillRect(P[i].x - 1, P[i].y - 1, 2, 2);
  for (const e of [face.leftEye, face.rightEye]) {
    ctx.strokeStyle = e.closed ? "#ff3b6b" : "#00ffaa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(e.center.x, e.center.y, e.width * 0.6, e.width * Math.max(0.08, e.ear), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#4dc3ff";
    ctx.beginPath();
    ctx.arc(e.iris.x, e.iris.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ffd36b";
  for (const i of [NOSE, FOREHEAD, CHIN, CHEEK_A, CHEEK_B]) {
    ctx.beginPath();
    ctx.arc(P[i].x, P[i].y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // брови: точка тим більша, чим вище піднята
  for (const side of ["left", "right"]) {
    const b = face.brows[side];
    ctx.fillStyle = b.raise > 0.12 ? "#ffd60a" : face.brows.frown ? "#ff3b6b" : "#c792ff";
    ctx.beginPath();
    ctx.arc(b.point.x, b.point.y, 5 + Math.max(0, b.raise) * 40, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const ids of [FACE_DRAW_IDS.BROW_A, FACE_DRAW_IDS.BROW_B]) {
    ctx.strokeStyle = "#c792ff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ids.forEach((i, j) => (j ? ctx.lineTo(P[i].x, P[i].y) : ctx.moveTo(P[i].x, P[i].y)));
    ctx.stroke();
  }
  // рот
  const M = FACE_DRAW_IDS.MOUTH;
  ctx.strokeStyle = face.mouth.isOpen ? "#ff9f1c" : face.mouth.isSmiling ? "#ffd60a" : face.mouth.isPuckered ? "#5ee7ff" : "#00ffaa";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(P[M.cornerA].x, P[M.cornerA].y);
  ctx.lineTo(P[M.top].x, P[M.top].y);
  ctx.lineTo(P[M.cornerB].x, P[M.cornerB].y);
  ctx.lineTo(P[M.bottom].x, P[M.bottom].y);
  ctx.closePath();
  ctx.stroke();

  // напрямок голови: стрілка від носа
  const n = P[NOSE];
  ctx.strokeStyle = "#ffd36b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(n.x, n.y);
  ctx.lineTo(n.x + face.yaw * face.size * 3, n.y + face.pitch * face.size * 3);
  ctx.stroke();
}

/** Приціл там, куди ти дивишся. */
function drawGaze(now) {
  if (!face) return;
  const { x, y } = face.gaze;
  const pulse = 1 + 0.12 * Math.sin(now / 180);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, 90);
  g.addColorStop(0, "rgba(120, 220, 255, 0.35)");
  g.addColorStop(1, "rgba(120, 220, 255, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - 90, y - 90, 180, 180);
  ctx.strokeStyle = "rgba(160, 235, 255, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 26 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * 34, y + dy * 34);
    ctx.lineTo(x + dx * 46, y + dy * 46);
    ctx.stroke();
  }
  ctx.restore();
}

function updateHud(now) {
  const prog = engine.progress();
  prog.forEach((p, i) => {
    bars[i].style.width = `${p * 100}%`;
    rows[i].classList.toggle("active", now < flashUntil[i] || heldKeys.has(i));
  });
  if (!debugChk.checked) debugInfoEl.textContent = "";
  faceInfoEl.textContent = !tracker?.hasFace
    ? ""
    : face
      ? `Обличчя: так · погляд: ${face.zone}` +
        (face.winking ? ` · 😉 ${face.winking === "left" ? "ліве" : "праве"}` : "") +
        (face.brows.bothRaised ? " · 😲" : face.brows.raisedOne ? " · 🤨" : face.brows.frown ? " · 😠" : "") +
        (face.mouth.isOpen ? " · 😮" : face.mouth.isSmiling ? " · 😁" : face.mouth.isPuckered ? " · 😗" : "")
      : "Обличчя: не видно";
}

// ---------- Клавіатура й миша ----------

addEventListener("mousemove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.code === "KeyH") hud.classList.toggle("hidden");
  if (e.code === "KeyD") debugChk.checked = !debugChk.checked;
  if (e.code === "KeyG") gazeChk.checked = !gazeChk.checked;
  if (e.code === "KeyC") {
    faceTracker.calibrate();
    setStatus("Відкалібровано: погляд — центр екрана, брови — нейтральне положення");
  }

  const i = keyIndex(e.code);
  if (i >= 0 && i < bindings.length && !e.repeat) {
    const b = bindings[i];
    if ((b.gesture.mode ?? "trigger") === "continuous") heldKeys.add(i);
    else {
      b.effect.trigger(fx, { x: mouse.x, y: mouse.y, size: 120 });
      flashUntil[i] = performance.now() + 400;
    }
  }
});

addEventListener("keyup", (e) => {
  const i = keyIndex(e.code);
  if (i >= 0) heldKeys.delete(i);
});

// ---------- Запис відео (тільки полотно, без панелі) ----------

let recorder = null;

function pickMime() {
  const options = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  return options.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) ?? "";
}

recordBtn.addEventListener("click", () => {
  if (recorder) {
    recorder.stop();
    return;
  }
  const mimeType = pickMime();
  const chunks = [];
  recorder = new MediaRecorder(canvas.captureStream(30), mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : {});
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    const type = recorder.mimeType || mimeType || "video/webm";
    const blob = new Blob(chunks, { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gesture-effects-${new Date().toISOString().replace(/[:.]/g, "-")}.${type.includes("mp4") ? "mp4" : "webm"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    recorder = null;
    recordBtn.textContent = "● Запис";
    recordBtn.classList.remove("recording");
  };
  recorder.start(250);
  recordBtn.textContent = "■ Зупинити";
  recordBtn.classList.add("recording");
});

start();
