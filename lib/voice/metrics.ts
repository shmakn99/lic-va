export type Observation = {
  at: string; elapsedMs: number; name: string; value?: number;
  sessionId?: string; responseId?: string; mode: "streaming" | "classic";
};
export class VoiceMeasurements {
  readonly observations: Observation[] = [];
  private started = performance.now();
  record(name: string, value?: number, responseId?: string, sessionId?: string, mode: Observation["mode"] = "streaming") {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) return;
    this.observations.push({ at: new Date().toISOString(), elapsedMs: performance.now() - this.started, name, value, responseId, sessionId, mode });
    if (this.observations.length > 5000) this.observations.shift();
  }
  export() { return { version: 1, timing: "Browser audio-render estimates; physical audibility requires loopback measurement", summary: { classic: summarize(this.observations.filter(r => r.mode === "classic")), streaming: summarize(this.observations.filter(r => r.mode === "streaming")) }, observations: [...this.observations] }; }
}
export function summarize(rows: Observation[]) {
  const names = [...new Set(rows.map(r => r.name))];
  return Object.fromEntries(names.map(name => {
    const matching = rows.filter(r => r.name === name);
    const values = matching.flatMap(r => r.value === undefined ? [] : [r.value]).sort((a,b) => a-b);
    const percentile = (p: number) => values.length ? values[Math.max(0, Math.ceil(values.length*p)-1)] : null;
    return [name, { count: matching.length, samples: values.length, p50: percentile(.5), p95: percentile(.95), max: values.at(-1) ?? null }];
  }));
}
