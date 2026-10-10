# Gesture Effects

Real-time video effects triggered by hand gestures and facial expressions, right in the browser: camera → MediaPipe finds 21 points on each hand and 478 points on the face → your rules recognize a gesture → an effect is drawn on top of the video.

No build step, no dependencies to install — plain ES modules + Canvas 2D. The UI is in Ukrainian.

## Running

1. Double-click `start.command` (or run `python3 -m http.server 8001` in this folder).
2. `http://localhost:8001` opens. Allow camera access.
3. The first run downloads the hand and face models (~12 MB) from the internet.

If macOS refuses to run `start.command`: right-click → Open.

Works best in Chrome-based browsers. Safari works too.

## Gestures

| Key | Gesture | Effect |
|---|---|---|
| **Hands** | | |
| 1 | 🤲 Two open palms apart | Energy ball with lightning to the fingertips; spread hands — it grows; drop them — it bursts |
| 5 | ✊→🖐 Make a fist and snap it open | Explosion: flash, shockwave, embers, camera shake |
| 6 | 👌 "OK" sign (other fingers straight) | Portal: rings expanding outward, sparks spiralling inward |
| 7 | 🤙 Shaka (thumb + pinky) | Shooting stars across the whole screen |
| 0 | ☝️ Index finger only | Light trail following the fingertip |
| **Hands + face** | | |
| 2 | 🎯 One eye closed + index finger | Laser from the open eye through the fingertip (left eye closed — red, right — green) |
| 3 | 👃 Touch your nose | Clown nose for 3 seconds (follows the head) + "БІП!" |
| 4 | 🤦 Palm on forehead (facepalm) | "Sorrow": anime tear streams, blue melancholic tint, "жаль…". A `dizzy` effect (stars circling the head) is also in `touchFx.js` — swap it in `config.js` |
| **Eyes** | | |
| 8 / 9 | 😉 Wink left / right eye | Gold / turquoise glint in the eye |
| **Eyebrows** | | |
| Q | 😲 Raise both eyebrows | Anime speed lines around the head + "!!" |
| W / E | 🤨 Raise left / right eyebrow | "?" above that eyebrow |
| R | 😠 Frown | Red vignette, steam from the head, 💢 |
| **Mouth** | | |
| T | 😮 Open mouth wide | Fire breath — goes where the head is turned |
| Y | 😁 Big smile | Sun rays around the head |
| U | 😗 Pucker lips | Soap bubbles from the mouth |

Keys work with any keyboard layout. One-shot effects fire once per gesture: release the gesture and show it again to repeat.

Gestures that already exist in macOS built-in **Reactions** (heart, 👍/👎, ✌️, two-hand rock-on) are intentionally not used here. If Reactions are enabled (Control Center → Video Effects), macOS draws its own effects directly into the camera feed, so they will show up here too.

The keys in the table fire an effect at the cursor without a gesture — handy when building a new effect. Continuous effects (1, 2, 0, T, U) must be held while moving the mouse.

- `D` — show hand and face points plus the numbers gestures use (for tuning thresholds).
- `G` — crosshair where you are looking.
- `C` — calibrate: look at the center of the screen with a neutral face and press (gaze + neutral eyebrow height).
- `H` — hide the panel (e.g. for screen recording).
- **● Запис** (Record) — records the video with effects to a file (without the panel).

## Structure

```
src/
  config.js        ← which gesture triggers which effect (main file)
  gestures/        ← gestures: detect(hands, debug, face) returns a position or null
  effects/         ← effects: trigger(fx, hit) adds particles to the screen
  engine.js        ← stabilization: hold N frames, cooldown, exclusive gestures
  geometry.js      ← hand point indices and helpers
  face.js          ← eyes, eyebrows, mouth, head pose, gaze point
  tracker.js       ← MediaPipe (hands + face)
  main.js          ← camera, frame loop, drawing, recording
```

## Adding your own gesture

**1. Gesture** — `src/gestures/fist.js`:

```js
import { INDEX, MIDDLE, RING, PINKY, isFolded } from "../geometry.js";

export const fist = {
  name: "fist",
  label: "✊ Fist",
  holdFrames: 8,      // how many consecutive frames to hold the gesture (~30 frames = 1 s)
  cooldownMs: 1500,   // minimum pause between triggers
  // mode: "continuous", // if the effect should run while the gesture is held (like the finger trail)

  detect(hands, debug) {
    for (const h of hands) {
      if ([INDEX, MIDDLE, RING, PINKY].every((f) => isFolded(h, f))) {
        const p = h.points[9]; // palm center
        return { x: p.x, y: p.y, size: h.size };
      }
    }
    return null;
  },
};
```

What `hands[i]` contains:
- `points` — 21 points in screen pixels (already mirrored);
- `size` — palm length in pixels (express all thresholds as fractions of `size`);
- `gesture` / `gestureScore` — the model's built-in gesture: `Closed_Fist`, `Open_Palm`, `Pointing_Up`, `Thumb_Down`, `Thumb_Up`, `Victory`, `ILoveYou`.

The point map is at the top of `src/geometry.js`.

**2. Effect** — copy `src/effects/portal.js` and change what is drawn. Each particle is an object with `update(dt)` (returns `false` when the particle should disappear) and `draw(ctx)` (plain Canvas 2D).

**3. Wire it up** in `src/config.js`:

```js
import { fist } from "./gestures/fist.js";
import { myEffect } from "./effects/myEffect.js";
// ...
{ gesture: fist, effect: myEffect },
```

## Face, eyes and gaze

`src/face.js` turns MediaPipe's 478 face points into meaningful values. Every gesture receives them as the third `face` argument:

| Field | Meaning |
|---|---|
| `face.leftEye.closed`, `face.rightEye.closed` | eye is closed (left = your left) |
| `face.winking` | `"left"`, `"right"` or `null` (a normal blink doesn't count) |
| `face.leftEye.ear` | how open the eye is (≈0.25–0.35 open, <0.12 closed) |
| `face.yaw`, `face.pitch`, `face.roll` | head turn left/right, up/down, tilt (°) |
| `face.gaze` | point on the screen you are looking at (pixels) |
| `face.zone` | gaze zone: `ліво` (left), `центр` (center), `право` (right), `верх-ліво` (top-left), `низ-центр` (bottom-center)… |
| `face.brows.left.raise` | how far the eyebrow is raised relative to neutral (0 — neutral, 0.12+ — raised, negative — lowered) |
| `face.brows.bothRaised`, `face.brows.raisedOne`, `face.brows.frown` | both raised / one raised (`"left"`/`"right"`) / frowning |
| `face.mouth.open` | mouth openness (≈0 closed, 0.1–0.3 talking, 0.5+ wide open) |
| `face.mouth.isOpen`, `isSmiling`, `isPuckered` | wide open / smiling / puckered |
| `face.nose`, `face.ears.left`, `face.ears.right`, `face.top` | nose tip, approximate ear positions (estimated), top of the forehead |
| `face.blend` | MediaPipe's 52 expression scores: `mouthSmileLeft`, `jawOpen`, `browInnerUp`, `cheekPuff`, etc. |

Example of a custom "puff your cheeks" gesture:

```js
export const cheekPuff = {
  name: "cheekPuff",
  label: "🐡 Puff cheeks",
  holdFrames: 6,
  detect(hands, debug, face) {
    if (!face || (face.blend.cheekPuff ?? 0) < 0.5) return null;
    return { x: face.nose.x, y: face.nose.y, size: face.size };
  },
};
```

The face model has no ear points, so `face.ears` is an estimate: the edge of the face at ear level, pushed slightly outward. The neutral eyebrow height is learned automatically during the first seconds. If eyebrow gestures fire on their own, make a neutral face and press `C`.

Effects can read the current face and hands through `fx.face` / `fx.hands` — that's how the clown nose follows the head.

**About gaze accuracy.** A regular webcam can't tell exactly where the eyes are looking. Gaze here is head rotation plus pupil offset, which is enough for screen zones (left / center / right, top / bottom), not for a specific button. Without calibration (`C`) the point may be offset. The coefficients are in `FACE_CONFIG` at the top of `src/face.js`.

## Tuning a gesture that misfires

1. Press `D` and show the gesture. The panel shows its numbers, e.g. `pinch=0.22` for "OK", `gap=2.40` for the palms.
2. Compare them with the thresholds at the top of the gesture file (`PINCH`, `THUMB_OUT`, `MIN_GAP`, etc.) and adjust.
3. Fires by accident → increase `holdFrames`. Effects jitter → decrease `SMOOTHING` in `main.js`.

## Using it in Zoom / Meet / Telegram

1. Install [OBS Studio](https://obsproject.com).
2. Add a **Window Capture** source → the browser window with this page (press `H` to hide the panel).
3. Click **Start Virtual Camera** in OBS.
4. In Zoom/Meet, pick **OBS Virtual Camera** as the camera.

## What's next

- Complex gestures that are hard to express as rules → record landmark samples and train a classifier (MediaPipe Model Maker or a small neural net in TensorFlow.js).
- Effects anchored to the face (glasses, masks) → use the 478 face points from `face.points`.
- 3D effects → Three.js instead of Canvas 2D.
