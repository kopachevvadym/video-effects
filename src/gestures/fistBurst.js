// ✊→🖐 Стиснути кулак і різко розкрити долоню → вибух.
// Приклад жесту в часі: важлива не поза, а перехід між двома позами.
import { isFist, isOpenHand, palmCenter } from "../geometry.js";

const WINDOW_MS = 600; // скільки часу між кулаком і розкритою долонею

const lastFist = new Map(); // hand.id → час, коли востаннє бачили кулак

export const fistBurst = {
  name: "fistBurst",
  label: "✊→🖐 Кулак і різко розкрити — вибух",
  holdFrames: 1, // подія миттєва, утримувати не треба
  graceFrames: 0,
  cooldownMs: 700,

  detect(hands, debug) {
    const now = performance.now();
    for (const h of hands) {
      if (isFist(h)) {
        lastFist.set(h.id, now);
        debug[h.id] = "fist";
        continue;
      }
      const t = lastFist.get(h.id) ?? -Infinity;
      if (isOpenHand(h) && now - t < WINDOW_MS) {
        lastFist.delete(h.id);
        const c = palmCenter(h);
        return { x: c.x, y: c.y, size: h.size };
      }
      debug[h.id] = isOpenHand(h) ? "open" : "-";
    }
    return null;
  },
};
