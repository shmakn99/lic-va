export class VoiceProviderError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

// Only allowlisted diagnostics leave the provider boundary. Never forward raw
// provider bodies, URLs, headers or error messages that could echo user content.
export function providerConnectionError(error?: unknown, status?: number): VoiceProviderError {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (["UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT", "CERT_HAS_EXPIRED", "ERR_TLS_CERT_ALTNAME_INVALID"].includes(String(code)))
    return new VoiceProviderError("provider_tls", "The voice service could not verify the speech provider's secure connection. Restart the app with system certificates enabled; if it persists, check the server certificate configuration.");
  if (status === 401 || status === 403)
    return new VoiceProviderError("provider_auth", "Sarvam rejected the API key or model access. Check the server credentials.");
  if (status === 429)
    return new VoiceProviderError("provider_rate_limit", "Sarvam is rate-limiting requests. Wait a moment, then retry.");
  if (status === 400 || status === 404 || status === 422)
    return new VoiceProviderError("provider_config", "Sarvam could not process this request. Check model access or try a shorter question.");
  return new VoiceProviderError("provider_connection", "The voice service could not connect to the speech provider. Check the server network and try again.");
}
