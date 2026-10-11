import { issueTicket } from "@/lib/voice/auth";
import { voiceDeployment, voiceOriginAllowed } from "@/lib/voice/deployment";
import { ApiError, boundedBody, errorResponse } from "@/lib/http";
import { z } from "zod";
export const runtime = "nodejs";
const schema = z.object({ challenge: z.string().uuid() }).strict();
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || !voiceOriginAllowed(origin, request.url)) return Response.json({ error: "Origin rejected" }, { status: 403 });
  const deployment = voiceDeployment();
  if (!deployment.enabled)
    return Response.json({ error: "Live conversation is unavailable. Use recording or typing." }, { status: 503 });
  try {
    // Next.js may expose an empty POST as a stream rather than a null body.
    const bytes = request.body ? await boundedBody(request, 1024) : undefined;
    let challenge: string | undefined;
    if (bytes?.byteLength) {
      let body: unknown;
      try { body = JSON.parse(new TextDecoder().decode(bytes)); }
      catch { throw new ApiError(400, "Send a valid JSON request."); }
      challenge = schema.parse(body).challenge;
    }
    const url = deployment.builtin ? `${origin.replace(/^http/, "ws")}/api/voice/socket` : deployment.url;
    return Response.json({
      url, authentication: "challenge",
      ...(challenge ? { ticket: issueTicket(deployment.secret, origin, Date.now(), challenge) } : {}),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
