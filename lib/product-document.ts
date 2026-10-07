import { z } from "zod";
import type { Source } from "./plans";

export const documentLimit = 24000;
export const productDocumentSchema = z.object({
  title: z.string().trim().min(3).max(160),
  text: z.string().trim().min(80).max(documentLimit),
}).strict();
export type ProductDocument = z.infer<typeof productDocumentSchema>;

// Preserve whole paragraphs (including tables and their line breaks). Never
// silently truncate a document or pretend that pasted sections are PDF pages.
export function documentKnowledge(document: ProductDocument) {
  const groups: string[] = [];
  for (const paragraph of document.text.split(/\r?\n\s*\r?\n/)) {
    const last = groups.length - 1;
    if (last >= 0 && groups[last].length + paragraph.length < 2000)
      groups[last] += `\n\n${paragraph}`;
    else groups.push(paragraph);
  }
  const sources: Source[] = groups.map((excerpt, index) => ({
    id: `DOC-${index + 1}`,
    planId: "custom",
    documentTitle: document.title,
    pageOrSection: `Pasted text · section ${index + 1}`,
    url: "",
    excerpt,
  }));
  return {
    plan: undefined,
    passages: JSON.stringify(sources.map((s) => ({ id: s.id, text: s.excerpt }))),
    sources,
  };
}
