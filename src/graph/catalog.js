// Registry of every node kind the editor knows about.
import { GESTURES } from "./gestures.js";
import { LOGIC } from "./logic.js";
import { MOTIONS } from "./motion.js";
import { EFFECTS, camera } from "./effects.js";

export const CATEGORIES = {
  hand: { uk: "Руки", en: "Hands", color: "#2dd4bf" },
  face: { uk: "Обличчя", en: "Face", color: "#a78bfa" },
  motion: { uk: "Рухи", en: "Motions", color: "#38bdf8" },
  handFace: { uk: "Руки + обличчя", en: "Hands + face", color: "#60a5fa" },
  object: { uk: "Об'єкти", en: "Objects", color: "#fbbf24" },
  input: { uk: "Вручну", en: "Manual", color: "#94a3b8" },
  logic: { uk: "Логіка й час", en: "Logic & timing", color: "#f59e0b" },
  state: { uk: "Стани (перемикачі)", en: "States (switches)", color: "#22c55e" },
  effect: { uk: "Реакції", en: "Reactions", color: "#f472b6" },
  output: { uk: "Камера", en: "Camera", color: "#ef4444" },
};

/** React Flow node type for a definition. */
export const nodeTypeOf = (def) =>
  def.category === "logic" || def.category === "state" ? "logic" : def.category === "effect" ? "effect" : def.category === "output" ? "camera" : "gesture";

export const ALL_DEFS = [...GESTURES.filter((d) => d.category !== "input"), ...MOTIONS, ...GESTURES.filter((d) => d.category === "input"), ...LOGIC, ...EFFECTS, camera];
export const CATALOG = Object.fromEntries(ALL_DEFS.map((d) => [d.kind, d]));

/** Params with defaults filled in. */
export function withDefaults(def, params = {}) {
  const out = {};
  for (const p of def.params ?? []) out[p.key] = params[p.key] ?? p.default;
  out.hold = params.hold ?? def.hold ?? 6;
  out.grace = params.grace ?? def.grace ?? 2;
  return out;
}

/** Inputs (target handles) for a definition. */
export function inputsOf(def) {
  const t = nodeTypeOf(def);
  if (t === "gesture")
    return [
      { id: "enable", label: { uk: "дозвіл", en: "enable" }, kind: "signal" },
      { id: "block", label: { uk: "блок", en: "block" }, kind: "signal" },
    ];
  if (t === "logic") return (def.inputs ?? []).map((i) => ({ ...i, kind: "signal" }));
  if (t === "effect")
    return [
      { id: "trigger", label: { uk: "запуск", en: "trigger" }, kind: "signal" },
      { id: "enable", label: { uk: "дозвіл", en: "enable" }, kind: "signal" },
      { id: "block", label: { uk: "блок", en: "block" }, kind: "signal" },
    ];
  return [{ id: "video", label: { uk: "ефекти / камери", en: "effects / cameras" }, kind: "video" }];
}

/** Outputs (source handles) for a definition. */
export function outputsOf(def) {
  const t = nodeTypeOf(def);
  if (t === "effect")
    return [
      { id: "video", label: { uk: "у камеру", en: "to camera" }, kind: "video" },
      { id: "fired", label: { uk: "спрацював", en: "fired" }, kind: "signal" },
    ];
  if (t === "camera") return [{ id: "video", label: { uk: "у камеру", en: "to camera" }, kind: "video" }];
  return [{ id: "out", label: { uk: "", en: "" }, kind: "signal" }];
}

export const handleKind = (def, handleId, side) =>
  (side === "source" ? outputsOf(def) : inputsOf(def)).find((h) => h.id === handleId)?.kind ?? "signal";
