/** SSE framing is independent of transport chunk and UTF-8 boundaries. */
export async function* readSSE(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 100_000) throw new Error("Provider event too large");
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer))) {
        const event = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const data = event.split(/\r?\n/).filter(l => l.startsWith("data:")).map(l => l.slice(5).trimStart()).join("\n");
        if (data) yield data;
      }
      if (done) {
        if (buffer.trim()) throw new Error("Truncated provider event");
        break;
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

/** Extract complete objects from {"segments":[...]} without parsing unfinished strings. */
export class SegmentParser {
  private raw = "";
  private cursor = 0;
  private start = -1;
  private depth = 0;
  private quoted = false;
  private escaped = false;
  private array = false;
  private ended = false;
  private boundary: "objectOrEnd" | "object" | "commaOrEnd" = "objectOrEnd";
  push(delta: string): unknown[] {
    this.raw += delta;
    if (this.raw.length > 32_000) throw new Error("Answer stream too large");
    const results: unknown[] = [];
    if (!this.array) {
      const prefix = /^\s*\{\s*"segments"\s*:\s*\[/.exec(this.raw);
      if (!prefix) return results;
      this.array = true; this.cursor = prefix[0].length;
    }
    for (; this.cursor < this.raw.length && !this.ended; this.cursor++) {
      const char = this.raw[this.cursor];
      if (!this.depth && !this.quoted) {
        if (/\s/.test(char)) continue;
        if (char === "]" && this.boundary !== "object") { this.ended = true; continue; }
        if (char === "," && this.boundary === "commaOrEnd") { this.boundary = "object"; continue; }
        if (char !== "{" || this.boundary === "commaOrEnd") throw new Error("Invalid segment framing");
        this.start = this.cursor; this.depth = 1; continue;
      }
      if (this.quoted) {
        if (this.escaped) this.escaped = false;
        else if (char === "\\") this.escaped = true;
        else if (char === '"') this.quoted = false;
        continue;
      }
      if (char === '"') this.quoted = true;
      else if (char === "{") { if (!this.depth) this.start = this.cursor; this.depth++; }
      else if (char === "}") {
        this.depth--;
        if (!this.depth && this.start >= 0) {
          results.push(JSON.parse(this.raw.slice(this.start, this.cursor + 1))); this.start = -1; this.boundary = "commaOrEnd";
        }
      } else if (char === "]" && !this.depth) this.ended = true;
      else if (!this.depth && !/[\s,]/.test(char)) throw new Error("Invalid segment framing");
    }
    return results;
  }
  finish() {
    const data = JSON.parse(this.raw);
    if (!this.ended || !/^\s*}\s*$/.test(this.raw.slice(this.cursor)) || Object.keys(data).join() !== "segments" || !Array.isArray(data.segments) || !data.segments.length) throw new Error("Incomplete answer stream");
  }
}
