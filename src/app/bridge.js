// Browser side of the Claude MCP bridge: connects to the local MCP server
// (mcp/server.js, ws://127.0.0.1:8789) and runs the tool calls it forwards.
import { useEffect, useRef, useState } from "react";
import { runTool } from "../agent/tools.js";
import { engine, runtime } from "./core.js";
import { setWorkerTimeout, clearWorkerTimeout } from "./timers.js";

const BRIDGE_URL = "ws://127.0.0.1:8789";

/** @returns "off" | "waiting" | "connected" */
export function useClaudeBridge(api, enabled) {
  const ref = useRef(api);
  ref.current = api;
  const [state, setState] = useState(enabled ? "waiting" : "off");

  useEffect(() => {
    if (!enabled) {
      setState("off");
      return;
    }
    let ws = null;
    let timer = null;
    let delay = 2000;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      setState("waiting");
      try {
        ws = new WebSocket(BRIDGE_URL);
      } catch {
        schedule();
        return;
      }
      ws.onopen = () => {
        delay = 2000;
        setState("connected");
      };
      ws.onmessage = async (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.type !== "call") return;
        let reply;
        try {
          reply = { type: "result", id: msg.id, ok: true, text: await runTool(msg.name, msg.args, { api: ref.current, engine, runtime }) };
        } catch (err) {
          reply = { type: "result", id: msg.id, ok: false, text: String(err?.message ?? err) };
        }
        ws.send(JSON.stringify(reply));
      };
      ws.onclose = (ev) => {
        if (stopped) return;
        if (ev.code === 4000) {
          // another editor tab took over the bridge: wait until this tab is used again
          setState("waiting");
          const retake = () => {
            removeEventListener("focus", retake);
            delay = 2000;
            connect();
          };
          addEventListener("focus", retake);
          return;
        }
        setState("waiting");
        schedule();
      };
    };
    // back off while Claude is not running, to keep the console quiet
    const schedule = () => {
      clearWorkerTimeout(timer);
      timer = setWorkerTimeout(connect, delay); // not throttled in hidden tabs
      delay = Math.min(delay * 1.5, 15000);
    };

    connect();
    return () => {
      stopped = true;
      clearWorkerTimeout(timer);
      ws?.close();
    };
  }, [enabled]);

  return state;
}
