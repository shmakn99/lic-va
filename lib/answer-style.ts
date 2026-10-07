export const answerStyles = ["very-simple", "normal", "technical"] as const;
export type AnswerStyle = (typeof answerStyles)[number];
export const defaultAnswerStyle: AnswerStyle = "technical";

export const answerStyleInstructions: Record<AnswerStyle, string> = {
  "very-simple":
    `Very simple language: assume no insurance knowledge. Use familiar everyday words and short sentences, with one idea per sentence. Replace legal and insurance jargon with its precise everyday meaning. Do not copy the formal wording of the sources into the answer. Use "you" when explaining a general rule, without claiming the user is eligible. Speak respectfully to an adult. Prefer a few short sentences over a compressed three-sentence introduction.
Wording examples (not additional product facts): "on maturity" becomes "when the policy term ends"; "in force" becomes "still active"; "all due premiums paid" becomes "you have made all the payments due"; "life assured survives" becomes "the insured person is alive"; "Basic Sum Assured" becomes "the basic cover amount shown in the policy"; "vested Simple Reversionary Bonuses" becomes "bonuses already added to the policy"; "Final Additional Bonus, if any" becomes "an extra final bonus, if LIC declares one". Preserve the distinctions between already-added and possible future bonuses. Do not replace a specific amount with a vague phrase such as "some money". If the question asks about an official term, name it once and explain it using everyday words.
Before returning JSON, rewrite any remaining unexplained jargon. A beginner should understand the answer without knowing any insurance terms.`,
  normal:
    `Normal language: explain to an adult who is unfamiliar with policy documents. Use conversational language and short, straightforward sentences, ideally under 25 words each. Keep common insurance words such as policy, premium, cover and maturity, with a brief explanation when needed. Replace specialist legal terms with plain descriptions instead of listing their formal names. Never use unexplained phrases like "vested Simple Reversionary Bonuses", "Sum Assured on Maturity" or "in force".
Wording examples (not additional product facts): say "At maturity (the end of the policy term)"; "the policy's basic cover amount"; "bonuses already added to your policy"; "an extra final bonus, if LIC declares one"; "the policy must be active and all premiums due must be paid". If a question specifically asks about a specialist term, name it once and explain it immediately. Before returning JSON, rewrite any sentence that still reads like a legal document.`,
  technical:
    "Technical language: retain the current document-grounded insurance terminology and precise policy wording where useful, while keeping the spoken answer concise.",
};
