// Ефекти для брів і рота: здивування, «?», злість, вогонь, сонце, бульбашки.
import { rand } from "../geometry.js";

/** Масштаб від ширини обличчя (≈250 px — нормальна відстань до камери). */
const kFace = (size) => Math.min(2, Math.max(0.5, (size || 250) / 250));
const easeOutBack = (p) => 1 + 2.7 * (p - 1) ** 3 + 1.7 * (p - 1) ** 2;

/** Текст із контуром, що «вистрибує» (для «!» і «?»). */
export function popText({ text, x, y, k, fill, life = 1.2, size = 90, wobble = 0, rise = 30 }) {
  let t = 0;
  return {
    update(dt) {
      t += dt;
      return t < life;
    },
    draw(ctx) {
      const p = t / life;
      const s = easeOutBack(Math.min(1, t / 0.3));
      ctx.globalAlpha = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
      ctx.translate(x, y - rise * k * p);
      ctx.rotate(Math.sin(t * 9) * wobble);
      ctx.scale(s, s);
      ctx.font = `900 ${size * k}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = 10 * k;
      ctx.strokeStyle = "#1a1a1a";
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = fill;
      ctx.fillText(text, 0, 0);
    },
  };
}

// ---------- 😲 здивування: аніме-лінії навколо голови + «!!» ----------

function speedLines(cx, cy, k) {
  let t = 0;
  const life = 0.6;
  const lines = Array.from({ length: 34 }, () => ({
    a: rand(0, Math.PI * 2),
    r1: rand(170, 230),
    len: rand(60, 160),
    w: rand(2, 6),
  }));
  return {
    update(dt) {
      t += dt;
      return t < life;
    },
    draw(ctx) {
      const p = t / life;
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = "#ffffff";
      ctx.lineCap = "round";
      for (const l of lines) {
        const r1 = (l.r1 + 40 * p) * k;
        const r2 = r1 + l.len * k;
        ctx.lineWidth = l.w * k;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(l.a) * r1, cy + Math.sin(l.a) * r1);
        ctx.lineTo(cx + Math.cos(l.a) * r2, cy + Math.sin(l.a) * r2);
        ctx.stroke();
      }
    },
  };
}

export const surprise = {
  trigger(fx, hit) {
    const k = kFace(hit.size);
    const c = hit.face ?? { x: hit.x, y: hit.y + 120 * k };
    fx.add(speedLines(c.x, c.y, k));
    fx.add(popText({ text: "!!", x: hit.x, y: hit.y - 70 * k, k, fill: "#ffd60a", size: 110, wobble: 0.08 }));
  },
};

// ---------- 🤨 одна брова: «?» над нею ----------

export const question = {
  trigger(fx, hit) {
    const k = kFace(hit.size);
    const fill = hit.side === "right" ? "#5ee7ff" : "#c792ff";
    const dir = hit.side === "right" ? 1 : -1;
    fx.add(popText({ text: "?", x: hit.x + dir * 20 * k, y: hit.y - 80 * k, k, fill, size: 100, wobble: 0.25, rise: 40 }));
    for (let i = 0; i < 3; i++) {
      fx.add(
        popText({
          text: "?",
          x: hit.x + dir * rand(60, 130) * k,
          y: hit.y - rand(40, 130) * k,
          k: k * 0.4,
          fill,
          size: 90,
          wobble: 0.4,
          life: rand(0.8, 1.2),
          rise: 120,
        }),
      );
    }
  },
};

// ---------- 😠 злість: червона віньєтка, пара з голови, 💢 ----------

function vignette() {
  let t = 0;
  const life = 1.6;
  return {
    update(dt) {
      t += dt;
      return t < life;
    },
    draw(ctx) {
      const W = innerWidth;
      const H = innerHeight;
      const a = 0.55 * Math.abs(Math.sin((t / life) * Math.PI * 2)) * (1 - t / life);
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(255, 0, 0, 0)");
      g.addColorStop(1, `rgba(220, 0, 0, ${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    },
  };
}

function steam(x, y, k, dir) {
  const vx = dir * rand(30, 110) * k;
  const vy = -rand(120, 220) * k;
  const r0 = rand(10, 22) * k;
  const life = rand(0.8, 1.4);
  let t = -rand(0, 0.6);
  return {
    update(dt) {
      t += dt;
      if (t < 0) return true;
      x += vx * dt;
      y += vy * dt;
      return t < life;
    },
    draw(ctx) {
      if (t < 0) return;
      const p = t / life;
      const r = r0 * (1 + 2.5 * p);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.7 * (1 - p)})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    },
  };
}

function angerMark(x, y, k) {
  let t = 0;
  const life = 1.6;
  return {
    update(dt) {
      t += dt;
      return t < life;
    },
    draw(ctx) {
      const s = (0.9 + 0.25 * Math.abs(Math.sin(t * 10))) * Math.min(1, t / 0.15);
      ctx.globalAlpha = t > life - 0.3 ? (life - t) / 0.3 : 1;
      ctx.font = `${70 * k * s}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("💢", x, y);
    },
  };
}

export const anger = {
  trigger(fx, hit) {
    const k = kFace(hit.size);
    fx.add(vignette());
    const tl = hit.temples?.left ?? { x: hit.x - 120 * k, y: hit.y + 60 * k };
    const tr = hit.temples?.right ?? { x: hit.x + 120 * k, y: hit.y + 60 * k };
    for (let i = 0; i < 14; i++) {
      fx.add(steam(tl.x, tl.y - 40 * k, k, -1));
      fx.add(steam(tr.x, tr.y - 40 * k, k, 1));
    }
    fx.add(angerMark(hit.x + 90 * k, hit.y + 10 * k, k));
    fx.shake = Math.max(fx.shake, 6 * k);
  },
};

// ---------- 😮 вогонь з рота (неперервний) ----------

function flame(x, y, k, dirX, dirY, spread) {
  let vx = (dirX * 650 + rand(-1, 1) * spread) * k;
  let vy = (dirY * 650 + rand(-1, 1) * spread) * k;
  const life = rand(0.45, 0.8);
  const r0 = rand(10, 20) * k;
  let t = 0;
  return {
    update(dt) {
      t += dt;
      vx *= 1 - 1.5 * dt;
      vy = vy * (1 - 1.5 * dt) - 300 * k * dt; // гаряче повітря піднімається
      x += vx * dt;
      y += vy * dt;
      return t < life;
    },
    draw(ctx) {
      const p = t / life;
      const r = r0 * (1 + 3.5 * p); // полум'я «наближається» і росте
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255, 245, 200, ${0.9 * (1 - p)})`);
      g.addColorStop(0.3, `rgba(255, 170, 40, ${0.7 * (1 - p)})`);
      g.addColorStop(0.7, `rgba(230, 60, 10, ${0.35 * (1 - p)})`);
      g.addColorStop(1, "rgba(120, 20, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    },
  };
}

export const fireBreath = {
  trigger(fx, hit) {
    const k = kFace(hit.size);
    // напрямок — куди повернута голова; дивишся прямо — вогонь летить «на камеру» (вниз і в боки)
    const dirX = (hit.yaw ?? 0) * 4;
    const dirY = (hit.pitch ?? 0) * 4 + 0.35;
    const spread = 260 + 200 * Math.max(0, 1 - Math.hypot(dirX, dirY));
    for (let i = 0; i < 7; i++) fx.add(flame(hit.x, hit.y, k, dirX, dirY, spread));
  },
};

// ---------- 😁 сонце: промені навколо голови ----------

function rays(cx, cy, k) {
  let t = 0;
  const life = 2.2;
  const n = 18;
  return {
    update(dt) {
      t += dt;
      return t < life;
    },
    draw(ctx) {
      const p = t / life;
      const a = Math.sin(Math.PI * p); // плавно з'являється і зникає
      const r1 = 170 * k;
      const r2 = (340 + 120 * p) * k;
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.4);
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        const w = 0.09;
        const g = ctx.createRadialGradient(0, 0, r1, 0, 0, r2);
        g.addColorStop(0, `rgba(255, 210, 80, ${0.55 * a})`);
        g.addColorStop(1, "rgba(255, 150, 30, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang - w) * r1, Math.sin(ang - w) * r1);
        ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
        ctx.lineTo(Math.cos(ang + w) * r1, Math.sin(ang + w) * r1);
        ctx.closePath();
        ctx.fill();
      }
      // теплий відтінок усього кадру
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(255, 170, 60, ${0.12 * a})`;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    },
  };
}

export const sunshine = {
  trigger(fx, hit) {
    fx.add(rays(hit.x, hit.y, kFace(hit.size)));
  },
};

// ---------- 😗 мильні бульбашки (неперервний) ----------

function bubble(x, y, k, yaw) {
  const r = rand(10, 34) * k;
  const vx = (yaw * 500 + rand(-60, 60)) * k;
  const vy = -rand(40, 110) * k;
  const life = rand(2, 4);
  const hue0 = rand(0, 360);
  const wob = rand(2, 4);
  let t = 0;
  return {
    update(dt) {
      t += dt;
      x += vx * dt * Math.max(0.15, 1 - t);
      y += vy * dt;
      return t < life;
    },
    draw(ctx) {
      const p = t / life;
      const rr = r * Math.min(1, t / 0.25) * (1 + 0.04 * Math.sin(t * wob * 3));
      const sx = x + Math.sin(t * wob) * 8 * k;
      ctx.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 1;
      // райдужний контур
      const g = ctx.createLinearGradient(sx - rr, y - rr, sx + rr, y + rr);
      g.addColorStop(0, `hsla(${hue0}, 100%, 75%, 0.9)`);
      g.addColorStop(0.5, `hsla(${hue0 + 120}, 100%, 75%, 0.9)`);
      g.addColorStop(1, `hsla(${hue0 + 240}, 100%, 75%, 0.9)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.8 * k;
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.beginPath();
      ctx.arc(sx, y, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // відблиск
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath();
      ctx.ellipse(sx - rr * 0.35, y - rr * 0.4, rr * 0.18, rr * 0.1, -0.6, 0, Math.PI * 2);
      ctx.fill();
    },
  };
}

export const bubbles = {
  trigger(fx, hit) {
    if (Math.random() > 0.22) return; // не більше ~7 бульбашок за секунду
    fx.add(bubble(hit.x, hit.y, kFace(hit.size), hit.yaw ?? 0));
  },
};
