import { z } from "zod";
import { ApiError, errorResponse, languageSchema, readJson } from "@/lib/http";
import { sarvam, settings } from "@/lib/sarvam";
export const runtime = "nodejs";
export const maxDuration = 30;
const schema = z
  .object({
    text: z.string().trim().min(1).max(2400),
    language: languageSchema,
  })
  .strict();
export async function POST(request: Request) {
  try {
    const input = schema.parse(await readJson(request, 16000));
    const result = (await sarvam(
      "/text-to-speech",
      {
        text: input.text,
        language_code: input.language,
        model: settings().tts,
        speaker: settings().voice,
        speech_sample_rate: 24000,
        output_audio_codec: "wav",
        pace: 1,
      },
      AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
    )) as { audios?: string[] };
    if (
      !Array.isArray(result.audios) ||
      !result.audios.length ||
      result.audios.some((a) => typeof a !== "string" || !a)
    )
      throw new ApiError(
        502,
        "Audio was unavailable. You can read the answer or retry audio.",
      );
    return Response.json({ audios: result.audios, mimeType: "audio/wav" });
  } catch (error) {
    return errorResponse(error);
  }
}
