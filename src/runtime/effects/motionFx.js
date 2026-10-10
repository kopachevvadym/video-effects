// Effects made for motion nodes: a glowing swoosh along the swipe path, and a
// free-text / emoji pop-up.
import { rand } from "../geometry.js";
import { count } from "../fx.js";
import { scaleFromHand, sparkleShape } from "./shapes.js";
import { popText } from "./faceFx.js";

/** Default colour per swipe direction, so up / down / left / right look different. */
const DIR_HUES = { up: 45, down: 205, left: 320, right: 140 };
const DIR_VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** Path of the swipe in world pixels: the real one, or a straight line ending at the hit. */
function pathOf(hit, k) {
  if (hit.path?.length >= 2) return hit.path;
  const [vx, vy] = DIR_VEC[hit.dir] ?? DIR_VEC.up;
  const len = 320 * k;
  return Array.from({ length: 8 }, (_, i) => {
    const f = i / 7 - 1; // −1 … 0
    return { x: hit.x + vx * len * f, y: hit.y + vy * len * f };
  });
}

/** Catmull-Rom-ish smoothing so a jittery 10-point path draws as one clean curve. */
function smooth(path) {
  if (path.length < 3) return path;
  const out = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1];
    const b = path[i];
    const c = path[i + 1];
    out.push({ x: (a.x + 2 * b.x + c.x) / 4, y: (a.y + 2 * b.y + c.y) / 4 });
  }
  out.push(path[path.length - 1]);
  return out;
}

function streak(path, k, hue) {
  let t = 0;
  const grow = 0.14; // head travels along the path
  const life = 0.75;
  const n = path.length;
  return {
    update(dt) {
      t += dt;
      return t < life;
    },
    draw(ctx) {
      const head = Math.min(1, t / grow) * (n - 1);
      const fade = t < grow ? 1 : 1 - (t - grow) / (life - grow);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      // tapered ribbon: thin tail → thick head, drawn segment by segment
      for (const [w, light, blur, op] of [
        [34, 55, 40, "lighter"],
        [14, 90, 0, "source-over"], // the white core: no additive blending, so joints don't form bright knots
      ]) {
        ctx.globalCompositeOperation = op;
        ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
        ctx.shadowBlur = blur * k;
        for (let i = 1; i <= head; i++) {
          const f = i / (n - 1);
          ctx.globalAlpha = fade * (0.25 + 0.75 * f);
          ctx.strokeStyle = `hsl(${hue}, 100%, ${light}%)`;
          ctx.lineWidth = w * k * (0.15 + 0.85 * f) * (0.6 + 0.4 * fade);
          ctx.beginPath();
          ctx.moveTo(path[i - 1].x, path[i - 1].y);
          ctx.lineTo(path[i].x, path[i].y);
          ctx.stroke();
        }
      }
    },
  };
}

function spark(x, y, dx, dy, k, hue) {
  const a = Math.atan2(dy, dx) + rand(-0.6, 0.6);
  const sp = rand(250, 700) * k;
  let vx = Math.cos(a) * sp;
  let vy = Math.sin(a) * sp;
  const r = rand(4, 10) * k;
  const life = rand(0.35, 0.8);
  let t = 0;
  return {
    update(dt) {
      t += dt;
      x += vx * dt;
      y += vy * dt;
      vx *= 1 - 3 * dt;
      vy *= 1 - 3 * dt;
      return t < life;
    },
    draw(ctx) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 1 - t / life;
      ctx.fillStyle = `hsl(${hue + rand(-20, 20)}, 100%, 78%)`;
      sparkleShape(ctx, x, y, r * (1 - t / life));
      ctx.fill();
    },
  };
}

export const swoosh = {
  trigger(fx, hit) {
    const k = scaleFromHand(hit.size);
    const hue = hit.hue ?? DIR_HUES[hit.dir] ?? 45;
    const path = smooth(pathOf(hit, k));
    fx.add(streak(path, k, hue));
    const end = path[path.length - 1];
    const prev = path[Math.max(0, path.length - 3)];
    const dx = end.x - prev.x || (DIR_VEC[hit.dir]?.[0] ?? 0);
    const dy = end.y - prev.y || (DIR_VEC[hit.dir]?.[1] ?? -1);
    for (let i = 0; i < count(18, hit); i++) fx.add(spark(end.x, end.y, dx, dy, k, hue));
  },
};

export const textPop = {
  trigger(fx, hit) {
    const k = Math.min(2, Math.max(0.5, (hit.size || 200) / 200));
    const hue = hit.hue ?? 50;
    const text = String(hit.text ?? "👋").slice(0, 40);
    fx.add(popText({ text, x: hit.x, y: hit.y - 90 * k, k, fill: `hsl(${hue}, 100%, 62%)`, size: 90, wobble: 0.1, life: 1.6 }));
  },
};

// ---------- 🫡 mind waves: glowing arcs radiating out of the temple ----------

function waveArc(x, y, angle, k, hue, delay) {
  let t = -delay;
  const life = 0.9;
  return {
    update(dt) {
      t += dt;
      return t < life;
    },
    draw(ctx) {
      if (t < 0) return;
      const p = t / life;
      const r = (18 + 230 * p) * k;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (1 - p) ** 1.3;
      ctx.lineCap = "round";
      ctx.shadowColor = `hsl(${hue}, 100%, 65%)`;
      ctx.shadowBlur = 22 * k;
      ctx.strokeStyle = `hsl(${hue}, 100%, ${70 + 20 * (1 - p)}%)`;
      ctx.lineWidth = (9 - 5 * p) * k;
      ctx.beginPath();
      ctx.arc(x, y, r, angle - 0.75, angle + 0.75);
      ctx.stroke();
    },
  };
}

function thought(x, y, angle, k, hue) {
  const a = angle + rand(-0.7, 0.7);
  const sp = rand(60, 160) * k;
  const vx = Math.cos(a) * sp;
  const vy = Math.sin(a) * sp - 40 * k;
  const r = rand(4, 9) * k;
  const life = rand(0.7, 1.4);
  let t = -rand(0, 0.5);
  return {
    update(dt) {
      t += dt;
      if (t > 0) {
        x += vx * dt;
        y += vy * dt;
      }
      return t < life;
    },
    draw(ctx) {
      if (t < 0) return;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 1 - t / life;
      ctx.fillStyle = `hsl(${hue + rand(-25, 25)}, 100%, 80%)`;
      sparkleShape(ctx, x, y, r);
      ctx.fill();
    },
  };
}

export const mindWaves = {
  trigger(fx, hit) {
    const k = Math.min(2, Math.max(0.5, (hit.size || 250) / 250));
    const hue = hit.hue ?? 275;
    // outward = from the middle of the face to the temple; fall back to the temple's side
    const c = hit.face;
    const angle = c && (c.x !== hit.x || c.y !== hit.y) ? Math.atan2(hit.y - c.y, hit.x - c.x) : hit.side === "left" ? Math.PI : 0;
    for (let i = 0; i < 5; i++) fx.add(waveArc(hit.x, hit.y, angle, k, hue, i * 0.16));
    for (let i = 0; i < count(14, hit); i++) fx.add(thought(hit.x, hit.y, angle, k, hue));
  },
};
