# Repeated live conversation disconnects — 11 October 2026

## Confirmed cause

The running production instance was launched with `node scripts/run-app.mjs
start`. Its Node processes did not enable the OS certificate trust store.
The Sarvam speech WebSocket TLS handshake failed with
`UNABLE_TO_GET_ISSUER_CERT_LOCALLY` / `unable to get local issuer certificate`.

This was a server-to-provider failure. Reproduction did not require microphone
access: the session ticket endpoint returned HTTP 200, the local WebSocket opened
and authenticated (`ready`), then it closed with code 1011 and reason
`Session failed; reconnect` before ever sending `listening`.

The original provider adapter discarded the TLS error. The server discarded the
remaining exception and closed the browser connection. The browser repeated the
same setup three times before displaying the reported generic disconnect error.

`start-local.ps1` already set `NODE_USE_SYSTEM_CA=1`, but the shared JavaScript
launcher did not. Consequently, passing earlier provider/browser checks under a
certificate-enabled shell did not establish that a later `npm start` would work.

## Evidence isolating the cause

| Check | Result |
| --- | --- |
| Running app `/api/status` | Configured and streaming enabled |
| Running app ticket endpoint | HTTP 200 |
| Original app WebSocket setup | `ready`, then close 1011; no `listening` |
| Direct Sarvam connection with existing key/model and default Node trust | TLS issuer-certificate failure |
| Same direct connection with `--use-system-ca` | WebSocket opens; Sarvam sends `session.begin` |
| Rebuilt/restarted app using corrected launcher | HTTP 200, `ready`, then `listening` |

The direct checks used Node 24.21.0 and identical provider parameters and
credentials. The change in trust configuration alone resolved the handshake.
This establishes missing system trust as the local cause; it does not identify
which network appliance or certificate issuer introduced that requirement.
No API key, model, audio format or certificate-verification bypass was needed.

Node documents that [`--use-system-ca`](https://nodejs.org/download/release/v24.20.0/docs/api/cli.html#--use-system-ca)
adds OS-trusted CAs alongside its bundled certificates. The provider endpoint and
message format were also checked against the
[Sarvam realtime STT documentation](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/realtime-streaming).

## Changes

- `scripts/run-app.mjs` enables system trust explicitly on both spawned services,
  for development and production, independent of the parent shell.
- Standalone web/voice startup and provider smoke scripts use the same trust flag.
- Provider connection failures are classified into safe certificate, credentials,
  rate-limit, configuration and network errors. STT setup sends the error before
  closing, so an unrecoverable setup failure no longer produces a futile retry
  loop. Logs and measurements include the stage and safe error code, without
  provider response bodies, credentials or transcripts.
- Browser diagnostics record socket close codes, ticket HTTP failures and setup
  timeouts. The setup deadline now covers authentication/provider setup through
  `listening`, rather than ending as soon as the local socket opens.
- A stable connection restores the retry budget after 30 seconds. Previously
  disconnects accumulated for the entire call, including after successful recovery.
  Policy rejection stops immediately. Existing interrupted-history handling and
  prevention of duplicate question replay remain in place.
- New user-facing errors have Hindi translations. Regression tests cover provider
  setup failure, cancellation during setup, error persistence, setup timeout,
  policy rejection and recovery across multiple separated network outages.

## Validation and current state

- `npm test`: **30 passed**.
- `npm run typecheck`: **passed**.
- `npm run build`: **passed**.
- Streaming browser regression suite: **10 passed**.
- `npm run smoke:streaming`: **TTS, STT, English chat and Hindi chat passed**.
- Real-provider browser test: **passed**, both English and Hindi. Each language
  exercised synthetic microphone capture, transcription, validated responses,
  PCM playback, interruption by a second utterance, and completed playback of
  the next response. Both sessions recorded one connection reaching `listening`
  and no disconnect, generation-failure or audio-failure events.
- Verified both running service command lines include `--use-system-ca`.
- Repeated the original ticket/WebSocket probe against the restarted application;
  it now reaches `listening` successfully.

Local evidence is in `.local/streaming-capabilities.json`,
`.local/streaming-browser-check.json`, and the language-specific
`.local/streaming-browser-en-IN.json` / `streaming-browser-hi-IN.json` exports.
These are ignored local artifacts. The successful real-browser run completed at
16:06 IST on 11 October 2026.

The rebuilt production application is running at `http://127.0.0.1:3000`.
Refresh an existing browser tab to replace its old JavaScript. Subsequent launches
through `npm start` or `npm run dev` retain the fix.

The end-to-end checks used a synthetic microphone and browser audio rendering;
physical microphone quality, speaker audibility and acoustic echo cancellation
were not measured. A passing finite run does not guarantee against future network
or provider outages; those now have more useful diagnostics and bounded recovery.
