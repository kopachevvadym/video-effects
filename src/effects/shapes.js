// Спільні фігури для ефектів.

// Класична крива серця (x = 16 sin³t, y = 13cos t − 5cos 2t − 2cos 3t − cos 4t),
// нормалізована так, що ширина ≈ 2, центр у (0,0).
const HEART_POINTS = (() => {
  const pts = [];
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([x / 16, -(y + 2) / 16]);
  }
  return pts;
})();

/** Створює шлях серця з центром (x, y) і «радіусом» r (ширина ≈ 2r). */
export function heartPath(ctx, x, y, r) {
  ctx.beginPath();
  HEART_POINTS.forEach(([px, py], i) => {
    const X = x + px * r;
    const Y = y + py * r;
    i === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
  });
  ctx.closePath();
}

/** Масштаб ефекту від розміру руки: рука далеко від камери → ефект менший. */
export const scaleFromHand = (size) => Math.min(2, Math.max(0.5, (size || 120) / 120));

/** Чотирипроменева «іскорка» з центром (x, y) і радіусом r. */
export function sparkleShape(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rr = i % 2 === 0 ? r : r * 0.28;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}
