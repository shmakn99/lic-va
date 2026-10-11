# Streaming voice implementation

The live conversation path uses browser AudioWorklet capture and playback, a
TypeScript WebSocket session service, Sarvam realtime STT, streamed chat, and
WebSocket TTS. No voice-agent framework is used. The original recording and HTTP
routes remain available. Live mode is started explicitly and keeps the microphone
open until End live conversation, reset, a context change, or session expiry.

## Run and use

`npm run dev` (or `start-local.ps1`) now launches Next.js on 3000 and the voice
service on 3001. `npm run build` followed by `npm start` runs the same two-process
layout with the production web build. The launcher reads `.env.local`, generates
an ephemeral shared ticket secret if none is configured, and stops both children
when either exits. Node 24 is required. The Sarvam key remains server-only.
Next.js reloads frontend changes during development; restart the launcher after
editing `server/` or the server-side voice modules.

Both launcher children and the standalone `voice:server`, `dev:web` and provider
smoke commands use Node 24's `--use-system-ca`. This adds OS-trusted certificate
authorities to Node's bundled roots while keeping TLS/hostname verification on.
This matters on managed networks: previously only `start-local.ps1` enabled
system trust, so `npm start` could repeatedly fail the Sarvam TLS handshake.
See [Node's certificate trust documentation](https://nodejs.org/download/release/v24.20.0/docs/api/cli.html#--use-system-ca).

## Diagnosing disconnects

- The ticket response and browser socket opening do not establish that Sarvam
  connected. `listening` confirms that speech-provider setup completed.
- Provider setup errors now emit a specific fatal error before the socket closes,
  avoiding retries of certificate, credential or model configuration failures.
  Server logs include `stage: stt.connect`, an opaque session ID and a safe code:
  `provider_tls`, `provider_auth`, `provider_rate_limit`, `provider_config`, or
  `provider_connection`. Raw provider errors, credentials and transcripts are
  excluded. The same code is recorded in exported voice measurements.
- `connection.close_code`, `connection.ticket_http_status`, and
  `connection.setup_timeout` distinguish transport, ticket and setup failures.
  Setup has a 20-second deadline through `listening`, not just WebSocket open.
  Transport failures allow three retries; 30 seconds of established listening
  with working heartbeats restores that budget. Policy rejection (1008) stops
  immediately. Reconnection never resubmits an earlier question.
- Run `npm run smoke:streaming` to independently exercise real TTS, STT and both
  chat languages. Results are written to `.local/streaming-capabilities.json`.
  To test the entire running app with synthetic microphone input, run
  `node --use-system-ca --env-file=.env.local --import tsx node_modules/@playwright/test/cli.js test tests/browser/streaming-live.spec.ts`
  with `LIVE_STREAMING_TEST=1`. This uses real provider requests; it does not
  verify a physical microphone, speakers or acoustic echo cancellation.
- For TLS failures that persist with system trust enabled, check the server's
  approved CA installation or configure `NODE_EXTRA_CA_CERTS` before starting
  Node. Do not disable certificate verification. For independently hosted
  services, use the same trust settings and matching ticket secrets on startup.

## Conversation controls

1. Select the document/plan, answer language, style and optional priority.
2. Click **Start live conversation** and grant microphone access.
3. Speak; partial transcription appears while you talk. Silence commits the turn.
4. Speak again to interrupt, or press **Stop audio**. **Finish my turn** supplies
   silence to finish a VAD utterance without ending the session.
5. **End live conversation** releases the microphone. Recording and typing remain
   available. Changing plan, document, language, style or priority ends live mode
   so an answer cannot use a partially changed configuration.
6. Open **Voice measurements and review**, refresh its snapshot, record a manual
   correctness review, and export JSON. Data is held in this tab (bounded to 5,000
   observations), not retained after refresh. Exports contain timings, event names,
   opaque IDs and review outcomes, not audio, transcripts, document text or keys.

`VOICE_STREAMING_ENABLED=false` disables the live path and starts only the web
app. `npm run dev:web` runs Next.js alone. On Vercel, enable Fluid compute and set
the flag and persistent session secret; the built-in voice route is used automatically
when `VOICE_PUBLIC_URL` is unset.

## Seven-step delivery map

| Step | Implementation |
| --- | --- |
| Baseline/provider capability | Classic STT, validated-answer and playback measurements; `npm run smoke:streaming` exercises the real streaming interfaces and saves `.local/streaming-capabilities.json`. |
| Persistent session | `server/voice.ts`, `lib/voice/session.ts`, `protocol.ts`, and `/api/voice/session`: origin-bound, short-lived, single-use HMAC ticket; one STT connection per session; response/turn IDs; cancellation; limits. |
| Capture and endpointing | `public/voice-worklet.js`: mono PCM, continuous resampling to 16 kHz, 40 ms packets; provider VAD plus local speech detection; partial transcripts, final-turn deduplication, manual finish and 25-second utterance cap. |
| Streaming synthesis/playback | `providers.ts`, `browser-audio.ts`: 24 kHz Linear16 TTS, continuous playback queue, initial buffer, segment markers, audio-thread flush, output-clock estimates and played acknowledgments. |
| Incremental validation | `stream-chat.ts`, `stream-parser.ts`: fragmented SSE/UTF-8 support; complete structured segments checked before release; bounded output; full-answer fallback before any release; no replacement of already released content. |
| Barge-in | `client.ts` and session coordinator: local clear first, invalidate response ID, abort generation, close interrupted TTS connection, reject late output and retain only fully played segments in spoken history. |
| Hardening/rollout | Feature flag, bounded transport/playback queues, session/turn/concurrency limits, heartbeat, reconnect without request replay, tests, measurements and manual review. |

## Answer validation contract

The existing product grounding prompt is shared by HTTP and streaming chat via
`prepareChat`. Streaming requests ask for `{"segments":[answer objects]}`. Each
complete segment passes the existing structural, source-ID, document evidence and
Hindi-script checks before text is displayed or sent to TTS. Every benefit and
its essential qualifications are requested in the same segment. The model may
use one segment when a safe division is not possible.

The checks prove allowed source IDs and matching quote presence, **not semantic
entailment, completeness of conditions, or consistency between segments**. Manual
source-support and material-condition reviews remain necessary; this limitation
also exists in the classic answer validator. The review panel records observations
without claiming automatic factual correctness.

If the first segment or stream fails before release, the existing complete-answer
validation and one-repair path is used. Once a segment has been released, a failed
continuation stops the response and marks it incomplete; the prefix is retained.
No rejected draft is displayed. The protocol also accepts `validation: "whole"`
for controlled rollout of streaming audio with the full-answer validation boundary.
Set `VOICE_VALIDATION_MODE=whole` on the voice service to enforce that boundary
for all clients; `segments` (the default) enables incremental release.

LLM production and TTS consumption overlap. TTS processes accepted segments in
order on one response connection, with a flush/final event per segment so playback
can acknowledge complete segments. Up to eight segments and 2,400 total text
characters are admitted. A very large segment can have slower first audio; there
is no latency threshold or automatic model substitution.

## Measurements, without targets

| Observation | Definition |
| --- | --- |
| `first_audible_response_estimate_ms` (live) | Local speech-end estimate to first non-silent rendered sample mapped to the browser output clock. Excludes turns with no local speech endpoint. |
| Same name (classic) | Submission/recording-stop to the first HTML audio `playing` event. This has a different anchor and precision, so summaries separate modes. |
| `response_start_to_audio_estimate_ms` | Client response-start event to first non-silent output; also available for typed live turns. |
| `interruption_to_output_stop_estimate_ms` | Local detected speech onset to audio-thread clear mapped to output time. Includes the detector's confirmation window. |
| `interrupt_event_to_output_stop_estimate_ms` | Manual/provider/disconnect interruption event to the same clear estimate; kept separate from acoustic-onset measurements. |
| `interrupt_detection_to_output_stop_estimate_ms` | Detection callback to output clear estimate. |
| Provider stage timings | Endpoint-to-final, first LLM token, validation release, first TTS audio and generation completion. Server-clock durations are never subtracted from browser-clock timestamps. |
| Correctness/recovery events | Duplicate final/turn prevention, stale output rejection, validation fallback/failure, response/audio failure, queue congestion/underruns and disconnects. Counts describe observed events, not a proof of correctness. |
| `review.<scenario>.<outcome>` | Human review of the latest answer: transcript, endpoint, source support, conditions, language, false interruption, stale output, duplicate turn; correct/issue/uncertain. |

The panel and `npm run voice:report -- path/to/export.json` show count, p50, p95,
maximum and the slowest observed responses. There are no latency pass/fail
thresholds. Missing observations remain missing, not zero; errors and interruptions
are counted separately. Review outcomes assess correctness only, not speed.

Output-clock estimates do not measure sound at a listener's ear. Device output
buffering, Bluetooth and acoustic echo require physical or loopback testing.
Played-history acknowledgments include only complete segments after their estimated
output completion; a partly heard segment is conservatively omitted and the next
turn is told the answer was interrupted. Generated/displayed text remains visible.

## Recovery and bounds

- 10 concurrent connections by default (`VOICE_MAX_SESSIONS`); 30 handshakes/IP/minute,
  both per process/function instance. A 10-second authentication deadline covers a
  second HTTP request for the ticket. Each 30-second ticket is bound to the exact
  origin and a random challenge from that socket. Reuse on another socket/instance
  is rejected; repeated authentication on the same socket is rejected too.
- 200 KB maximum WebSocket message, 3,200-byte input frames, 64 KB/s input ceiling,
  100 messages/s and 256 KB queued network output. Congestion ends the live path
  rather than silently dropping arbitrary microphone data.
- 30-minute session, 2-minute speech/text inactivity, 60 turns, 60-second response
  deadline, 20-second TTS segment deadline. These are resource bounds, not targets.
- Playback holds at most 60 seconds of 24 kHz PCM. Overflow stops speech and leaves
  accepted text available. Input/output queues are independent of conversation UI.
- Network disconnect clears old playback and attempts up to three reconnects with
  backoff and jitter. New tickets and current completed/played context are used.
  Pending utterances and failed requests are never automatically resubmitted.
- Provider errors retain accepted text, identify an incomplete response, and leave
  recording/typing and Listen available. Physical microphone denial preserves typing.
- No database or cross-instance session resumption is required: a session stays on
  one service instance; reconnect sends conservative conversation context from the
  browser. Do not assume an interrupted utterance survives a server restart.

## Deployment

### Vercel (web and voice together)

`app/api/voice/socket/route.ts` uses the pinned `@vercel/functions`
`experimental_upgradeWebSocket` API with a 200 KB payload cap. Fluid compute is
required. Set `SARVAM_API_KEY`, `VOICE_STREAMING_ENABLED=true`, and a persistent
random `VOICE_SESSION_SECRET` (32+ characters). Leave `VOICE_PUBLIC_URL` unset;
the browser connects over WSS to its current origin. An unset origin allowlist
accepts only that origin; an explicit list is exact and comma-separated.

The shared socket handler sends a random connection challenge. The same-origin
HTTP ticket endpoint signs it, and the handler validates it before any provider
connection opens. This prevents cross-instance replay without an in-memory global
ticket store or a new database. Admission counters remain per-instance; platform
Firewall and access protection are separate controls.

The route declares `maxDuration=300`, closing at 270 seconds with code 1001 and
cleaning up provider connections. The client reconnects with a new challenge and
conservative played history. An active utterance/response can be interrupted;
there is no replay or seamless resumption claim. Test a call beyond 4.5 minutes
on the actual deployment, since local tests cannot prove the hosted runtime.

Ordinary `next dev` / `next start` uses the separate local voice service. The Vercel
adapter can be exercised locally with `vercel dev` (CLI 54.14.2+) and the documented
platform settings; it cannot upgrade sockets under plain `next start`.

### Separate Node host

Run Next.js and the voice service as separate supervised processes/containers, or
use the combined launcher on a Node host. The voice process uses `tsx` at runtime;
install development dependencies for this configuration (`npm ci`, not `--omit=dev`).
Retain `content/`, `lib/` and `server/` alongside dependencies.

Configure both deployments with the same random `VOICE_SESSION_SECRET` of at least
32 characters. Set `VOICE_ALLOWED_ORIGINS` to exact allowed web origins (comma
separated); configure `VOICE_PUBLIC_URL=wss://voice.example.com/voice` on Next.js.
On the voice host, set `VOICE_HOST=0.0.0.0` if a container/proxy must reach it. Keep
the Sarvam key on whichever servers make provider requests. Use TLS and a reverse
proxy that forwards WebSocket upgrades with an appropriate connection lifetime.
`GET /health` checks the service process, not provider account access.

The web app can remain on Vercel while the voice process runs elsewhere. Keep the
standard Next.js build and runtime; a custom combined Next.js server is not needed.
The existing Vercel request limits still apply to the classic routes.

Vercel supports [WebSockets in beta](https://vercel.com/docs/functions/websockets)
with Fluid compute, using the [Next.js upgrade adapter](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#experimental_upgradewebsocket).
The built-in route above uses that API. Vercel still does not run `server/voice.ts`;
that entry point is for local or separately supervised hosting. Upgrade the web
and standalone voice processes together when the handshake protocol changes.

The ticket proves authorized page-origin access and prevents key exposure; it is
not an end-user identity system. Preserve deployment access protection for this
attended demo. A public ticket endpoint lets visitors consume the configured
bounded session capacity. If placed behind a proxy, per-IP admission sees the
proxy address unless a trusted-proxy policy is deliberately implemented; forwarded
addresses are not blindly trusted.

## Validation commands and remaining device checks

```
npm run typecheck
npm test
npm run test:browser
npm run build
npm run smoke:streaming
```

The ordinary browser suite uses controlled server events and real AudioWorklet
playback. The opt-in complete live check uses generated English/Hindi microphone
speech, actual ticket authentication, actual service and all three providers:

```powershell
$env:LIVE_STREAMING_TEST = '1'
$env:NODE_USE_SYSTEM_CA = '1'
node --env-file-if-exists=.env.local node_modules/@playwright/test/cli.js test tests/browser/streaming-live.spec.ts
Remove-Item Env:LIVE_STREAMING_TEST
```

Reports and screenshots are in ignored `.local/`. No physical audibility claim is
made by these tests. Before broad rollout, record review observations on real
headphones and speakers: echo, background voices, natural hesitations, code-switching,
plan names/numbers, false interruptions, stop latency, autoplay/device suspension,
network loss and long sessions. Compare collected distributions in follow-up work.

Provider references: [realtime STT](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/realtime-streaming),
[chat streaming](https://docs.sarvam.ai/api/api-guides-tutorials/chat-completion/overview),
[TTS streaming and cancellation](https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/streaming-api/web-socket).
