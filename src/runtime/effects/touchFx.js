// Ефекти дотиків до обличчя: клоунський ніс.
import { rand } from "../geometry.js";
import { sparkleShape } from "./shapes.js";
import { popText } from "./faceFx.js";
import { view, count } from "../fx.js";
import { tr } from "../lang.js";

const kFace = (size) => Math.min(2, Math.max(0.5, (size || 250) / 250));

// ---------- 👃 клоунський ніс ----------

function clownNose(fx, start, k) {
  let t = 0;
  const life = 3;
  let pos = { ...start };
  return {
    update(dt) {
      t += dt;
      if (fx.face?.nose) pos = fx.face.nose; // ніс їде разом з головою
      return t < life;
    },
    draw(ctx) {
      const pop = t < 0.25 ? 1 + 0.5 * Math.sin((t / 0.25) * Math.PI) : 1; // «пружинка» при появі
      const r = 30 * k * pop * Math.min(1, t / 0.08);
      ctx.globalAlpha = t > life - 0.4 ? (life - t) / 0.4 : 1;
      const g = ctx.createRadialGradient(pos.x - r * 0.35, pos.y - r * 0.4, r * 0.1, pos.x, pos.y, r);
      g.addColorStop(0, "#ff8a8a");
      g.addColorStop(0.5, "#e01e1e");
      g.addColorStop(1, "#8a0000");
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 12 * k;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.ellipse(pos.x - r * 0.35, pos.y - r * 0.4, r * 0.28, r * 0.17, -0.6, 0, Math.PI * 2);
      ctx.fill();
    },
  };
}

function star(x, y, k) {
  const a = rand(0, Math.PI * 2);
  const sp = rand(120, 300) * k;
  const vx = Math.cos(a) * sp;
  const vy = Math.sin(a) * sp;
  const life = rand(0.4, 0.8);
  let t = 0;
  return {
    update(dt) {
      t += dt;
      x += vx * dt;
      y += vy * dt;
      return t < life;
    },
    draw(ctx) {
      ctx.globalAlpha = 1 - t / life;
      ctx.fillStyle = "#ffe066";
      sparkleShape(ctx, x, y, 9 * k);
      ctx.fill();
    },
  };
}

export const noseHonk = {
  trigger(fx, hit) {
    const k = kFace(hit.size);
    fx.add(clownNose(fx, hit, k));
    for (let i = 0; i < count(10, hit); i++) fx.add(star(hit.x, hit.y, k));
    fx.add(popText({ text: tr("boop"), x: hit.x + 110 * k, y: hit.y - 60 * k, k: k * 0.6, fill: "#ff5d8f", size: 80, wobble: 0.15 }));
  },
};

// ---------- 🤦 запаморочення: зірочки кружляють навколо голови ----------

/** П'ятикутна зірка з центром (x, y). */
function starPath(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}

function dizzyStars(fx, start, k) {
  let t = 0;
  const life = 3.5;
  const n = 5;
  let pos = { ...start };
  let roll = 0;
  return {
    update(dt) {
      t += dt;
      if (fx.face?.top) {
        pos = fx.face.top; // орбіта їде разом з головою
        roll = ((fx.face.roll ?? 0) * Math.PI) / 180;
      }
      return t < life;
    },
    draw(ctx) {
      const appear = Math.min(1, t / 0.35);
      const fade = t > life - 0.5 ? (life - t) / 0.5 : 1;
      const rx = 150 * k * appear; // ширина орбіти
      const ry = 34 * k * appear; // «висота» орбіти — сплющений еліпс дає ефект 3D
      const cy = pos.y + 10 * k;

      // спершу ті, що позаду (sin < 0), потім ті, що попереду — так правильне накладання
      const stars = Array.from({ length: n }, (_, i) => {
        const a = t * 4.2 + (i / n) * Math.PI * 2;
        return { a, depth: Math.sin(a) };
      }).sort((p, q) => p.depth - q.depth);

      ctx.translate(pos.x, cy);
      ctx.rotate(roll); // орбіта нахиляється разом з головою

      // ледь помітна траєкторія
      ctx.globalAlpha = 0.25 * fade;
      ctx.strokeStyle = "#ffe066";
      ctx.lineWidth = 2 * k;
      ctx.setLineDash([6 * k, 8 * k]);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      for (const { a, depth } of stars) {
        const x = Math.cos(a) * rx;
        const y = Math.sin(a) * ry;
        const front = (depth + 1) / 2; // 0 — позаду, 1 — попереду
        const r = (12 + 10 * front) * k;
        ctx.globalAlpha = (0.45 + 0.55 * front) * fade;
        ctx.fillStyle = "#ffd60a";
        ctx.strokeStyle = "#8a5a00";
        ctx.lineWidth = 2.5 * k;
        ctx.lineJoin = "round";
        starPath(ctx, x, y, r, t * 6 + a);
        ctx.fill();
        ctx.stroke();
      }
    },
  };
}

export const dizzy = {
  trigger(fx, hit) {
    const k = kFace(hit.size);
    fx.add(dizzyStars(fx, hit, k));
  },
};

// ---------- 🤦 жаль: аніме-сльози струмками + синій смуток ----------

/** Крапля-сльоза. */
function tear(x, y, k, dir) {
  let vx = dir * rand(20, 70) * k;
  let vy = rand(40, 120) * k;
  const r = rand(4, 7) * k;
  let t = 0;
  return {
    update(dt) {
      t += dt;
      vy += 1100 * k * dt;
      x += vx * dt;
      y += vy * dt;
      return t < 1.2;
    },
    draw(ctx) {
      ctx.globalAlpha = Math.max(0, 1 - t / 1.2);
      ctx.fillStyle = "rgba(150, 205, 255, 0.95)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 1.2 * k;
      // форма краплі: кругле дно, гострий верх
      ctx.beginPath();
      ctx.moveTo(x, y - r * 2.2);
      ctx.quadraticCurveTo(x + r * 1.1, y - r * 0.2, x, y + r);
      ctx.quadraticCurveTo(x - r * 1.1, y - r * 0.2, x, y - r * 2.2);
      ctx.fill();
      ctx.stroke();
    },
  };
}

function sorrowFx(fx, start, k) {
  let t = 0;
  const life = 3.8;
  let eyes = null;
  let faceSize = start.size || 250;
  return {
    update(dt) {
      t += dt;
      const f = fx.face;
      if (f?.leftEye) {
        eyes = [f.leftEye, f.rightEye];
        faceSize = f.size;
      }
      // краплі зриваються з низу струмків
      if (eyes && t > 0.3 && t < life - 0.6 && Math.random() < 0.5) {
        for (const [i, e] of eyes.entries()) {
          const dir = i === 0 ? -1 : 1;
          const bx = e.center.x + dir * e.width * 0.35;
          const by = e.center.y + faceSize * 0.42 * Math.min(1, (t - 0.3) / 0.5);
          fx.add(tear(bx, by, k, dir));
        }
      }
      return t < life;
    },
    draw(ctx) {
      const { W, H } = view;
      const a = Math.min(1, t / 0.4) * (t > life - 0.6 ? (life - t) / 0.6 : 1);

      // синій меланхолійний відтінок і віньєтка
      ctx.fillStyle = `rgba(30, 60, 140, ${0.18 * a})`;
      ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(10, 20, 60, 0)");
      g.addColorStop(1, `rgba(10, 20, 60, ${0.55 * a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      if (!eyes) return;
      // струмки сліз з кутиків очей по щоках
      const grow = Math.min(1, Math.max(0, (t - 0.15) / 0.5));
      for (const [i, e] of eyes.entries()) {
        const dir = i === 0 ? -1 : 1;
        const x0 = e.center.x + dir * e.width * 0.25;
        const y0 = e.center.y + e.width * 0.15;
        const len = faceSize * 0.42 * grow;
        const steps = 14;
        ctx.beginPath();
        for (let j = 0; j <= steps; j++) {
          const p = j / steps;
          const wobble = Math.sin(p * 9 - t * 10) * 3 * k * p;
          const x = x0 + dir * e.width * 0.1 * p + wobble;
          const y = y0 + len * p;
          j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.globalAlpha = 0.55 * a;
        ctx.strokeStyle = "#7fc4ff";
        ctx.lineWidth = 14 * k;
        ctx.stroke();
        ctx.globalAlpha = 0.9 * a;
        ctx.strokeStyle = "#e6f4ff";
        ctx.lineWidth = 4 * k;
        ctx.stroke();
      }
    },
  };
}

export const sorrow = {
  trigger(fx, hit) {
    const k = kFace(hit.size);
    fx.add(sorrowFx(fx, hit, k));
    fx.add(popText({ text: tr("sorrow"), x: hit.x + 190 * k, y: hit.y + 30 * k, k: k * 0.55, fill: "#9ec5ff", size: 80, wobble: 0.04, life: 2.6, rise: 25 }));
  },
};
