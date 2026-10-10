// Gesture (source) nodes: each one turns the current hands / face into a "hit"
// ({ x, y, size, ... } in world pixels) or null.
import {
  THUMB, INDEX, MIDDLE, RING, PINKY,
  isExtended, isFolded, isOpenHand, isFist, thumbOut, palmCenter, dist, mid,
} from "../runtime/geometry.js";
import { handParam, forHands, handCenter, pinchRatio } from "./hands.js";

const num = (key, label, def, min, max, step = 0.01) => ({ key, type: "number", label, default: def, min, max, step });
const sel = (key, label, options, def) => ({ key, type: "select", label, options, default: def });
const opt = (value, uk, en) => ({ value, label: { uk, en } });

// ---------- hands ----------

const openPalm = {
  kind: "openPalm",
  category: "hand",
  icon: "🖐",
  title: { uk: "Розкрита долоня", en: "Open palm" },
  params: [handParam()],
  hold: 6,
  detect: ({ hands }, p) => forHands(hands, p.hand, (h) => (isOpenHand(h) ? { ...palmCenter(h), size: h.size } : null)),
};

const fist = {
  kind: "fist",
  category: "hand",
  icon: "✊",
  title: { uk: "Кулак", en: "Fist" },
  params: [handParam()],
  hold: 6,
  detect: ({ hands }, p) => forHands(hands, p.hand, (h) => (isFist(h) ? { ...palmCenter(h), size: h.size } : null)),
};

const fistToOpen = {
  kind: "fistToOpen",
  category: "hand",
  icon: "✊→🖐",
  title: { uk: "Кулак → різко розкрити", en: "Fist → snap open" },
  params: [handParam(), num("windowMs", { uk: "Вікно, мс", en: "Window, ms" }, 600, 100, 2000, 50)],
  hold: 1,
  grace: 0,
  detect: ({ hands, now }, p, state) => {
    state.lastFist ??= {};
    return forHands(hands, p.hand, (h) => {
      if (isFist(h)) {
        state.lastFist[h.id] = now;
        return null;
      }
      const t = state.lastFist[h.id] ?? -Infinity;
      if (isOpenHand(h) && now - t < p.windowMs) {
        delete state.lastFist[h.id];
        return { ...palmCenter(h), size: h.size };
      }
      return null;
    });
  },
};

const pointing = {
  kind: "pointing",
  category: "hand",
  icon: "☝️",
  title: { uk: "Вказівний палець", en: "Index finger" },
  params: [handParam()],
  hold: 4,
  grace: 3,
  detect: ({ hands }, p) =>
    forHands(hands, p.hand, (h) =>
      isExtended(h, INDEX) && isFolded(h, MIDDLE) && isFolded(h, RING) && isFolded(h, PINKY)
        ? { ...h.points[INDEX.tip], size: h.size }
        : null,
    ),
};

const okSign = {
  kind: "okSign",
  category: "hand",
  icon: "👌",
  title: { uk: "Знак «ОК»", en: "OK sign" },
  params: [handParam(), num("pinch", { uk: "Щипок <", en: "Pinch <" }, 0.3, 0.1, 0.8)],
  hold: 6,
  detect: ({ hands }, p, s, debug) =>
    forHands(hands, p.hand, (h) => {
      const r = pinchRatio(h);
      debug.push(`pinch=${r.toFixed(2)}`);
      return r < p.pinch && isExtended(h, MIDDLE) && isExtended(h, RING) && isExtended(h, PINKY)
        ? { ...mid(h.points[THUMB.tip], h.points[INDEX.tip]), size: h.size }
        : null;
    }),
};

const pinch = {
  kind: "pinch",
  category: "hand",
  icon: "🤏",
  title: { uk: "Щипок", en: "Pinch" },
  params: [handParam(), num("pinch", { uk: "Щипок <", en: "Pinch <" }, 0.35, 0.1, 0.8)],
  hold: 3,
  detect: ({ hands }, p, s, debug) =>
    forHands(hands, p.hand, (h) => {
      const r = pinchRatio(h);
      debug.push(`pinch=${r.toFixed(2)}`);
      return r < p.pinch ? { ...mid(h.points[THUMB.tip], h.points[INDEX.tip]), size: h.size } : null;
    }),
};

const shaka = {
  kind: "shaka",
  category: "hand",
  icon: "🤙",
  title: { uk: "Шака", en: "Shaka" },
  params: [handParam(), num("thumbOut", { uk: "Великий палець >", en: "Thumb out >" }, 0.7, 0.3, 1.5)],
  hold: 8,
  detect: ({ hands }, p, s, debug) =>
    forHands(hands, p.hand, (h) => {
      const t = thumbOut(h);
      debug.push(`thumb=${t.toFixed(2)}`);
      return t > p.thumbOut && isExtended(h, PINKY) && isFolded(h, INDEX) && isFolded(h, MIDDLE) && isFolded(h, RING)
        ? { ...h.points[THUMB.tip], size: h.size }
        : null;
    }),
};

const MODEL_GESTURES = [
  opt("Closed_Fist", "Кулак (модель)", "Closed fist (model)"),
  opt("Open_Palm", "Долоня (модель)", "Open palm (model)"),
  opt("Pointing_Up", "Палець вгору (модель)", "Pointing up (model)"),
  opt("Thumb_Up", "👍 (є в Реакціях macOS)", "👍 (in macOS Reactions)"),
  opt("Thumb_Down", "👎 (є в Реакціях macOS)", "👎 (in macOS Reactions)"),
  opt("Victory", "✌️ (є в Реакціях macOS)", "✌️ (in macOS Reactions)"),
  opt("ILoveYou", "🤟 I love you", "🤟 I love you"),
];

const modelGesture = {
  kind: "modelGesture",
  category: "hand",
  icon: "🤖",
  title: { uk: "Жест моделі MediaPipe", en: "MediaPipe model gesture" },
  params: [
    handParam(),
    sel("gesture", { uk: "Жест", en: "Gesture" }, MODEL_GESTURES, "ILoveYou"),
    num("minScore", { uk: "Впевненість >", en: "Score >" }, 0.6, 0.1, 1),
  ],
  hold: 6,
  detect: ({ hands }, p) =>
    forHands(hands, p.hand, (h) =>
      h.gesture === p.gesture && h.gestureScore > p.minScore ? { ...palmCenter(h), size: h.size } : null,
    ),
};

const twoPalms = {
  kind: "twoPalms",
  category: "hand",
  icon: "🤲",
  title: { uk: "Дві долоні на відстані", en: "Two palms apart" },
  params: [
    num("minGap", { uk: "Мін. відстань", en: "Min gap" }, 0.6, 0, 3),
    num("maxGap", { uk: "Макс. відстань", en: "Max gap" }, 4.5, 1, 10),
  ],
  hold: 5,
  grace: 3,
  detect: ({ hands }, p, s, debug) => {
    if (hands.length < 2) return null;
    const [a, b] = hands;
    const sz = (a.size + b.size) / 2;
    const ca = palmCenter(a);
    const cb = palmCenter(b);
    const gap = dist(ca, cb) / sz;
    debug.push(`gap=${gap.toFixed(2)}`);
    if (!isOpenHand(a) || !isOpenHand(b) || gap < p.minGap || gap > p.maxGap) return null;
    const TIPS = [4, 8, 12, 16, 20];
    return {
      ...mid(ca, cb),
      size: sz,
      hand: "both",
      r: Math.max(0.35 * sz, 0.32 * dist(ca, cb)),
      tips: [...TIPS.map((i) => a.points[i]), ...TIPS.map((i) => b.points[i])],
    };
  },
};

// ---------- face ----------

const EYE_OPTIONS = [opt("any", "Будь-яке", "Any"), opt("left", "Ліве", "Left"), opt("right", "Праве", "Right")];

const wink = {
  kind: "wink",
  category: "face",
  icon: "😉",
  title: { uk: "Підморгування", en: "Wink" },
  params: [sel("eye", { uk: "Око", en: "Eye" }, EYE_OPTIONS, "any")],
  hold: 4,
  detect: ({ face }, p, s, debug) => {
    if (!face) return null;
    debug.push(`L=${face.leftEye.ear.toFixed(2)} R=${face.rightEye.ear.toFixed(2)}`);
    if (!face.winking || (p.eye !== "any" && face.winking !== p.eye)) return null;
    const eye = face.winking === "left" ? face.leftEye : face.rightEye;
    return { ...eye.center, size: face.size * 0.6, side: face.winking };
  },
};

const eyesClosed = {
  kind: "eyesClosed",
  category: "face",
  icon: "😌",
  title: { uk: "Обидва ока закриті", en: "Both eyes closed" },
  params: [],
  hold: 20,
  detect: ({ face }) => (face?.blink ? { ...face.nose, size: face.size } : null),
};

const BROW_MODES = [
  opt("both", "Обидві підняті", "Both raised"),
  opt("left", "Ліва піднята", "Left raised"),
  opt("right", "Права піднята", "Right raised"),
  opt("one", "Одна (будь-яка)", "One (any)"),
  opt("frown", "Насуплення", "Frown"),
];

const brows = {
  kind: "brows",
  category: "face",
  icon: "🤨",
  title: { uk: "Брови", en: "Eyebrows" },
  params: [sel("mode", { uk: "Що", en: "What" }, BROW_MODES, "both")],
  hold: 5,
  detect: ({ face }, p, s, debug) => {
    if (!face) return null;
    const b = face.brows;
    debug.push(`L=${b.left.raise.toFixed(2)} R=${b.right.raise.toFixed(2)} down=${b.frownScore.toFixed(2)}`);
    const base = { size: face.size, face: face.nose, temples: face.temples };
    if (p.mode === "both" && b.bothRaised) return { ...face.top, ...base };
    if (p.mode === "frown" && b.frown) return { ...face.top, ...base };
    const one = b.raisedOne;
    if (one && (p.mode === "one" || p.mode === one)) return { ...b[one].point, ...base, side: one };
    return null;
  },
};

const MOUTH_MODES = [opt("open", "Широко відкритий", "Wide open"), opt("smile", "Усмішка", "Smile"), opt("pucker", "Трубочка", "Pucker")];

const mouth = {
  kind: "mouth",
  category: "face",
  icon: "😮",
  title: { uk: "Рот", en: "Mouth" },
  params: [sel("mode", { uk: "Що", en: "What" }, MOUTH_MODES, "open")],
  hold: 5,
  grace: 3,
  detect: ({ face }, p, s, debug) => {
    if (!face) return null;
    const m = face.mouth;
    debug.push(`open=${m.open.toFixed(2)} smile=${m.smile.toFixed(2)} pucker=${m.pucker.toFixed(2)}`);
    const on = p.mode === "open" ? m.isOpen : p.mode === "smile" ? m.isSmiling : m.isPuckered;
    if (!on) return null;
    const at = p.mode === "smile" ? face.nose : m.center;
    return { ...at, size: face.size, yaw: face.yaw, pitch: face.pitch };
  },
};

const HEAD_DIRS = [
  opt("left", "Поворот вліво", "Turn left"),
  opt("right", "Поворот вправо", "Turn right"),
  opt("up", "Вгору", "Up"),
  opt("down", "Вниз", "Down"),
  opt("tiltLeft", "Нахил вліво", "Tilt left"),
  opt("tiltRight", "Нахил вправо", "Tilt right"),
];

const headTurn = {
  kind: "headTurn",
  category: "face",
  icon: "🙂‍↔️",
  title: { uk: "Поворот голови", en: "Head turn" },
  params: [
    sel("dir", { uk: "Напрямок", en: "Direction" }, HEAD_DIRS, "left"),
    num("amount", { uk: "Сила", en: "Amount" }, 0.12, 0.03, 0.5),
  ],
  hold: 6,
  detect: ({ face }, p, s, debug) => {
    if (!face) return null;
    debug.push(`yaw=${face.yaw.toFixed(2)} pitch=${face.pitch.toFixed(2)} roll=${face.roll.toFixed(0)}°`);
    const a = p.amount;
    const rollA = a * 120; // degrees
    const on =
      (p.dir === "left" && face.yaw < -a) ||
      (p.dir === "right" && face.yaw > a) ||
      (p.dir === "up" && face.pitch < -a) ||
      (p.dir === "down" && face.pitch > a) ||
      (p.dir === "tiltLeft" && face.roll < -rollA) ||
      (p.dir === "tiltRight" && face.roll > rollA);
    return on ? { ...face.top, size: face.size } : null;
  },
};

const GAZE_ZONES = [
  opt("left", "Ліво", "Left"), opt("right", "Право", "Right"), opt("top", "Верх", "Top"),
  opt("bottom", "Низ", "Bottom"), opt("center", "Центр", "Center"),
];

const gaze = {
  kind: "gaze",
  category: "face",
  icon: "👀",
  title: { uk: "Погляд у зону", en: "Gaze at zone" },
  params: [sel("zone", { uk: "Зона", en: "Zone" }, GAZE_ZONES, "left")],
  hold: 10,
  detect: ({ face, W, H }, p, s, debug) => {
    if (!face) return null;
    const { x, y } = face.gaze;
    debug.push(`x=${(x / W).toFixed(2)} y=${(y / H).toFixed(2)}`);
    const on =
      (p.zone === "left" && x < W / 3) ||
      (p.zone === "right" && x > (2 * W) / 3) ||
      (p.zone === "top" && y < H / 3) ||
      (p.zone === "bottom" && y > (2 * H) / 3) ||
      (p.zone === "center" && x > W / 3 && x < (2 * W) / 3 && y > H / 3 && y < (2 * H) / 3);
    return on ? { x, y, size: face.size } : null;
  },
};

export const BLENDSHAPES = [
  "browDownLeft", "browDownRight", "browInnerUp", "browOuterUpLeft", "browOuterUpRight",
  "cheekPuff", "cheekSquintLeft", "cheekSquintRight", "eyeBlinkLeft", "eyeBlinkRight",
  "eyeLookDownLeft", "eyeLookDownRight", "eyeLookInLeft", "eyeLookInRight", "eyeLookOutLeft",
  "eyeLookOutRight", "eyeLookUpLeft", "eyeLookUpRight", "eyeSquintLeft", "eyeSquintRight",
  "eyeWideLeft", "eyeWideRight", "jawForward", "jawLeft", "jawOpen", "jawRight", "mouthClose",
  "mouthDimpleLeft", "mouthDimpleRight", "mouthFrownLeft", "mouthFrownRight", "mouthFunnel",
  "mouthLeft", "mouthLowerDownLeft", "mouthLowerDownRight", "mouthPressLeft", "mouthPressRight",
  "mouthPucker", "mouthRight", "mouthRollLower", "mouthRollUpper", "mouthShrugLower",
  "mouthShrugUpper", "mouthSmileLeft", "mouthSmileRight", "mouthStretchLeft", "mouthStretchRight",
  "mouthUpperUpLeft", "mouthUpperUpRight", "noseSneerLeft", "noseSneerRight",
];

const blendshape = {
  kind: "blendshape",
  category: "face",
  icon: "🎭",
  title: { uk: "Міміка (blendshape)", en: "Expression (blendshape)" },
  params: [
    sel("name", { uk: "Параметр", en: "Shape" }, BLENDSHAPES.map((b) => ({ value: b, label: { uk: b, en: b } })), "cheekPuff"),
    num("min", { uk: "Поріг >", en: "Threshold >" }, 0.5, 0.05, 1),
  ],
  hold: 5,
  detect: ({ face }, p, s, debug) => {
    if (!face) return null;
    const v = face.blend?.[p.name] ?? 0;
    debug.push(`${p.name}=${v.toFixed(2)}`);
    return v > p.min ? { ...face.nose, size: face.size } : null;
  },
};

// ---------- hands + face ----------

const FACE_POINTS = [
  opt("nose", "Ніс", "Nose"), opt("mouth", "Рот", "Mouth"), opt("leftEye", "Ліве око", "Left eye"),
  opt("rightEye", "Праве око", "Right eye"), opt("forehead", "Лоб", "Forehead"), opt("chin", "Підборіддя", "Chin"),
  opt("leftEar", "Ліве вухо", "Left ear"), opt("rightEar", "Праве вухо", "Right ear"),
  opt("leftTemple", "Ліва скроня", "Left temple"), opt("rightTemple", "Права скроня", "Right temple"),
];

/** Named point on the face, in world pixels. */
export function facePoint(face, name) {
  switch (name) {
    case "nose": return face.nose;
    case "mouth": return face.mouth.center;
    case "leftEye": return face.leftEye.center;
    case "rightEye": return face.rightEye.center;
    case "forehead": return face.top;
    case "chin": return face.points[152];
    case "leftEar": return face.ears.left;
    case "rightEar": return face.ears.right;
    case "leftTemple": return face.temple?.left ?? face.ears.left;
    case "rightTemple": return face.temple?.right ?? face.ears.right;
    default: return face.nose;
  }
}

const FINGERS = [opt("tips", "Кінчик будь-якого пальця", "Any fingertip"), opt("index", "Вказівний", "Index"), opt("palm", "Долоня", "Palm")];

const touchFace = {
  kind: "touchFace",
  category: "handFace",
  icon: "👃",
  title: { uk: "Дотик до обличчя", en: "Touch face" },
  params: [
    sel("target", { uk: "Куди", en: "Where" }, FACE_POINTS, "nose"),
    handParam(),
    sel("finger", { uk: "Чим", en: "With" }, FINGERS, "tips"),
    num("distance", { uk: "Відстань <", en: "Distance <" }, 0.14, 0.03, 0.6),
  ],
  hold: 3,
  detect: ({ hands, face }, p, s, debug) => {
    if (!face) return null;
    const target = facePoint(face, p.target);
    let best = Infinity;
    const hit = forHands(hands, p.hand, (h) => {
      const pts = p.finger === "index" ? [h.points[8]] : p.finger === "palm" ? [palmCenter(h)] : [4, 8, 12].map((i) => h.points[i]);
      const d = Math.min(...pts.map((q) => dist(q, target))) / face.size;
      best = Math.min(best, d);
      return d < p.distance ? { ...target, size: face.size } : null;
    });
    if (hands.length) debug.push(`d=${best.toFixed(2)}`);
    return hit;
  },
};

/** Index finger to the temple ("thinking", "mind reading"). */
const fingerToTemple = {
  kind: "fingerToTemple",
  category: "handFace",
  icon: "🫡",
  title: { uk: "Палець до скроні", en: "Finger to temple" },
  params: [
    sel("side", { uk: "Скроня", en: "Temple" }, [opt("any", "Будь-яка", "Any"), opt("left", "Ліва", "Left"), opt("right", "Права", "Right")], "any"),
    handParam(),
    sel(
      "pose",
      { uk: "Поза руки", en: "Hand pose" },
      [opt("point", "Лише вказівний випрямлений", "Only the index finger straight"), opt("any", "Будь-яка", "Any")],
      "point",
    ),
    num("distance", { uk: "Відстань <", en: "Distance <" }, 0.22, 0.05, 0.6),
  ],
  hold: 6,
  detect: ({ hands, face }, p, s, debug) => {
    if (!face?.temple) return null;
    const sides = p.side === "any" ? ["left", "right"] : [p.side];
    let best = Infinity;
    const hit = forHands(hands, p.hand, (h) => {
      if (p.pose === "point" && !(isExtended(h, INDEX) && [MIDDLE, RING, PINKY].filter((f) => isFolded(h, f)).length >= 2)) return null;
      const tip = h.points[INDEX.tip];
      for (const side of sides) {
        const t = face.temple[side];
        const d = dist(tip, t) / face.size;
        best = Math.min(best, d);
        if (d < p.distance) return { x: t.x, y: t.y, size: face.size, side, temple: side };
      }
      return null;
    });
    if (hands.length) debug.push(`d=${Number.isFinite(best) ? best.toFixed(2) : "–"}`);
    return hit;
  },
};

const facepalm = {
  kind: "facepalm",
  category: "handFace",
  icon: "🤦",
  title: { uk: "Долоня на лобі", en: "Palm on forehead" },
  params: [handParam(), num("near", { uk: "Відстань <", en: "Distance <" }, 0.38, 0.1, 1)],
  hold: 5,
  detect: ({ hands, face }, p, s, debug) => {
    if (!face) return null;
    const browMid = mid(face.brows.left.point, face.brows.right.point);
    const forehead = mid(face.top, browMid);
    const eyeY = (face.leftEye.center.y + face.rightEye.center.y) / 2;
    return forHands(hands, p.hand, (h) => {
      const c = handCenter(h);
      const near = dist(c, forehead) / face.size;
      const straight = [INDEX, MIDDLE, RING, PINKY].filter((f) => isExtended(h, f)).length;
      debug.push(`d=${near.toFixed(2)} fingers=${straight}`);
      return near < p.near && straight >= 3 && c.y < eyeY ? { ...face.top, size: face.size } : null;
    });
  },
};

// ---------- objects ----------

export const PROP_TYPES = [
  opt("topHat", "Циліндр", "Top hat"),
  opt("partyHat", "Святковий ковпак", "Party hat"),
  opt("crown", "Корона", "Crown"),
  opt("sunglasses", "Окуляри", "Sunglasses"),
  opt("mustache", "Вуса", "Mustache"),
];

const propOnHead = {
  kind: "propOnHead",
  category: "object",
  icon: "🎩",
  title: { uk: "Об'єкт на голові", en: "Object on head" },
  params: [sel("type", { uk: "Об'єкт", en: "Object" }, [opt("any", "Будь-який", "Any"), ...PROP_TYPES], "any")],
  hold: 1,
  grace: 0,
  detect: ({ props }) => {
    const o = props?.objects.find((x) => x.attached === "head" && x.settled);
    return o ? { x: o.x, y: o.y, size: o.w } : null;
  },
};
propOnHead.detect = ({ props }, p) => {
  const o = props?.objects.find((x) => x.attached === "head" && x.settled && (p.type === "any" || x.type === p.type));
  return o ? { x: o.x, y: o.y, size: o.w } : null;
};

const propInHand = {
  kind: "propInHand",
  category: "object",
  icon: "🫴",
  title: { uk: "Об'єкт у руці", en: "Object in hand" },
  params: [sel("type", { uk: "Об'єкт", en: "Object" }, [opt("any", "Будь-який", "Any"), ...PROP_TYPES], "any")],
  hold: 1,
  grace: 0,
  detect: ({ props }, p) => {
    const o = props?.objects.find((x) => x.attached === "hand" && (p.type === "any" || x.type === p.type));
    return o ? { x: o.x, y: o.y, size: o.w } : null;
  },
};

// ---------- manual inputs ----------

const KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((k) => opt(`Key${k}`, k, k));

const keyPress = {
  kind: "keyPress",
  category: "input",
  icon: "⌨️",
  title: { uk: "Клавіша", en: "Key" },
  params: [sel("key", { uk: "Клавіша", en: "Key" }, KEYS, "KeyX")],
  hold: 1,
  grace: 0,
  detect: ({ keys, W, H, face }, p) => (keys.has(p.key) ? { ...(face?.nose ?? { x: W / 2, y: H / 2 }), size: face?.size ?? 250 } : null),
};

const always = {
  kind: "always",
  category: "input",
  icon: "∞",
  title: { uk: "Завжди увімкнено", en: "Always on" },
  params: [],
  hold: 1,
  grace: 0,
  detect: ({ W, H, face }) => ({ ...(face?.nose ?? { x: W / 2, y: H / 2 }), size: face?.size ?? 250 }),
};

const SWITCH_KEYS = [opt("", "—", "—"), ...KEYS];

/** On/off switch (on by default). Wire it into "enable" inputs to turn nodes off with one click. */
const switchNode = {
  kind: "switch",
  category: "input",
  icon: "⏻",
  title: { uk: "Вимикач", en: "Switch" },
  params: [
    { key: "label", type: "text", label: { uk: "Підпис", en: "Label" }, default: "" },
    { key: "on", type: "bool", label: { uk: "Увімкнено", en: "On" }, default: true },
    { key: "key", type: "select", label: { uk: "Клавіша-перемикач", en: "Toggle key" }, options: SWITCH_KEYS, default: "" },
  ],
  hold: 1,
  grace: 0,
  detect: ({ W, H, face }, p) => (p.on ? { ...(face?.nose ?? { x: W / 2, y: H / 2 }), size: face?.size ?? 250 } : null),
};

export const GESTURES = [
  openPalm, fist, fistToOpen, pointing, okSign, pinch, shaka, modelGesture, twoPalms,
  wink, eyesClosed, brows, mouth, headTurn, gaze, blendshape,
  touchFace, fingerToTemple, facepalm,
  propOnHead, propInHand,
  keyPress, always, switchNode,
];
