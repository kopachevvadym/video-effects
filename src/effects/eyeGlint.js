// Іскра в оці: великий відблиск-зірочка, що крутиться і гасне, + дрібні іскорки.
// Колір залежить від ока: ліве — золото, праве — бірюза.
import { scaleFromHand, sparkleShape } from "./shapes.js";
import { rand } from "../geometry.js";

const HUES = { left: 45, right: 185 };

function glint(x, y, k, hue) {
  let t = 0;
  const life = 0.7;
  return {
    update(dt) {
      t += dt;
      return t < life;
    },
    draw(ctx) {
      const p = t / life;
      const a = p < 0.2 ? p / 0.2 : 1 - (p - 0.2) / 0.8;
      const r = 70 * k * (0.3 + 0.7 * Math.sin(Math.min(1, p * 1.6) * (Math.PI / 2)));
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = a;
      ctx.translate(x, y);
      ctx.rotate(p * 1.2);
      ctx.shadowColor = `hsl(${hue}, 100%, 65%)`;
      ctx.shadowBlur = 30 * k;
      ctx.fillStyle = `hsl(${hue}, 100%, 92%)`;
      sparkleShape(ctx, 0, 0, r);
      ctx.fill();
      ctx.rotate(Math.PI / 4);
      sparkleShape(ctx, 0, 0, r * 0.45);
      ctx.fill();
    },
  };
}

function mote(x, y, k, hue) {
  const angle = rand(0, Math.PI * 2);
  const speed = rand(60, 220) * k;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  const r = rand(3, 8) * k;
  const life = rand(0.4, 0.9);
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
      ctx.globalAlpha = 1 - t / life;
      ctx.fillStyle = `hsl(${hue + rand(-15, 15)}, 100%, 80%)`;
      sparkleShape(ctx, x, y, r);
      ctx.fill();
    },
  };
}

export const eyeGlint = {
  trigger(fx, hit) {
    const k = scaleFromHand(hit.size);
    const hue = HUES[hit.side] ?? 45;
    fx.add(glint(hit.x, hit.y, k, hue));
    for (let i = 0; i < 16; i++) fx.add(mote(hit.x, hit.y, k, hue));
  },
};
