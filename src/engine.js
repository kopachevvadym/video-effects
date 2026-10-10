// Рушій жестів: перетворює «сирі» спрацювання кожного кадру на стабільні події.
//
// Без цього ефекти запускались би від випадкових кадрів і мерехтіли.
// Логіка:
//   - жест має триматися holdFrames кадрів поспіль, щоб спрацювати;
//   - до graceFrames пропущених кадрів не скидають лічильник (трекер іноді «моргає»);
//   - mode "trigger": один запуск на одне утримання (щоб знову — відпусти жест), мінімум cooldownMs між запусками;
//   - mode "continuous": ефект отримує позицію кожен кадр, поки жест триває;
//   - exclusive: якщо такий жест активний, решта жестів у цьому кадрі ігноруються
//     (наприклад, у «сердечку» пальці можуть випадково скластися у «вказівний»).

const DEFAULTS = { holdFrames: 6, graceFrames: 2, cooldownMs: 1200, mode: "trigger", exclusive: false };

export class GestureEngine {
  constructor(bindings) {
    this.items = bindings.map((b) => ({
      ...b,
      g: { ...DEFAULTS, ...b.gesture },
      count: 0,
      misses: 0,
      lastFired: -Infinity,
      lastHit: null,
      debug: {},
    }));
  }

  /** @returns {Array<{binding, hit}>} події, які треба віддати ефектам у цьому кадрі */
  /** face — об'єкт обличчя з src/face.js або null; жести отримують його третім параметром. */
  update(hands, now, face = null) {
    const events = [];
    let blocked = false;

    for (const it of this.items) {
      const { g } = it;
      it.debug = {};
      const hit = blocked ? null : g.detect(hands, it.debug, face);

      if (hit) {
        it.count++;
        it.misses = 0;
        it.lastHit = hit;
      } else if (it.count > 0 && ++it.misses > g.graceFrames) {
        it.count = 0;
        it.misses = 0;
        it.latched = false; // жест відпущено — можна запускати знову
      }

      const stable = it.count >= g.holdFrames;
      if (stable && hit && g.exclusive) blocked = true;
      if (!stable || !hit) continue;

      if (g.mode === "continuous") {
        events.push({ binding: it, hit });
      } else if (!it.latched && now - it.lastFired >= g.cooldownMs) {
        // одноразовий ефект: спрацьовує один раз, поки жест не відпустиш
        it.lastFired = now;
        it.latched = true;
        events.push({ binding: it, hit });
      }
    }
    return events;
  }

  /** Прогрес утримання 0..1 для кожного жесту — для індикатора в панелі. */
  progress() {
    return this.items.map((it) => Math.min(1, it.count / it.g.holdFrames));
  }
}
