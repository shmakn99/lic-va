# Road to production — evidence and speaker notes

Prepared 8 October 2026. This is a proposed roadmap, not a production certification or a measured capacity result. Slide 3 is in `deck.template.html`; the generated deck is `../../public/presentation.html#slide-3`. The [handmade diagram brief](handmade-roadmap-brief.md) describes its replacement illustration.

## The story to tell

“The MVP proves the conversation experience. Production needs five parallel workstreams: governed documents, measured capacity, safe public access, data minimisation, and trusted operations. We should keep general policy questions open without a login. Our initial planning target is roughly 1,000 active chats, with 5,000 and 10,000 as higher load scenarios. These are targets to prove, not capacity we have today. All five workstreams must pass a readiness gate before a measured pilot and wider rollout.”

## What the app actually does today

| Area | Evidence in this repository | Production gap |
| --- | --- | --- |
| Knowledge | `lib/knowledge.ts` reads one curated Markdown file for each of three hard-coded plans; `content/sources.json` holds source references. | No managed ingestion, catalogue, document lifecycle or publication workflow. Existing multiple source references are not a multi-document management platform. |
| User documents | `lib/product-document.ts` accepts one pasted document, up to 24,000 characters, split into sections. | No persistent upload library, multi-document policy grouping or trusted publication boundary. |
| Retrieval | `lib/chat.ts` includes the prepared passages in the prompt. | No search index or relevance retrieval. Sending an expanding catalogue on every turn would increase latency, tokens and cost. |
| State | `lib/use-voice-conversation.ts` keeps conversation state in React and sends up to six recent exchanges. | No application conversation database was found. Browser memory, request processing and provider retention are separate concerns. |
| Access | Chat, transcription and speech handlers have input limits but no app authentication or distributed rate limiter. | A reachable API can consume provider credits. UI controls do not protect backend endpoints. Deployment protection settings are unknown. |
| AI calls | `lib/sarvam.ts` uses Sarvam for chat, STT and TTS. Chat can make a second call to repair invalid output. | Provider quotas, shared account usage, burst capacity and contracted service levels are unverified. No Canto integration was found; the retention recommendation below refers to Sarvam. |
| Reliability | Timeouts, bounded input, schema checks, cancellation and voice-error recovery exist. | No demonstrated service SLOs, fleet-wide admission control, circuit breaker, restore exercise or operational ownership. |
| Validation | Contract, sales and browser tests plus rehearsal scripts exist. | These are useful foundations, not production load tests or independent factual-quality certification. |

The builder reports successful use by 4–5 people together. Treat this as an informal demo observation; request timing, test duration and turn frequency were not measured. It establishes neither an upper limit nor sustained throughput.

## 1. A governed document and ingestion platform

Use a policy/product catalogue, immutable object storage for original files, a metadata database, and a derived retrieval index. Begin with managed Postgres plus full-text/vector retrieval if evaluation supports it; a separate vector database is not a prerequisite.

Represent `Product → ProductVersion → Documents → DocumentVersions → Chunks`. Product means an insurance offering here, not an individual customer's policy record. Store the UIN/plan identifier, document type, language, effective dates, source URL, checksum, page/section, uploader, reviewer, publication status and superseded version. A brochure, policy wording, rider, FAQ and circular can belong to the same product version.

The publication path is:

1. Authorised staff upload a file to quarantine; validate type/size, scan it, deduplicate by hash and record provenance.
2. A durable queue runs isolated extraction/OCR workers. Preserve tables, numbers, page boundaries and language. Retry failed jobs safely; expose a review queue.
3. A reviewer checks extraction and conflicting terms. Apply a documented source-precedence policy approved by the content owner; an unresolved conflict blocks publication.
4. Chunk and index the reviewed version, run retrieval/answer evaluations, then atomically publish a complete release. Every chunk retains its source version and page.
5. Retrieve within the chosen product/version/language/effective date. Cite the exact supporting document; abstain or escalate when evidence conflicts or is absent.
6. Support correction, withdrawal, rollback, stale-document alerts and a recorded review history. Rebuild the index from original files and metadata during a restore drill.

Keep user-pasted material isolated from the approved corpus. It must never silently become official knowledge or enter a shared answer cache. Pin a chat to a known content release, with a deliberate update policy when a document is withdrawn.

## 2. Traffic and a defensible capacity estimate

### Observed external estimate

[Semrush's LIC domain overview](https://www.semrush.com/website/licindia.in/overview/) reports **9.76 million visits in August 2026**, 11.6 million in July and 15.37 million in June; the page identifies a 17 September 2026 update. These are third-party estimates, not LIC analytics. August was the latest month exposed by that source during this review; it is not an October measurement.

Visits are not unique people, registered users, chatbot sessions or simultaneous requests. Domain traffic includes journeys that may never expose this chatbot. Do not add related portal/domain estimates without checking overlap, and do not substitute organic-search estimates for total visits. A LIC analytics export should ultimately supply eligible page visits and peak intervals.

### Model and assumptions

Use a rounded 30-day planning month. Define adoption as the fraction of all domain visits that starts a chat, including the effect of widget placement:

```text
chat sessions/month = monthly website visits × adoption
average active chats = chat sessions/month × chat duration in minutes / 43,200
peak active chats = average active chats × peak-to-average multiplier
```

| Scenario | Visits/month | Adoption | Chat duration | Peak multiplier | Chat sessions/day* | Peak active chats |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Limited uptake | 10M | 5% | 5 min | 3× | 16,667 | 174 |
| Initial planning case | 10M | 10% | 8 min | 5× | 33,333 | 926 |
| Busy scenario | 15M | 20% | 10 min | 8× | 100,000 | 5,556 |

\*Sessions can include repeat visitors; these are not daily unique users. All adoption, duration and peak factors are assumptions. The busy scenario is a sensitivity case, not a measured forecast.

**Recommendation:** begin capacity engineering at **1,000 concurrently active chat sessions**. Test around **5,000–6,000** for the busy scenario and **10,000** for stress behaviour. A first public pilot must use a smaller admission cap proven by testing. If “5,000 users” instead means per day, its resource requirement is much lower and depends on their arrival pattern.

### Translate active chats into infrastructure demand

Assume one user turn every 45 seconds, averaged over reading, listening and thinking time; 10% of answers need a second LLM call; 40% of turns use speech input and 60% request speech output. These are workload assumptions to replace with telemetry.

| Active chats | User turns/sec | LLM requests/min, including repair | STT requests/min | TTS requests/min |
| --- | ---: | ---: | ---: | ---: |
| 1,000 | 22.2 | 1,467 | 533 | 800 |
| 5,000 | 111.1 | 7,333 | 2,667 | 4,000 |
| 10,000 | 222.2 | 14,667 | 5,333 | 8,000 |

At 1,000 active chats and an assumed 10-second average LLM call, approximately 244 LLM calls are in flight: `22.2 × 1.1 × 10`. This is not 1,000 simultaneous function executions. STT and TTS contribute their own in-flight work. Retries, repeat playback, slower models and synchronised bursts add demand; the table is not a guaranteed peak envelope.

Measure input/output tokens, audio seconds, TTS characters, repair rates and latency distributions. Reserve throughput and any token/audio quotas with the provider, with agreed burst headroom. Estimate monthly cost from actual units per conversation × monthly conversations, then add hosting, storage, ingestion and operations. Do not quote a rupee budget before measuring these units and obtaining the relevant commercial terms.

### What the current Vercel deployment can theoretically serve

The repository does not identify the active Vercel plan, Fluid Compute setting, regions, spend limits or the Sarvam account tier. No authenticated dashboard was inspected. Therefore **an exact current user capacity cannot be established**.

[Vercel's concurrency documentation](https://vercel.com/docs/functions/concurrency-scaling) lists automatic scaling up to 30,000 concurrent executions on Hobby/Pro and 100,000 on Enterprise, with a burst scaling limit of 1,000 executions per 10 seconds per region. Scaling is not instantaneous. These are platform ceilings, not chatbot-user commitments.

[Sarvam's published rate limits](https://docs.sarvam.ai/api/getting-started/ratelimits) list the following for the models/endpoints this app uses. Limits are shared per account, not multiplied by making extra API keys:

| Sarvam tier | 105B conversations LLM/min | REST STT/min | Bulbul v3 REST TTS/min |
| --- | ---: | ---: | ---: |
| Starter | 40 | 60 | 30 |
| Pro | 60 | 100 | 200 |
| Business | 120 | 4,000 | 1,000 |

Our inference, using 45-second turns and 10% repair overhead: the LLM quota alone permits approximately **27 / 41 / 82 active text-chat sessions** at Starter / Pro / Business. For 100% speech input and output, Starter's TTS quota lowers its ceiling to roughly **23**. These are sustained rate-budget calculations with no safety margin, other-account traffic, token constraints or latency guarantee; they are not tested app capacities. At 70% planned quota utilisation, text-chat planning numbers would be about **19 / 29 / 57**. Confirm the actual account limits before applying any figure.

Thus a standard hosting upgrade alone cannot establish 1,000–10,000 active-chat capacity. The initial 1,000-session scenario already needs custom AI throughput or an evaluated alternative deployment. Contracted quotas and realistic latency tests come first.

[Vercel's function limits](https://vercel.com/docs/functions/limitations) also include a 4.5 MB request/response payload ceiling. This app declares 60-second chat/STT and 30-second TTS function limits, with shorter provider timeouts of 30/30/15 seconds. TTS currently returns base64 WAV JSON; move toward a validated compressed/streamed delivery path and test long answers on real devices. More platform duration does not override the app's timeout settings.

### Infrastructure path

Keep the web frontend on a CDN and the online API stateless. Use an edge firewall/bot layer, an atomic shared rate limiter and a bounded admission policy before paid provider calls. Autoscaling app instances then share the approved document service and a provider gateway that budgets each model's throughput independently.

Place ingestion/OCR on a durable queue and separate workers so a bulk upload cannot exhaust chat capacity. Pool database connections, index metadata filters, version retrieval caches and bound prompt size. Cache approved public content carefully; never share personal prompts or pasted documents across sessions.

Choose compatible regions after measuring Indian-user latency and agreeing data-location requirements across hosting, databases, logs and providers. Add wider geographic deployment or dedicated inference only when measured load, availability or contractual requirements justify it. More app replicas cannot remove a provider account quota.

Use short, bounded retry budgets with jitter and provider retry hints; avoid retry storms and duplicate billing. A circuit breaker should preserve text when speech fails and offer approved static information or human assistance when chat fails. Do not leave users in an unbounded interactive queue.

## 3. Public access without mandatory login

General information about public policies does not require identity. Issue a short-lived, signed anonymous session token; enforce session and network/device-aware limits, request-size and token budgets, concurrent-request caps and daily spend controls server-side. Treat the token as a continuity/abuse signal, not proof of identity. Limit token issuance as well as API calls; challenge suspicious traffic, with care for shared mobile networks. Restrict origins as defence in depth; CORS alone does not prevent direct API abuse.

Document publishers and operators need SSO, MFA, role-based permissions and an audit trail. Require actual customer authentication and resource-level authorisation only when introducing private policy records, saved personal history or transactions. A public information bot should not imply access to an individual's LIC policy.

## 4. Privacy and retention

Preserve ephemeral chats by default. Give a clear notice before sending text/audio to processors; discourage unnecessary identifiers and minimise or redact sensitive data. Keep payloads out of telemetry and session-replay tooling. If chat history is later offered, make storage a deliberate product choice with access, expiry and deletion controls.

[Sarvam's retention documentation](https://docs.sarvam.ai/api/platform/data-retention) says **Model APIs support zero-day retention**; Voice Agents do not currently support that option. It also says data is retained indefinitely until a period is configured and that changes are not retroactive. This app uses Model APIs. The live setting is unknown. Configure the appropriate workspace/product setting and retain evidence of verification; arrange deletion of older data separately.

The [Sarvam platform FAQ](https://docs.sarvam.ai/api/platform/faq) documents a separate model-training toggle controlled by an organisation Owner. Verify training opt-out as well as retention. Do not equate a zero-day setting with a promise that billing/security metadata or every subprocessor record disappears.

Before launch, record data categories, purpose, storage location, approved retention and deletion method for browser state, temporary audio, provider payloads, hosting logs, operational metrics, backups and staff audit records. Propose zero durable transcript/audio retention; give content-free operational metrics and security records separately approved periods. Test expiry/deletion and minimise linkage of anonymous identifiers. Have LIC's privacy/security owners approve processor terms, data flows and applicable obligations; this slide does not establish compliance.

## 5. Trust, operations and release gates

Assign content, engineering, operations and privacy/security owners. Extend the existing checks to cover supported claims and their qualifications, source/version accuracy, conflicting or missing evidence, prompt injection, Hindi/English parity, speech recognition of numbers, low bandwidth, keyboard/screen-reader access and older mobile devices. A valid source ID alone does not establish that the cited passage supports a claim.

Define an official human-help route and clear boundaries for personal recommendations, eligibility, premiums and claims. Include dependency/security scans, secret rotation, staff access review and an independent security assessment in release work. Verify commercial rights for generated speech with the provider before public use.

Instrument content-free request IDs, per-stage latency, errors/429s, quota headroom, token/audio usage, cost, retrieval outcomes and escalation. Establish alert ownership, an incident runbook, backup/restore, content rollback and deployment rollback. Separate preview/staging credentials and budgets from production.

Proposed acceptance criteria to agree with LIC and validate in staging:

| Gate | Evidence needed |
| --- | --- |
| Content quality | Reviewed bilingual evaluation set; no critical unsupported product claims in the release set; agreed factual/citation thresholds; documented human escalation. |
| Capacity | Ramp 25 → 100 → 250 → 500 → 1,000 active chats; progress to 5,000–6,000 and 10,000 only with sufficient quotas. Use realistic think time, mixed voice/text, long prompts, repairs and arrival spikes. |
| Experience | Proposed p95 full text response ≤10 seconds; p95 end-of-recording to first audio ≤15 seconds; <1% technical failures at admitted target load. These are proposed budgets, not measured results. Track valid abstentions separately. |
| Resilience | At least a one-hour steady test plus longer soak; provider slowdowns/outages, exhausted quotas, cold starts and traffic bursts. Demonstrate bounded overload behaviour and recovery. Use synthetic, nonpersonal input. |
| Privacy/security | Verified retention/training settings, deletion exercise, access review and abuse tests. Resolve critical findings. |
| Operations/cost | Agreed service hours and availability SLO; on-call owner, alerts, rollback/restore drill, measured cost per session and budget stop conditions. |

Run provider-stub tests to isolate app limits, then separately run end-to-end tests against the contracted provider capacity. Label the results distinctly. Launch to a small admitted cohort, measure adoption and turn rates, revise the model and widen exposure only as each gate holds. No paid load test or deployment configuration change was performed for this presentation task.
