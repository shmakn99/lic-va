import { chat, chatSchema, prepareChat } from "../chat";
import { answerJsonSchema, documentAnswerJsonSchema, parseAnswer, parseDocumentAnswer } from "../answer";
import { settings } from "../sarvam";
import type { VoiceConfig, Segment } from "./protocol";
import { limits } from "./protocol";
import { readSSE, SegmentParser } from "./stream-parser";

export async function* streamChat(config: VoiceConfig, question: string, signal: AbortSignal, metric: (name: string) => void): AsyncGenerator<Segment> {
  const { validation, voice: _voice, ...context } = config;
  const input = chatSchema.parse({ ...context, question });
  if (validation === "whole") { yield await chat(input, signal); return; }
  const prepared = await prepareChat(input);
  if (prepared.introduction) { yield prepared.introduction; return; }
  const messages = [...prepared.messages];
  messages[0] = { ...messages[0], content: messages[0].content + `\nSTREAMING OUTPUT CONTRACT: Replace the outer answer object with {"segments":[answer objects]}. Each answer object follows the answer contract above, including evidence for supplied documents. Use 1 to 8 short, independently meaningful segments, total text <=2400 characters. Every benefit MUST include its material conditions in the SAME segment, before another segment starts. Never defer a qualification, negation, exception or correction to a later segment. Avoid contradictions or repetition across segments. If the answer cannot safely be divided, use exactly one segment. These segments will be spoken immediately after local structure/source checks, and cannot be retracted. Only output this JSON; no markdown.` };
  let released = 0;
  let characters = 0;
  try {
    const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST", signal,
      headers: { "Content-Type": "application/json", "api-subscription-key": process.env.SARVAM_API_KEY || "" },
      body: JSON.stringify({ model: settings().chat, messages, stream: true, temperature: .1, max_tokens: 1800, reasoning_effort: null,
        response_format: { type: "json_schema", json_schema: { name: "spoken_segments", strict: true, schema: {
          type: "object", additionalProperties: false, required: ["segments"], properties: { segments: { type: "array", minItems: 1, maxItems: limits.maxSegments, items: input.document ? documentAnswerJsonSchema : answerJsonSchema } },
        } } },
      }),
    });
    if (!response.ok || !response.body) throw new Error(`Chat stream failed (${response.status})`);
    const parser = new SegmentParser();
    let finished = false;
    let first = true;
    for await (const data of readSSE(response.body)) {
      signal.throwIfAborted();
      if (data === "[DONE]") break;
      const event = JSON.parse(data);
      if (event.error) throw new Error("Chat stream error");
      const choice = event.choices?.[0];
      if (!choice) continue; // final usage-only event
      if (choice.finish_reason) {
        if (choice.finish_reason !== "stop") throw new Error("Answer generation was incomplete");
        finished = true;
      }
      const delta = choice.delta?.content;
      if (typeof delta !== "string") continue;
      if (first) { metric("llm.first_token"); first = false; }
      for (const raw of parser.push(delta)) {
        let answer;
        try {
          answer = input.document ? parseDocumentAnswer(JSON.stringify(raw), prepared.sources) : parseAnswer(JSON.stringify(raw), prepared.sources);
          if (input.language === "hi-IN" && !/[\u0900-\u097F]/.test(answer.text)) throw new Error("Answer language check failed");
        } catch (error) { metric("validation.segment_rejected"); throw error; }
        characters += answer.text.length + (released ? 1 : 0);
        if (characters > 2400 || released >= limits.maxSegments) throw new Error("Answer exceeds limits");
        metric("validation.accepted"); released++;
        yield { ...answer, sources: prepared.sources.filter(s => answer.sourceIds.includes(s.id)) };
      }
    }
    parser.finish();
    if (!finished) throw new Error("Missing generation completion");
  } catch (error) {
    if (signal.aborted) throw error;
    metric("validation.or_stream_failure");
    // A released prefix cannot be replaced. Only retry before any release.
    if (released) throw new Error("The continuation could not be verified. The displayed portion is incomplete.");
    metric("validation.whole_answer_fallback");
    yield await chat(input, signal);
  }
}
