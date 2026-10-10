// WebMCP: exposes the editor to AI agents running inside the browser.
//
// Current draft API: document.modelContext.registerTool(tool, { signal }) (Chrome 146+,
// chrome://flags/#enable-webmcp-testing or the origin trial). Falls back to the older
// navigator.modelContext location. Without either, nothing happens.
import { useEffect, useRef } from "react";
import { TOOLS, runTool } from "../agent/tools.js";
import { engine, runtime } from "./core.js";

export const webMcpAvailable = () => !!(document.modelContext ?? navigator.modelContext);

/** Registers the shared agent tools while the editor is mounted. `api` = graph + setters. */
export function useWebMcp(api) {
  const ref = useRef(api);
  ref.current = api;

  useEffect(() => {
    const mc = document.modelContext ?? navigator.modelContext;
    if (!mc?.registerTool) return;
    const controller = new AbortController();
    (async () => {
      for (const t of TOOLS) {
        try {
          await mc.registerTool(
            {
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
              ...(t.annotations ? { annotations: t.annotations } : {}),
              execute: (args) => runTool(t.name, args, { api: ref.current, engine, runtime }),
            },
            { signal: controller.signal },
          );
        } catch (err) {
          console.warn("WebMCP: could not register", t.name, err);
        }
      }
    })();
    return () => controller.abort();
  }, []);
}
