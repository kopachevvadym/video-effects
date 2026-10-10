// Effect (reaction) nodes and the camera output node.
import { energyBall } from "../runtime/effects/energyBall.js";
import { laser } from "../runtime/effects/laser.js";
import { explosion } from "../runtime/effects/explosion.js";
import { portal } from "../runtime/effects/portal.js";
import { starfall } from "../runtime/effects/starfall.js";
import { eyeGlint } from "../runtime/effects/eyeGlint.js";
import { magicTrail } from "../runtime/effects/magicTrail.js";
import { surprise, question, anger, fireBreath, sunshine, bubbles } from "../runtime/effects/faceFx.js";
import { noseHonk, sorrow, dizzy } from "../runtime/effects/touchFx.js";
import { swoosh, textPop, mindWaves } from "../runtime/effects/motionFx.js";
import { PROP_TYPES } from "./gestures.js";

const opt = (value, uk, en) => ({ value, label: { uk, en } });

export const ANCHORS = [
  opt("gesture", "Де жест", "Gesture point"),
  opt("nose", "Ніс", "Nose"),
  opt("forehead", "Лоб", "Forehead"),
  opt("mouth", "Рот", "Mouth"),
  opt("leftEye", "Ліве око", "Left eye"),
  opt("rightEye", "Праве око", "Right eye"),
  opt("center", "Центр кадру", "Frame center"),
];

/** Params every visual effect gets. `cont` effects run every frame while the input is on. */
function effectParams({ cont, hue, intensity, anchor = "gesture" }) {
  const ps = [
    { key: "anchor", type: "select", label: { uk: "Де", en: "Where" }, options: ANCHORS, default: anchor },
    { key: "scale", type: "number", label: { uk: "Розмір ×", en: "Size ×" }, default: 1, min: 0.2, max: 4, step: 0.1 },
  ];
  if (intensity) ps.push({ key: "intensity", type: "number", label: { uk: "Інтенсивність ×", en: "Intensity ×" }, default: 1, min: 0.2, max: 4, step: 0.1 });
  if (hue) ps.push({ key: "hue", type: "hue", label: { uk: "Колір", en: "Color" }, default: null });
  if (!cont) {
    ps.push(
      { key: "delayMs", type: "number", label: { uk: "Затримка, мс", en: "Delay, ms" }, default: 0, min: 0, max: 10000, step: 50 },
      { key: "cooldownMs", type: "number", label: { uk: "Пауза, мс", en: "Cooldown, ms" }, default: 800, min: 0, max: 20000, step: 100 },
      { key: "chance", type: "number", label: { uk: "Шанс, %", en: "Chance, %" }, default: 100, min: 1, max: 100, step: 1 },
    );
  }
  return ps;
}

const fx = (kind, icon, uk, en, effect, { cont = false, hue = false, intensity = false, anchor } = {}) => ({
  kind,
  category: "effect",
  icon,
  title: { uk, en },
  continuous: cont,
  params: effectParams({ cont, hue, intensity, anchor }),
  run: (layer, hit) => effect.trigger(layer, hit),
});

const VISUAL = [
  fx("energyBall", "🔮", "Енергетична куля", "Energy ball", energyBall, { cont: true, hue: true, intensity: true }),
  fx("laser", "🔴", "Лазер з ока", "Eye laser", laser, { cont: true, hue: true }),
  fx("explosion", "💥", "Вибух", "Explosion", explosion, { intensity: true }),
  fx("portal", "🌀", "Портал", "Portal", portal, { hue: true, intensity: true }),
  fx("starfall", "🌠", "Зорепад", "Shooting stars", starfall, { hue: true, intensity: true }),
  fx("eyeGlint", "✨", "Іскра", "Glint", eyeGlint, { hue: true, intensity: true }),
  fx("magicTrail", "🪄", "Світловий слід", "Light trail", magicTrail, { cont: true, hue: true }),
  fx("surprise", "😲", "Здивування «!!»", "Surprise “!!”", surprise),
  fx("question", "❓", "Знак питання", "Question mark", question, { intensity: true }),
  fx("anger", "💢", "Злість", "Anger", anger, { intensity: true }),
  fx("fireBreath", "🔥", "Вогняне дихання", "Fire breath", fireBreath, { cont: true, intensity: true, anchor: "mouth" }),
  fx("sunshine", "☀️", "Сонячні промені", "Sun rays", sunshine, { anchor: "nose" }),
  fx("bubbles", "🫧", "Бульбашки", "Bubbles", bubbles, { cont: true, intensity: true, anchor: "mouth" }),
  fx("noseHonk", "🔴", "Клоунський ніс", "Clown nose", noseHonk, { intensity: true, anchor: "nose" }),
  fx("sorrow", "😢", "Жаль (сльози)", "Sorrow (tears)", sorrow, { anchor: "forehead" }),
  fx("dizzy", "💫", "Зірочки навколо голови", "Dizzy stars", dizzy, { anchor: "forehead" }),
  fx("mindWaves", "🧠", "Хвилі думок", "Mind waves", mindWaves, { hue: true, intensity: true }),
  fx("swoosh", "💨", "Слід змаху", "Swipe swoosh", swoosh, { hue: true, intensity: true }),
  (() => {
    const d = fx("textPop", "💬", "Текст / емодзі", "Text / emoji", textPop, { hue: true });
    d.params.unshift({ key: "text", type: "text", label: { uk: "Текст", en: "Text" }, default: "👋 Hi!" });
    return d;
  })(),
];

// ---------- objects ----------

const spawnProp = {
  kind: "spawnProp",
  category: "effect",
  icon: "🎩",
  title: { uk: "Створити об'єкт", en: "Spawn object" },
  continuous: false,
  isProp: true,
  params: [
    { key: "type", type: "select", label: { uk: "Об'єкт", en: "Object" }, options: PROP_TYPES, default: "topHat" },
    {
      key: "place",
      type: "select",
      label: { uk: "Де з'явиться", en: "Appears" },
      options: [opt("hand", "У руці", "In hand"), opt("head", "Одразу на голові", "Right on head"), opt("point", "Де жест", "At gesture")],
      default: "hand",
    },
    {
      key: "release",
      type: "select",
      label: { uk: "Якщо відпустити", en: "When released" },
      options: [opt("float", "Висить у повітрі", "Floats"), opt("fall", "Падає", "Falls"), opt("vanish", "Зникає", "Vanishes")],
      default: "fall",
    },
    { key: "cooldownMs", type: "number", label: { uk: "Пауза, мс", en: "Cooldown, ms" }, default: 1500, min: 0, max: 20000, step: 100 },
  ],
};

const clearProps = {
  kind: "clearProps",
  category: "effect",
  icon: "🧹",
  title: { uk: "Прибрати об'єкти", en: "Remove objects" },
  continuous: false,
  isProp: true,
  params: [
    { key: "type", type: "select", label: { uk: "Які", en: "Which" }, options: [opt("all", "Усі", "All"), ...PROP_TYPES], default: "all" },
    { key: "cooldownMs", type: "number", label: { uk: "Пауза, мс", en: "Cooldown, ms" }, default: 800, min: 0, max: 20000, step: 100 },
  ],
};

export const EFFECTS = [...VISUAL, spawnProp, clearProps];

// ---------- camera output ----------

export const RESOLUTIONS = [
  opt("1280x720", "1280×720 (HD)", "1280×720 (HD)"),
  opt("1920x1080", "1920×1080 (Full HD)", "1920×1080 (Full HD)"),
  opt("720x1280", "720×1280 (вертикально)", "720×1280 (vertical)"),
  opt("1080x1080", "1080×1080 (квадрат)", "1080×1080 (square)"),
];

export const camera = {
  kind: "camera",
  category: "output",
  icon: "🎥",
  title: { uk: "Камера", en: "Camera" },
  params: [
    { key: "name", type: "text", label: { uk: "Назва", en: "Name" }, default: "" },
    { key: "resolution", type: "select", label: { uk: "Розмір", en: "Resolution" }, options: RESOLUTIONS, default: "1280x720" },
    {
      key: "background",
      type: "select",
      label: { uk: "Фон", en: "Background" },
      options: [opt("camera", "Відео з камери", "Camera video"), opt("green", "Зелений (хромакей)", "Green (chroma key)"), opt("black", "Чорний", "Black")],
      default: "camera",
    },
    {
      key: "hotkey",
      type: "select",
      label: { uk: "Клавіша", en: "Hotkey" },
      options: [opt("", "—", "—"), ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => opt(String(n), `Alt+${n}`, `Alt+${n}`))],
      default: "",
    },
    { key: "obsScene", type: "obsScene", label: { uk: "Сцена OBS", en: "OBS scene" }, default: "" },
  ],
};
