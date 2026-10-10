#!/usr/bin/env node
// Adds the Gesture Flow MCP server to Claude Desktop's config (macOS / Windows).
// Makes a backup of the existing config first. Restart Claude Desktop afterwards.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "server.js");
const configPath =
  process.platform === "win32"
    ? path.join(process.env.APPDATA ?? "", "Claude", "claude_desktop_config.json")
    : path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");

let config = {};
if (fs.existsSync(configPath)) {
  const raw = fs.readFileSync(configPath, "utf8");
  config = raw.trim() ? JSON.parse(raw) : {};
  const backup = `${configPath}.backup-${Date.now()}`;
  fs.copyFileSync(configPath, backup);
  console.log("Backup:", backup);
} else {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
}

config.mcpServers ??= {};
// absolute node path: Claude Desktop does not load nvm / shell PATH
config.mcpServers["gesture-flow"] = { command: process.execPath, args: [serverPath] };
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

console.log("Added “gesture-flow” to", configPath);
console.log("  command:", process.execPath);
console.log("  args:   ", serverPath);
console.log("\nRestart Claude Desktop, open the editor (http://localhost:8001) and ask Claude, e.g.:");
console.log("  “In Gesture Flow, make a portal appear when I pinch with my left hand.”");
console.log("\nClaude Code instead:  claude mcp add gesture-flow -- " + JSON.stringify(process.execPath) + " " + JSON.stringify(serverPath));
