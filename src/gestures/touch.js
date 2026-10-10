// Руки + обличчя: торкнутись носа.
import { dist } from "../geometry.js";

const NOSE_TOUCH = 0.14; // кінчик пальця ближче до носа, ніж 0.14 ширини обличчя

/** 👃 Торкнутись носа кінчиком будь-якого пальця. */
export const noseBoop = {
  name: "noseBoop",
  label: "👃 Торкнутись носа — біп!",
  exclusive: true, // щоб палець біля носа не малював світловий слід
  holdFrames: 3,
  cooldownMs: 1500,

  detect(hands, debug, face) {
    if (!face) return null;
    let best = Infinity;
    for (const h of hands) {
      for (const tip of [4, 8, 12]) best = Math.min(best, dist(h.points[tip], face.nose) / face.size);
    }
    if (hands.length) debug.toNose = best.toFixed(2);
    if (best > NOSE_TOUCH) return null;
    return { x: face.nose.x, y: face.nose.y, size: face.size };
  },
};
