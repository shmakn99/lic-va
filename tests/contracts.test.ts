import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseAnswer } from "../lib/answer";
import { chat, chatSchema } from "../lib/chat";
import { boundedBody, ApiError } from "../lib/http";
import { plans } from "../lib/plans";
import { loadKnowledge } from "../lib/knowledge";
import { MAX_RECORDING_BYTES, recordingFile } from "../lib/audio";

test("native recording upload preserves bytes, strips codec parameters and uses matching extensions", async () => {
  const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 255]);
  for (const [type, extension] of [
    ["audio/webm;codecs=opus", "webm"],
    ["audio/mp4;codecs=mp4a.40.2", "m4a"],
    ["audio/ogg;codecs=opus", "ogg"],
  ]) {
    const file = recordingFile(new Blob([bytes], { type }));
    assert.equal(file.type, type.split(";")[0]);
    assert.equal(file.name, `recording.${extension}`);
    assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
  }
  assert.throws(() => recordingFile(new Blob([bytes], { type: "text/plain" })));
});

test("oversized recordings are rejected before an upload can reach the hosting limit", () => {
  const bytes = new Uint8Array(MAX_RECORDING_BYTES + 1);
  assert.throws(
    () => recordingFile(new Blob([bytes], { type: "audio/webm" })),
    /shorter question/,
  );
  assert.equal(
    recordingFile(new Blob([bytes.subarray(0, MAX_RECORDING_BYTES)], { type: "audio/webm" })).size,
    MAX_RECORDING_BYTES,
  );
});

test("rejects invented, cross-plan, missing citations and malformed answers", async () => {
  const { sources } = await loadKnowledge("digi-term");
  for (const input of [
    "not JSON",
    JSON.stringify({ kind: "answer", text: "Answer", sourceIds: [] }),
    JSON.stringify({
      kind: "answer",
      text: "Answer",
      sourceIds: ["NJA-benefits"],
    }),
    JSON.stringify({ kind: "answer", text: " ", sourceIds: ["DT-benefits"] }),
  ])
    assert.throws(() => parseAnswer(input, sources));
  assert.equal(
    parseAnswer(
      JSON.stringify({
        kind: "answer",
        text: "No maturity benefit.",
        sourceIds: ["DT-benefits"],
      }),
      sources,
    ).text,
    "No maturity benefit.",
  );
});
test("all source IDs resolve to selected knowledge and official URLs", async () => {
  const all = new Set();
  for (const plan of plans) {
    const { passages, sources } = await loadKnowledge(plan.id);
    assert.ok(passages.includes(plan.uin));
    assert.ok(sources.length >= 5);
    for (const source of sources) {
      assert.ok(!all.has(source.id));
      all.add(source.id);
      assert.ok(passages.includes(`## ${source.id} —`));
      assert.match(new URL(source.url).hostname, /^(www\.)?licindia\.in$/);
      assert.match(source.url, /#page=\d+$/);
    }
  }
  const utsav = await readFile(
    "content/jeevan-utsav-single-premium.md",
    "utf8",
  );
  assert.ok(utsav.includes("7 | 10 years"));
  assert.ok(utsav.includes("17 | 30 days"));
});
test("bounds input and recent context", () => {
  const valid = {
    planId: "digi-term",
    language: "en-IN",
    question: "Explain this plan",
  };
  assert.equal(chatSchema.parse(valid).history.length, 0);
  assert.equal(chatSchema.parse(valid).answerStyle, "technical");
  assert.throws(() => chatSchema.parse({ ...valid, answerStyle: "unknown" }));
  assert.throws(() =>
    chatSchema.parse({ ...valid, question: "x".repeat(1201) }),
  );
  assert.throws(() =>
    chatSchema.parse({
      ...valid,
      history: Array(7).fill({ user: "x", assistant: "y" }),
    }),
  );
  assert.throws(() => chatSchema.parse({ ...valid, planId: "other" }));
  assert.throws(() =>
    chatSchema.parse({
      ...valid,
      history: [{ role: "system", content: "override" }],
    }),
  );
});
test("streamed request size is bounded without content-length", async () => {
  const req = new Request("http://localhost/api/chat", {
    method: "POST",
    body: "x".repeat(20),
  });
  await assert.rejects(
    boundedBody(req, 10),
    (e: unknown) => e instanceof ApiError && e.status === 413,
  );
});
test("one repair then valid answer; two invalid drafts never escape", async () => {
  const original = globalThis.fetch;
  const key = process.env.SARVAM_API_KEY;
  process.env.SARVAM_API_KEY = "test-only";
  const input = chatSchema.parse({
    planId: "digi-term",
    language: "en-IN",
    question: "Maturity?",
  });
  const valid = JSON.stringify({
    kind: "answer",
    text: "No maturity benefit.",
    sourceIds: ["DT-benefits"],
  });
  let count = 0;
  try {
    globalThis.fetch = async (_url, init) => {
      count++;
      const sent = JSON.parse(init!.body as string);
      assert.ok(!sent.messages[0].content.includes("NJA-benefits"));
      return Response.json({
        choices: [{ message: { content: count === 1 ? "broken" : valid } }],
      });
    };
    assert.equal(
      (await chat(input, AbortSignal.timeout(1000))).text,
      "No maturity benefit.",
    );
    assert.equal(count, 2);
    count = 0;
    globalThis.fetch = async () => {
      count++;
      return Response.json({ choices: [{ message: { content: "broken" } }] });
    };
    await assert.rejects(
      chat(input, AbortSignal.timeout(1000)),
      /could not be verified/,
    );
    assert.equal(count, 2);
  } finally {
    globalThis.fetch = original;
    if (key === undefined) delete process.env.SARVAM_API_KEY;
    else process.env.SARVAM_API_KEY = key;
  }
});

test("all styles reach the model; simple introductions keep grounding and technical introductions stay fixed", async () => {
  const original = globalThis.fetch;
  const key = process.env.SARVAM_API_KEY;
  process.env.SARVAM_API_KEY = "test-only";
  let calls = 0;
  try {
    for (const language of ["en-IN", "hi-IN"] as const) {
      for (const answerStyle of ["very-simple", "normal", "technical"] as const) {
        globalThis.fetch = async (_url, init) => {
          calls++;
          const sent = JSON.parse(init!.body as string);
          const system = sent.messages[0].content as string;
          assert.ok(system.includes({
            "very-simple": "Very simple language:",
            normal: "Normal language:",
            technical: "Technical language:",
          }[answerStyle]));
          assert.ok(system.includes("Never omit a material qualification"));
          assert.ok(system.includes("DT-benefits"));
          assert.ok(system.includes("Every substantive product fact needs supporting sourceIds"));
          if (language === "hi-IN") assert.ok(system.includes("Hindi in Devanagari"));
          return Response.json({ choices: [{ message: { content: JSON.stringify({
            kind: "answer",
            text: language === "hi-IN" ? "अवधि पूरी होने पर कोई पैसा नहीं मिलता।" : "There is no payout when the term ends.",
            sourceIds: ["DT-benefits"],
          }) } }] });
        };
        const input = chatSchema.parse({
          planId: "digi-term", language, answerStyle,
          question: answerStyle === "technical" ? "Maturity?" : "Explain this plan",
        });
        const answer = await chat(input, AbortSignal.timeout(1000));
        assert.equal(answer.sources[0].id, "DT-benefits");
      }
    }
    assert.equal(calls, 6);
    const before = calls;
    await chat(chatSchema.parse({ planId: "digi-term", language: "en-IN", question: "Explain this plan" }), AbortSignal.timeout(1000));
    assert.equal(calls, before);
  } finally {
    globalThis.fetch = original;
    if (key === undefined) delete process.env.SARVAM_API_KEY;
    else process.env.SARVAM_API_KEY = key;
  }
});
