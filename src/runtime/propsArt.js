// Vector art for attachable objects. Each draw(ctx, w) draws the object
// centered at (0, 0) with width ≈ w, "up" = negative y.
//
// slot:   where it sits on the head (see props.js → headSlot)
// widthK: object width relative to face width when worn
// baseY:  art y-coordinate (in units of w) that sits exactly on the slot point

const topHat = {
  slot: "top",
  widthK: 1.05,
  baseY: 0.42, // the brim sits on top of the forehead
  draw(ctx, w) {
    const brimW = w;
    const brimH = w * 0.1;
    const crownW = w * 0.64;
    const crownH = w * 0.62;
    const by = w * 0.42; // brim center y (bottom of the hat)
    // crown
    const g = ctx.createLinearGradient(-crownW / 2, 0, crownW / 2, 0);
    g.addColorStop(0, "#111");
    g.addColorStop(0.45, "#3a3a44");
    g.addColorStop(1, "#0b0b0f");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-crownW / 2, by);
    ctx.lineTo(-crownW / 2 * 0.94, by - crownH);
    ctx.quadraticCurveTo(0, by - crownH - w * 0.04, crownW / 2 * 0.94, by - crownH);
    ctx.lineTo(crownW / 2, by);
    ctx.closePath();
    ctx.fill();
    // band
    ctx.fillStyle = "#b3122e";
    ctx.fillRect(-crownW / 2 * 0.99, by - w * 0.16, crownW * 0.99, w * 0.1);
    // brim
    ctx.fillStyle = "#16161c";
    ctx.beginPath();
    ctx.ellipse(0, by, brimW / 2, brimH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = w * 0.01;
    ctx.stroke();
  },
};

const partyHat = {
  slot: "top",
  widthK: 0.55,
  baseY: 0.5,
  draw(ctx, w) {
    const h = w * 1.5;
    const by = w * 0.5;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-w / 2, by);
    ctx.lineTo(0, by - h);
    ctx.lineTo(w / 2, by);
    ctx.closePath();
    ctx.fillStyle = "#ff4fa3";
    ctx.fill();
    ctx.clip();
    // stripes
    ctx.strokeStyle = "#ffd60a";
    ctx.lineWidth = w * 0.12;
    for (let i = -3; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(-w, by - i * w * 0.32);
      ctx.lineTo(w, by - i * w * 0.32 - w * 0.5);
      ctx.stroke();
    }
    ctx.restore();
    // pompom
    ctx.fillStyle = "#5ee7ff";
    ctx.beginPath();
    ctx.arc(0, by - h, w * 0.13, 0, Math.PI * 2);
    ctx.fill();
    // fringe
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(-w / 2 + (i + 0.5) * (w / 7), by, w * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

const crown = {
  slot: "top",
  widthK: 0.8,
  baseY: 0.3,
  draw(ctx, w) {
    const h = w * 0.5;
    const by = w * 0.3;
    const g = ctx.createLinearGradient(0, by - h, 0, by);
    g.addColorStop(0, "#fff3a0");
    g.addColorStop(0.5, "#ffc93c");
    g.addColorStop(1, "#c98b00");
    ctx.fillStyle = g;
    ctx.strokeStyle = "#7a5200";
    ctx.lineWidth = w * 0.02;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-w / 2, by);
    ctx.lineTo(-w / 2, by - h * 0.55);
    ctx.lineTo(-w / 4, by - h * 0.2);
    ctx.lineTo(0, by - h);
    ctx.lineTo(w / 4, by - h * 0.2);
    ctx.lineTo(w / 2, by - h * 0.55);
    ctx.lineTo(w / 2, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // gems
    const gems = [["#e63946", 0, by - h * 0.32], ["#2a9df4", -w * 0.3, by - h * 0.18], ["#2ec27e", w * 0.3, by - h * 0.18]];
    for (const [c, x, y] of gems) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, w * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const x of [-w / 2, 0, w / 2]) {
      ctx.fillStyle = "#fff3a0";
      ctx.beginPath();
      ctx.arc(x, by - (x === 0 ? h : h * 0.55), w * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

const sunglasses = {
  slot: "eyes",
  widthK: 0.95,
  baseY: 0,
  draw(ctx, w) {
    const lw = w * 0.4;
    const lh = w * 0.24;
    ctx.fillStyle = "rgba(10,10,20,0.92)";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = w * 0.03;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * w * 0.06, -lh * 0.5);
      ctx.lineTo(sx * (w * 0.06 + lw), -lh * 0.5);
      ctx.quadraticCurveTo(sx * (w * 0.06 + lw), lh * 0.8, sx * (w * 0.06 + lw * 0.5), lh * 0.6);
      ctx.quadraticCurveTo(sx * w * 0.06, lh * 0.5, sx * w * 0.06, -lh * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // glare
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = w * 0.015;
      ctx.beginPath();
      ctx.moveTo(sx * (w * 0.12), -lh * 0.25);
      ctx.lineTo(sx * (w * 0.22), -lh * 0.35);
      ctx.stroke();
      ctx.strokeStyle = "#111";
      ctx.lineWidth = w * 0.03;
    }
    ctx.beginPath();
    ctx.moveTo(-w * 0.06, -lh * 0.35);
    ctx.quadraticCurveTo(0, -lh * 0.55, w * 0.06, -lh * 0.35);
    ctx.stroke();
  },
};

const mustache = {
  slot: "lip",
  widthK: 0.5,
  baseY: 0,
  draw(ctx, w) {
    ctx.fillStyle = "#3b2414";
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.06);
    ctx.bezierCurveTo(w * 0.15, -w * 0.18, w * 0.38, -w * 0.12, w * 0.5, w * 0.04);
    ctx.bezierCurveTo(w * 0.42, -w * 0.02, w * 0.32, w * 0.1, w * 0.18, w * 0.08);
    ctx.bezierCurveTo(w * 0.08, w * 0.07, w * 0.03, w * 0.02, 0, w * 0.0);
    ctx.bezierCurveTo(-w * 0.03, w * 0.02, -w * 0.08, w * 0.07, -w * 0.18, w * 0.08);
    ctx.bezierCurveTo(-w * 0.32, w * 0.1, -w * 0.42, -w * 0.02, -w * 0.5, w * 0.04);
    ctx.bezierCurveTo(-w * 0.38, -w * 0.12, -w * 0.15, -w * 0.18, 0, -w * 0.06);
    ctx.fill();
  },
};

export const PROP_ART = { topHat, partyHat, crown, sunglasses, mustache };
