// 🎯 Комбінований жест: закрите одне око + вказівний палець → лазер з відкритого ока крізь палець.
// Приклад жесту, що поєднує обличчя і руки.
import { INDEX, MIDDLE, RING, PINKY, isExtended, isFolded } from "../geometry.js";

export const aimLaser = {
  name: "aimLaser",
  label: "🎯 Закрите око + вказівний палець — лазер",
  mode: "continuous",
  exclusive: true, // поки цілишся, звичайні підморгування і слід пальця не спрацьовують
  holdFrames: 3,
  graceFrames: 4,

  detect(hands, debug, face) {
    if (!face || !face.winking) return null;
    const h = hands.find(
      (h) => isExtended(h, INDEX) && isFolded(h, MIDDLE) && isFolded(h, RING) && isFolded(h, PINKY),
    );
    if (!h) return null;
    const eye = face.winking === "left" ? face.rightEye : face.leftEye; // цілимось відкритим оком
    const tip = h.points[INDEX.tip];
    return { x: tip.x, y: tip.y, from: eye.center, size: h.size, side: face.winking };
  },
};
