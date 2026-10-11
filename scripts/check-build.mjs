import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import path from "node:path";

const plans = ["new-jeevan-anand", "jeevan-utsav-single-premium", "digi-term"];
for (const route of ["chat", "voice/socket"]) {
  const trace = path.resolve(`.next/server/app/api/${route}/route.js.nft.json`);
  const { files } = JSON.parse(await readFile(trace, "utf8"));
  const included = new Set(files.map(file => path.resolve(path.dirname(trace), file)));
  for (const plan of plans) {
    const source = path.resolve(`content/${plan}.md`);
    assert.ok(included.has(source), `${route} is missing ${plan}.md in its deployment trace`);
    await access(source);
  }
  assert.ok(!files.some(file => /(?:^|[/\\])\.env(?:\.|$)/.test(file)), `${route} includes an environment file`);
}
for (const asset of ["public/voice-worklet.js", "public/presentation.html"]) await access(asset);
console.log("Deployment traces include all three plan documents for chat and live voice; no environment files traced.");
