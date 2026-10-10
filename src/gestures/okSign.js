// 👌 Знак «ОК»: великий і вказівний утворюють кільце, решта пальців випрямлені → портал.
import { THUMB, INDEX, MIDDLE, RING, PINKY, isExtended, dist, mid } from "../geometry.js";

const PINCH = 0.3; // наскільки близько кінчики великого і вказівного (частка долоні)

export const okSign = {
  name: "okSign",
  label: "👌 Знак ОК — портал",
  holdFrames: 6,
  cooldownMs: 1400,

  detect(hands, debug) {
    for (const h of hands) {
      const pinch = dist(h.points[THUMB.tip], h.points[INDEX.tip]) / h.size;
      debug[h.id] = `pinch=${pinch.toFixed(2)}`;
      if (pinch < PINCH && isExtended(h, MIDDLE) && isExtended(h, RING) && isExtended(h, PINKY)) {
        const c = mid(h.points[THUMB.tip], h.points[INDEX.tip]);
        return { x: c.x, y: c.y, size: h.size };
      }
    }
    return null;
  },
};
