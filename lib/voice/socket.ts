import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import { verifyTicket } from "./auth";
import { clientEventSchema, limits, type ServerEvent } from "./protocol";
import { VoiceSession } from "./session";

/** Limits are per process/Fluid instance, not a deployment-wide quota. */
export class VoiceAdmission {
  private active = 0;
  private attempts = new Map<string, { count: number; expires: number }>();
  reserve(address: string, maximum = 10, now = Date.now()) {
    for (const [key, value] of this.attempts) if (value.expires <= now) this.attempts.delete(key);
    if (!Number.isInteger(maximum) || maximum < 1 || this.active >= maximum) return;
    if (!this.attempts.has(address) && this.attempts.size >= 10_000) return;
    const bucket = this.attempts.get(address) || { count: 0, expires: now + 60_000 };
    bucket.count++; this.attempts.set(address, bucket);
    if (bucket.count > 30) return;
    this.active++;
    let released = false;
    return () => { if (!released) { released = true; this.active--; } };
  }
}

type SessionFactory = (send: (event: ServerEvent) => void, terminate: () => void) => VoiceSession;
export function attachVoiceSocket(ws: WebSocket, options: {
  origin: string; secret: string; release: () => void; lifetimeMs?: number;
  createSession?: SessionFactory;
}) {
  const challenge = randomUUID();
  let session: VoiceSession | undefined;
  let configured = false;
  let messages = 0;
  let lastWindow = Date.now();
  let closed = false;
  const authTimeout = setTimeout(() => ws.close(1008, "Authentication required"), 10_000);
  // Reconnect before Vercel's hard limit, leaving time for cleanup.
  const lifetime = options.lifetimeMs ? setTimeout(() => {
    session?.close(); ws.close(1001, "Connection renewal");
  }, options.lifetimeMs) : undefined;
  const cleanup = () => {
    if (closed) return;
    closed = true; clearTimeout(authTimeout); clearTimeout(lifetime);
    session?.close(); options.release();
  };
  ws.on("close", cleanup);
  ws.on("error", () => { cleanup(); ws.terminate(); });
  ws.on("message", (data, binary) => {
    if (closed) return;
    try {
      if (Date.now() - lastWindow >= 1000) { messages = 0; lastWindow = Date.now(); }
      if (++messages > 100) throw new Error("Message rate exceeded");
      if (binary) {
        if (!session || !configured) throw new Error("Not ready");
        session.audio(Buffer.from(data as Buffer)); return;
      }
      const event = clientEventSchema.parse(JSON.parse(data.toString()));
      if (!session) {
        if (event.type !== "authenticate") throw new Error("Authentication required");
        // Binding to this socket prevents cross-instance replay without a database.
        verifyTicket(event.ticket, options.secret, options.origin, Date.now(), challenge);
        clearTimeout(authTimeout);
        const create = options.createSession || ((send, terminate) => new VoiceSession(send, terminate));
        session = create(event => {
          if (closed || ws.readyState !== WebSocket.OPEN) return;
          if (ws.bufferedAmount > limits.socketBytes) { session?.close(); ws.close(1013, "Slow connection"); return; }
          ws.send(JSON.stringify(event));
        }, () => ws.close(1000));
        ws.send(JSON.stringify({ type: "ready", sessionId: session.id }));
      } else {
        if (event.type === "authenticate") throw new Error("Already authenticated");
        if (event.type === "configure") {
          if (configured) throw new Error("Already configured");
          configured = true;
        } else if (!configured && event.type !== "stop") throw new Error("Configure first");
        void session.handle(event).catch(() => {
          console.warn(JSON.stringify({ component: "voice", stage: "session.handle", sessionId: session?.id, event: event.type, code: "session_failed" }));
          session?.close();
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "error", fatal: true, message: "The live conversation session failed. Start a new conversation or use typing." }));
          ws.close(1011, "Session failed");
        });
      }
    } catch { session?.close(); ws.close(1008, "Invalid session message"); }
  });
  ws.send(JSON.stringify({ type: "challenge", challenge }));
}
