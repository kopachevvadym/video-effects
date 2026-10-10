// Допоміжна геометрія для опису жестів.
//
// Індекси 21 точки руки (MediaPipe):
//   0 зап'ястя
//   великий:   1 CMC, 2 MCP, 3 IP,  4 кінчик
//   вказівний: 5 MCP, 6 PIP, 7 DIP, 8 кінчик
//   середній:  9 MCP, 10 PIP, 11 DIP, 12 кінчик
//   безіменний: 13 MCP, 14 PIP, 15 DIP, 16 кінчик
//   мізинець:  17 MCP, 18 PIP, 19 DIP, 20 кінчик
//
// Координати hand.points — пікселі екрана (вже віддзеркалені, як у дзеркалі).
// hand.size — довжина долоні (зап'ястя → основа середнього пальця) у пікселях.
// Усі пороги в жестах задавай відносно hand.size, тоді вони не залежать
// від відстані до камери.

export const WRIST = 0;
export const THUMB = { mcp: 2, ip: 3, tip: 4 };
export const INDEX = { mcp: 5, pip: 6, dip: 7, tip: 8 };
export const MIDDLE = { mcp: 9, pip: 10, dip: 11, tip: 12 };
export const RING = { mcp: 13, pip: 14, dip: 15, tip: 16 };
export const PINKY = { mcp: 17, pip: 18, dip: 19, tip: 20 };

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Палець випрямлений: кінчик помітно далі від зап'ястя, ніж середній суглоб. */
export function isExtended(hand, finger) {
  const w = hand.points[WRIST];
  return dist(hand.points[finger.tip], w) > dist(hand.points[finger.pip], w) * 1.15;
}

/** Палець зігнутий: кінчик ближче до зап'ястя, ніж середній суглоб. */
export function isFolded(hand, finger) {
  const w = hand.points[WRIST];
  return dist(hand.points[finger.tip], w) < dist(hand.points[finger.pip], w);
}

const FOUR_FINGERS = [INDEX, MIDDLE, RING, PINKY];

/** Долоня розкрита: усі чотири пальці (без великого) випрямлені. */
export const isOpenHand = (hand) => FOUR_FINGERS.every((f) => isExtended(hand, f));

/** Кулак: усі чотири пальці зігнуті. */
export const isFist = (hand) => FOUR_FINGERS.every((f) => isFolded(hand, f));

/** Великий палець відставлений убік: кінчик далеко від основи вказівного (частка долоні). */
export const thumbOut = (hand) => dist(hand.points[THUMB.tip], hand.points[INDEX.mcp]) / hand.size;

/** Центр долоні: середнє зап'ястя й основ пальців. */
export function palmCenter(hand) {
  const ids = [0, 5, 9, 13, 17];
  const x = ids.reduce((s, i) => s + hand.points[i].x, 0) / ids.length;
  const y = ids.reduce((s, i) => s + hand.points[i].y, 0) / ids.length;
  return { x, y };
}

/** Мінімальна відстань між будь-якими точками з двох наборів індексів. */
export function minDist(handA, idsA, handB, idsB) {
  let best = Infinity;
  for (const i of idsA) for (const j of idsB) best = Math.min(best, dist(handA.points[i], handB.points[j]));
  return best;
}

export const rand = (min, max) => min + Math.random() * (max - min);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
