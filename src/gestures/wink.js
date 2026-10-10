// 😉 Підморгування лівим або правим оком.
// Жести отримують третім параметром face (див. src/face.js) — так само можна
// робити будь-які жести обличчям: поворот голови, погляд у куток, нахил тощо.

function makeWink(side) {
  const label = side === "left" ? "😉 Підморгнути лівим оком — іскра" : "😉 Підморгнути правим оком — іскра";
  return {
    name: `wink-${side}`,
    label,
    holdFrames: 4,
    cooldownMs: 900,

    detect(hands, debug, face) {
      if (!face) return null;
      debug.ear = `L=${face.leftEye.ear.toFixed(2)} R=${face.rightEye.ear.toFixed(2)}`;
      if (face.winking !== side) return null;
      const eye = side === "left" ? face.leftEye : face.rightEye;
      return { x: eye.center.x, y: eye.center.y, size: face.size * 0.6, side };
    },
  };
}

export const winkLeft = makeWink("left");
export const winkRight = makeWink("right");
