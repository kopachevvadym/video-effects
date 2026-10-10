// Портал: кільця світла розходяться назовні, а іскри закручуються спіраллю всередину.
import { scaleFromHand } from "./shapes.js";
import { rand } from "../geometry.js";
import { count } from "../fx.js";

const easeOut = (p) => 1 - (1 - p) ** 3;

function ring(x, y, k, delay, hue) {
  let t = -delay;
  const life = 1.2;
  return {
    update(dt) {
      t += dt;
      return t < life;
    },
    draw(ctx) {
      if (t < 0) return;
      const p = t / life;
      const r = (12 + 190 * easeOut(p)) * k;
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
      ctx.shadowBlur = 24 * k;
      ctx.strokeStyle = `hsla(${hue}, 100%, 70%, ${1 - p})`;
      ctx.lineWidth = (9 * (1 - p) + 1.5) * k;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    },
  };
}

function swirl(cx, cy, k, hue) {
  let angle = rand(0, Math.PI * 2);
  const startR = rand(110, 220) * k;
  const spin = rand(4, 7) * (Math.random() < 0.5 ? -1 : 1);
  const life = rand(0.8, 1.4);
  let t = -rand(0, 0.3);
  let px = null;
  let py = null;
  let x = cx;
  let y = cy;
  return {
    update(dt) {
      t += dt;
      if (t < 0) return true;
      const p = t / life;
      const r = startR * (1 - easeOut(p));
      angle += spin * dt * (1 + 2 * p); // ближче до центру — швидше
      px = x;
      py = y;
      x = cx + Math.cos(angle) * r;
      y = cy + Math.sin(angle) * r;
      if (px === cx && py === cy) {
        px = x;
        py = y;
      }
      return t < life;
    },
    draw(ctx) {
      if (t < 0) return;
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `hsla(${hue}, 100%, 80%, ${1 - t / life})`;
      ctx.lineWidth = 2.5 * k;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
    },
  };
}

function core(x, y, k, hue) {
  let t = 0;
  const life = 1.4;
  return {
    update(dt) {
      t += dt;
      return t < life;
    },
    draw(ctx) {
      const p = t / life;
      const a = Math.sin(Math.PI * p); // плавно з'являється і зникає
      const r = 70 * k * (0.6 + 0.4 * Math.sin(t * 12) ** 2);
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `hsla(${hue + 40}, 100%, 92%, ${a})`);
      g.addColorStop(0.4, `hsla(${hue}, 100%, 60%, ${0.6 * a})`);
      g.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    },
  };
}

export const portal = {
  trigger(fx, hit) {
    const k = scaleFromHand(hit.size);
    const hue = hit.hue ?? rand(180, 290); // від бірюзового до фіолетового
    fx.add(core(hit.x, hit.y, k, hue));
    for (let i = 0; i < 5; i++) fx.add(ring(hit.x, hit.y, k, i * 0.14, hue + i * 12));
    for (let i = 0; i < count(60, hit); i++) fx.add(swirl(hit.x, hit.y, k, hue + rand(-30, 30)));
  },
};
