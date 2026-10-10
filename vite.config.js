import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { WebSocketServer } from "ws";
import fs from "node:fs/promises";
import path from "node:path";

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

/**
 * Saved settings ("presets"): JSON files in ./presets, so they survive clearing the
 * browser, work from any browser, and can be committed. Local requests only.
 *   GET    /gf-api/presets          → [{ name, savedAt, size }]
 *   GET    /gf-api/presets/:name    → the saved graph
 *   PUT    /gf-api/presets/:name    ← the graph (JSON body, ≤ 2 MB)
 *   DELETE /gf-api/presets/:name
 */
function presetsApi() {
  const dir = path.resolve("presets");
  const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
  // file name from a preset name: keep letters (any script), digits, space, - _ ; nothing that can climb directories
  const fileOf = (name) => {
    const clean = String(name).normalize("NFC").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 60);
    return clean ? path.join(dir, `${clean}.json`) : null;
  };
  const send = (res, code, body) => {
    res.statusCode = code;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  };
  const readBody = (req) =>
    new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on("data", (c) => {
        size += c.length;
        if (size > 2_000_000) reject(new Error("too large"));
        else chunks.push(c);
      });
      req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      req.on("error", reject);
    });

  const handler = async (req, res, next) => {
    if (!req.url?.startsWith("/gf-api/presets")) return next();
    const origin = req.headers.origin ?? "";
    const host = (req.headers.host ?? "").replace(/:\d+$/, "");
    if ((origin && !LOCAL.test(origin)) || !["localhost", "127.0.0.1", "[::1]"].includes(host)) return send(res, 403, { error: "local only" });
    try {
      const rest = decodeURIComponent(req.url.slice("/gf-api/presets".length).split("?")[0]).replace(/^\//, "");
      if (!rest) {
        if (req.method !== "GET") return send(res, 405, { error: "method" });
        await fs.mkdir(dir, { recursive: true });
        const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
        const list = await Promise.all(
          files.map(async (f) => {
            const st = await fs.stat(path.join(dir, f));
            return { name: f.slice(0, -5), savedAt: st.mtimeMs, size: st.size };
          }),
        );
        return send(res, 200, list.sort((a, b) => b.savedAt - a.savedAt));
      }
      const file = fileOf(rest);
      if (!file || path.dirname(file) !== dir) return send(res, 400, { error: "bad name" });
      if (req.method === "GET") return send(res, 200, JSON.parse(await fs.readFile(file, "utf8")));
      if (req.method === "PUT") {
        const body = JSON.parse(await readBody(req));
        if (!Array.isArray(body?.nodes) || !Array.isArray(body?.edges)) return send(res, 400, { error: "not a graph" });
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(file, JSON.stringify(body, null, 2));
        return send(res, 200, { name: path.basename(file, ".json") });
      }
      if (req.method === "DELETE") {
        await fs.rm(file, { force: true });
        return send(res, 200, { ok: true });
      }
      return send(res, 405, { error: "method" });
    } catch (err) {
      return send(res, err.code === "ENOENT" ? 404 : 500, { error: String(err.message ?? err) });
    }
  };
  return {
    name: "gesture-flow-presets",
    // block bodies: a hook that returns a function is treated by Vite as a "post" hook
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [react(), programSignaling(), presetsApi()],
  server: { port: 8001, strictPort: false, watch: { ignored: ["**/presets/**"] } },
  build: {
    rollupOptions: {
      input: { main: "index.html", program: "program.html" },
    },
  },
});
