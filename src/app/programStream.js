// Sends the program feed (active camera) to every program.html viewer over WebRTC.
// The video stays on this machine (peer-to-peer on localhost); the dev server only
// relays the signaling messages (see vite.config.js).
//
// Only one editor tab streams at a time ("primary"); other tabs stay on standby
// and can take over with claim().
import { useEffect, useRef, useState } from "react";
import { runtime } from "./core.js";
import { setWorkerTimeout, clearWorkerTimeout } from "./timers.js";

const MAX_BITRATE = 8_000_000;

/** Prefer H.264 (hardware encoder on Mac), then VP8; the viewer picks what it supports. */
function preferCodecs(transceiver) {
  const caps = window.RTCRtpSender?.getCapabilities?.("video")?.codecs;
  if (!caps || !transceiver.setCodecPreferences) return;
  const rank = (c) => (/h264/i.test(c.mimeType) ? 0 : /vp8/i.test(c.mimeType) ? 1 : /rtx|red|ulpfec/i.test(c.mimeType) ? 3 : 2);
  try {
    transceiver.setCodecPreferences([...caps].sort((a, b) => rank(a) - rank(b)));
  } catch {}
}

/**
 * Localhost has plenty of bandwidth: start (and stay) at a high bitrate instead of
 * WebRTC's slow ramp-up from a tiny picture. Chrome reads these x-google-* hints.
 */
function boostBitrate(sdp) {
  const pts = [...sdp.matchAll(/^a=rtpmap:(\d+) (VP8|VP9|H264|AV1)\/90000/gm)].map((m) => m[1]);
  const hint = "x-google-start-bitrate=6000;x-google-min-bitrate=2500;x-google-max-bitrate=8000";
  let out = sdp;
  for (const pt of pts) {
    const fmtp = new RegExp(`^a=fmtp:${pt} (.*)$`, "m");
    if (fmtp.test(out)) out = out.replace(fmtp, (line) => (line.includes("x-google-start-bitrate") ? line : `${line};${hint}`));
    else out = out.replace(new RegExp(`^(a=rtpmap:${pt} .*)$`, "m"), `$1\r\na=fmtp:${pt} ${hint}`);
  }
  return out;
}

/** @returns {{ viewers: number, role: "connecting" | "primary" | "standby", claim: () => void }} */
export function useProgramStream() {
  const [viewers, setViewers] = useState(0);
  const [role, setRole] = useState("connecting");
  const wsRef = useRef(null);

  useEffect(() => {
    let ws = null;
    let stopped = false;
    let timer = null;
    const pcs = new Map(); // viewer id → RTCPeerConnection
    window.__gfProgramPeers = pcs; // for diagnostics (getStats) from the console / tools
    const update = () => setViewers([...pcs.values()].filter((pc) => pc.connectionState === "connected").length);
    const send = (msg) => ws?.readyState === 1 && ws.send(JSON.stringify(msg));
    const closeAll = () => {
      pcs.forEach((pc) => pc.close());
      pcs.clear();
      update();
    };

    const offerTo = async (viewer) => {
      pcs.get(viewer)?.close();
      const stream = runtime.programStream();
      const pc = new RTCPeerConnection();
      pcs.set(viewer, pc);
      for (const track of stream.getVideoTracks()) {
        track.contentHint = "motion";
        const tr = pc.addTransceiver(track, { direction: "sendonly", streams: [stream] });
        preferCodecs(tr);
        const p = tr.sender.getParameters();
        p.encodings = [{ ...(p.encodings?.[0] ?? {}), maxBitrate: MAX_BITRATE, maxFramerate: 30 }];
        p.degradationPreference = "maintain-resolution"; // localhost has bandwidth to spare; keep the full picture
        tr.sender.setParameters(p).catch(() => {});
      }
      pc.onicecandidate = (e) => e.candidate && send({ type: "ice", to: viewer, candidate: e.candidate });
      pc.onconnectionstatechange = () => {
        if (["failed", "closed"].includes(pc.connectionState)) pcs.delete(viewer);
        update();
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription({ type: "offer", sdp: boostBitrate(offer.sdp) });
      send({ type: "offer", to: viewer, sdp: pc.localDescription });
    };

    const connect = () => {
      if (stopped) return;
      ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/gf-signal`);
      wsRef.current = ws;
      ws.onopen = () => send({ type: "hello", role: "sender" });
      ws.onmessage = async (ev) => {
        const m = JSON.parse(ev.data);
        if (m.type === "primary") setRole("primary");
        else if (m.type === "standby") {
          setRole("standby");
          closeAll();
        } else if (m.type === "viewer-joined") offerTo(m.from);
        else if (m.type === "answer") await pcs.get(m.from)?.setRemoteDescription(m.sdp);
        else if (m.type === "ice") {
          try {
            await pcs.get(m.from)?.addIceCandidate(m.candidate);
          } catch {}
        } else if (m.type === "viewer-left") {
          pcs.get(m.from)?.close();
          pcs.delete(m.from);
          update();
        }
      };
      ws.onclose = () => {
        closeAll();
        setRole("connecting");
        if (!stopped) timer = setWorkerTimeout(connect, 2000); // not throttled in hidden tabs
      };
    };

    connect();
    return () => {
      stopped = true;
      clearWorkerTimeout(timer);
      ws?.close();
      closeAll();
    };
  }, []);

  const claim = () => wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify({ type: "claim" }));
  return { viewers, role, claim };
}
