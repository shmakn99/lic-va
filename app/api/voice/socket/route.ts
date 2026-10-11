import { experimental_upgradeWebSocket, ipAddress } from "@vercel/functions";
import { voiceDeployment, voiceOriginAllowed } from "@/lib/voice/deployment";
import { attachVoiceSocket, VoiceAdmission } from "@/lib/voice/socket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const admission = new VoiceAdmission();

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !voiceOriginAllowed(origin, request.url)) return new Response("Origin rejected", { status: 403 });
  const deployment = voiceDeployment();
  if (!deployment.enabled || !deployment.builtin) return new Response("Live conversation unavailable", { status: 503 });
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return new Response("WebSocket required", { status: 426 });
  const release = admission.reserve(ipAddress(request) || "unknown", Number(process.env.VOICE_MAX_SESSIONS || 10));
  if (!release) return new Response("Voice capacity reached", { status: 429 });
  try {
    return await experimental_upgradeWebSocket(ws => {
      attachVoiceSocket(ws, { origin, secret: deployment.secret, release, lifetimeMs: 270_000 });
    }, { maxPayload: 200_000 });
  } catch {
    release();
    return new Response("WebSocket upgrade unavailable", { status: 503 });
  }
}
