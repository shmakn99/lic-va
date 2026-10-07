import { ApiError } from "./http";
export const settings = () => ({
  chat: process.env.SARVAM_CHAT_MODEL || "sarvam-105b",
  stt: process.env.SARVAM_STT_MODEL || "saaras:v4",
  tts: process.env.SARVAM_TTS_MODEL || "bulbul:v3",
  voice: process.env.SARVAM_VOICE || "shubh",
});
export async function sarvam(
  path: string,
  body: object | FormData,
  signal: AbortSignal,
): Promise<unknown> {
  const key = process.env.SARVAM_API_KEY;
  if (!key?.trim())
    throw new ApiError(
      503,
      "Add SARVAM_API_KEY to .env.local and restart the local app.",
    );
  const form = body instanceof FormData;
  const start = performance.now();
  try {
    const response = await fetch(`https://api.sarvam.ai${path}`, {
      method: "POST",
      signal,
      cache: "no-store",
      headers: {
        "api-subscription-key": key,
        ...(form ? {} : { "Content-Type": "application/json" }),
      },
      body: form ? body : JSON.stringify(body),
    });
    if (!response.ok) {
      console.warn(`Sarvam ${path}: HTTP ${response.status}`);
      // Never forward provider bodies, which may echo request content or credentials.
      if ([401, 403].includes(response.status))
        throw new ApiError(
          502,
          "Sarvam rejected the API key or model access. Check the server credentials.",
        );
      if (response.status === 429)
        throw new ApiError(
          429,
          "Sarvam is rate-limiting requests. Wait a moment, then retry.",
        );
      if ([400, 422].includes(response.status) && path === "/speech-to-text")
        throw new ApiError(
          502,
          "Sarvam could not read this recording. Refresh the page and record again, or type your question.",
        );
      if ([400, 404, 422].includes(response.status))
        throw new ApiError(
          502,
          "Sarvam could not process this request. Check model access or try a shorter question.",
        );
      throw new ApiError(502, "Sarvam is unavailable right now. Please retry.");
    }
    return await response.json();
  } finally {
    console.info(`Sarvam ${path}: ${Math.round(performance.now() - start)}ms`);
  }
}
