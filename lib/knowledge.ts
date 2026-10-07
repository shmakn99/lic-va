import { readFile } from "node:fs/promises";
import path from "node:path";
import manifest from "../content/sources.json";
import { plans, type PlanId, type Source } from "./plans";
export async function loadKnowledge(planId: PlanId) {
  const plan = plans.find((p) => p.id === planId);
  if (!plan) throw new Error("Unknown plan");
  const passages = await readFile(
    path.join(process.cwd(), "content", `${planId}.md`),
    "utf8",
  );
  const sources: Source[] = manifest.filter((s) => s.planId === planId);
  return { plan, passages, sources };
}
