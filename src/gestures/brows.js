// Брови: обидві підняті, одна піднята (ліва / права), насуплення.
// Норма висоти брів вивчається сама в перші секунди; C — скинути на поточне обличчя.

const browDebug = (debug, face) => {
  const b = face.brows;
  debug.brows = `L=${b.left.raise.toFixed(2)} R=${b.right.raise.toFixed(2)} down=${b.frownScore.toFixed(2)}`;
};

export const browsUp = {
  name: "browsUp",
  label: "😲 Підняти обидві брови — здивування",
  holdFrames: 5,
  cooldownMs: 1500,
  detect(hands, debug, face) {
    if (!face) return null;
    browDebug(debug, face);
    if (!face.brows.bothRaised) return null;
    return { x: face.top.x, y: face.top.y, size: face.size, face: face.points[1] };
  },
};

function makeOneBrow(side) {
  return {
    name: `brow-${side}`,
    label: side === "left" ? "🤨 Підняти ліву брову — «?»" : "🤨 Підняти праву брову — «?»",
    holdFrames: 5,
    cooldownMs: 1200,
    detect(hands, debug, face) {
      if (!face || face.brows.raisedOne !== side) return null;
      const p = face.brows[side].point;
      return { x: p.x, y: p.y, size: face.size, side };
    },
  };
}

export const browLeft = makeOneBrow("left");
export const browRight = makeOneBrow("right");

export const frown = {
  name: "frown",
  label: "😠 Насупитись — злість",
  holdFrames: 8,
  cooldownMs: 2000,
  detect(hands, debug, face) {
    if (!face || !face.brows.frown) return null;
    return { x: face.top.x, y: face.top.y, size: face.size, temples: face.temples };
  },
};
