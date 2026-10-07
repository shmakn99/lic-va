/** Keep the completed native container intact; Sarvam needs a MIME without codec parameters. */
export function recordingFile(recording: Blob): File {
  if (recording.size > MAX_RECORDING_BYTES)
    throw new Error("Please ask a shorter question, or type it in the text box.");
  const type = recording.type.split(";")[0].trim().toLowerCase();
  const extensions: Record<string, string> = {
    "audio/webm": "webm",
    "video/webm": "webm",
    "audio/mp4": "m4a",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mpeg": "mp3",
  };
  if (!extensions[type])
    throw new Error(
      "No supported recording format was found. Please type your question.",
    );
  return new File([recording], `recording.${extensions[type]}`, { type });
}

// Leave room for multipart headers below Vercel's 4.5 MB request limit.
export const MAX_RECORDING_BYTES = 4 * 1024 * 1024;
export const MAX_AUDIO_REQUEST_BYTES = MAX_RECORDING_BYTES + 64 * 1024;
