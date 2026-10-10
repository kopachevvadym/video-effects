// 🤲 Дві розкриті долоні навпроти одна одної → енергетична куля між ними.
// Неперервний жест: куля росте, коли розводиш руки, і тріщить блискавками до пальців.
import { isOpenHand, palmCenter, dist, mid } from "../geometry.js";

const MIN_GAP = 0.6; // долоні не мають злипатися (частка довжини долоні)
const MAX_GAP = 4.5; // і не мають бути надто далеко
const TIPS = [4, 8, 12, 16, 20];

export const energyPalms = {
  name: "energyPalms",
  label: "🤲 Дві розкриті долоні — енергетична куля",
  mode: "continuous",
  exclusive: true,
  holdFrames: 5,
  graceFrames: 3,

  detect(hands, debug) {
    if (hands.length < 2) return null;
    const [a, b] = hands;
    const s = (a.size + b.size) / 2;
    const ca = palmCenter(a);
    const cb = palmCenter(b);
    const gap = dist(ca, cb) / s;
    Object.assign(debug, { open: `${isOpenHand(a)}/${isOpenHand(b)}`, gap: gap.toFixed(2) });

    if (!isOpenHand(a) || !isOpenHand(b) || gap < MIN_GAP || gap > MAX_GAP) return null;
    const c = mid(ca, cb);
    return {
      x: c.x,
      y: c.y,
      size: s,
      r: Math.max(0.35 * s, 0.32 * dist(ca, cb)),
      tips: [...TIPS.map((i) => a.points[i]), ...TIPS.map((i) => b.points[i])],
    };
  },
};
