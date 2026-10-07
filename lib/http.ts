import { z } from "zod";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const languageSchema = z.enum(["en-IN", "hi-IN"]);
export const planSchema = z.enum([
  "new-jeevan-anand",
  "jeevan-utsav-single-premium",
  "digi-term",
]);
export async function boundedBody(
  request: Request,
  maximum: number,
): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length")) > maximum)
    throw new ApiError(413, "This request is too large. Please shorten it.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "A request body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.length;
      if (length > maximum) {
        await reader.cancel();
        throw new ApiError(
          413,
          "This request is too large. Please shorten it.",
        );
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function readJson(
  request: Request,
  max = 48000,
): Promise<unknown> {
  try {
    return JSON.parse(
      new TextDecoder().decode(await boundedBody(request, max)),
    );
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "Send a valid JSON request.");
  }
}
export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError)
    return Response.json(
      {
        error: "Please check the selected plan, language and question length.",
      },
      { status: 400 },
    );
  if (
    error instanceof Error &&
    ["TimeoutError", "AbortError"].includes(error.name)
  )
    return Response.json(
      { error: "The request timed out or was cancelled. Please retry." },
      { status: 504 },
    );
  console.error(
    "Request failed",
    error instanceof Error ? error.name : "Unknown error",
  );
  return Response.json(
    { error: "Something went wrong. Please retry." },
    { status: 500 },
  );
}
