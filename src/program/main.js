// Program viewer (e.g. OBS Browser Source): receives the active camera from the
// editor over WebRTC and shows it full-size. Reconnects automatically.
const video = document.getElementById("video");
const wait = document.getElementById("wait");
let ws = null;
let pc = null;
let sender = null;

const showWaiting = (on) => wait.classList.toggle("hidden", !on);
const send = (msg) => ws?.readyState === 1 && ws.send(JSON.stringify(msg));

function resetPeer() {
  pc?.close();
  pc = null;
  video.srcObject = null;
  showWaiting(true);
}

function connect() {
  ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/gf-signal`);
  ws.onopen = () => send({ type: "hello", role: "viewer" });
  ws.onmessage = async (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === "offer") {
      resetPeer();
      sender = m.from;
      pc = new RTCPeerConnection();
      pc.onicecandidate = (e) => e.candidate && send({ type: "ice", to: sender, candidate: e.candidate });
      pc.ontrack = (e) => {
        // play frames as soon as they arrive (lowest latency)
        try {
          e.receiver.jitterBufferTarget = 0;
        } catch {}
        try {
          e.receiver.playoutDelayHint = 0;
        } catch {}
        video.srcObject = e.streams[0];
        showWaiting(false);
      };
      pc.onconnectionstatechange = () => ["failed", "closed"].includes(pc?.connectionState) && resetPeer();
      await pc.setRemoteDescription(m.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: "answer", to: sender, sdp: pc.localDescription });
    } else if (m.type === "ice" && pc) {
      try {
        await pc.addIceCandidate(m.candidate);
      } catch {}
    } else if (m.type === "bye") {
      resetPeer();
    }
  };
  ws.onclose = () => {
    resetPeer();
    setTimeout(connect, 2000);
  };
}

connect();
