# Bulbul V4 Flash migration

The feasibility check on 16 October 2026 passed with the existing Sarvam credential for English (`en-IN`) and Hindi (`hi-IN`). Both conversation modes now default to `bulbul:v4-flash` with persona `shubh_enhi_ads`, the documented V4 default Shubh persona. Voice identity and delivery should still be auditioned; a persona is not a promise of identical V3 speech.

## Compatibility

Both paths read `settings()` in `lib/sarvam.ts`:

| Mode | Provider path | Audio contract |
| --- | --- | --- |
| Turn-based conversation and replay | `app/api/speak/route.ts` → `POST /text-to-speech` | Base64 WAV, 24 kHz, pace 1 |
| Live conversation | `lib/voice/providers.ts` → `/text-to-speech/ws?model=…` | Base64 raw `linear16` PCM chunks, 24 kHz, pace 1; `final` completion event per flush |

The model and persona change together. V3's short `shubh` speaker ID is not valid on V4. The API key, endpoints, language codes, browser playback, and request limits require no changes. The app's 2,400-character turn-based limit stays below the provider's 2,500-character limit. No model fallback is performed on provider errors.

References: [REST contract](https://docs.sarvam.ai/api-reference/text-to-speech/convert), [WebSocket protocol](https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/streaming-api/web-socket), [V4 guidance and migration](https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/best-practices). The guide and API reference differ on some optional parameters/codecs; this migration keeps existing parameters and validates `linear16` streaming against the actual API.

## Repeatable provider checks

`npm run smoke:tts` makes real TTS calls with synthetic English/Hindi text. It invokes the actual turn-based route and live provider adapter, validates WAV headers and 24 kHz sample rate, checks streamed PCM is nonempty and nonsilent, and requires two sequential flushes to complete on each socket. It writes `.local/tts-capabilities.json` and `.local/tts-*.wav`; these artifacts are ignored by Git and contain no credentials.

The migration run passed all six cases: two REST languages and two WebSocket utterances per language. REST generation took about 1.2–1.4 seconds; first streamed audio took 186–208 ms, measured after sending text on an established connection. These are a few short samples, not a production latency benchmark or comparison with V3.

`npm run smoke` also passed chat plus TTS-to-STT round trips in both languages; transcriptions matched the synthetic prompts.

Migration verification passed:

- `npm run typecheck` and all 39 tests in `npm test`.
- `npm run smoke:tts` and `npm run smoke` using V4 Flash and the new persona.
- Live-provider Playwright checks: all three tests passed on an isolated local server, with `LIVE_VOICE_TEST=1` and `LIVE_STREAMING_TEST=1`. Turn-based recording/transcription/chat/playback passed for all three plans in both languages. Live PCM playback, interruption, and recovery passed in both languages.
- `npm run build` and `npm run check:build`, including deployment trace validation.

Browser checks used synthetic microphone input. Physical microphone quality, speaker audibility, subjective voice quality, long-answer latency, quotas, and production load remain outside the automated checks.

## Configuration and rollback

Set both values in existing environments, then restart/redeploy the web process and any separately hosted voice service:

```dotenv
SARVAM_TTS_MODEL=bulbul:v4-flash
SARVAM_VOICE=shubh_enhi_ads
```

The local `.env.local` was migrated as well as `.env.example`. Hosted environment variables must be updated separately; changing the code default does not override a deployed `bulbul:v3` value.

To roll back, set `SARVAM_TTS_MODEL=bulbul:v3` and `SARVAM_VOICE=shubh`, then restart/redeploy both services. With the voice override unset, selecting V3 also restores its `shubh` default. Choose a full persona ID if overriding the voice on V4.
