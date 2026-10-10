// Minimal obs-websocket v5 client (built into OBS 28+: Tools → WebSocket Server Settings).
// Used to start/stop the OBS Virtual Camera and switch scenes when the active camera changes.

async function sha256b64(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export class ObsClient {
  constructor() {
    this.ws = null;
    this.state = "disconnected"; // disconnected | connecting | connected | error
    this.error = "";
    this.virtualCam = false;
    this.scenes = [];
    this.pending = new Map();
    this.listeners = new Set();
    this.nextId = 1;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this.snapshot());
  }

  snapshot() {
    return { state: this.state, error: this.error, virtualCam: this.virtualCam, scenes: this.scenes };
  }

  connect({ host = "127.0.0.1", port = 4455, password = "" } = {}) {
    this.disconnect();
    this.state = "connecting";
    this.error = "";
    this.emit();
    let ws;
    try {
      ws = new WebSocket(`ws://${host}:${port}`);
    } catch (err) {
      this.state = "error";
      this.error = err.message;
      this.emit();
      return;
    }
    this.ws = ws;
    ws.onmessage = async (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.op === 0) {
        // Hello → Identify (with auth if the server requires it)
        const d = { rpcVersion: 1, eventSubscriptions: 1 << 10 /* Outputs */ };
        const auth = msg.d.authentication;
        if (auth) d.authentication = await sha256b64((await sha256b64(password + auth.salt)) + auth.challenge);
        ws.send(JSON.stringify({ op: 1, d }));
      } else if (msg.op === 2) {
        this.state = "connected";
        this.emit();
        this.refresh();
      } else if (msg.op === 7) {
        const p = this.pending.get(msg.d.requestId);
        if (p) {
          this.pending.delete(msg.d.requestId);
          msg.d.requestStatus.result ? p.resolve(msg.d.responseData ?? {}) : p.reject(new Error(msg.d.requestStatus.comment ?? "OBS error"));
        }
      } else if (msg.op === 5 && msg.d.eventType === "VirtualcamStateChanged") {
        this.virtualCam = !!msg.d.eventData.outputActive;
        this.emit();
      }
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.state = ev.code === 4009 ? "error" : this.state === "connected" ? "disconnected" : "error";
      if (ev.code === 4009) this.error = "auth";
      else if (!this.error && this.state === "error") this.error = "unreachable";
      this.ws = null;
      this.emit();
    };
  }

  disconnect() {
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.close();
    }
    this.state = "disconnected";
    this.emit();
  }

  request(requestType, requestData = {}) {
    if (!this.ws || this.state !== "connected") return Promise.reject(new Error("not connected"));
    const requestId = String(this.nextId++);
    this.ws.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      setTimeout(() => {
        if (this.pending.delete(requestId)) reject(new Error("timeout"));
      }, 5000);
    });
  }

  async refresh() {
    try {
      const vc = await this.request("GetVirtualCamStatus");
      this.virtualCam = !!vc.outputActive;
      const sl = await this.request("GetSceneList");
      this.scenes = (sl.scenes ?? []).map((s) => s.sceneName).reverse();
    } catch (err) {
      this.error = err.message;
    }
    this.emit();
  }

  async setVirtualCam(on) {
    await this.request(on ? "StartVirtualCam" : "StopVirtualCam");
    this.virtualCam = on;
    this.emit();
  }

  async setScene(sceneName) {
    if (sceneName) await this.request("SetCurrentProgramScene", { sceneName });
  }
}
