# Source preparation notes — 6 October 2026

All three product identities were checked against official LIC listings and the downloaded English sales brochures. The source manifest records direct PDF URLs and one-based PDF page numbers.

| Plan                        | Number | UIN        | Brochure used                                                  |
| --------------------------- | ------ | ---------- | -------------------------------------------------------------- |
| New Jeevan Anand            | 715    | 512N279V03 | Official current listing, brochure filename Eng_141025         |
| Jeevan Utsav Single Premium | 883    | 512N392V01 | Official English single-premium brochure                       |
| Digi Term                   | 876    | 512N356V02 | April 2025 English brochure; the listing URL still ends in v01 |

The checked-in passages are source extracts, with whitespace cleanup, page furniture removed, and the following reviewed extraction corrections:

- Digi Term's duplicated extracted UIN was restored to `512N356V02`, as shown on the cover.
- New Jeevan Anand's duplicated colon before entry age 50 was removed.
- Jeevan Utsav's minimum-age table was restored row by row: a seven-year Guaranteed Addition Period requires ten completed years; a seventeen-year period admits thirty days. Intermediate rows decrease the minimum entry age by one year for each added period year. The risk-start exception for children does not waive this table.
- The Digi Term Increasing Sum Assured maximum-term table was omitted and marked as a gap. Level-cover limits must not be used for increasing cover.
- Qualifications that continue onto another page were retained, including New Jeevan Anand's suicide-exclusion premium definition and lapse exception.
- Historical loan rates retain their applicable dates. They are not current quotes.

Introductions are edited summaries with explicit source IDs. Product-specific reading reminders in `lib/chat.ts` point back to the same passages and address errors observed in early model rehearsals: entry eligibility versus deferred risk, future bonuses versus guarantees, free-look deductions, and differing single/regular-premium death formulas.

Review limitations: this was a source preparation and compact demo review, not insurer approval or a legal review. Citation shape validation does not establish that each generated sentence is entailed. The model can still omit qualifications in compressed answers. Official sources remain available beneath each substantive answer.
