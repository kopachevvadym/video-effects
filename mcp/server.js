#!/usr/bin/env node
// Gesture Flow MCP server — lets Claude (Desktop / Code) control the editor with prompts.
//
//   Claude ──stdio (MCP)──▶ this process ──WebSocket 127.0.0.1:8789──▶ editor tab in the browser
//
// The tools are defined once in src/agent/tools.js and executed inside the editor,
// so this process only lists them and forwards calls. The editor must be open
// (start.command or `npm run dev`, http://localhost:8001).
//
// Logs go to stderr: stdout is reserved for the MCP protocol.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { WebSocketServer } from "ws";
import { TOOL_SCHEMAS } from "../src/agent/tools.js";

const PORT = Number(process.env.GESTURE_FLOW_BRIDGE_PORT ?? 8789);
const TIMEOUT_MS = 15000;
const log = (...a) => console.error("[gesture-flow-mcp]", ...a);

// ---------- bridge to the editor ----------

let editor = null;
let bridgeError = null;
const pending = new Map();
let nextId = 1;

const localOrigin = (origin) => !origin || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);

const wss = new WebSocketServer({
  host: "127.0.0.1",
  port: PORT,
  verifyClient: ({ origin }) => localOrigin(origin), // only pages served from this machine
});
wss.on("listening", () => log(`bridge listening on ws://127.0.0.1:${PORT}`));
wss.on("error", (err) => {
  bridgeError = err.code === "EADDRINUSE" ? `Port ${PORT} is busy — another Gesture Flow MCP server is probably running. Close the other Claude app/session or set GESTURE_FLOW_BRIDGE_PORT.` : err.message;
  log("bridge error:", bridgeError);
});
wss.on("connection", (ws) => {
  if (editor && editor !== ws) editor.close(4000, "replaced by a newer editor tab");
  editor = ws;
  log("editor connected");
  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (msg.type === "result" && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  ws.on("close", () => {
    if (editor === ws) editor = null;
    log("editor disconnected");
  });
  ws.send(JSON.stringify({ type: "hello", server: "gesture-flow-mcp" }));
});

function callEditor(name, args) {
  if (bridgeError) return Promise.resolve({ ok: false, text: bridgeError });
  if (!editor) {
    return Promise.resolve({
      ok: false,
      text: "The Gesture Flow editor is not open. Start it (double-click start.command or run `npm run dev` in the project folder), open http://localhost:8001, make sure “Control from Claude (MCP)” is enabled in Settings, then try again.",
    });
  }
  const id = nextId++;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ ok: false, text: `The editor did not answer within ${TIMEOUT_MS / 1000} s.` });
    }, TIMEOUT_MS);
    pending.set(id, (msg) => {
      clearTimeout(timer);
      resolve({ ok: msg.ok !== false, text: String(msg.text ?? "") });
    });
    editor.send(JSON.stringify({ type: "call", id, name, args: args ?? {} }));
  });
}

// ---------- MCP ----------

const server = new Server({ name: "gesture-flow", version: "0.3.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_SCHEMAS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: {
      readOnlyHint: !!t.annotations?.readOnlyHint,
      destructiveHint: !!t.annotations?.consequentialHint,
      openWorldHint: false,
    },
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  if (!TOOL_SCHEMAS.some((t) => t.name === name)) {
    return { content: [{ type: "text", text: `Unknown tool ${name}` }], isError: true };
  }
  const res = await callEditor(name, args);
  return { content: [{ type: "text", text: res.text }], isError: !res.ok };
});

await server.connect(new StdioServerTransport());
log("MCP server ready (stdio)");

const shutdown = () => {
  wss.close();
  process.exit(0);
};
process.stdin.on("close", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
