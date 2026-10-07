# Deployment preparation

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

The chat handler reads the three `content/*.md` files at runtime. Next.js includes these in its production file trace; retain them in the repository. JSON sources and introductions are imported into the server bundle. There are no runtime filesystem writes.

## Environment variables

Set these in Vercel before deploying. Configure Production and, if preview deployments should call Sarvam, Preview separately. Never prefix these names with `NEXT_PUBLIC_`.

| Variable | Required | Default / purpose |
| --- | --- | --- |
| `SARVAM_API_KEY` | Yes for live features | Server-only Sarvam credential with model access and credits |
| `SARVAM_CHAT_MODEL` | No | `sarvam-105b-conversations` |
| `SARVAM_STT_MODEL` | No | `saaras:v4` |
| `SARVAM_TTS_MODEL` | No | `bulbul:v3` |
| `SARVAM_VOICE` | No | `shubh` |

The production build does not require an API key. Locally, copy `.env.example` to `.env.local` and supply the key. All real `.env` files are ignored by Git. `NODE_USE_SYSTEM_CA=1` is only a local option for networks using a corporate certificate authority; it is not an app requirement on Vercel.

## Services and state

- Outbound HTTPS requests go to `https://api.sarvam.ai` for chat, transcription and speech.
- No database, storage service, authentication provider, OAuth callback or migration is required.
- Conversations and pasted documents live in the browser tab; requests send the relevant text/audio to Sarvam.
- No app login or application rate limit is implemented. A reachable deployment can incur Sarvam usage from visitors. For the attended demo, configure deployment access protection before sharing the URL, consistent with the implementation plan.
- Official LIC PDFs are source links. Python source-preparation scripts are development utilities and are not needed during deployment.

## Hosting limits

Vercel limits function request and response payloads to 4.5 MB. Recordings are capped at 4 MiB before upload; the server allows 64 KiB of multipart overhead. Chat/transcription declare a 60-second function ceiling and speech 30 seconds, leaving room around the existing provider timeouts of 30 and 15 seconds. These settings do not extend the browser's request timeouts.

Speech currently returns base64 WAV data in JSON. Check long English and Hindi answers in the deployed smoke test because responses also share the platform payload limit. The text answer remains available when audio fails.

References: [Vercel payload limits](https://vercel.com/docs/functions/limitations), [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## First deployment checks

1. Import `shmakn99/lic-va` in Vercel and use `main` as the production branch.
2. Apply the settings and environment variables above; configure demo access protection.
3. Deploy, review the build logs and open the HTTPS URL.
4. Verify `/api/status` reports `configured: true` without exposing credentials.
5. Test all three plans, English/Hindi chat, source links, custom document input, microphone transcription and speech playback, including a long answer.
6. Confirm pull requests receive previews and merges to `main` deploy to production.

Preparation and local checks do not establish that a Vercel deployment has succeeded; repeat the live checks on the deployed URL.
