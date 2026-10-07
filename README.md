# LIC Plan Companion — local voice demo

A Next.js + React + TypeScript application for document-grounded conversations about New Jeevan Anand (715), Jeevan Utsav Single Premium (883), and Digi Term (876). English and Hindi text and speech use Sarvam. Runs locally or on Vercel; see [deployment setup and requirements](docs/deployment.md).

## Sales conversation — first iteration

- Start with **Pitch this plan** for a benefit-led pitch with a relevant trade-off and a next step. **Explain this plan** remains available for a neutral introduction.
- Optionally enter **What matters to you?** to connect the pitch to priorities such as family protection or income. This is sent with every new question, even after older turns leave the six-exchange history. Reset or changing products clears it.
- Ask objections and follow-ups, or use the claims, coverage-duration and trade-off suggestions. Prepared LIC excerpts still lack claim-submission procedures; the assistant should say so.
- **Use your own product document** accepts a name and 80–24,000 characters of pasted text for one product. Applying it clears the conversation and replaces the prepared LIC context. Paste conditions, exclusions and any claims instructions along with benefits. Text stays in this tab until refresh and is sent to Sarvam with questions; there is no document database, file upload, PDF parser or OCR in this iteration.
- Custom Sources display the original cited text, not fabricated PDF page links. Generated custom answers must include exact supporting quotes that are checked against cited sections, with one repair allowed. This checks evidence presence, not sentence-level factual entailment or document authenticity.
- **Correct question** on the most recent spoken question removes that exchange and puts its transcript into the text box. Edit and send it again; the incorrect exchange is omitted from follow-up history.

The sales flow keeps quotes, personal suitability/eligibility decisions, guaranteed claim outcomes and purchase transactions outside scope. It can explain relevance and documented next steps without pressure.

With the app running, `npm run rehearse:sales` makes eight live chat requests covering pitch, objection, missing claims procedure, custom-document claims and validity, Hindi and instruction override. It saves `.local/sales-rehearsal.json` for manual review. `npm test` and `npm run test:browser` cover contracts and UI flows with controlled responses. See [the first-iteration notes](docs/sales-first-pass.md).

## Run on this laptop

```powershell
cd lic-va
.\start-local.ps1
```

Open **http://127.0.0.1:3000** in Chrome or Edge. The launcher locates the existing Node installation and enables the Windows system certificate store. Leave its terminal running. Stop with Ctrl+C.

Your credential is in `.env.local`, excluded by `.gitignore`. `.env.example` is a blank template. Never use a `NEXT_PUBLIC_` variable for the key. Restart the server after editing credentials.

For other machines: Node 24 LTS, `npm ci`, copy `.env.example` to `.env.local`, set `SARVAM_API_KEY`, then `npm run dev`. On networks using a corporate certificate authority, Node 24 supports `NODE_USE_SYSTEM_CA=1`; certificate verification stays enabled.

## Try it

1. Select a plan and English or हिन्दी.
   Set **Answer style** to **Very simple language**, **Normal language**, or **Technical language** (the default). This controls wording in new text and spoken answers while retaining policy conditions and sources. Changing the slider keeps existing answers and conversation context; an answer already being generated uses the setting selected when its question was submitted.
2. Press **Explain this plan**, or type a question.
3. Press the microphone, allow access, speak, and press it again to submit. At 25 seconds it submits automatically.
4. Read the transcript and answer; audio plays after the text appears. If autoplay is blocked, press **Play / Replay**.
5. Ask a follow-up. Expand **Sources** for the official PDF and page.
6. **Stop audio** stops playback immediately. **Voice off** suppresses automatic speech; **Listen** remains available.
7. Selecting another plan or **Reset** clears the conversation. Changing language translates the entire interface, including plan cards, sources and errors, retains completed exchanges in their original language and cancels any unfinished turn.

The microphone stream is stopped before transcription. MediaRecorder produces a complete native recording on stop, uploaded without browser decoding or conversion. The initial Chrome MIME value (`audio/webm;codecs=opus`) was rejected by Sarvam's literal MIME validation; the upload now uses `audio/webm` and a matching `.webm` filename, preserving the original bytes. MP4 and Ogg recordings similarly retain their native container. The server also strips codec parameters. Four-second questions are valid.

## Verified provider configuration

| Use           | Setting                                                          |
| ------------- | ---------------------------------------------------------------- |
| Chat          | `sarvam-105b-conversations`, reasoning disabled, JSON schema response |
| Transcription | `saaras:v4`, transcribe mode, automatic language detection       |
| Speech        | `bulbul:v3`, `shubh`, pace 1, WAV, 24 kHz                        |
| Browser input | Completed native MediaRecorder file → normalized MIME → upload |

Live smoke tests passed for text, English/Hindi TTS and transcription. The browser voice test uses synthetic speech through a real browser MediaRecorder; a person must still check physical microphone quality and audible playback on the presentation device. This distinction matters: generated test speech does not prove a particular microphone works.

## Scope and implementation

- `/api/transcribe`, `/api/chat`, `/api/speak` are Node route handlers. `/api/status` exposes only whether a key is configured. Custom text uses the same chat route with a bounded 200,000-byte body.
- `content/*.md` contains selected official source passages; `content/sources.json` maps stable source IDs to official documents and PDF pages. Each request loads only the selected plan, or only the supplied custom document.
- Technical introductions are manually authored in both languages, checked against cited passages and stored in `content/introductions.json`. Simpler introductions, open questions and follow-ups use the live text model with the selected answer style. There is no simulated provider mode or model fallback.
- Browser-only conversation state; latest six completed exchanges are sent. No accounts, database, vector search, session store or restoration after refresh.
- General insurance concepts may use established model knowledge without product citations. Product facts must still come from the selected passages; mixed answers distinguish the general explanation from documented product details. This distinction is made in the prompt, without another classifier or validator call.
- Answers are validated for structure, length and selected-plan source IDs. General answers may have empty source IDs; cited custom-document facts still require exact evidence quotes. One repair is permitted. Rejected drafts are never displayed or spoken. Hindi answers must contain Devanagari.
- Abort controllers and generation counters prevent late answers/audio after reset, plan or language changes. STT plus chat share a 30-second browser budget; TTS has a separate 15-second budget.
- Questions are limited to 1,200 characters; answers to 2,400; recordings to 4 MiB, with 64 KiB extra allowed for multipart headers. Oversized recordings are rejected before upload, and server request bodies are bounded while reading.
- Chat failures retain the question with **Retry question**. Audio failures retain the answer with **Retry audio**, without another chat call. Microphone failures retain typing.

## Checks

```powershell
npm run typecheck
npm test
npm run build
npm run test:browser
```

The browser suite uses isolated headless Chromium, not your Chrome profile. Install it once with `npx playwright install chromium`. Tests use controlled provider responses to exercise recovery. The live voice test is opt-in because it makes actual Sarvam calls:

```powershell
$env:NODE_USE_SYSTEM_CA = '1'
npm run smoke
$env:LIVE_VOICE_TEST = '1'
npx playwright test tests/browser/voice.spec.ts
Remove-Item Env:LIVE_VOICE_TEST
```

With the local server running, `npx tsx scripts/rehearse.ts` runs the 15 content questions plus mixed-language, missing-evidence, quote, claim-outcome and instruction-override checks. Expected facts, expected sources and actual results are saved in `.local/rehearsal.json`. These are reviewed examples, not an automated proof of factual correctness. `docs/demo-checklist.md` records the remaining presentation checks.

To run an optimized local build: `npm run build`, stop the development server, then `npm start` (same server-only environment and system-CA setting).

## Content boundaries

Documents are from the specified UINs, checked on 6 October 2026. This is not a live product catalogue. General insurance definitions and category comparisons may be explained even when absent from the passages. Missing product details should get an explicit limitation, while still answering any general educational part; general industry practices must not be presented as the selected plan's terms. Current loan rates, personal quotes, calculators, tax advice, claim decisions and claim submission procedures are outside the prepared coverage. Digi Term's increasing-cover maximum-term table is explicitly omitted rather than flattened incorrectly.

Source IDs are validated; sentence-level factual entailment is not mechanically verified. Short generated answers can omit a qualification, so consult the linked policy documents when exact conditions matter. Do not use the demonstration to decide a purchase or claim.

The one-time `scripts/prepare_sources.py` utility downloads official PDFs to ignored `.local/sources` and extracts text (`pip install pypdf`). `scripts/curate-content.py` reproduces the selected passages, including the manually restored age table. It is a development utility, not an upload or ingestion service. See `docs/content-review.md` for editorial notes.

## Troubleshooting

- **Recording rejected / Unable to decode audio data:** refresh the page to load the native-recording fix, allow microphone access and retry. Recording upload no longer uses `decodeAudioData`. Text remains available.
- **No speech detected:** move closer to the microphone and retry; empty transcriptions do not generate a chat request.
- **Permission denied:** enable microphone permission for `127.0.0.1` in the browser. Recording requires localhost or HTTPS.
- **No sound:** use Play/Replay, check device volume/output, or retry audio. Disabling automatic voice does not remove text.
- **API access error:** check the key, credits and model access in Sarvam. No alternative models are silently selected.
- **Certificate error:** use the launcher / `NODE_USE_SYSTEM_CA=1` on this Windows network.
- **Port in use:** stop the earlier local server before restarting.

API references: [Sarvam chat](https://docs.sarvam.ai/api/api-guides-tutorials/chat-completion/overview), [STT](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe), [TTS](https://docs.sarvam.ai/api-reference/text-to-speech/convert).
