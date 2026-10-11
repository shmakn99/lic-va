# Deployment review — 11 October 2026

Target: `shmakn99/lic-va`, branch `main`, production `https://lic-va.vercel.app`.

## Findings addressed

- The live service previously existed only as a separately launched Node process.
  Added the Vercel Next.js WebSocket adapter using the same session coordinator.
- Added connection-specific challenge tickets: a ticket cannot authenticate a
  different socket, including on another Fluid instance. Provider work starts
  only after authentication. Origin checks, bounded payloads, admission limits,
  and cleanup are shared with the standalone service.
- Added renewal at 270 seconds within the route's 300-second function limit.
  Reconnect obtains a fresh ticket and never resubmits the previous question.
  Partial microphone capture/VAD state is cleared on disconnect.
- Readiness now rejects missing provider credentials, short secrets and insecure
  production WebSocket configuration. Vercel defaults to its own WSS origin.
- A real-browser check found empty streamed POST bodies were rejected during
  discovery. Fixed this and added a regression assertion.
- Explicitly included plan Markdown in both function traces and added an automated
  build-artifact check. Oversized speech now returns a recoverable small JSON error.
- Added GitHub Actions checks for clean installation, types, tests, production
  build, traced content and browser regressions.

## Evidence

- Clean `npm ci`, type checking, production build and trace checks passed from an
  isolated staged-source copy with no `.env.local` or API credentials.
- `npm test`: 38 passing contract/integration tests, including a real WebSocket
  handshake through the installed Vercel SDK with a simulated runtime bridge,
  replay rejection, origin/configuration checks and timed connection renewal.
- Controlled Chromium suite against the production build: 31 passed; the two
  provider-dependent scenarios were subsequently run separately.
- Real Sarvam live-browser scenario passed in English and Hindi: synthetic
  microphone, realtime STT, validated chat, PCM playback, barge-in and the next
  response. Both measurement exports show one listening connection and no
  disconnect, generation failure or audio failure events.
- Real HTTP-provider smoke passed for chat, English/Hindi transcription and speech.
- Real recording-mode browser checks passed for all three plans in both languages
  (six combinations), covering native recording upload, transcript, grounded answer
  and playback controls.
- npm audits reported zero known vulnerabilities. The tracked-file scan found no
  current local credential values, private-key blocks, or real environment files.

## Required hosted verification

This device is restricted from Vercel; no bypass was attempted. Local results and
GitHub deployment status do not establish that the hosted voice path works.

On an unrestricted device, apply the settings in [deployment.md](deployment.md):
Fluid compute, `VOICE_STREAMING_ENABLED=true`, a random `VOICE_SESSION_SECRET`
of at least 32 characters, and the existing Sarvam key. Leave `VOICE_PUBLIC_URL`
unset for the built-in route. Redeploy after environment changes. Confirm status,
both languages, interruptions, long audio, and renewal beyond 4.5 minutes.

WebSockets and the Next.js upgrade API are beta/experimental. A renewal can
interrupt the current utterance/response. Admission limits are per instance;
the app has no end-user login or global usage quota. Keep demo access protection
for attended use. These are known rollout limits, not claims of unrestricted
production hardening or zero possible defects.

Tests use synthetic microphone input. Physical microphone/speaker behavior and
acoustic echo still need a device check. Structural/citation/evidence validation
does not prove semantic accuracy of every generated insurance explanation.
