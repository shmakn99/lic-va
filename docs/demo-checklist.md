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

With the local server running, `npx tsx scripts/rehearse-education.ts` checks general definitions, Hindi, mixed conceptual/product questions, unsupported product details, custom documents and recovery from an earlier over-restrictive refusal. Review `.local/education-rehearsal.json`: general answers may have no sources, product claims must cite relevant passages, and missing product terms must not be filled from general knowledge. These are live model rehearsals, not a runtime validator or an automated proof of factual correctness.

The 7 October 2026 rehearsal answered the original term-protection question directly in English and Hindi and cited Digi Term benefits for mixed/product questions. Remaining model deviations: a request to use general knowledge for an exact claim checklist still elicited a generic checklist alongside the missing-procedure limitation; a definition following an earlier refusal overgeneralized the absence of survival payouts. Prompt instructions prohibit both, but do not mechanically enforce them. Successful HTTP responses are not a pass for these cases.

## Presentation-device checks (human)

- [ ] A real microphone question for each plan in English.
- [ ] A real microphone question for each plan in Hindi.
- [ ] One mixed Hindi-English spoken question.
- [ ] Listen to amounts and dates; confirm they are intelligible on the intended speakers.
- [ ] Several successive spoken follow-ups without refreshing.
- [ ] Stop/replay, voice toggle, reset and switch during processing.

The user's first four-second recording exposed a MIME rejection; a subsequent WAV conversion attempt caused a browser decoding failure. Native upload now preserves the complete recording and normalizes only MIME metadata, eliminating the decoding dependency. All six live plan/language checks passed with decoding deliberately disabled. Synthetic browser tests cannot substitute for confirmation that the physical microphone and speakers sound correct.
