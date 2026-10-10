// Трекінг рук і обличчя через MediaPipe.
//
// Руки — Gesture Recognizer: 21 точка на руку + вбудований жест моделі
//   (None, Closed_Fist, Open_Palm, Pointing_Up, Thumb_Down, Thumb_Up, Victory, ILoveYou).
// Обличчя — Face Landmarker: 478 точок (включно з райдужками очей) + blendshapes
//   (оцінки 0..1 для моргання, усмішки, піднятих брів тощо).
//
// Усі координати нормалізовані 0..1, у кадрі камери (ще не віддзеркалені).

import { FilesetResolver, GestureRecognizer, FaceLandmarker } from "@mediapipe/tasks-vision";

// WASM files are loaded from the CDN for the same version as the npm package.
const MP_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

async function withGpuFallback(create) {
  try {
    return await create("GPU");
  } catch (err) {
    console.warn("GPU delegate недоступний, перемикаюсь на CPU", err);
    return await create("CPU");
  }
}

export async function createTracker() {
  const vision = await FilesetResolver.forVisionTasks(MP_WASM);

  const handsP = withGpuFallback((delegate) =>
    GestureRecognizer.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_MODEL, delegate },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.5,
    }),
  );

  const faceP = withGpuFallback((delegate) =>
    FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
    }),
  ).catch((err) => {
    // без обличчя програма все одно працює з руками
    console.error("Не вдалося завантажити модель обличчя", err);
    return null;
  });

  const [recognizer, faceLandmarker] = await Promise.all([handsP, faceP]);

  return {
    hasFace: !!faceLandmarker,

    /** @returns {{hands: Array, face: null | {landmarks, blend: Record<string, number>}}} */
    detect(video, timestampMs) {
      const r = recognizer.recognizeForVideo(video, timestampMs);
      const hands = r.landmarks.map((landmarks, i) => ({
        landmarks,
        handedness: r.handedness[i]?.[0]?.categoryName ?? `hand${i}`,
        gesture: r.gestures[i]?.[0]?.categoryName ?? "None",
        gestureScore: r.gestures[i]?.[0]?.score ?? 0,
      }));

      let face = null;
      if (faceLandmarker) {
        const f = faceLandmarker.detectForVideo(video, timestampMs);
        if (f.faceLandmarks?.length) {
          const blend = {};
          for (const c of f.faceBlendshapes?.[0]?.categories ?? []) blend[c.categoryName] = c.score;
          face = { landmarks: f.faceLandmarks[0], blend };
        }
      }
      return { hands, face };
    },
  };
}
