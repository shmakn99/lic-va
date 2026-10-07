import { ApiError, boundedBody, errorResponse } from "@/lib/http";
import { sarvam, settings } from "@/lib/sarvam";
import { MAX_AUDIO_REQUEST_BYTES, MAX_RECORDING_BYTES } from "@/lib/audio";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const bytes = await boundedBody(request, MAX_AUDIO_REQUEST_BYTES);
    const form = await new Response(Buffer.from(bytes), {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size)
      throw new ApiError(
        400,
        "The recording is empty. Please record again or type a question.",
      );
    if (file.size > MAX_RECORDING_BYTES)
      throw new ApiError(
        413,
        "Please ask a shorter question, or type it in the text box.",
      );
    if (
      !/^(audio\/(webm|wav|x-wav|ogg|mp4|mpeg)|video\/webm)(;.*)?$/.test(
        file.type,
      )
    )
      throw new ApiError(
        400,
        "This audio format is not supported. Please type your question.",
      );
    // Sarvam validates MIME literally and rejects MediaRecorder's ;codecs=opus suffix.
    const cleanFile = new File([await file.arrayBuffer()], file.name, {
      type: file.type.split(";")[0],
    });
    const providerForm = new FormData();
    providerForm.set("file", cleanFile);
    providerForm.set("model", settings().stt);
    providerForm.set("mode", "transcribe");
    providerForm.set("language_code", "unknown");
    const result = (await sarvam(
      "/speech-to-text",
      providerForm,
      AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
    )) as { transcript?: unknown };
    if (typeof result.transcript !== "string")
      throw new ApiError(
        502,
        "Transcription failed. Please record again or type your question.",
      );
    if (result.transcript.length > 1200)
      throw new ApiError(
        400,
        "Please ask a shorter question, or type it in the text box.",
      );
    return Response.json({ transcript: result.transcript.trim() });
  } catch (error) {
    return errorResponse(error);
  }
}
