// ГОЛОВНИЙ ФАЙЛ НАЛАШТУВАНЬ: який жест запускає який ефект.
//
// Тут немає жестів, які вже є у вбудованих «Реакціях» macOS
// (сердечко, 👍/👎, ✌️, «коза» двома руками), щоб не було подвійних ефектів.
//
// Кожен жест — detect(hands, debug, face):
//   hands — руки (src/geometry.js), face — обличчя (src/face.js) або null.
//
// Щоб додати свій жест:
//   1. створи файл у src/gestures/ (скопіюй okSign.js або wink.js як шаблон);
//   2. створи ефект у src/effects/ (скопіюй portal.js або explosion.js);
//   3. імпортуй обидва сюди і додай рядок у bindings.
//
// Порядок важливий: жести з exclusive: true мають стояти першими,
// щоб блокувати решту, поки вони активні.

import { energyPalms } from "./gestures/energyPalms.js";
import { aimLaser } from "./gestures/aimLaser.js";
import { fistBurst } from "./gestures/fistBurst.js";
import { okSign } from "./gestures/okSign.js";
import { shaka } from "./gestures/shaka.js";
import { winkLeft, winkRight } from "./gestures/wink.js";
import { pointing } from "./gestures/pointing.js";
import { browsUp, browLeft, browRight, frown } from "./gestures/brows.js";
import { mouthOpen, smile, pucker } from "./gestures/mouth.js";
import { noseBoop } from "./gestures/touch.js";
import { facepalm } from "./gestures/facepalm.js";

import { energyBall } from "./effects/energyBall.js";
import { laser } from "./effects/laser.js";
import { explosion } from "./effects/explosion.js";
import { portal } from "./effects/portal.js";
import { starfall } from "./effects/starfall.js";
import { eyeGlint } from "./effects/eyeGlint.js";
import { magicTrail } from "./effects/magicTrail.js";
import { surprise, question, anger, fireBreath, sunshine, bubbles } from "./effects/faceFx.js";
import { noseHonk, dizzy, sorrow } from "./effects/touchFx.js";

export const bindings = [
  { gesture: energyPalms, effect: energyBall },
  { gesture: aimLaser, effect: laser },
  // руки + обличчя (exclusive: щоб палець біля носа не малював слід, а рука на лобі не зсувала «брови»)
  { gesture: noseBoop, effect: noseHonk },
  { gesture: facepalm, effect: sorrow },
  { gesture: fistBurst, effect: explosion },
  { gesture: okSign, effect: portal },
  { gesture: shaka, effect: starfall },
  { gesture: winkLeft, effect: eyeGlint },
  { gesture: winkRight, effect: eyeGlint },
  { gesture: pointing, effect: magicTrail },
  // брови
  { gesture: browsUp, effect: surprise },
  { gesture: browLeft, effect: question },
  { gesture: browRight, effect: question },
  { gesture: frown, effect: anger },
  // рот
  { gesture: mouthOpen, effect: fireBreath },
  { gesture: smile, effect: sunshine },
  { gesture: pucker, effect: bubbles },
];
