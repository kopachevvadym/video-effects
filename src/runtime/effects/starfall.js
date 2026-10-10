// Зорепад: падаючі зірки зі шлейфами по всьому екрану + мерехтіння біля руки.
import { scaleFromHand, sparkleShape } from "./shapes.js";
import { rand } from "../geometry.js";
import { view, count } from "../fx.js";

function shootingStar(k, hueBase) {
  const { W, H } = view;
  let x = rand(-0.2 * W, W);
  let y = rand(-0.4 * H, -20);
  const speed = rand(600, 1100) * k;
  const angle = rand(0.95, 1.25); // ~60–70° вниз-вправо
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  const tail = rand(80, 200) * k;
  const r = rand(4, 9) * k;
  const hue = (hueBase ?? 50) + rand(-10, 10);
  let t = -rand(0, 1.6); // зірки вилітають не всі одразу
  return {
    update(dt) {
      t += dt;
      if (t < 0) return true;
      x += vx * dt;
      y += vy * dt;
      return y < H + tail && x < W + tail;
    },
    draw(ctx) {
      if (t < 0) return;
      const tx = x - (vx / speed) * tail;
      const ty = y - (vy / speed) * tail;
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createLinearGradient(tx, ty, x, y);
      g.addColorStop(0, `hsla(${hue}, 100%, 70%, 0)`);
      g.addColorStop(1, `hsla(${hue}, 100%, 85%, 0.9)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = r * 0.6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;
      ctx.shadowBlur = 16 * k;
      ctx.fillStyle = "#fffbe6";
      sparkleShape(ctx, x, y, r * (1 + 0.3 * Math.sin(t * 30)));
      ctx.fill();
    },
  };
}

function twinkle(x, y, k) {
  x += rand(-120, 120) * k;
  y += rand(-120, 60) * k;
  const r = rand(5, 14) * k;
  const life = rand(0.6, 1.4);
  let t = -rand(0, 0.8);
  return {
    update(dt) {
      t += dt;
      y -= 20 * k * dt;
      return t < life;
    },
    draw(ctx) {
      if (t < 0) return;
      const a = Math.sin((Math.PI * t) / life);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = a;
      ctx.fillStyle = "#fff2b3";
      ctx.shadowColor = "#ffd166";
      ctx.shadowBlur = 12 * k;
      sparkleShape(ctx, x, y, r * a);
      ctx.fill();
    },
  };
}

export const starfall = {
  trigger(fx, hit) {
    const k = scaleFromHand(hit.size);
    for (let i = 0; i < count(45, hit); i++) fx.add(shootingStar(Math.min(1.3, k), hit.hue));
    for (let i = 0; i < count(18, hit); i++) fx.add(twinkle(hit.x, hit.y, k));
  },
};
