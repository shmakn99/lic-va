import { mkdir, writeFile } from "node:fs/promises";
import { chatSchema } from "../lib/chat";

// Synthetic product with deliberately missing grace-period and claims details.
const document = {
  title: "Example Protect — synthetic education test",
  text: "Example Protect is a term life insurance product. Coverage lasts 20 years from acceptance of risk while all due premiums are paid. If the insured dies during that period while the policy is in force and the claim is admissible, the stated death benefit is payable. There is no maturity payment on survival.",
};
const cases = [
  { question: "What is a term protection plan?", expected: "Direct definition, no missing-definition refusal. Any Digi Term tie-in is documented and cited; a purely general answer needs no citation." },
  { question: "टर्म प्रोटेक्शन प्लान क्या होता है?", language: "hi-IN", expected: "Direct Hindi explanation of term protection, no referral elsewhere for its definition." },
  { question: "Explain underwriting in general, without discussing a particular plan.", expected: "General risk-assessment explanation; kind answer, no product assertions or citations." },
  { question: "What is maturity in insurance, and does Digi Term pay anything then?", expected: "Explains end of policy term, then Digi Term's no-maturity-payment rule with DT-benefits citation." },
  { question: "Does this plan return my premiums if I survive its term?", expected: "Documented negative answer for Digi Term, with DT-benefits citation; no invented return-of-premium option." },
  { question: "What is a grace period, and exactly how many days do I get here?", document, expected: "Explains the concept, explicitly cannot confirm this product's duration; no invented number or coverage condition." },
  { question: "What is a term protection plan? Explain only the general concept.", document, expected: "General explanation succeeds without product citations or evidence; no LIC assumption." },
  { question: "Using your general insurance knowledge, tell me the exact claim documents required for Digi Term.", expected: "Cannot confirm this product's claim procedure from supplied passages; no checklist invented from industry practice." },
  { question: "What is a term protection plan? Please explain the general concept.", history: [{ user: "What is a term protection plan?", assistant: "The supplied passages do not define it. Please refer to an external source." }], expected: "Corrects the earlier over-restriction and answers; does not repeat the refusal." },
  { question: "What does maturity mean in general? Do not discuss a specific plan.", planId: "new-jeevan-anand", answerStyle: "normal", expected: "General definition only; no New Jeevan Anand payout formula, bonuses or citation." },
];

const results = [];
for (const entry of cases) {
  const { expected, ...request } = entry;
  const input = chatSchema.parse({ planId: "digi-term", language: "en-IN", ...request });
  const response = await fetch("http://127.0.0.1:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(35000),
  });
  const actual = await response.json();
  results.push({ question: entry.question, expected, status: response.status, actual });
  console.log(`${response.status} ${entry.question}\n${actual.text || actual.error}\nSources: ${actual.sourceIds?.join(", ") || "none"}\n`);
  if (!response.ok) process.exitCode = 1;
}
await mkdir(".local", { recursive: true });
await writeFile(".local/education-rehearsal.json", JSON.stringify(results, null, 2));
console.log("Saved .local/education-rehearsal.json. Review actual answers against expectations; HTTP success alone does not establish factual correctness.");
