// setTimeout that is not throttled in hidden tabs: the timer runs in a Web Worker.
// (Browsers slow main-thread timers down to once per second — or once per minute —
// when the window is hidden or on another desktop, which would stall reconnects.)

let worker = null;
let nextId = 1;
const callbacks = new Map();

function ensureWorker() {
  if (worker) return worker;
  const src = `
    const timers = new Map();
    onmessage = (e) => {
      const { op, id, ms } = e.data;
      if (op === "set") timers.set(id, setTimeout(() => { timers.delete(id); postMessage(id); }, ms));
      else if (op === "clear") { clearTimeout(timers.get(id)); timers.delete(id); }
    };`;
  worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
  worker.onmessage = (e) => {
    const fn = callbacks.get(e.data);
    callbacks.delete(e.data);
    fn?.();
  };
  return worker;
}

export function setWorkerTimeout(fn, ms) {
  const id = nextId++;
  callbacks.set(id, fn);
  ensureWorker().postMessage({ op: "set", id, ms });
  return id;
}

export function clearWorkerTimeout(id) {
  if (!callbacks.delete(id)) return;
  worker?.postMessage({ op: "clear", id });
}
