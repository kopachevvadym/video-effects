// End-to-end: Claude-like MCP client → mcp/server.js → browser editor (Playwright).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
// Needs Playwright (npm i -D playwright) and `npm run preview -- --port 8790` running.
const { chromium } = await import("playwright");
const SERVER = fileURLToPath(new URL("../mcp/server.js", import.meta.url));
const EDITOR = process.env.EDITOR_URL ?? "http://localhost:8790/";

const client = new Client({ name: "test-claude", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [SERVER], stderr: "pipe" }));
const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  return (r.isError ? "ERROR: " : "") + r.content.map((c) => c.text).join("");
};
const { tools } = await client.listTools();
console.log("MCP tools:", tools.length, tools.slice(0, 4).map((t) => t.name).join(", "), "…");
console.log("before editor:", (await call("gesture_flow_get_graph")).slice(0, 60));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route("https://storage.googleapis.com/**", (r) => r.fulfill({ status: 404, body: "" }));
await page.route("https://cdn.jsdelivr.net/**", (r) => r.fulfill({ status: 404, body: "" }));
await page.addInitScript(() => { localStorage.setItem("gesture-flow-lang", "en"); });
await page.goto(EDITOR);
await page.evaluate(() => localStorage.removeItem("gesture-flow-graph-v1"));
await page.reload();
await page.waitForTimeout(3500);
console.log("claude badge:", await page.locator(".webmcp-badge.claude").count());
console.log("help:", (await call("gesture_flow_help")).split("\n")[0]);
console.log(await call("gesture_flow_add_rule", { gesture: "headTurn", gestureParams: { dir: "right" }, reaction: "starfall", reactionParams: { hue: 200 }, camera: "Face" }));
console.log(await call("gesture_flow_set_switch", { node: "Mouth", on: false }));
await page.waitForTimeout(300);
const g = JSON.parse(await call("gesture_flow_get_graph"));
console.log("graph nodes:", g.nodes.length, "| mouth switch on =", g.nodes.find((n) => n.id === "sw-mouth").params.on, "| headTurn dir =", g.nodes.find((n) => n.kind === "headTurn")?.params.dir);
console.log("UI switch:", await page.locator('.react-flow__node[data-id="sw-mouth"] .switch').textContent());
console.log(await call("gesture_flow_set_active_camera", { camera: "Hands" }));
await page.waitForTimeout(200);
console.log("active chip:", await page.locator(".cam-chip.active").textContent());
await browser.close();
await new Promise((r) => setTimeout(r, 500));
console.log("after closing editor:", (await call("gesture_flow_help")).slice(0, 70));
await client.close();
