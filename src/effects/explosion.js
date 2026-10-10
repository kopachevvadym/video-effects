// Вибух: спалах, ударна хвиля, вогняні уламки і струс екрана.
import { scaleFromHand } from "./shapes.js";
import { rand, pick } from "../geometry.js";

const FIRE = ["#fff3b0", "#ffd166", "#ff9f1c", "#ff6b35", "#e63946"];

function flash(x, y, k) {
  let t = 0;
  const life = 0.35;
  return {
    update(dt) {
      t += dt;
      return t < life;
    },
    draw(ctx) {
      const a = 1 - t / life;
      const r = 160 * k * (0.6 + t / life);
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255, 250, 220, ${a})`);
      g.addColorStop(0.35, `rgba(255, 170, 60, ${0.7 * a})`);
      g.addColorStop(1, "rgba(255, 80, 20, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    },
  };
}

function shockwave(x, y, k) {
  let t = 0;
  const life = 0.6;
  return {
    update(dt) {
      t += dt;
      return t < life;
    },
    draw(ctx) {
      const p = t / life;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * (1 - p)})`;
      ctx.lineWidth = 6 * k * (1 - p) + 1;
      ctx.beginPath();
      ctx.arc(x, y, 30 * k + 420 * k * (1 - (1 - p) ** 2), 0, Math.PI * 2);
      ctx.stroke();
    },
  };
}

function ember(x, y, k) {
  const angle = rand(0, Math.PI * 2);
  const speed = rand(250, 1100) * k;
  let vx = Math.cos(angle) * speed;
  let vy = Math.sin(angle) * speed;
  let px = x;
  let py = y;
  const color = pick(FIRE);
  const life = rand(0.5, 1.3);
  const w = rand(2, 5) * k;
  let t = 0;
  return {
    update(dt) {
      t += dt;
      px = x;
      py = y;
      vx *= 1 - 3 * dt;
      vy = vy * (1 - 3 * dt) + 500 * k * dt;
      x += vx * dt;
      y += vy * dt;
      return t < life;
    },
    draw(ctx) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 1 - t / life;
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x + (x - px) * 2, y + (y - py) * 2); // довгий «хвіст» на швидкості
      ctx.stroke();
    },
  };
}

function smoke(x, y, k) {
  const angle = rand(0, Math.PI * 2);
  const speed = rand(40, 180) * k;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed - 40 * k;
  const life = rand(1, 1.8);
  const r0 = rand(20, 45) * k;
  let t = 0;
  return {
    update(dt) {
      t += dt;
      x += vx * dt;
      y += vy * dt;
      return t < life;
    },
    draw(ctx) {
      const p = t / life;
      const r = r0 * (1 + 1.5 * p);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(60, 50, 50, ${0.35 * (1 - p)})`);
      g.addColorStop(1, "rgba(60, 50, 50, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    },
  };
}

export const explosion = {
  trigger(fx, hit) {
    const k = scaleFromHand(hit.size);
    for (let i = 0; i < 14; i++) fx.add(smoke(hit.x, hit.y, k));
    fx.add(flash(hit.x, hit.y, k));
    fx.add(shockwave(hit.x, hit.y, k));
    for (let i = 0; i < 120; i++) fx.add(ember(hit.x, hit.y, k));
    fx.shake = Math.max(fx.shake, 18 * k);
  },
};
