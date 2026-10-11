import { readFile } from "node:fs/promises";
import { summarize, type Observation } from "../lib/voice/metrics";
const file = process.argv[2];
if (!file) throw new Error("Usage: npm run voice:report -- <exported-measurements.json>");
const report = JSON.parse(await readFile(file, "utf8"));
const observations = report.observations as Observation[];
if (!Array.isArray(observations)) throw new Error("Expected voice measurement export");
for (const mode of ["classic", "streaming"]) {
  const rows = observations.filter(r => r.mode === mode);
  console.log(mode); console.table(summarize(rows));
  console.log("Slowest observed responses (ranking only, no threshold)");
  console.table(rows.filter(r => r.name === "first_audible_response_estimate_ms" && typeof r.value === "number").sort((a,b) => b.value! - a.value!).slice(0, 10).map(r => ({ at: r.at, responseId: r.responseId, milliseconds: r.value })));
}
