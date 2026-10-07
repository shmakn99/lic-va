# Local rehearsal

## Automated checks

- Type checking and production build.
- Contract tests: invalid/cross-plan citations, one repair only, request bounds, source completeness, native recording byte preservation and MIME/extension normalization.
- Browser recovery: pending reset/plan/language cancellation; completed language-history preservation; chat retry without duplicate question; TTS retry without another chat request; autoplay fallback; replay/stop; microphone denial; empty transcription and 25-second cap; desktop and mobile layout.
- Full-page Hindi: headings, plan names, categories, hints, sources, errors, controls, accessible labels, document language, desktop/mobile layout and switching back to English while preserving conversation text.
- Opt-in live browser voice: synthetic English and Hindi microphone input, four-second native browser recordings with `decodeAudioData` forced to throw, real Sarvam STT/chat/TTS, source ownership, and actual browser audio playback start for all three plans. Results go to `.local/voice-results.json`.

## Content rehearsal

`scripts/rehearse.ts` contains five ordered questions for each plan, with expected facts and source IDs. It covers introductions, payment/eligibility, free look or exclusion, benefits and contextual follow-ups. Additional questions test Hindi-English mixing, absent claim procedures, personal quotes, guaranteed claim outcomes, comparison requests and fabricated returns.

Read `.local/rehearsal.json` alongside the source passages. Confirm all material conditions, particularly:

- New Jeevan Anand: premium payment and in-force conditions; declared bonuses; Basic Sum Assured after the policy term.
- Jeevan Utsav: age/period table; income starts after the Guaranteed Addition Period; income base is Basic Sum Assured, not premium; Flexi accumulation and withdrawal conditions.
- Digi Term: no maturity payout; single versus regular/limited premium definitions; revival/in-force and premium exclusions in the suicide clause.
- Free look: 30 days from the earlier electronic/physical receipt; risk, medical and stamp deductions.

## Presentation-device checks (human)

- [ ] A real microphone question for each plan in English.
- [ ] A real microphone question for each plan in Hindi.
- [ ] One mixed Hindi-English spoken question.
- [ ] Listen to amounts and dates; confirm they are intelligible on the intended speakers.
- [ ] Several successive spoken follow-ups without refreshing.
- [ ] Stop/replay, voice toggle, reset and switch during processing.

The user's first four-second recording exposed a MIME rejection; a subsequent WAV conversion attempt caused a browser decoding failure. Native upload now preserves the complete recording and normalizes only MIME metadata, eliminating the decoding dependency. All six live plan/language checks passed with decoding deliberately disabled. Synthetic browser tests cannot substitute for confirmation that the physical microphone and speakers sound correct.
