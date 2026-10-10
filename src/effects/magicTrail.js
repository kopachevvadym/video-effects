// Світловий слід за пальцем (неперервний ефект).
// trigger викликається кожен кадр, поки жест активний, і додає нову точку до сліду.
import { scaleFromHand } from "./shapes.js";
import { rand } from "../geometry.js";

const TRAIL_SECONDS = 0.9; // скільки живе кожна точка сліду

function createTrail(fx) {
  const pts = []; // {x, y, age}
  let hue = rand(0, 360);
  const item = {
    pts,
    k: 1,
    update(dt) {
      hue = (hue + 90 * dt) % 360;
      for (const p of pts) p.age += dt;
      while (pts.length && pts[0].age > TRAIL_SECONDS) pts.shift();
      if (!pts.length) {
        fx.state.delete("magicTrail");
        return false;
      }
      return true;
    },
    draw(ctx) {
      if (pts.length < 2) return;
      const k = this.k;
      const tail = pts[0];
      const head = pts[pts.length - 1];
      const life = (p) => 1 - p.age / TRAIL_SECONDS;

      // Веселковий градієнт від хвоста до голови.
      const grad = (light, alpha) => {
        const g = ctx.createLinearGradient(tail.x, tail.y, head.x + 0.01, head.y);
        g.addColorStop(0, `hsla(${hue}, 100%, ${light}%, ${alpha * 0.2})`);
        g.addColorStop(1, `hsla(${(hue + 80) % 360}, 100%, ${light}%, ${alpha})`);
        return g;
      };

      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = `hsl(${(hue + 80) % 360}, 100%, 60%)`;
      ctx.shadowBlur = 24 * k;

      ribbonPath(ctx, pts, (p) => 20 * k * life(p)); // м'яке світіння
      ctx.fillStyle = grad(55, 0.55);
      ctx.fill();

      ribbonPath(ctx, pts, (p) => 6 * k * life(p)); // яскраве ядро
      ctx.fillStyle = grad(92, 1);
      ctx.fill();

      ctx.beginPath(); // «зірочка» на кінчику пальця
      ctx.arc(head.x, head.y, 7 * k, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fill();
    },
  };
  return item;
}

/** Суцільна стрічка змінної ширини вздовж точок (без «намистин» на стиках). */
function ribbonPath(ctx, pts, widthOf) {
  const left = [];
  const right = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const w = widthOf(p) / 2;
    left.push([p.x + nx * w, p.y + ny * w]);
    right.push([p.x - nx * w, p.y - ny * w]);
  }
  ctx.beginPath();
  left.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
}

function sparkle(x, y, k) {
  let vx = rand(-60, 60) * k;
  let vy = rand(-60, 60) * k;
  const life = rand(0.3, 0.7);
  const hue = rand(0, 360);
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
      ctx.fillStyle = `hsla(${hue}, 100%, 80%, ${1 - t / life})`;
      ctx.beginPath();
      ctx.arc(x, y, 2.5 * k, 0, Math.PI * 2);
      ctx.fill();
    },
  };
}

export const magicTrail = {
  trigger(fx, hit) {
    let trail = fx.state.get("magicTrail");
    if (!trail) {
      trail = createTrail(fx);
      fx.state.set("magicTrail", trail);
      fx.add(trail);
    }
    trail.k = scaleFromHand(hit.size);
    trail.pts.push({ x: hit.x, y: hit.y, age: 0 });
    if (Math.random() < 0.6) fx.add(sparkle(hit.x, hit.y, trail.k));
  },
};
