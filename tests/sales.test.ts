import test from "node:test";
import assert from "node:assert/strict";
import { documentKnowledge, productDocumentSchema, documentLimit } from "../lib/product-document";
import { parseDocumentAnswer } from "../lib/answer";
import { chat, chatSchema } from "../lib/chat";

const document = {
  title: "Example Protect — test fixture",
  text: "Example Protect provides a death benefit during its 20-year coverage period while premiums are paid. There is no maturity benefit.\n\nClaims: contact the insurer's branch with the claim form, death certificate and policy document. Claim approval is subject to the policy terms. Claim processing timelines are not specified.",
};
const valid = {
  kind: "answer", text: "Coverage lasts 20 years while premiums are paid.",
  sourceIds: ["DOC-1"],
  evidence: [{ sourceId: "DOC-1", quote: "20-year coverage period while premiums are paid" }],
};

test("document input is bounded and paragraphs/tables are preserved without truncation", () => {
  assert.throws(() => productDocumentSchema.parse({ ...document, text: "too short" }));
  assert.throws(() => productDocumentSchema.parse({ ...document, text: "a".repeat(documentLimit + 1) }));
  const text = `${"A".repeat(2100)}\n\nTerm | Condition\n20 years | Premiums paid\n\n${document.text}`;
  const knowledge = documentKnowledge({ ...document, text });
  assert.equal(knowledge.sources.map((s) => s.excerpt).join("\n\n"), text);
  assert.equal(knowledge.sources.length, 2);
  assert.ok(knowledge.sources.every((s) => s.planId === "custom" && !s.url));
});

test("custom answers reject invented quotes, missing evidence and cross-product citations", () => {
  const { sources } = documentKnowledge(document);
  assert.equal(parseDocumentAnswer(JSON.stringify(valid), sources).kind, "answer");
  for (const body of [
    { ...valid, evidence: [] },
    { ...valid, evidence: [{ sourceId: "DOC-1", quote: "Guaranteed maturity payout" }] },
    { ...valid, sourceIds: ["DT-benefits"] },
  ]) assert.throws(() => parseDocumentAnswer(JSON.stringify(body), sources));
  assert.equal(parseDocumentAnswer(JSON.stringify({ kind: "unsupported", text: "The document does not specify timelines.", sourceIds: [], evidence: [] }), sources).kind, "unsupported");
});

test("custom document bypasses the fixed introduction and excludes prepared product facts", async () => {
  const original = globalThis.fetch;
  const key = process.env.SARVAM_API_KEY;
  process.env.SARVAM_API_KEY = "test-only";
  let calls = 0;
  try {
    globalThis.fetch = async (_url, init) => {
      calls++;
      const sent = JSON.parse(init!.body as string);
      const system = sent.messages[0].content;
      assert.ok(system.includes(document.text.split("\n\n")[0]));
      assert.ok(!system.includes("NJA-benefits"));
      assert.ok(!system.includes("DT-benefits"));
      assert.ok(!system.includes("JUSP-benefits"));
      assert.ok(system.includes("benefit-led pitch"));
      assert.ok(sent.response_format.json_schema.schema.required.includes("evidence"));
      assert.equal(JSON.parse(sent.messages.at(-1).content).priority, "Family protection");
      return Response.json({ choices: [{ message: { content: JSON.stringify(valid) } }] });
    };
    const answer = await chat(chatSchema.parse({ planId: "new-jeevan-anand", language: "en-IN", question: "Explain this plan", priority: "Family protection", document }), AbortSignal.timeout(1000));
    assert.equal(calls, 1);
    assert.equal(answer.sources[0].excerpt, document.text);
    assert.equal(answer.sources[0].documentTitle, document.title);
  } finally {
    globalThis.fetch = original;
    if (key === undefined) delete process.env.SARVAM_API_KEY;
    else process.env.SARVAM_API_KEY = key;
  }
});

test("bad document evidence is repaired once and an invalid second answer is withheld", async () => {
  const original = globalThis.fetch;
  const key = process.env.SARVAM_API_KEY;
  process.env.SARVAM_API_KEY = "test-only";
  const input = chatSchema.parse({ planId: "digi-term", language: "en-IN", question: "Pitch this plan", document });
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ choices: [{ message: { content: JSON.stringify({ ...valid, evidence: [] }) } }] });
    };
    await assert.rejects(chat(input, AbortSignal.timeout(1000)), /could not be verified/);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
    if (key === undefined) delete process.env.SARVAM_API_KEY;
    else process.env.SARVAM_API_KEY = key;
  }
});

test("built-in pitches use the model and carry optional priorities and recent objections", async () => {
  const original = globalThis.fetch;
  const key = process.env.SARVAM_API_KEY;
  process.env.SARVAM_API_KEY = "test-only";
  try {
    globalThis.fetch = async (_url, init) => {
      const sent = JSON.parse(init!.body as string);
      assert.ok(sent.messages[0].content.includes("DT-benefits"));
      assert.ok(sent.messages[0].content.includes("Never pressure"));
      assert.equal(sent.messages[1].content, "I want a maturity payout.");
      assert.equal(JSON.parse(sent.messages.at(-1).content).priority, "Family protection");
      return Response.json({ choices: [{ message: { content: JSON.stringify({ kind: "answer", text: "Digi Term provides life protection but no maturity benefit.", sourceIds: ["DT-benefits"] }) } }] });
    };
    const input = chatSchema.parse({ planId: "digi-term", language: "en-IN", question: "Pitch this plan", priority: "Family protection", history: [{ user: "I want a maturity payout.", assistant: "This plan has no maturity benefit." }] });
    assert.throws(() => chatSchema.parse({ ...input, priority: "a".repeat(241) }));
    assert.equal((await chat(input, AbortSignal.timeout(1000))).sources[0].id, "DT-benefits");
  } finally {
    globalThis.fetch = original;
    if (key === undefined) delete process.env.SARVAM_API_KEY;
    else process.env.SARVAM_API_KEY = key;
  }
});
