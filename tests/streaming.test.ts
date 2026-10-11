import test from "node:test";
import assert from "node:assert/strict";
import { issueTicket, verifyTicket } from "../lib/voice/auth";
import { readSSE, SegmentParser } from "../lib/voice/stream-parser";
import { streamChat } from "../lib/voice/stream-chat";
import { VoiceMeasurements, summarize } from "../lib/voice/metrics";
import { VoiceSession, type ChatStream } from "../lib/voice/session";
import { clientEventSchema, type Segment, type ServerEvent, type VoiceConfig } from "../lib/voice/protocol";
import type { SttEvent, VoiceProviders } from "../lib/voice/providers";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { providerConnectionError } from "../lib/voice/provider-error";

const config: VoiceConfig = { planId: "digi-term", language: "en-IN", answerStyle: "normal", priority: "", history: [], voice: true, validation: "segments" };
const answer = { kind: "answer" as const, text: "Term insurance provides life cover subject to policy terms.", sourceIds: [] as string[], sources: [] };
test("provider failures are classified without exposing raw connection details", () => {
  const failure = providerConnectionError(Object.assign(new Error("private provider response"), { code: "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" }));
  assert.equal(failure.code, "provider_tls");
  assert.match(failure.message, /system certificates/);
  assert.equal(providerConnectionError(undefined, 401).code, "provider_auth");
  assert.equal(providerConnectionError(undefined, 403).code, "provider_auth");
  assert.equal(providerConnectionError(undefined, 429).code, "provider_rate_limit");
  assert.equal(providerConnectionError(undefined, 422).code, "provider_config");
  assert.equal(providerConnectionError(undefined, 503).code, "provider_connection");
  assert.doesNotMatch(providerConnectionError(new Error("secret-token")).message, /secret-token/);
});

test("STT setup failure sends the actionable error before closing, instead of triggering a reconnect loop", async () => {
  const events: ServerEvent[] = []; let terminations = 0; let cancelled = false;
  const providers: VoiceProviders = {
    async stt(_event, _failure, signal) {
      signal.addEventListener("abort", () => { cancelled = true; });
      throw providerConnectionError({ code: "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" });
    },
    async tts() { throw new Error("Must not start synthesis"); },
  };
  const session = new VoiceSession(e => events.push(e), () => {
    assert.ok(events.some(e => e.type === "error" && e.fatal && /system certificates/.test(e.message)));
    terminations++;
  }, providers);
  try {
    await session.handle({ type: "configure", config });
    assert.equal(terminations, 1); assert.equal(cancelled, true);
    assert.equal(events.some(e => e.type === "listening"), false);
    assert.ok(events.some(e => e.type === "metric" && e.name === "connection.provider_tls"));
  } finally { session.close(); }
});

test("stopping during pending STT setup suppresses late connection errors", async () => {
  const events: ServerEvent[] = []; let reject!: (e: Error) => void;
  const providers: VoiceProviders = {
    stt() { return new Promise((_resolve, fail) => { reject = fail; }); },
    async tts() { throw new Error("Must not start synthesis"); },
  };
  const session = new VoiceSession(e => events.push(e), () => {}, providers);
  const pending = session.handle({ type: "configure", config });
  session.close(); reject(providerConnectionError()); await pending;
  assert.deepEqual(events, []);
});
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function until(condition: () => boolean) { for (let i = 0; i < 100; i++) { if (condition()) return; await tick(); } assert.fail("Expected event did not occur"); }
function streamResponse(segments: unknown[], finish = "stop") {
  const text = JSON.stringify({ segments });
  const events = [...text].map(content => `data: ${JSON.stringify({ choices: [{ delta: { content }, finish_reason: null }] })}\n\n`).join("") + `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: finish }] })}\n\ndata: [DONE]\n\n`;
  return new Response(events, { headers: { "Content-Type": "text/event-stream" } });
}

test("tickets reject tampering, expiry and origin mismatch", () => {
  const ticket = issueTicket("a".repeat(32), "https://voice.example", 1000);
  assert.equal(verifyTicket(ticket, "a".repeat(32), "https://voice.example", 2000).origin, "https://voice.example");
  assert.throws(() => verifyTicket(ticket, "b".repeat(32), "https://voice.example", 2000));
  assert.throws(() => verifyTicket(ticket, "a".repeat(32), "https://evil.example", 2000));
  assert.throws(() => verifyTicket(ticket, "a".repeat(32), "https://voice.example", 32000));
  assert.throws(() => verifyTicket(ticket + ".extra", "a".repeat(32), "https://voice.example", 2000));
});
test("protocol bounds configuration and rejects arbitrary operations", () => {
  assert.equal(clientEventSchema.safeParse({ type: "configure", config }).success, true);
  assert.equal(clientEventSchema.safeParse({ type: "text", id: "1", text: "x".repeat(1201) }).success, false);
  assert.equal(clientEventSchema.safeParse({ type: "played", responseId: "1", segment: -1 }).success, false);
  assert.equal(clientEventSchema.safeParse({ type: "execute", code: "anything" }).success, false);
});
test("SSE survives fragmented UTF-8 and CRLF and ignores comments", async () => {
  const bytes = new TextEncoder().encode(': ping\r\n\r\ndata: {"text":"हिन्दी"}\r\n\r\ndata: [DONE]\n\n');
  const body = new ReadableStream<Uint8Array>({ start(c) { for (const b of bytes) c.enqueue(new Uint8Array([b])); c.close(); } });
  const events = []; for await (const event of readSSE(body)) events.push(event);
  assert.deepEqual(events, ['{"text":"हिन्दी"}', "[DONE]"]);
});
test("incremental parser releases only complete objects including escaped braces", () => {
  const parser = new SegmentParser(); const objects = [];
  const value = { segments: [{ text: 'Quoted "}" and [brackets]', nested: { a: "हिन्दी" } }, { text: "Next" }] };
  for (const character of JSON.stringify(value)) objects.push(...parser.push(character));
  parser.finish(); assert.deepEqual(objects, value.segments);
  const truncated = new SegmentParser(); truncated.push('{"segments":[{"text":"unfinished'); assert.throws(() => truncated.finish());
  const missingComma = new SegmentParser(); missingComma.push('{"segments":[{"text":"first"}');
  assert.throws(() => missingComma.push('{"text":"second"}]}'), /framing/);
  const duplicateArray = new SegmentParser(); duplicateArray.push('{"segments":[{"text":"first"}],"segments":[{"text":"replacement"}]}');
  assert.throws(() => duplicateArray.finish(), /Incomplete/);
});
test("streamed custom evidence is checked before release; a bad continuation cannot replace a released prefix", async () => {
  const original = globalThis.fetch;
  const custom = { ...config, document: { title: "Example policy", text: "Life cover applies only while the policy is active and all premiums have been paid. No maturity benefit is provided." } };
  let calls = 0;
  globalThis.fetch = async () => { calls++; return streamResponse([
    { kind: "answer", text: "Cover requires an active policy and paid premiums.", sourceIds: ["DOC-1"], evidence: [{ sourceId: "DOC-1", quote: "only while the policy is active and all premiums have been paid" }] },
    { kind: "answer", text: "You receive guaranteed profits.", sourceIds: ["DOC-1"], evidence: [{ sourceId: "DOC-1", quote: "guaranteed profits" }] },
  ]); };
  try {
    const released: Segment[] = [];
    await assert.rejects(async () => { for await (const segment of streamChat(custom, "Explain the benefits", new AbortController().signal, () => {})) released.push(segment); }, /continuation/);
    assert.equal(calls, 1); assert.equal(released.length, 1); assert.match(released[0].text, /active policy/);
  } finally { globalThis.fetch = original; }
});
test("invalid first segment uses full validation fallback, not raw streamed text", async () => {
  const original = globalThis.fetch; const key = process.env.SARVAM_API_KEY; process.env.SARVAM_API_KEY = "test-key";
  let calls = 0; const metrics: string[] = [];
  globalThis.fetch = async () => ++calls === 1 ? streamResponse([{ ...answer, sources: undefined, sourceIds: ["invented"] }]) : Response.json({ choices: [{ message: { content: JSON.stringify({ kind: "answer", text: "A general explanation.", sourceIds: [] }) } }] });
  try {
    const released = []; for await (const segment of streamChat(config, "Define term insurance", new AbortController().signal, name => metrics.push(name))) released.push(segment);
    assert.equal(released.length, 1); assert.equal(released[0].text, "A general explanation."); assert.equal(calls, 2); assert.ok(metrics.includes("validation.whole_answer_fallback"));
  } finally { globalThis.fetch = original; if (key === undefined) delete process.env.SARVAM_API_KEY; else process.env.SARVAM_API_KEY = key; }
});
test("measurement summaries keep missing samples out and impose no thresholds", () => {
  const metrics = new VoiceMeasurements(); metrics.record("first_audible_response_estimate_ms", 900); metrics.record("first_audible_response_estimate_ms", 3200); metrics.record("correctness.stale_event_prevented"); metrics.record("bad", -1);
  const result = summarize(metrics.observations);
  assert.deepEqual(result.first_audible_response_estimate_ms, { count: 2, samples: 2, p50: 900, p95: 3200, max: 3200 });
  assert.equal(result["correctness.stale_event_prevented"].p95, null); assert.equal(result.bad, undefined);
  assert.equal(JSON.stringify(metrics.export()).includes("threshold"), false);
});

function harness(generate: ChatStream) {
  const events: ServerEvent[] = []; let sttEvent!: (event: SttEvent) => void; let closed = 0;
  const providers: VoiceProviders = {
    async stt(event) { sttEvent = event; return { send() {}, finish() {}, close() { closed++; } }; },
    async tts(_language, signal) { return { async speak(_text, audio) { if (!signal.aborted) audio(Buffer.alloc(320).toString("base64")); }, close() {} }; },
  };
  const session = new VoiceSession(e => events.push(e), () => {}, providers, generate);
  return { session, events, stt: (event: SttEvent) => sttEvent(event), closed: () => closed };
}
test("one final creates one turn; duplicate final/text and stale playback cannot corrupt state", async () => {
  let calls = 0;
  const h = harness(async function* () { calls++; yield answer; });
  try {
    await h.session.handle({ type: "configure", config });
    h.stt({ event: "vad.speech_start" }); h.stt({ event: "vad.speech_end" });
    h.stt({ event: "transcript.final", text: "Explain term insurance" }); h.stt({ event: "transcript.final", text: "Explain term insurance" });
    await until(() => h.events.some(e => e.type === "response.end"));
    assert.equal(calls, 1); assert.equal(h.events.filter(e => e.type === "transcript.final").length, 1);
    await h.session.handle({ type: "text", id: "typed", text: "Follow up" });
    await h.session.handle({ type: "text", id: "typed", text: "Follow up" });
    await tick(); assert.equal(calls, 2);
  } finally { h.session.close(); }
  assert.equal(h.closed(), 1);
});
test("interruption aborts work, prevents late segments and carries only played segments into history", async () => {
  let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  let calls = 0; let firstSignal: AbortSignal | undefined; let history = config.history;
  const h = harness(async function* (input, _question, signal) {
    if (++calls === 1) { firstSignal = signal; yield answer; await gate; yield { ...answer, text: "Unheard continuation" }; }
    else { history = input.history; yield answer; }
  });
  try {
    await h.session.handle({ type: "configure", config: { ...config, history: [] } });
    await h.session.handle({ type: "text", id: "first", text: "First question" });
    await until(() => h.events.some(e => e.type === "segment.audio.end"));
    const start = h.events.find(e => e.type === "response.start")! as Extract<ServerEvent, {type: "response.start"}>;
    await h.session.handle({ type: "played", responseId: start.responseId, segment: 0 });
    await h.session.handle({ type: "interrupt", responseId: start.responseId });
    release(); await tick();
    assert.equal(firstSignal?.aborted, true); assert.equal(h.events.filter(e => e.type === "segment").length, 1);
    await h.session.handle({ type: "text", id: "second", text: "Second question" }); await tick();
    assert.match(history[0].assistant, /Term insurance/); assert.match(history[0].assistant, /interrupted/); assert.doesNotMatch(history[0].assistant, /Unheard continuation/);
  } finally { release(); h.session.close(); }
});
test("worklet resamples capture, renders ordered audio and clears queued output", async () => {
  const messages: Record<string, any>[] = []; let Processor: any;
  const context = vm.createContext({ AudioWorkletProcessor: class { port = { onmessage: undefined, postMessage: (data: any) => messages.push(data) }; }, sampleRate: 48000, currentTime: 0, registerProcessor: (_name: string, implementation: any) => { Processor = implementation; }, Int16Array, Float32Array, Math });
  vm.runInContext(await readFile("public/voice-worklet.js", "utf8"), context);
  const processor = new Processor();
  processor.port.onmessage({ data: { type: "capture", enabled: true } });
  for (let i = 0; i < 15; i++) processor.process([[new Float32Array(128).fill(.1)]], [[new Float32Array(128)]]);
  assert.equal(messages.filter(m => m.type === "input").length, 1);
  processor.port.onmessage({ data: { type: "reset", responseId: "reply" } });
  processor.port.onmessage({ data: { type: "audio", responseId: "reply", samples: new Float32Array(1600).fill(.3), segment: 0 } });
  processor.port.onmessage({ data: { type: "segment.end", responseId: "reply", segment: 0 } });
  processor.port.onmessage({ data: { type: "response.end", responseId: "reply" } });
  const output = new Float32Array(128); processor.process([[]], [[output]]); assert.ok(output.some(v => v > .2));
  processor.port.onmessage({ data: { type: "reset", requestId: "interrupt" } });
  const silence = new Float32Array(128); processor.process([[]], [[silence]]); assert.ok(silence.every(v => v === 0));
  assert.ok(messages.some(m => m.type === "cleared" && m.requestId === "interrupt" && m.hadAudio));
  assert.equal(messages.some(m => m.type === "played"), false);
});

test("audio provider failure leaves accepted text and closes the response without retrying the LLM", async () => {
  const events: ServerEvent[] = []; let calls = 0;
  const providers: VoiceProviders = {
    async stt() { return { send() {}, finish() {}, close() {} }; },
    async tts() { return { async speak() { throw new Error("Provider unavailable"); }, close() {} }; },
  };
  const session = new VoiceSession(e => events.push(e), () => {}, providers, async function* () { calls++; yield answer; });
  try {
    await session.handle({ type: "configure", config }); await session.handle({ type: "text", id: "one", text: "Explain" });
    await until(() => events.some(e => e.type === "response.end"));
    assert.equal(calls, 1); assert.equal(events.filter(e => e.type === "segment").length, 1);
    assert.ok(events.some(e => e.type === "error" && e.scope === "audio"));
  } finally { session.close(); }
});
test("closing a session cancels pending generation and never releases its late continuation", async () => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let signal: AbortSignal | undefined;
  const h = harness(async function* (_config, _question, inputSignal) { signal = inputSignal; await gate; yield answer; });
  await h.session.handle({ type: "configure", config }); await h.session.handle({ type: "text", id: "one", text: "Explain" });
  h.session.close(); release(); await tick();
  assert.equal(signal?.aborted, true); assert.equal(h.events.filter(e => e.type === "segment" || e.type === "audio").length, 0);
});
test("whole-answer mode keeps original validation and does not ask for a stream", async () => {
  const original = globalThis.fetch; const key = process.env.SARVAM_API_KEY; process.env.SARVAM_API_KEY = "test";
  let streamed: unknown;
  globalThis.fetch = async (_url, init) => { streamed = JSON.parse(init?.body as string).stream; return Response.json({ choices: [{ message: { content: JSON.stringify({ kind: "answer", text: "Checked full answer.", sourceIds: [] }) } }] }); };
  try {
    const released = []; for await (const segment of streamChat({ ...config, validation: "whole" }, "What is term insurance?", new AbortController().signal, () => {})) released.push(segment);
    assert.equal(streamed, undefined); assert.equal(released.length, 1);
  } finally { globalThis.fetch = original; if (key === undefined) delete process.env.SARVAM_API_KEY; else process.env.SARVAM_API_KEY = key; }
});
