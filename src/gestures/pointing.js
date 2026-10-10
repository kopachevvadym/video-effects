// «Чарівна паличка»: випрямлений лише вказівний палець.
// Власне правило на точках, без вбудованих жестів моделі — приклад, як описати свій жест.
import { INDEX, MIDDLE, RING, PINKY, isExtended, isFolded } from "../geometry.js";

export const pointing = {
  name: "pointing",
  label: "☝️ Вказівний палець — малювати світлом",
  mode: "continuous", // ефект отримує позицію пальця кожен кадр
  holdFrames: 4,
  graceFrames: 3,

  detect(hands) {
    for (const h of hands) {
      if (
        isExtended(h, INDEX) &&
        isFolded(h, MIDDLE) &&
        isFolded(h, RING) &&
        isFolded(h, PINKY)
      ) {
        const tip = h.points[INDEX.tip];
        return { x: tip.x, y: tip.y, size: h.size, hand: h.id };
      }
    }
    return null;
  },
};
