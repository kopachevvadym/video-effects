import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { WebSocketServer } from "ws";

/**
 * WebRTC signaling for the program feed: the editor (sender) streams the active
 * camera to program.html (viewer), e.g. an OBS Browser Source. Only relays small
 * JSON messages (offer / answer / ICE); the video goes peer-to-peer on localhost.
 */
function programSignaling() {
  const attach = (httpServer) => {
    if (!httpServer) return;
    const wss = new WebSocketServer({ noServer: true });
    const peers = new Map(); // id → { ws, role }
    let nextId = 1;
    let primary = null; // the one editor tab that streams (newest / claimed)
    const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg));
    const each = (role, fn) => peers.forEach((p, id) => p.role === role && fn(p, id));

    httpServer.on("upgrade", (req, socket, head) => {
      if (!req.url?.startsWith("/gf-signal")) return; // everything else (Vite HMR) is handled by Vite
      const origin = req.headers.origin ?? "";
      if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
    });

    wss.on("connection", (ws) => {
      const id = nextId++;
      peers.set(id, { ws, role: null });
      ws.on("message", (raw) => {
        let m;
        try {
          m = JSON.parse(raw);
        } catch {
          return;
        }
        const makePrimary = () => {
          if (primary && primary !== id && peers.has(primary)) send(peers.get(primary).ws, { type: "standby" });
          primary = id;
          send(ws, { type: "primary" });
          each("viewer", (p, vid) => send(ws, { type: "viewer-joined", from: vid }));
        };
        if (m.type === "hello") {
          peers.get(id).role = m.role;
          if (m.role === "viewer" && primary && peers.has(primary)) send(peers.get(primary).ws, { type: "viewer-joined", from: id });
          if (m.role === "sender") makePrimary();
          return;
        }
        if (m.type === "claim" && peers.get(id)?.role === "sender") {
          makePrimary();
          return;
        }
        const target = peers.get(m.to);
        if (target) send(target.ws, { ...m, from: id });
      });
      ws.on("close", () => {
        const role = peers.get(id)?.role;
        peers.delete(id);
        if (role === "viewer" && primary && peers.has(primary)) send(peers.get(primary).ws, { type: "viewer-left", from: id });
        if (role === "sender" && primary === id) {
          // promote the most recent remaining editor tab
          primary = null;
          const rest = [...peers].filter(([, p]) => p.role === "sender").map(([pid]) => pid);
          const next = rest[rest.length - 1];
          if (next) {
            primary = next;
            const nws = peers.get(next).ws;
            send(nws, { type: "primary" });
            each("viewer", (p, vid) => send(nws, { type: "viewer-joined", from: vid }));
          }
        }
      });
    });
  };
  return {
    name: "gesture-flow-program-signaling",
    configureServer: (server) => attach(server.httpServer),
    configurePreviewServer: (server) => attach(server.httpServer),
  };
}

export default defineConfig({
  plugins: [react(), programSignaling()],
  server: { port: 8001, strictPort: false },
  build: {
    rollupOptions: {
      input: { main: "index.html", program: "program.html" },
    },
  },
});
