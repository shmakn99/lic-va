"use client";
import { useState } from "react";
import { documentLimit, productDocumentSchema, type ProductDocument } from "@/lib/product-document";
import { ui } from "@/lib/i18n";
import type { Language } from "@/lib/plans";

export function DocumentContext({ language, document, onApply }: {
  language: Language;
  document?: ProductDocument;
  onApply: (document: ProductDocument) => void;
}) {
  const t = ui(language);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);
  return <div className="document-context">
    <button className="document-toggle" aria-expanded={open} aria-controls="document-editor" onClick={() => {
      if (!open) { setTitle(document?.title || ""); setText(document?.text || ""); setInvalid(false); }
      setOpen(!open);
    }}>{document ? t.editDocument : t.addDocument}</button>
    {open && <form id="document-editor" className="document-editor" onSubmit={(event) => {
      event.preventDefault();
      const parsed = productDocumentSchema.safeParse({ title, text });
      if (!parsed.success) { setInvalid(true); return; }
      onApply(parsed.data);
      setOpen(false);
    }}>
      <p>{t.documentHint}</p>
      <label htmlFor="document-title">{t.documentTitle}</label>
      <input id="document-title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
      <label htmlFor="document-text">{t.documentText}</label>
      <textarea id="document-text" rows={8} value={text} onChange={(e) => setText(e.target.value)} aria-describedby="document-length" />
      <p id="document-length">{text.length.toLocaleString(language)} / {documentLimit.toLocaleString(language)} · {t.documentLimits}</p>
      {invalid && <p role="alert">{t.documentInvalid}</p>}
      <button className="explain-button" type="submit">{t.useDocument}</button>
    </form>}
  </div>;
}
