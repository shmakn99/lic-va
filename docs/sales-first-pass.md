# Sales behavior: first iteration, 7 October 2026

This increment moves the voice explainer toward the seed requirement without implementing the full ten-point roadmap.

## Implemented

- A live, benefit-led pitch action in English and Hindi, with a material trade-off and one relevant next step. Neutral introductions still work.
- Optional explicit priorities kept in the current tab and included on every turn. Recent conversation still covers the last six completed exchanges; no automated long-term memory.
- Prompt behavior for objections, product/need mismatches, claims versus claim procedures, validity rules versus live policy status, and honest unsupported answers.
- One pasted document at a time, 80–24,000 characters, with user review in the editor. Applying or replacing it resets conversation, priorities and pending audio/answers. Choosing a prepared plan discards custom context.
- Whole-paragraph source sections with original text shown in Sources. No claims of independent verification or invented page numbers. Pasted headings and tables are preserved, but no automatic table reconstruction is attempted.
- Exact quote validation for custom-source citations, plus the existing shape/source-ID validation and one repair. Neither establishes that every generated assertion is correct.
- Correction of the latest voice transcript; its old exchange is removed before resubmission. The existing STT/chat/TTS pipeline handles pitches and follow-ups.

## Deliberately deferred

PDF upload/OCR, retrieval infrastructure, automatic topic-coverage classification, external sourcing of missing claims procedures, full semantic verification, cross-product comparisons, lead capture, purchasing, continuous listening, and persistent sessions.

Prepared LIC content has not been broadened by guessing missing rules. Users can supply a document containing claims instructions through the custom-text path. Existing LIC citations retain their reviewed sources.

## Review

- `npm test`: document size bounds, preserved text, cross-product isolation, quote validation, rejected-answer repair limit, and sales context; existing contracts retained.
- `npm run test:browser`: priorities, pitch-to-speech text, document replacement/cancellation, excerpts, Hindi/mobile controls, transcript correction, and existing recovery flows. Controlled responses do not assess model quality.
- `npm run rehearse:sales`: eight actual model calls with expected behavior recorded for human comparison. Its Example Protect document is synthetic and is not an insurance offer.
- Physical microphone/speaker quality still needs a human check. No claim of full seed-requirement completion or insurer approval.

Live rehearsals during implementation demonstrated relevant pitches, objection handling, supported custom claims answers and refusal to invent a missing timeline. They also exposed conditional-benefit omissions and an unnecessary payout formula in a pitch. The pitch instructions were tightened in response. The final rehearsal still used an unsupported affordability characterization and compressed an increasing-cover rule too broadly. These remain model-quality limitations; the eight-case rehearsal is not a factual pass certificate.

Verification for this increment: typecheck and production build passed; 12 contract tests and 18 browser tests passed. The opt-in live browser voice test was not rerun. Eight final live chat cases returned successfully and were reviewed with the limitations above; results are in `.local/sales-rehearsal.json`.
