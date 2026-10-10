// Шар ефектів: зберігає всі живі об'єкти (частинки, сліди, спалахи),
// оновлює і малює їх кожен кадр.
//
// Будь-який об'єкт ефекту — це { update(dt) -> boolean (живий?), draw(ctx) }.
// dt — секунди з минулого кадру. Об'єкт може додавати нові об'єкти через fx.add()
// навіть усередині свого update (наприклад, відкладений вибух феєрверка).

const MAX_ITEMS = 4000; // запобіжник, щоб випадково не «покласти» браузер

export class FxLayer {
  constructor() {
    this.items = [];
    this.pending = [];
    this.state = new Map(); // для ефектів, яким треба пам'ятати щось між кадрами (напр. слід)
    this.shake = 0; // струс екрана в пікселях; ефект може задати, він сам затухає
    this.face = null; // поточне обличчя (оновлюється кожен кадр) — щоб ефект міг «їхати» разом з головою
    this.hands = [];
  }

  add(item) {
    this.pending.push(item);
  }

  update(dt) {
    const alive = this.items.filter((it) => it.update(dt));
    this.items = alive.concat(this.pending);
    this.pending = [];
    this.shake *= Math.max(0, 1 - 6 * dt);
    if (this.shake < 0.3) this.shake = 0;
    if (this.items.length > MAX_ITEMS) this.items.splice(0, this.items.length - MAX_ITEMS);
  }

  draw(ctx) {
    for (const it of this.items) {
      ctx.save();
      it.draw(ctx);
      ctx.restore();
    }
  }
}
