// Attachable objects ("props"): a hat you can hold in your hand, bring to your
// head, and it stays there following the head; pinch it to take it back.
//
// States:
//   hand — follows a hand (on the palm, or between thumb and index when pinched)
//   head — sits on its head slot (top of head / eyes / upper lip), follows head pose
//   free — left in the air (or falling / fading, depending on the "release" setting)
import { PROP_ART } from "./propsArt.js";
import { dist, mid, palmCenter } from "./geometry.js";

export const PROP_CONFIG = {
  grabPinch: 0.35, // pinch closer than this (in palm lengths) grabs an object
  releasePinch: 0.55, // opening wider than this releases a pinched object
  grabReach: 0.55, // how close the pinch must be to the object (in object widths)
  snapDistance: 0.45, // how close to the head slot an object snaps on (in face widths)
};

let nextId = 1;
const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/** Where an object of the given art sits on the head: point, width, rotation. */
export function headSlot(face, art) {
  const roll = (face.roll * Math.PI) / 180;
  const up = { x: Math.sin(roll), y: -Math.cos(roll) };
  let p;
  if (art.slot === "eyes") p = mid(face.leftEye.center, face.rightEye.center);
  else if (art.slot === "lip") p = mid(face.nose, face.points[13] ?? face.mouth.center);
  else p = { x: face.top.x + up.x * face.size * 0.03, y: face.top.y + up.y * face.size * 0.03 };
  return { x: p.x, y: p.y, w: face.size * art.widthK, rot: roll };
}

function handGrip(h) {
  const pinch = dist(h.points[4], h.points[8]) / h.size;
  if (pinch < PROP_CONFIG.releasePinch) return { ...mid(h.points[4], h.points[8]), pinch };
  // resting on the palm: a bit above the palm center, "up" along the hand
  const c = palmCenter(h);
  return { x: c.x, y: c.y - h.size * 0.25, pinch };
}

export class PropSystem {
  constructor() {
    this.objects = [];
    this.pinching = new Map(); // hand id → was pinching on the previous frame
  }

  /**
   * @param {object} o
   * @param {string} o.type      key of PROP_ART
   * @param {"hand"|"head"|"point"} o.place
   * @param {object} o.hit       gesture hit (x, y, handId)
   * @param {Set<string>} o.outputs camera node ids that draw this object
   * @param {"float"|"fall"|"vanish"} o.release what happens when let go away from the head
   * @param {boolean} o.replace  remove existing objects of the same type first
   */
  spawn({ type, place, hit, outputs, release = "float", replace = true }, world) {
    const art = PROP_ART[type];
    if (!art) return;
    if (replace) this.objects = this.objects.filter((o) => o.type !== type);
    const face = world.face;
    const w = face ? face.size * art.widthK : 200 * art.widthK;
    const o = {
      id: nextId++,
      type,
      art,
      outputs,
      release,
      attached: "free",
      handId: null,
      x: hit?.x ?? world.W / 2,
      y: hit?.y ?? world.H / 2,
      w,
      rot: 0,
      alpha: 0,
      armed: true, // may snap to the head
      settled: false,
      vy: 0,
      pinched: false,
      lostAt: null,
      born: world.now,
    };
    if (place === "head" && face) {
      o.attached = "head";
      Object.assign(o, headSlot(face, art));
    } else if (place === "hand") {
      const h =
        world.hands.find((x) => x.id === hit?.handId) ??
        world.hands.slice().sort((a, b) => dist(palmCenter(a), hit ?? a.points[0]) - dist(palmCenter(b), hit ?? b.points[0]))[0];
      if (h) {
        o.attached = "hand";
        o.handId = h.id;
        Object.assign(o, handGrip(h));
      }
    }
    this.objects.push(o);
  }

  clear(type = "all") {
    for (const o of this.objects) if (type === "all" || o.type === type) o.removing = true;
  }

  update({ hands, face, dt, now, H }) {
    const C = PROP_CONFIG;
    // which hands just started a pinch this frame
    const pinchStart = new Map();
    for (const h of hands) {
      const r = dist(h.points[4], h.points[8]) / h.size;
      const was = this.pinching.get(h.id) ?? false;
      const isP = was ? r < C.releasePinch : r < C.grabPinch;
      this.pinching.set(h.id, isP);
      if (isP && !was) pinchStart.set(h.id, h);
    }

    for (const o of this.objects) {
      o.alpha = Math.min(1, o.alpha + dt * 5);
      if (o.removing) {
        o.alpha -= dt * 8;
        continue;
      }

      // grab: a pinch starting on a free / worn object takes it into the hand
      if (o.attached !== "hand") {
        for (const h of pinchStart.values()) {
          const g = mid(h.points[4], h.points[8]);
          if (dist(g, o) < C.grabReach * o.w) {
            o.attached = "hand";
            o.handId = h.id;
            o.pinched = true;
            o.armed = false; // must move away from the head before it can snap back
            o.settled = false;
            pinchStart.delete(h.id);
            break;
          }
        }
      }

      if (o.attached === "hand") {
        const h = hands.find((x) => x.id === o.handId);
        if (!h) {
          o.lostAt ??= now;
          if (now - o.lostAt > 600) this.letGo(o);
          continue;
        }
        o.lostAt = null;
        const g = handGrip(h);
        if (o.pinched && g.pinch > C.releasePinch) {
          this.letGo(o);
          continue;
        }
        if (!o.pinched && g.pinch < C.grabPinch) o.pinched = true;
        const tilt = Math.atan2(h.points[9].x - h.points[0].x, -(h.points[9].y - h.points[0].y)) * 0.35;
        const targetW = face ? face.size * o.art.widthK : h.size * 2 * o.art.widthK;
        o.x = lerp(o.x, g.x, 0.6);
        o.y = lerp(o.y, g.y, 0.6);
        o.w = lerp(o.w, targetW, 0.2);
        o.rot = lerpAngle(o.rot, tilt, 0.3);

        // snap onto the head when brought close to its slot
        if (face) {
          const slot = headSlot(face, o.art);
          const d = dist(o, slot) / face.size;
          if (!o.armed && d > C.snapDistance * 1.4) o.armed = true;
          if (o.armed && d < C.snapDistance) {
            o.attached = "head";
            o.handId = null;
            o.pinched = false;
            o.settled = false;
          }
        }
        continue;
      }

      if (o.attached === "head") {
        if (!face) continue; // keep the last pose until the face is back
        const slot = headSlot(face, o.art);
        const k = o.settled ? 0.55 : 0.25;
        o.x = lerp(o.x, slot.x, k);
        o.y = lerp(o.y, slot.y, k);
        o.w = lerp(o.w, slot.w, k);
        o.rot = lerpAngle(o.rot, slot.rot, k);
        if (!o.settled && dist(o, slot) < face.size * 0.03) o.settled = true;
        continue;
      }

      // free
      if (o.release === "fall") {
        o.vy += 2200 * dt;
        o.y += o.vy * dt;
        o.rot += dt * 2;
        if (o.y - o.w > H) o.removing = true;
      } else if (o.release === "vanish") {
        o.removing = true;
      }
    }
    this.objects = this.objects.filter((o) => !o.removing || o.alpha > 0);
  }

  letGo(o) {
    o.attached = "free";
    o.handId = null;
    o.pinched = false;
    o.vy = 0;
  }

  draw(ctx, outputId) {
    for (const o of this.objects) {
      if (o.outputs && !o.outputs.has(outputId)) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, o.alpha));
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rot);
      ctx.translate(0, -o.art.baseY * o.w);
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = o.w * 0.06;
      ctx.shadowOffsetY = o.w * 0.03;
      o.art.draw(ctx, o.w);
      ctx.restore();
    }
  }
}
