/** Server-only deployment settings. Never send credentials in status responses. */
export function voiceDeployment(env: Record<string, string | undefined> = process.env) {
  const vercel = env.VERCEL === "1";
  const secret = env.VOICE_SESSION_SECRET?.trim() || "";
  const configuredUrl = env.VOICE_PUBLIC_URL?.trim();
  const builtin = vercel && !configuredUrl;
  const url = configuredUrl || (builtin ? "" : "ws://127.0.0.1:3001/voice");
  let validUrl = builtin;
  if (url) {
    try {
      const parsed = new URL(url);
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
      validUrl = !parsed.username && !parsed.password && !parsed.hash &&
        (parsed.protocol === "wss:" || (!vercel && local && parsed.protocol === "ws:"));
    } catch { /* Invalid configuration disables the live control. */ }
  }
  return {
    builtin, url, secret,
    enabled: env.VOICE_STREAMING_ENABLED === "true" && secret.length >= 32 &&
      Boolean(env.SARVAM_API_KEY?.trim()) && validUrl,
  };
}

export function voiceOriginAllowed(origin: string | null, requestUrl?: string, env: Record<string, string | undefined> = process.env) {
  if (!origin) return false;
  const explicit = env.VOICE_ALLOWED_ORIGINS?.split(",").map(value => value.trim()).filter(Boolean);
  if (explicit?.length) return explicit.includes(origin);
  // Vercel supplies the request URL. Do not reflect an arbitrary Origin header.
  if (env.VERCEL === "1" && requestUrl) return origin === new URL(requestUrl).origin;
  return ["http://127.0.0.1:3000", "http://localhost:3000"].includes(origin);
}
