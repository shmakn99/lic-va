# Deployment preparation

Live conversation now has a Vercel route at `/api/voice/socket`, using Vercel's
WebSocket beta and Fluid compute. It shares the local voice coordinator, validates
connection-bound tickets, and renews connections before the function duration limit.
No separate voice host is required. The local two-process launcher remains available.
See [streaming voice deployment](streaming-voice.md#deployment) for both layouts.

Target repository: public `shmakn99/lic-va`, production branch `main`.

## Runtime and build

- Framework: Next.js with Node route handlers; this app requires a server runtime.
- Root directory: repository root.
- Node.js: `24.x`, pinned in `package.json`.
- Package manager: npm with committed `package-lock.json`.
- Install command: `npm ci`.
- Build command: `npm run build`.
- Output directory: keep Vercel's Next.js default.
- No custom Vercel configuration file is required.

Both chat and live voice read the three `content/*.md` files at runtime. Explicit
file-tracing includes in `next.config.ts` retain them in both function bundles.
`npm run check:build` verifies their presence after a build. JSON sources and
introductions are imported into the server bundle. There are no runtime filesystem writes.

## Environment variables

Set these in Vercel before deploying. Configure Production and, if preview deployments should call Sarvam, Preview separately. Never prefix these names with `NEXT_PUBLIC_`.

| Variable | Required | Default / purpose |
| --- | --- | --- |
| `SARVAM_API_KEY` | Yes for live features | Server-only Sarvam credential with model access and credits |
| `SARVAM_CHAT_MODEL` | No | `sarvam-105b-conversations` |
| `SARVAM_STT_MODEL` | No | `saaras:v4` |
| `SARVAM_TTS_MODEL` | No | `bulbul:v3` |
| `SARVAM_VOICE` | No | `shubh` |
| `VOICE_STREAMING_ENABLED` | Yes for live conversation | `true` |
| `VOICE_SESSION_SECRET` | Yes for live conversation | Generate a random secret of at least 32 characters; do not commit it |
| `VOICE_PUBLIC_URL` | Leave unset on Vercel | Automatically uses `wss://<current-origin>/api/voice/socket`; never copy the localhost value to Vercel |
| `VOICE_ALLOWED_ORIGINS` | Optional | Unset: same-origin only on Vercel, including previews. Production-only restriction: `https://lic-va.vercel.app` |
| `VOICE_MAX_SESSIONS` | No | `10` per function instance, not a global quota |
| `VOICE_VALIDATION_MODE` | No | `segments`; use `whole` to validate a complete answer before streaming audio |

On an unrestricted device, open the existing **lic-va** Vercel project:

1. Confirm Node 24 and **Fluid compute** are enabled.
2. Retain the server-only Sarvam variables. Add `VOICE_STREAMING_ENABLED=true` and
   `VOICE_SESSION_SECRET` to Production (and Preview if desired).
   Generate a secret locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
3. Remove any localhost `VOICE_PUBLIC_URL` / `VOICE_ALLOWED_ORIGINS` copied from
   `.env.example`, or set the production origin above. Keep `VOICE_PUBLIC_URL` unset
   for the built-in Vercel endpoint.
4. Push to `main`, or redeploy the latest commit if these settings were changed
   after the automatic deployment. Environment changes require a new deployment.

The explicit `true` flag and a valid secret are required; missing settings leave
recording and typing available while hiding the live control. `/api/status` is a
configuration check, not a provider health or WebSocket availability guarantee.

The production build does not require an API key. Locally, copy `.env.example` to `.env.local` and supply the key. All real `.env` files are ignored by Git. `NODE_USE_SYSTEM_CA=1` is only a local option for networks using a corporate certificate authority; it is not an app requirement on Vercel.

## Services and state

- Outbound HTTPS requests go to `https://api.sarvam.ai` for chat, transcription and speech.
- No database, storage service, authentication provider, OAuth callback or migration is required.
- Conversations and pasted documents live in the browser tab; requests send the relevant text/audio to Sarvam.
- No app login or application rate limit is implemented. A reachable deployment can incur Sarvam usage from visitors. For the attended demo, configure deployment access protection before sharing the URL, consistent with the implementation plan.
- Official LIC PDFs are source links. Python source-preparation scripts are development utilities and are not needed during deployment.

## Hosting limits

Vercel limits function request and response payloads to 4.5 MB. Recordings are capped at 4 MiB before upload; the server allows 64 KiB of multipart overhead. Chat/transcription declare a 60-second function ceiling and speech 30 seconds, leaving room around the existing provider timeouts of 30 and 15 seconds. These settings do not extend the browser's request timeouts.

Speech returns base64 WAV data in JSON. Audio over 4,000,000 encoded bytes returns
a small recoverable error before reaching the platform response limit. The text
answer remains available. Check long English and Hindi answers in the deployed smoke test.

The voice route declares a 300-second duration and closes at 270 seconds with code
1001 so the browser can reconnect with a fresh ticket and completed/played context.
An in-progress utterance or answer may be interrupted at renewal; it is never
automatically replayed. Session and connection admission limits apply per instance.
Use Vercel Firewall/rate limits for a deployment-wide abuse boundary if sharing publicly.

References: [Vercel payload limits](https://vercel.com/docs/functions/limitations), [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## First deployment checks

1. Import `shmakn99/lic-va` in Vercel and use `main` as the production branch.
2. Apply the settings and environment variables above; configure demo access protection.
3. Deploy, review the build logs and open the HTTPS URL.
4. Verify `/api/status` reports `configured: true` and `streaming: true` without exposing credentials.
5. Test all three plans, English/Hindi chat, source links, custom document input, microphone transcription and speech playback, including a long answer.
6. Confirm pull requests receive previews and merges to `main` deploy to production.
7. Start live conversation in both languages; verify transcription, answers, audio,
   interruption, End, and a conversation lasting beyond 4.5 minutes. Confirm renewal
   reconnects without duplicating the previous question. Check function logs for errors.

GitHub Actions runs clean installation, type checking, contract/integration tests,
the production build, bundle checks and the controlled Chromium suite. It is an
independent check; it does not block Vercel's automatic deployment by itself.

Preparation and local checks do not establish that a Vercel deployment has succeeded; repeat the live checks on the deployed URL.
