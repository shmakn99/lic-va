import { z } from "zod";
import type { Answer, Source } from "./plans";
export const answerSchema = z
  .object({
    kind: z.enum(["answer", "clarification", "unsupported"]),
    text: z.string().trim().min(1).max(2400),
    sourceIds: z.array(z.string()).max(12),
  })
  .strict();
export function parseAnswer(raw: string, sources: Source[]): Answer {
  const answer = answerSchema.parse(JSON.parse(raw));
  const allowed = new Set(sources.map((s) => s.id));
  if (answer.sourceIds.some((id) => !allowed.has(id)))
    throw new Error("Invalid source ID");
  if (answer.kind === "answer" && !answer.sourceIds.length)
    throw new Error("Missing source");
  return { ...answer, sourceIds: [...new Set(answer.sourceIds)] };
}
export const answerJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "text", "sourceIds"],
  properties: {
    kind: { type: "string", enum: ["answer", "clarification", "unsupported"] },
    text: { type: "string" },
    sourceIds: { type: "array", items: { type: "string" } },
  },
};

const evidenceSchema = answerSchema.extend({
  evidence: z.array(z.object({
    sourceId: z.string(),
    quote: z.string().trim().min(12).max(600),
  }).strict()).max(12),
});
export const documentAnswerJsonSchema = {
  ...answerJsonSchema,
  required: [...answerJsonSchema.required, "evidence"],
  properties: {
    ...answerJsonSchema.properties,
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sourceId", "quote"],
        properties: { sourceId: { type: "string" }, quote: { type: "string" } },
      },
    },
  },
};

// An exact supporting quote is a modest extra check, not an entailment proof.
export function parseDocumentAnswer(raw: string, sources: Source[]): Answer {
  const { evidence, ...body } = evidenceSchema.parse(JSON.parse(raw));
  const answer = parseAnswer(JSON.stringify(body), sources);
  const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
  for (const item of evidence) {
    const source = sources.find((s) => s.id === item.sourceId);
    if (!answer.sourceIds.includes(item.sourceId) || !source?.excerpt ||
        !normalize(source.excerpt).includes(normalize(item.quote)))
      throw new Error("Evidence quote must occur in the cited source");
  }
  if (answer.sourceIds.some((id) => !evidence.some((e) => e.sourceId === id)))
    throw new Error("Each cited source needs an evidence quote");
  return answer;
}
