import { z } from "zod";
import { productDocumentSchema } from "../product-document";
import { answerStyles } from "../answer-style";
import type { Answer, Source } from "../plans";

export const voiceConfigSchema = z.object({
  planId: z.enum(["new-jeevan-anand", "jeevan-utsav-single-premium", "digi-term"]),
  language: z.enum(["en-IN", "hi-IN"]),
  answerStyle: z.enum(answerStyles),
  document: productDocumentSchema.optional(),
  priority: z.string().trim().max(240).default(""),
  history: z.array(z.object({ user: z.string().max(1200), assistant: z.string().max(2400) }).strict()).max(6).default([]),
  validation: z.enum(["segments", "whole"]).default("segments"),
  voice: z.boolean().default(true),
}).strict();
export type VoiceConfig = z.infer<typeof voiceConfigSchema>;
const id = z.string().min(1).max(100);
export const clientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("authenticate"), ticket: z.string().max(2048) }).strict(),
  z.object({ type: z.literal("configure"), config: voiceConfigSchema }).strict(),
  z.object({ type: z.literal("text"), id, text: z.string().trim().min(1).max(1200) }).strict(),
  z.object({ type: z.literal("interrupt"), responseId: id }).strict(),
  z.object({ type: z.literal("played"), responseId: id, segment: z.number().int().min(0).max(12) }).strict(),
  z.object({ type: z.literal("finish") }).strict(),
  z.object({ type: z.literal("ping") }).strict(),
  z.object({ type: z.literal("stop") }).strict(),
]);
export type ClientEvent = z.infer<typeof clientEventSchema>;
export type Segment = Answer & { sources: Source[] };
export type ServerEvent =
  | { type: "challenge"; challenge: string }
  | { type: "ready"; sessionId: string }
  | { type: "listening" }
  | { type: "speech.start"; turnId: string }
  | { type: "speech.end"; turnId: string }
  | { type: "transcript.partial"; turnId: string; text: string }
  | { type: "transcript.final"; turnId: string; text: string; spoken: boolean }
  | { type: "response.start"; turnId: string; responseId: string }
  | { type: "segment"; responseId: string; index: number; answer: Segment }
  | { type: "audio"; responseId: string; segment: number; sequence: number; audio: string; sampleRate: number }
  | { type: "segment.audio.end"; responseId: string; segment: number }
  | { type: "response.end"; responseId: string }
  | { type: "interrupted"; responseId: string }
  | { type: "metric"; name: string; value?: number; responseId?: string }
  | { type: "error"; message: string; fatal: boolean; responseId?: string; scope?: "audio" | "generation" }
  | { type: "pong" };

export const limits = {
  frameBytes: 3200, socketBytes: 256_000,
  utteranceMs: 25_000, sessionMs: 30 * 60_000, idleMs: 120_000,
  responseMs: 60_000, maxSegments: 8, maxTurns: 60,
};
