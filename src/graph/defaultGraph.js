// The graph you get on first launch (and after "Reset"): every gesture from the
// pre-editor version, wired the same way, plus examples of the new features.

const COL = { gesture: 0, logic: 300, effect: 600, camera: 950, merge: 1400 };
const ROW = 150;

export function createDefaultGraph() {
  const uk = false; // names are stored in English and shown localized (see names.js)
  const nodes = [];
  const edges = [];
  let row = 0;
  const node = (id, kind, col, r, params = {}) => {
    nodes.push({ id, type: undefined, position: { x: COL[col], y: r * ROW }, data: { kind, params } });
    return id;
  };
  const edge = (source, target, sourceHandle = "out", targetHandle = "trigger") =>
    edges.push({ id: `e-${source}-${sourceHandle}-${target}-${targetHandle}`, source, target, sourceHandle, targetHandle });
  const toCam = (effectId, cam) => edge(effectId, cam, "video", "video");

  // cameras
  node("cam-hands", "camera", "camera", 2, { name: uk ? "Руки" : "Hands", hotkey: "1" });
  node("cam-face", "camera", "camera", 16, { name: uk ? "Міміка" : "Face", hotkey: "2" });
  node("cam-all", "camera", "merge", 9, { name: uk ? "Все разом" : "All together", hotkey: "3" });
  edge("cam-hands", "cam-all", "video", "video");
  edge("cam-face", "cam-all", "video", "video");

  // ---------- hands ----------
  node("g-palms", "twoPalms", "gesture", row);
  node("fx-ball", "energyBall", "effect", row++);
  edge("g-palms", "fx-ball");
  toCam("fx-ball", "cam-hands");

  // laser = wink AND pointing (combination of two gestures)
  node("g-aim-wink", "wink", "gesture", row, { eye: "any" });
  node("g-aim-point", "pointing", "gesture", row + 1, { hand: "any" });
  node("l-aim", "and", "logic", row, { anchor: "b" });
  node("fx-laser", "laser", "effect", row);
  edge("g-aim-wink", "l-aim", "out", "a");
  edge("g-aim-point", "l-aim", "out", "b");
  edge("l-aim", "fx-laser");
  toCam("fx-laser", "cam-hands");
  row += 2;

  node("g-burst", "fistToOpen", "gesture", row);
  node("fx-boom", "explosion", "effect", row++);
  edge("g-burst", "fx-boom");
  toCam("fx-boom", "cam-hands");

  node("g-ok", "okSign", "gesture", row);
  node("fx-portal", "portal", "effect", row++);
  edge("g-ok", "fx-portal");
  toCam("fx-portal", "cam-hands");

  node("g-shaka", "shaka", "gesture", row);
  node("fx-stars", "starfall", "effect", row++);
  edge("g-shaka", "fx-stars");
  toCam("fx-stars", "cam-hands");

  // drawing with the index finger — switched on/off by a state ("drawing")
  node("g-fists", "fist", "gesture", row, { hand: "both" });
  node("s-draw-set", "setVar", "logic", row, { name: "drawing" });
  edge("g-fists", "s-draw-set", "out", "toggle");
  row++;
  node("s-draw-get", "getVar", "logic", row, { name: "drawing" });
  node("g-draw", "pointing", "gesture", row + 1, { hand: "any" });
  node("fx-trail", "magicTrail", "effect", row + 1);
  edge("s-draw-get", "g-draw", "out", "enable");
  edge("g-draw", "fx-trail");
  toCam("fx-trail", "cam-hands");
  edge("l-aim", "g-draw", "out", "block"); // while aiming the laser, don't draw
  row += 2;

  // objects: 🤟 spawns a top hat in the hand → bring it to the head
  node("sw-hat", "switch", "logic", row, { label: uk ? "Капелюх" : "Hat", on: true });
  node("g-hat", "modelGesture", "gesture", row, { gesture: "ILoveYou", hand: "any" });
  edge("sw-hat", "g-hat", "out", "enable");
  node("fx-hat", "spawnProp", "effect", row++, { type: "topHat", place: "hand", release: "fall" });
  edge("g-hat", "fx-hat");
  toCam("fx-hat", "cam-hands");

  node("g-worn", "propOnHead", "gesture", row, { type: "any" });
  node("fx-worn", "eyeGlint", "effect", row++, { anchor: "forehead", scale: 1.6, hue: 45 });
  edge("g-worn", "fx-worn");
  toCam("fx-worn", "cam-hands");

  node("g-clear", "eyesClosed", "gesture", row, { hold: 30 });
  node("fx-clear", "clearProps", "effect", row++, { type: "all" });
  edge("g-clear", "fx-clear");
  toCam("fx-clear", "cam-hands");

  // ---------- face ----------
  row += 1;
  node("g-nose", "touchFace", "gesture", row, { target: "nose" });
  node("fx-nose", "noseHonk", "effect", row++);
  edge("g-nose", "fx-nose");
  toCam("fx-nose", "cam-face");
  edge("g-nose", "g-draw", "out", "block"); // a finger on the nose shouldn't draw

  node("g-facepalm", "facepalm", "gesture", row);
  node("fx-sorrow", "sorrow", "effect", row++);
  edge("g-facepalm", "fx-sorrow");
  toCam("fx-sorrow", "cam-face");

  node("g-wink-l", "wink", "gesture", row, { eye: "left" });
  node("fx-wink-l", "eyeGlint", "effect", row++);
  edge("g-wink-l", "fx-wink-l");
  toCam("fx-wink-l", "cam-face");
  edge("l-aim", "g-wink-l", "out", "block");

  node("g-wink-r", "wink", "gesture", row, { eye: "right" });
  node("fx-wink-r", "eyeGlint", "effect", row++);
  edge("g-wink-r", "fx-wink-r");
  toCam("fx-wink-r", "cam-face");
  edge("l-aim", "g-wink-r", "out", "block");

  const browRows = [
    ["both", "surprise"],
    ["left", "question"],
    ["right", "question"],
    ["frown", "anger"],
  ];
  for (const [mode, effect] of browRows) {
    node(`g-brow-${mode}`, "brows", "gesture", row, { mode });
    node(`fx-brow-${mode}`, effect, "effect", row++);
    edge(`g-brow-${mode}`, `fx-brow-${mode}`);
    toCam(`fx-brow-${mode}`, "cam-face");
    edge("g-facepalm", `g-brow-${mode}`, "out", "block"); // a palm on the forehead moves the brows
  }

  node("sw-mouth", "switch", "logic", row + 1, { label: uk ? "Рот" : "Mouth", on: true, key: "KeyM" });
  for (const [mode, effect] of [
    ["open", "fireBreath"],
    ["smile", "sunshine"],
    ["pucker", "bubbles"],
  ]) {
    node(`g-mouth-${mode}`, "mouth", "gesture", row, { mode });
    node(`fx-mouth-${mode}`, effect, "effect", row++);
    edge(`g-mouth-${mode}`, `fx-mouth-${mode}`);
    edge("sw-mouth", `g-mouth-${mode}`, "out", "enable");
    toCam(`fx-mouth-${mode}`, "cam-face");
  }

  node("g-temple", "fingerToTemple", "gesture", row);
  node("fx-temple", "mindWaves", "effect", row++);
  edge("g-temple", "fx-temple");
  toCam("fx-temple", "cam-face");
  edge("g-temple", "g-draw", "out", "block"); // a finger at the temple shouldn't draw

  // ---------- scenes: show 1–5 fingers (held still, fingers up) → the camera with Alt+N ----------
  node("sw-scenes", "switch", "logic", row, { label: uk ? "Сцени" : "Scenes", on: true, key: "KeyS" });
  node("g-fingers", "fingerCount", "gesture", row, { count: "any" });
  node("act-scene", "switchCamera", "effect", row++, { target: "fingers" });
  edge("sw-scenes", "g-fingers", "out", "enable");
  edge("g-fingers", "act-scene");
  // don't switch while aiming the laser, drawing, or with a finger on the nose / temple
  for (const src of ["l-aim", "s-draw-get", "g-nose", "g-temple"]) edge(src, "g-fingers", "out", "block");
  row += 1;

  // ---------- motions (movement over time, not a pose) ----------
  // One switch (key N) turns every motion off; they also pause while drawing,
  // because drawing moves the hand a lot.
  row += 1;
  node("sw-motion", "switch", "logic", row + 2, { label: uk ? "Рухи" : "Motions", on: true, key: "KeyN" });
  const motion = (id, kind, params, fxId, effect, fxParams, cam = "cam-hands") => {
    node(id, kind, "gesture", row);
    nodes[nodes.length - 1].data.params = params;
    node(fxId, effect, "effect", row++, fxParams);
    edge(id, fxId);
    edge("sw-motion", id, "out", "enable");
    if (cam === "cam-hands") edge("s-draw-get", id, "out", "block");
    toCam(fxId, cam);
  };
  // the same movement in different directions → different reactions
  motion("m-swipe-up", "swipe", { dir: "up" }, "fx-swipe-up", "swoosh", { hue: 45, cooldownMs: 300 });
  motion("m-swipe-down", "swipe", { dir: "down" }, "fx-swipe-down", "swoosh", { hue: 205, cooldownMs: 300 });
  motion("m-swipe-left", "swipe", { dir: "left" }, "fx-swipe-left", "swoosh", { hue: 320, cooldownMs: 300 });
  motion("m-swipe-right", "swipe", { dir: "right" }, "fx-swipe-right", "swoosh", { hue: 140, cooldownMs: 300 });
  motion("m-wave", "wave", {}, "fx-wave", "textPop", { text: "👋 Hi!", hue: 50 });
  motion("m-circle", "circle", {}, "fx-circle", "portal", { hue: 280 });
  motion("m-push", "push", { dir: "push" }, "fx-push", "explosion", { scale: 0.7 });
  motion("m-nod", "headGesture", { type: "nod" }, "fx-nod", "textPop", { text: "✓ Yes", hue: 130, anchor: "forehead" }, "cam-face");
  motion("m-shake", "headGesture", { type: "shake" }, "fx-shake", "textPop", { text: "✗ No", hue: 0, anchor: "forehead" }, "cam-face");

  return {
    version: 1,
    migrations: ["motions-1", "temple-1", "scenes-1"],
    nodes,
    edges,
    variables: { drawing: false },
    activeCamera: "cam-all",
  };
}
