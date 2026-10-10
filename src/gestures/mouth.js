// Рот: широко відкритий, усмішка, губи трубочкою.

const mouthDebug = (debug, face) => {
  const m = face.mouth;
  debug.mouth = `open=${m.open.toFixed(2)} smile=${m.smile.toFixed(2)} pucker=${m.pucker.toFixed(2)}`;
};

/** 😮 Широко відкритий рот → вогняне дихання в напрямку, куди повернута голова. */
export const mouthOpen = {
  name: "mouthOpen",
  label: "😮 Широко відкрити рот — вогонь",
  mode: "continuous",
  holdFrames: 5,
  graceFrames: 3,
  detect(hands, debug, face) {
    if (!face) return null;
    mouthDebug(debug, face);
    if (!face.mouth.isOpen) return null;
    const c = face.mouth.center;
    return { x: c.x, y: c.y, size: face.size, yaw: face.yaw, pitch: face.pitch, width: face.mouth.width };
  },
};

/** 😁 Широка усмішка → сонячні промені навколо голови. */
export const smile = {
  name: "smile",
  label: "😁 Широко усміхнутись — сонце",
  holdFrames: 8,
  cooldownMs: 2500,
  detect(hands, debug, face) {
    if (!face || !face.mouth.isSmiling) return null;
    const n = face.points[1];
    return { x: n.x, y: n.y, size: face.size };
  },
};

/** 😗 Губи трубочкою → мильні бульбашки з рота. */
export const pucker = {
  name: "pucker",
  label: "😗 Губи трубочкою — бульбашки",
  mode: "continuous",
  holdFrames: 6,
  graceFrames: 3,
  detect(hands, debug, face) {
    if (!face || !face.mouth.isPuckered) return null;
    const c = face.mouth.center;
    return { x: c.x, y: c.y, size: face.size, yaw: face.yaw };
  },
};
