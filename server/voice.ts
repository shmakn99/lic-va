import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { voiceOriginAllowed } from "../lib/voice/deployment";
import { attachVoiceSocket, VoiceAdmission } from "../lib/voice/socket";

const secret = process.env.VOICE_SESSION_SECRET?.trim();
if (!secret || secret.length < 32) throw new Error("VOICE_SESSION_SECRET must contain at least 32 characters");
const port = Number(process.env.VOICE_PORT || 3001);
const admission = new VoiceAdmission();
const server = createServer((request, response) => {
  response.writeHead(request.url === "/health" ? 200 : 404);
  response.end(request.url === "/health" ? "ok" : "Not found");
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 200_000, perMessageDeflate: false });
server.on("upgrade", (request, socket, head) => {
  const origin = request.headers.origin || "";
  if (request.url !== "/voice" || !voiceOriginAllowed(origin)) {
    socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); return;
  }
  const release = admission.reserve(request.socket.remoteAddress || "unknown", Number(process.env.VOICE_MAX_SESSIONS || 10));
  if (!release) { socket.end("HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n"); return; }
  socket.once("close", release);
  try {
    wss.handleUpgrade(request, socket, head, ws => attachVoiceSocket(ws, { origin, secret, release }));
  } catch { release(); socket.destroy(); }
});
server.listen(port, process.env.VOICE_HOST || "127.0.0.1", () => console.info(`Voice service listening on ${port}`));
function shutdown() { for (const ws of wss.clients) ws.close(1001, "Server stopping"); wss.close(); server.close(); setTimeout(() => process.exit(0), 2000).unref(); }
process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
