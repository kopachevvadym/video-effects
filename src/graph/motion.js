// Motion nodes: recognise movements over time (swipes, waves, circles, pushes,
// fast moves, head nods / shakes) from the recent trajectory, not a single pose.
//
// Every node keeps its own short history per hand (state.hist), so several motion
// nodes can watch the same hand with different settings.
import { isOpenHand, isFist, isExtended, isFolded, palmCenter, dist, INDEX, MIDDLE, RING, PINKY } from "../runtime/geometry.js";
import { handParam, forHands } from "./hands.js";

const opt = (value, uk, en) => ({ value, label: { uk, en } });
const num = (key, label, def, min, max, step = 0.1) => ({ key, type: "number", label, default: def, min, max, step });

const POSES = [
  opt("any", "Будь-яка", "Any"),
  opt("open", "Розкрита долоня", "Open palm"),
  opt("fist", "Кулак", "Fist"),
  opt("point", "Вказівний палець", "Index finger"),
];
const poseParam = (def = "any") => ({ key: "pose", type: "select", label: { uk: "Поза руки", en: "Hand pose" }, options: POSES, default: def });

function poseOk(h, pose) {
  if (pose === "open") return isOpenHand(h);
  if (pose === "fist") return isFist(h);
  if (pose === "point") return isExtended(h, INDEX) && isFolded(h, MIDDLE) && isFolded(h, RING) && isFolded(h, PINKY);
  return true;
}

/** Appends the hand's palm position to this node's history and drops old samples. */
function track(state, h, now, keepMs) {
  state.hist ??= new Map();
  let arr = state.hist.get(h.id);
  if (!arr) state.hist.set(h.id, (arr = []));
  const c = palmCenter(h);
  arr.push({ t: now, x: c.x, y: c.y, s: h.size });
  while (arr.length && now - arr[0].t > keepMs) arr.shift();
  // forget hands that disappeared
  return arr;
}

const forget = (state, hands) => {
  if (!state.hist) return;
  for (const id of state.hist.keys()) if (!hands.some((h) => h.id === id)) state.hist.delete(id);
};

// ---------- swipe ----------

const SWIPE_DIRS = [
  opt("up", "Вгору", "Up"),
  opt("down", "Вниз", "Down"),
  opt("left", "Вліво", "Left"),
  opt("right", "Вправо", "Right"),
  opt("any", "Будь-куди", "Any direction"),
];

// After a swipe, the hand usually travels back. Remember the last swipe per hand (shared by
// all swipe nodes) so that return stroke does not fire the opposite direction.
const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };
const lastSwipe = new Map(); // hand id → { dir, t }
const RETURN_MS = 600;

const swipe = {
  kind: "swipe",
  category: "motion",
  icon: "👋",
  title: { uk: "Змах рукою", en: "Hand swipe" },
  params: [
    { key: "dir", type: "select", label: { uk: "Напрямок", en: "Direction" }, options: SWIPE_DIRS, default: "up" },
    handParam(),
    poseParam(),
    num("distance", { uk: "Довжина змаху (долонь)", en: "Swipe length (palms)" }, 2, 0.5, 6),
    num("maxMs", { uk: "Не довше, мс", en: "Within, ms" }, 450, 100, 1500, 25),
  ],
  hold: 1,
  grace: 0,
  detect: ({ hands, now }, p, st, debug) => {
    forget(st, hands);
    return forHands(hands, p.hand, (h) => {
      const arr = track(st, h, now, p.maxMs);
      if (!poseOk(h, p.pose)) {
        arr.length = 0; // the swipe must be done in the chosen pose
        return null;
      }
      if (arr.length < 3) return null;
      const a = arr[0];
      const b = arr[arr.length - 1];
      const dx = (b.x - a.x) / b.s;
      const dy = (b.y - a.y) / b.s;
      debug.push(`dx=${dx.toFixed(1)} dy=${dy.toFixed(1)}`);
      let dir = null;
      if (Math.abs(dy) > 1.3 * Math.abs(dx)) dir = dy < 0 ? "up" : "down";
      else if (Math.abs(dx) > 1.3 * Math.abs(dy)) dir = dx < 0 ? "left" : "right";
      const len = Math.hypot(dx, dy);
      if (!dir || len < p.distance) return null;
      const last = lastSwipe.get(h.id);
      if (last && last.t !== now && OPPOSITE[last.dir] === dir && now - last.t < RETURN_MS) {
        arr.length = 0; // the hand is coming back from the previous swipe
        return null;
      }
      if (p.dir !== "any" && dir !== p.dir) return null;
      lastSwipe.set(h.id, { dir, t: now });
      const path = arr.map(({ x, y }) => ({ x, y }));
      arr.length = 0; // one swipe = one event
      return { x: b.x, y: b.y, size: b.s, dir, path, speed: len / ((b.t - a.t) / 1000) };
    });
  },
};

// ---------- wave ----------

/** Counts direction reversals of a 1-D signal with at least `amp` swing between extremes. */
function reversals(values, amp) {
  let count = 0;
  let trend = 0; // +1 rising, -1 falling, 0 not decided yet
  let hi = values[0];
  let lo = values[0];
  for (const v of values) {
    if (trend === 0) {
      hi = Math.max(hi, v);
      lo = Math.min(lo, v);
      if (hi - v > amp) [trend, lo] = [-1, v];
      else if (v - lo > amp) [trend, hi] = [1, v];
    } else if (trend === 1) {
      hi = Math.max(hi, v);
      if (hi - v > amp) [count, trend, lo] = [count + 1, -1, v];
    } else {
      lo = Math.min(lo, v);
      if (v - lo > amp) [count, trend, hi] = [count + 1, 1, v];
    }
  }
  return count;
}

const wave = {
  kind: "wave",
  category: "motion",
  icon: "🙋",
  title: { uk: "Помахати рукою", en: "Wave hand" },
  params: [
    handParam(),
    poseParam("open"),
    num("swings", { uk: "Помахів", en: "Swings" }, 3, 2, 8, 1),
    num("amplitude", { uk: "Розмах (долонь)", en: "Swing size (palms)" }, 0.5, 0.2, 3),
  ],
  hold: 1,
  grace: 0,
  detect: ({ hands, now }, p, st, debug) => {
    forget(st, hands);
    return forHands(hands, p.hand, (h) => {
      const arr = track(st, h, now, 1600);
      if (!poseOk(h, p.pose)) return null;
      if (arr.length < 6) return null;
      const s = arr[arr.length - 1].s;
      const n = reversals(arr.map((q) => q.x / s), p.amplitude);
      debug.push(`swings=${n}`);
      if (n + 1 < p.swings) return null;
      arr.length = 0;
      const c = palmCenter(h);
      return { ...c, size: h.size };
    });
  },
};

// ---------- circle ----------

const circle = {
  kind: "circle",
  category: "motion",
  icon: "🔄",
  title: { uk: "Коло рукою", en: "Hand circle" },
  params: [
    {
      key: "dir",
      type: "select",
      label: { uk: "Напрямок", en: "Direction" },
      options: [opt("any", "Будь-який", "Any"), opt("cw", "За годинниковою", "Clockwise"), opt("ccw", "Проти годинникової", "Counter-clockwise")],
      default: "any",
    },
    handParam(),
    poseParam("point"),
    num("radius", { uk: "Мін. радіус (долонь)", en: "Min radius (palms)" }, 0.6, 0.2, 3),
  ],
  hold: 1,
  grace: 0,
  detect: ({ hands, now }, p, st, debug) => {
    forget(st, hands);
    return forHands(hands, p.hand, (h) => {
      const arr = track(st, h, now, 1800);
      if (!poseOk(h, p.pose) || arr.length < 10) return null;
      const cx = arr.reduce((a, q) => a + q.x, 0) / arr.length;
      const cy = arr.reduce((a, q) => a + q.y, 0) / arr.length;
      const s = arr[arr.length - 1].s;
      const r = arr.reduce((a, q) => a + Math.hypot(q.x - cx, q.y - cy), 0) / arr.length / s;
      let sum = 0;
      for (let i = 1; i < arr.length; i++) {
        let d = Math.atan2(arr[i].y - cy, arr[i].x - cx) - Math.atan2(arr[i - 1].y - cy, arr[i - 1].x - cx);
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;
        sum += d;
      }
      debug.push(`turn=${((sum / (2 * Math.PI)) * 360).toFixed(0)}° r=${r.toFixed(2)}`);
      const dir = sum > 0 ? "cw" : "ccw"; // screen y points down
      if (Math.abs(sum) < 2 * Math.PI * 0.9 || r < p.radius || (p.dir !== "any" && p.dir !== dir)) return null;
      arr.length = 0;
      return { x: cx, y: cy, size: s * Math.max(1, r * 1.5), dir };
    });
  },
};

// ---------- push / pull ----------

const push = {
  kind: "push",
  category: "motion",
  icon: "🫸",
  title: { uk: "Поштовх до камери / від неї", en: "Push / pull" },
  params: [
    {
      key: "dir",
      type: "select",
      label: { uk: "Напрямок", en: "Direction" },
      options: [opt("push", "До камери", "Toward camera"), opt("pull", "Від камери", "Away from camera")],
      default: "push",
    },
    handParam(),
    poseParam("open"),
    num("amount", { uk: "Зміна розміру ×", en: "Size change ×" }, 1.35, 1.1, 3, 0.05),
  ],
  hold: 1,
  grace: 0,
  detect: ({ hands, now }, p, st, debug) => {
    forget(st, hands);
    return forHands(hands, p.hand, (h) => {
      const arr = track(st, h, now, 450);
      if (!poseOk(h, p.pose) || arr.length < 3) return null;
      const cur = arr[arr.length - 1];
      const ratio = p.dir === "push" ? cur.s / Math.min(...arr.map((q) => q.s)) : Math.max(...arr.map((q) => q.s)) / cur.s;
      debug.push(`×${ratio.toFixed(2)}`);
      if (ratio < p.amount) return null;
      arr.length = 0;
      return { x: cur.x, y: cur.y, size: cur.s, dir: p.dir };
    });
  },
};

// ---------- fast movement (continuous) ----------

const handSpeed = {
  kind: "handSpeed",
  category: "motion",
  icon: "💨",
  title: { uk: "Швидкий рух руки", en: "Fast hand movement" },
  params: [handParam(), num("minSpeed", { uk: "Швидкість > (долонь/с)", en: "Speed > (palms/s)" }, 6, 1, 30, 0.5)],
  hold: 1,
  grace: 3,
  detect: ({ hands, now }, p, st, debug) => {
    forget(st, hands);
    return forHands(hands, p.hand, (h) => {
      const arr = track(st, h, now, 150);
      if (arr.length < 2) return null;
      const a = arr[0];
      const b = arr[arr.length - 1];
      const dt = (b.t - a.t) / 1000;
      if (dt <= 0) return null;
      const v = dist(a, b) / b.s / dt;
      debug.push(`v=${v.toFixed(1)}`);
      return v > p.minSpeed ? { x: b.x, y: b.y, size: b.s, speed: v } : null;
    });
  },
};

// ---------- head nod / shake ----------

const headGesture = {
  kind: "headGesture",
  category: "motion",
  icon: "🙂",
  title: { uk: "Кивок / похитування головою", en: "Head nod / shake" },
  params: [
    {
      key: "type",
      type: "select",
      label: { uk: "Рух", en: "Movement" },
      options: [opt("nod", "Кивок «так»", "Nod “yes”"), opt("shake", "Похитати «ні»", "Shake “no”")],
      default: "nod",
    },
    num("amplitude", { uk: "Чутливість (менше — чутливіше)", en: "Amplitude (lower = more sensitive)" }, 0.04, 0.01, 0.2, 0.005),
    num("swings", { uk: "Рухів", en: "Movements" }, 2, 1, 6, 1),
  ],
  hold: 1,
  grace: 0,
  detect: ({ face, now }, p, st, debug) => {
    st.h ??= [];
    if (!face) {
      st.h.length = 0;
      return null;
    }
    st.h.push({ t: now, v: p.type === "nod" ? face.pitch : face.yaw });
    while (st.h.length && now - st.h[0].t > 1400) st.h.shift();
    if (st.h.length < 6) return null;
    const n = reversals(
      st.h.map((q) => q.v),
      p.amplitude,
    );
    debug.push(`${p.type}=${n}`);
    if (n < p.swings) return null;
    st.h.length = 0;
    return { ...face.top, size: face.size, type: p.type };
  },
};

export const MOTIONS = [swipe, wave, circle, push, handSpeed, headGesture];
