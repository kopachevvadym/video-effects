// Лазер з ока крізь кінчик пальця до краю екрана (неперервний ефект).
import { scaleFromHand } from "./shapes.js";
import { rand } from "../geometry.js";
import { view } from "../fx.js";

const RELEASE_AFTER = 0.12;
const COLORS = { left: 0, right: 140 }; // закрите ліве → червоний, праве → зелений

/** Точка, де промінь з a через b виходить за межі екрана. */
function toScreenEdge(a, b) {
  const { W, H } = view;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  let t = Infinity;
  if (ux > 0) t = Math.min(t, (W - a.x) / ux);
  if (ux < 0) t = Math.min(t, -a.x / ux);
  if (uy > 0) t = Math.min(t, (H - a.y) / uy);
  if (uy < 0) t = Math.min(t, -a.y / uy);
  if (!Number.isFinite(t)) t = 0;
  return { x: a.x + ux * t, y: a.y + uy * t };
}

function spark(x, y, k, hue) {
  const angle = rand(0, Math.PI * 2);
  const speed = rand(100, 400) * k;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  const life = rand(0.15, 0.4);
  let t = 0;
  return {
    update(dt) {
      t += dt;
      x += vx * dt;
      y += vy * dt;
      return t < life;
    },
    draw(ctx) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `hsla(${hue}, 100%, 75%, ${1 - t / life})`;
      ctx.fillRect(x - 1.5 * k, y - 1.5 * k, 3 * k, 3 * k);
    },
  };
}

function createLaser(fx) {
  return {
    t: 0,
    lastFed: 0,
    from: { x: 0, y: 0 },
    tip: { x: 0, y: 0 },
    k: 1,
    hue: 0,
    feed(hit) {
      // aim from the open eye (the closed one is the "aiming" eye)
      const f = fx.face;
      const eye = f ? (f.winking === "left" ? f.rightEye : f.leftEye) : null;
      this.from = hit.from ?? eye?.center ?? { x: view.W / 2, y: view.H * 0.3 };
      this.tip = { x: hit.x, y: hit.y };
      this.k = scaleFromHand(hit.size);
      this.hue = hit.hue ?? COLORS[hit.side ?? f?.winking] ?? 0;
      this.lastFed = this.t;
      for (let i = 0; i < 3; i++) fx.add(spark(this.tip.x, this.tip.y, this.k, this.hue));
    },
    update(dt) {
      this.t += dt;
      if (this.t - this.lastFed > RELEASE_AFTER) {
        fx.state.delete("laser");
        return false;
      }
      return true;
    },
    draw(ctx) {
      const { from, tip, k, hue } = this;
      const end = toScreenEdge(from, tip);
      const flicker = 0.85 + 0.15 * Math.random();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      ctx.shadowColor = `hsl(${hue}, 100%, 55%)`;
      ctx.shadowBlur = 25 * k;

      const beam = (width, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      };
      beam(16 * k * flicker, `hsla(${hue}, 100%, 50%, 0.35)`);
      beam(6 * k, `hsla(${hue}, 100%, 65%, 0.9)`);
      beam(2 * k, "rgba(255,255,255,0.95)");

      // світіння в оці і на кінчику пальця
      for (const [p, r] of [
        [from, 26 * k],
        [tip, 18 * k],
      ]) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * flicker);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.4, `hsla(${hue}, 100%, 60%, 0.8)`);
        g.addColorStop(1, `hsla(${hue}, 100%, 50%, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      }
    },
  };
}

export const laser = {
  trigger(fx, hit) {
    let l = fx.state.get("laser");
    if (!l) {
      l = createLaser(fx);
      fx.state.set("laser", l);
      fx.add(l);
    }
    l.feed(hit);
  },
};
