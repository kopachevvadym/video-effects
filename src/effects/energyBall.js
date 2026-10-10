// Енергетична куля між долонями (неперервний ефект).
// trigger викликається кожен кадр, поки жест триває: оновлює позицію, розмір і пальці.
// Коли жест зникає, куля розлітається іскрами.
import { scaleFromHand } from "./shapes.js";
import { rand } from "../geometry.js";

const RELEASE_AFTER = 0.15; // с без оновлень → куля відпущена

/** Ламана «блискавка» від a до b (зміщення середніх точок). */
function lightningPath(ctx, a, b, roughness) {
  let pts = [a, b];
  let offset = roughness;
  for (let level = 0; level < 4; level++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1];
      const q = pts[i];
      const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
      const nx = -(q.y - p.y) / len;
      const ny = (q.x - p.x) / len;
      const d = rand(-offset, offset);
      next.push({ x: (p.x + q.x) / 2 + nx * d, y: (p.y + q.y) / 2 + ny * d }, q);
    }
    pts = next;
    offset /= 2;
  }
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
}

function spark(x, y, k, hue) {
  const angle = rand(0, Math.PI * 2);
  const speed = rand(200, 800) * k;
  let vx = Math.cos(angle) * speed;
  let vy = Math.sin(angle) * speed;
  const life = rand(0.4, 0.9);
  let t = 0;
  return {
    update(dt) {
      t += dt;
      vx *= 1 - 2.5 * dt;
      vy *= 1 - 2.5 * dt;
      x += vx * dt;
      y += vy * dt;
      return t < life;
    },
    draw(ctx) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `hsla(${hue}, 100%, 75%, ${1 - t / life})`;
      ctx.beginPath();
      ctx.arc(x, y, 3 * k, 0, Math.PI * 2);
      ctx.fill();
    },
  };
}

function createBall(fx, hit) {
  const ball = {
    x: hit.x,
    y: hit.y,
    r: 0,
    targetR: 40,
    tips: [],
    k: 1,
    t: 0,
    lastFed: 0,
    fade: 1,
    hue: rand(185, 215),
    feed(h) {
      this.k = scaleFromHand(h.size);
      this.x += (h.x - this.x) * 0.5;
      this.y += (h.y - this.y) * 0.5;
      this.targetR = h.r ?? 0.6 * (h.size || 120);
      this.tips = h.tips ?? [];
      this.lastFed = this.t;
    },
    update(dt) {
      this.t += dt;
      this.r += (this.targetR - this.r) * Math.min(1, dt * 8);
      if (this.t - this.lastFed > RELEASE_AFTER) {
        // відпустили: вибух іскрами і зникнення
        for (let i = 0; i < 70; i++) fx.add(spark(this.x, this.y, this.k, this.hue + rand(-20, 30)));
        fx.state.delete("energyBall");
        return false;
      }
      return true;
    },
    draw(ctx) {
      const { x, y, k, hue } = this;
      const pulse = 1 + 0.08 * Math.sin(this.t * 18) + 0.05 * Math.sin(this.t * 7);
      const r = this.r * pulse;
      ctx.globalCompositeOperation = "lighter";

      // ореол
      const halo = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.2);
      halo.addColorStop(0, `hsla(${hue}, 100%, 60%, 0.55)`);
      halo.addColorStop(1, `hsla(${hue + 30}, 100%, 50%, 0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);

      // ядро
      const core = ctx.createRadialGradient(x, y, 0, x, y, r);
      core.addColorStop(0, "rgba(255,255,255,1)");
      core.addColorStop(0.45, `hsla(${hue}, 100%, 80%, 0.95)`);
      core.addColorStop(1, `hsla(${hue}, 100%, 55%, 0)`);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // блискавки до кінчиків пальців
      ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;
      ctx.shadowBlur = 14 * k;
      ctx.lineJoin = "round";
      for (const tip of this.tips) {
        if (Math.random() < 0.35) continue; // мерехтіння
        const ang = Math.atan2(tip.y - y, tip.x - x);
        const from = { x: x + Math.cos(ang) * r * 0.5, y: y + Math.sin(ang) * r * 0.5 };
        lightningPath(ctx, from, tip, 28 * k);
        ctx.strokeStyle = `hsla(${hue}, 100%, 85%, 0.9)`;
        ctx.lineWidth = 2 * k;
        ctx.stroke();
      }

      // кілька дуг по поверхні
      for (let i = 0; i < 3; i++) {
        const a1 = rand(0, Math.PI * 2);
        const a2 = a1 + rand(0.8, 2);
        lightningPath(
          ctx,
          { x: x + Math.cos(a1) * r * 0.8, y: y + Math.sin(a1) * r * 0.8 },
          { x: x + Math.cos(a2) * r * 0.8, y: y + Math.sin(a2) * r * 0.8 },
          14 * k,
        );
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 1.5 * k;
        ctx.stroke();
      }
    },
  };
  return ball;
}

export const energyBall = {
  trigger(fx, hit) {
    let ball = fx.state.get("energyBall");
    if (!ball) {
      ball = createBall(fx, hit);
      fx.state.set("energyBall", ball);
      fx.add(ball);
    }
    ball.feed(hit);
  },
};
