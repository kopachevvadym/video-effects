// Hand selection helpers shared by gesture nodes.
import { dist, mid } from "../runtime/geometry.js";

export const HAND_OPTIONS = [
  { value: "any", label: { uk: "Будь-яка", en: "Any" } },
  { value: "left", label: { uk: "Ліва", en: "Left" } },
  { value: "right", label: { uk: "Права", en: "Right" } },
  { value: "both", label: { uk: "Обидві", en: "Both" } },
];

export const handParam = (def = "any") => ({
  key: "hand",
  type: "select",
  label: { uk: "Рука", en: "Hand" },
  options: HAND_OPTIONS,
  default: def,
});

/**
 * Runs `test(hand)` for the selected hand(s).
 * - any:   first hand that matches
 * - left / right: only that hand
 * - both:  both hands must match; the hit is the midpoint
 */
export function forHands(hands, which, test) {
  if (which === "left" || which === "right") {
    const h = hands.find((x) => x.side === which);
    return h ? withHand(test(h), h) : null;
  }
  if (which === "both") {
    const l = hands.find((x) => x.side === "left");
    const r = hands.find((x) => x.side === "right");
    if (!l || !r) return null;
    const a = test(l);
    const b = test(r);
    if (!a || !b) return null;
    const m = mid(a, b);
    return { ...a, x: m.x, y: m.y, size: (a.size + b.size) / 2, hand: "both", hits: [a, b] };
  }
  for (const h of hands) {
    const hit = test(h);
    if (hit) return withHand(hit, h);
  }
  return null;
}

const withHand = (hit, h) => (hit ? { hand: h.side, handId: h.id, ...hit } : null);

/** Centroid of all 21 points (fingers included). */
export const handCenter = (h) => ({
  x: h.points.reduce((a, p) => a + p.x, 0) / h.points.length,
  y: h.points.reduce((a, p) => a + p.y, 0) / h.points.length,
});

export const pinchRatio = (h) => dist(h.points[4], h.points[8]) / h.size;
