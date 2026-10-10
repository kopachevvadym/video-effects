// Обличчя: очі (відкрите / закрите, куди дивиться зіниця), поворот голови і точка погляду.
//
// Усі координати — пікселі екрана, вже віддзеркалені (як у дзеркалі),
// тому leftEye — це твоє ліве око, і воно на екрані ліворуч.
//
// Точність погляду з вебкамери груба: вистачає на зони екрана (ліво / центр / право,
// верх / низ), а не на конкретну кнопку. Перед використанням подивись у центр екрана
// і натисни C — це калібрування.

import { dist, mid } from "./geometry.js";

// Індекси точок Face Landmarker (478 точок)
const EYE_A = { outer: 33, inner: 133, top: 159, bottom: 145 };
const EYE_B = { outer: 263, inner: 362, top: 386, bottom: 374 };
const IRISES = [468, 473];
const NOSE = 1;
const FOREHEAD = 10;
const CHIN = 152;
const CHEEK_A = 234;
const CHEEK_B = 454;
const TEMPLE_A = 21; // same side as CHEEK_A
const TEMPLE_B = 251;
// брови: верхній контур; BROW_A — над EYE_A, BROW_B — над EYE_B
const BROW_A = [70, 63, 105, 66, 107];
const BROW_B = [300, 293, 334, 296, 336];
// рот: внутрішні краї губ і кутики
const MOUTH = { top: 13, bottom: 14, cornerA: 61, cornerB: 291, outerTop: 0, outerBottom: 17 };

export const FACE_DRAW_IDS = { EYE_A, EYE_B, IRISES, NOSE, FOREHEAD, CHIN, CHEEK_A, CHEEK_B, BROW_A, BROW_B, MOUTH };

// Налаштування. Підкручуй, дивлячись на числа в режимі D.
export const FACE_CONFIG = {
  winkRatio: 0.6, // око «закрите», якщо воно в стільки разів вужче за інше
  blinkEar: 0.14, // обидва ока вужчі за це — звичайне моргання, а не підморгування
  gazeHeadX: 2.6, // наскільки поворот голови рухає точку погляду
  gazeHeadY: 3.2,
  gazeEyeX: 2.2, // наскільки рух зіниць рухає точку погляду
  gazeEyeY: 2.6,
  gazeSmoothing: 0.18, // 0..1: менше — плавніше

  browRaise: 0.12, // брова «піднята», якщо відстань брова–око більша за норму на 12%
  browOneDiff: 0.09, // одна брова піднята, а інша — ні (різниця між ними)
  browFrownBlend: 0.4, // насуплення за оцінкою MediaPipe (browDown)
  browFrownDrop: 0.07, // або обидві брови нижчі за норму на 7%

  mouthOpen: 0.45, // рот широко відкритий: висота отвору / ширина рота
  mouthSmile: 0.55, // усмішка (оцінка MediaPipe mouthSmile)
  mouthPucker: 0.55, // губи трубочкою (оцінка MediaPipe mouthPucker)
};

const lerp = (a, b, t) => a + (b - a) * t;

function measureEye(points, ids, irisPoint) {
  const outer = points[ids.outer];
  const inner = points[ids.inner];
  const w = dist(outer, inner) || 1;
  const center = mid(outer, inner);
  return {
    center,
    width: w,
    ear: dist(points[ids.top], points[ids.bottom]) / w, // «відкритість» ока
    iris: irisPoint,
    look: { x: (irisPoint.x - center.x) / w, y: (irisPoint.y - center.y) / w }, // зміщення зіниці
  };
}

const avgPoint = (pts) => ({
  x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
  y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
});

export class FaceTracker {
  constructor() {
    this.browBase = null; // «нормальна» висота брів (підлаштовується сама, C — скинути)
    this.frames = 0;
    this.calib = { x: 0, y: 0 };
    this.raw = null; // останні «сирі» значення погляду (для калібрування)
    this.smooth = null; // згладжений стан
  }

  /** Подивись у центр екрана і виклич — точка погляду стане по центру. */
  calibrate() {
    if (this.raw) this.calib = { x: this.raw.gx, y: this.raw.gy };
    this.browBase = null; // брови теж: поточне положення стане «нормальним»
    this.frames = 0;
  }

  /**
   * @param raw  результат tracker.detect(...).face або null
   * @param toScreen функція (нормалізована точка) → точка на екрані
   */
  update(raw, toScreen, W, H) {
    if (!raw) {
      this.smooth = null;
      return null;
    }
    const C = FACE_CONFIG;
    const points = raw.landmarks.map(toScreen);

    // райдужки: беремо ту, що ближче до відповідного ока
    const cA = mid(points[EYE_A.outer], points[EYE_A.inner]);
    const [i1, i2] = IRISES.map((i) => points[i] ?? cA);
    const irisForA = dist(i1, cA) < dist(i2, cA) ? i1 : i2;
    const irisForB = irisForA === i1 ? i2 : i1;
    const eA = measureEye(points, EYE_A, irisForA);
    const eB = measureEye(points, EYE_B, irisForB);
    const [leftEye, rightEye] = eA.center.x < eB.center.x ? [eA, eB] : [eB, eA];

    // поворот голови: де ніс відносно середини обличчя
    const faceW = dist(points[CHEEK_A], points[CHEEK_B]) || 1;
    const faceH = dist(points[FOREHEAD], points[CHIN]) || 1;
    const nose = points[NOSE];
    const yaw = (nose.x - mid(points[CHEEK_A], points[CHEEK_B]).x) / faceW; // − ліво, + право
    const pitch = (nose.y - mid(points[FOREHEAD], points[CHIN]).y) / faceH; // − вгору, + вниз
    const roll = (Math.atan2(rightEye.center.y - leftEye.center.y, rightEye.center.x - leftEye.center.x) * 180) / Math.PI;

    // згладжування
    const s = this.smooth ?? {
      earL: leftEye.ear,
      earR: rightEye.ear,
      yaw,
      pitch,
      lookX: 0,
      lookY: 0,
      gazeX: W / 2,
      gazeY: H / 2,
    };
    s.earL = lerp(s.earL, leftEye.ear, 0.6);
    s.earR = lerp(s.earR, rightEye.ear, 0.6);
    s.yaw = lerp(s.yaw, yaw, 0.4);
    s.pitch = lerp(s.pitch, pitch, 0.4);

    // ---------- брови ----------
    const browA = avgPoint(BROW_A.map((i) => points[i]));
    const browB = avgPoint(BROW_B.map((i) => points[i]));
    // висота брови = відстань від брови до центру ока, у частках висоти обличчя
    const hA = dist(browA, eA.center) / faceH;
    const hB = dist(browB, eB.center) / faceH;
    const aIsLeft = eA.center.x < eB.center.x;
    const cur = aIsLeft ? { left: hA, right: hB } : { left: hB, right: hA };
    const browPts = aIsLeft ? { left: browA, right: browB } : { left: browB, right: browA };
    this.frames++;
    if (!this.browBase) this.browBase = { ...cur };
    for (const side of ["left", "right"]) {
      const ratio = cur[side] / this.browBase[side];
      // перші ~20 кадрів швидко вчимо норму, далі — повільно і лише біля нейтрального положення
      const rate = this.frames < 20 ? 0.2 : Math.abs(ratio - 1) < 0.05 ? 0.01 : 0;
      this.browBase[side] = lerp(this.browBase[side], cur[side], rate);
    }
    s.raiseL = lerp(s.raiseL ?? 0, cur.left / this.browBase.left - 1, 0.5);
    s.raiseR = lerp(s.raiseR ?? 0, cur.right / this.browBase.right - 1, 0.5);
    const bl = raw.blend ?? {};
    const frownScore = ((bl.browDownLeft ?? 0) + (bl.browDownRight ?? 0)) / 2;
    const bothRaised = s.raiseL > C.browRaise && s.raiseR > C.browRaise;
    const raisedOne =
      !bothRaised && s.raiseL - s.raiseR > C.browOneDiff && s.raiseL > C.browRaise
        ? "left"
        : !bothRaised && s.raiseR - s.raiseL > C.browOneDiff && s.raiseR > C.browRaise
          ? "right"
          : null;

    // ---------- рот ----------
    const mA = points[MOUTH.cornerA];
    const mB = points[MOUTH.cornerB];
    const mouthW = dist(mA, mB) || 1;
    const openRatio = dist(points[MOUTH.top], points[MOUTH.bottom]) / mouthW;
    s.mouthOpen = lerp(s.mouthOpen ?? openRatio, openRatio, 0.5);
    const smile = ((bl.mouthSmileLeft ?? 0) + (bl.mouthSmileRight ?? 0)) / 2;
    const pucker = bl.mouthPucker ?? 0;
    const isSmiling = smile > C.mouthSmile;
    const frown =
      !isSmiling &&
      (frownScore > C.browFrownBlend || (s.raiseL < -C.browFrownDrop && s.raiseR < -C.browFrownDrop));

    // підморгування / моргання
    const blink = s.earL < C.blinkEar && s.earR < C.blinkEar;
    const leftWink = !blink && s.earL < s.earR * C.winkRatio;
    const rightWink = !blink && s.earR < s.earL * C.winkRatio;
    leftEye.ear = s.earL;
    rightEye.ear = s.earR;
    leftEye.closed = blink || leftWink;
    rightEye.closed = blink || rightWink;

    // зіниці: беремо лише з відкритих очей (у закритому оці райдужка «стрибає»)
    const open = [leftEye, rightEye].filter((e) => !e.closed);
    if (open.length) {
      const lx = open.reduce((a, e) => a + e.look.x, 0) / open.length;
      const ly = open.reduce((a, e) => a + e.look.y, 0) / open.length;
      s.lookX = lerp(s.lookX, lx, 0.4);
      s.lookY = lerp(s.lookY, ly, 0.4);
    }

    // точка погляду = поворот голови + рух очей − калібрування
    const gx = s.yaw * C.gazeHeadX + s.lookX * C.gazeEyeX;
    const gy = s.pitch * C.gazeHeadY + s.lookY * C.gazeEyeY;
    this.raw = { gx, gy };
    const tx = Math.min(W, Math.max(0, W / 2 + (gx - this.calib.x) * W));
    const ty = Math.min(H, Math.max(0, H / 2 + (gy - this.calib.y) * H));
    s.gazeX = lerp(s.gazeX, tx, C.gazeSmoothing);
    s.gazeY = lerp(s.gazeY, ty, C.gazeSmoothing);
    this.smooth = s;

    const col = s.gazeX < W / 3 ? "left" : s.gazeX > (2 * W) / 3 ? "right" : "center";
    const row = s.gazeY < H / 3 ? "top" : s.gazeY > (2 * H) / 3 ? "bottom" : "";

    return {
      points,
      size: faceW,
      leftEye,
      rightEye,
      winking: leftWink ? "left" : rightWink ? "right" : null,
      blink,
      yaw: s.yaw,
      pitch: s.pitch,
      roll,
      gaze: { x: s.gazeX, y: s.gazeY },
      zone: row ? `${row}-${col}` : col,
      blend: raw.blend,
      top: points[FOREHEAD], // верх лоба
      nose: points[NOSE], // кінчик носа
      // вух у моделі немає, тому беремо краї обличчя на рівні вух і трохи відсуваємо назовні
      ears: (() => {
        const bridge = points[168] ?? nose;
        const out = (p) => ({ x: p.x + (p.x - bridge.x) * 0.12, y: p.y + (p.y - bridge.y) * 0.12 });
        const a = out(points[CHEEK_A]);
        const b = out(points[CHEEK_B]);
        return aIsLeft ? { left: a, right: b } : { left: b, right: a };
      })(),
      temples: { left: points[aIsLeft ? CHEEK_A : CHEEK_B], right: points[aIsLeft ? CHEEK_B : CHEEK_A] },
      // the real temples: face outline beside the eyes, a bit above them (mesh points 21 / 251, same sides as 234 / 454)
      temple: (() => {
        const a = points[TEMPLE_A] ?? points[CHEEK_A];
        const b = points[TEMPLE_B] ?? points[CHEEK_B];
        return aIsLeft ? { left: a, right: b } : { left: b, right: a };
      })(),
      brows: {
        left: { point: browPts.left, raise: s.raiseL },
        right: { point: browPts.right, raise: s.raiseR },
        bothRaised,
        raisedOne, // "left" | "right" | null
        frown,
        frownScore,
      },
      mouth: {
        center: mid(points[MOUTH.outerTop], points[MOUTH.outerBottom]),
        width: mouthW,
        open: s.mouthOpen, // ≈0 закритий, 0.1–0.3 розмова, 0.5+ широко відкритий
        isOpen: s.mouthOpen > C.mouthOpen,
        smile,
        isSmiling,
        pucker,
        isPuckered: pucker > C.mouthPucker && s.mouthOpen < C.mouthOpen,
      },
    };
  }
}
