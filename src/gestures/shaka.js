// 🤙 «Шака»: відставлені великий палець і мізинець, решта зігнуті → зорепад.
import { THUMB, INDEX, MIDDLE, RING, PINKY, isExtended, isFolded, thumbOut } from "../geometry.js";

const THUMB_OUT = 0.7; // наскільки далеко великий палець від основи вказівного

export const shaka = {
  name: "shaka",
  label: "🤙 Шака — зорепад",
  holdFrames: 8,
  cooldownMs: 2500,

  detect(hands, debug) {
    for (const h of hands) {
      const t = thumbOut(h);
      debug[h.id] = `thumb=${t.toFixed(2)}`;
      if (
        t > THUMB_OUT &&
        isExtended(h, PINKY) &&
        isFolded(h, INDEX) &&
        isFolded(h, MIDDLE) &&
        isFolded(h, RING)
      ) {
        const p = h.points[THUMB.tip];
        return { x: p.x, y: p.y, size: h.size };
      }
    }
    return null;
  },
};
