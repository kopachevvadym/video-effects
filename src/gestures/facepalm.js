// 🤦 Фейспалм: розкрита долоня лежить на лобі.
import { INDEX, MIDDLE, RING, PINKY, isExtended, dist, mid } from "../geometry.js";

const NEAR = 0.38; // центр руки ближче до центру лоба, ніж 0.38 ширини обличчя

export const facepalm = {
  name: "facepalm",
  label: "🤦 Долоня на лоб — жаль (сльози)",
  exclusive: true, // рука на лобі зсуває брови — щоб не спрацювали «здивування» чи «злість»
  holdFrames: 5,
  cooldownMs: 3000,

  detect(hands, debug, face) {
    if (!face) return null;
    // центр лоба: між верхом лоба і серединою брів
    const browMid = mid(face.brows.left.point, face.brows.right.point);
    const forehead = mid(face.top, browMid);
    const eyeY = (face.leftEye.center.y + face.rightEye.center.y) / 2;

    for (const h of hands) {
      // центр усієї руки (разом з пальцями), а не лише долоні: пальці лежать поперек лоба
      const c = {
        x: h.points.reduce((a, p) => a + p.x, 0) / h.points.length,
        y: h.points.reduce((a, p) => a + p.y, 0) / h.points.length,
      };
      const near = dist(c, forehead) / face.size;
      const straight = [INDEX, MIDDLE, RING, PINKY].filter((f) => isExtended(h, f)).length;
      debug[h.id] = `toForehead=${near.toFixed(2)} fingers=${straight}`;
      if (near < NEAR && straight >= 3 && c.y < eyeY) {
        return { x: face.top.x, y: face.top.y, size: face.size };
      }
    }
    return null;
  },
};
