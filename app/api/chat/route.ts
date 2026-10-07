import { chat, chatSchema } from "@/lib/chat";
import { errorResponse, readJson } from "@/lib/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(30000),
    ]);
    return Response.json(
      await chat(chatSchema.parse(await readJson(request, 200000)), signal),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
