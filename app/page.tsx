"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { plans, type Language, type PlanId } from "@/lib/plans";
import { ui, planCopy, sourceCopy, messageCopy } from "@/lib/i18n";
import { useVoiceConversation, type Message } from "@/lib/use-voice-conversation";
import { answerStyles } from "@/lib/answer-style";
import { DocumentContext } from "./document-context";

function Icon({
  name,
  size = 20,
}: {
  name:
    | "mic"
    | "send"
    | "sound"
    | "book"
    | "reset"
    | "stop"
    | "play"
    | "spark"
    | "copy";
  size?: number;
}) {
  const shapes = {
    copy: (
      <>
        <rect x="8" y="8" width="12" height="13" rx="2" />
        <path d="M16 8V3H3v13h5" />
      </>
    ),
    mic: (
      <>
        <rect x="9" y="2" width="6" height="13" rx="3" />
        <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
      </>
    ),
    send: (
      <>
        <path d="m4 12 16-8-6 16-3-7-7-1Z" />
        <path d="m11 13 9-9" />
      </>
    ),
    sound: (
      <>
        <path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
      </>
    ),
    book: (
      <>
        <path d="M12 5c-3-3-7-2-10-1v15c3-1 7-2 10 1 3-3 7-2 10-1V4c-3-1-7-2-10 1Zm0 0v15" />
      </>
    ),
    reset: (
      <>
        <path d="M3 11a9 9 0 1 1 2 7M3 4v7h7" />
      </>
    ),
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    play: <path d="m8 4 12 8-12 8V4Z" />,
    spark: (
      <>
        <path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[name]}
    </svg>
  );
}

function CopyAnswer({
  message,
  language,
}: {
  message: Message;
  language: Language;
}) {
  const t = ui(language);
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), 3000);
    return () => clearTimeout(timer);
  }, [status]);
  const copy = async () => {
    const sources = message.sources?.map((source) => {
      const label = sourceCopy(source, language);
      return `${label.title} — ${label.section}\n${source.url || source.excerpt || ""}`;
    });
    const text = sources?.length
      ? `${message.text}\n\n${t.sources}:\n${sources.join("\n\n")}`
      : message.text;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };
  return (
    <div className="copy-control">
      <button className="copy-button" onClick={() => void copy()}>
        <Icon name="copy" size={14} />
        {t.copyAnswer}
      </button>
      <span className="copy-feedback" role="status">
        {status === "copied"
          ? t.copied
          : status === "failed"
            ? t.copyFailed
            : ""}
      </span>
    </div>
  );
}

export default function Home() {
  const c = useVoiceConversation();
  const [draft, setDraft] = useState("");
  const conversation = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const plan = plans.find((p) => p.id === c.planId)!;
  const t = ui(c.language);
  const details = planCopy(c.planId, c.language);
  useEffect(() => {
    document.documentElement.lang = c.language === "hi-IN" ? "hi" : "en";
    document.title = t.brand;
  }, [c.language, t.brand]);
  const disabled =
    c.processing || c.status === "Listening" || c.configured === false;
  useLayoutEffect(() => {
    if (!c.messages.length) {
      nearBottom.current = true;
      if (conversation.current) conversation.current.scrollTop = 0;
      return;
    }
    if (nearBottom.current && conversation.current) {
      conversation.current.scrollTop = conversation.current.scrollHeight;
    }
  }, [c.messages.length, c.status]);
  const send = (text: string) => {
    if (disabled || !text.trim()) return;
    setDraft("");
    void c.submit(text);
  };
  const suggestions = c.document || c.messages.length ? t.salesSuggestions : t.suggestionsList[c.planId];
  const lastUserId = c.messages.findLast((m) => m.role === "user")?.id;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="sound" size={22} />
          </span>
          <div>
            <strong>{t.brand}</strong>
            <span>{c.document ? t.customGrounded : t.subtitle}</span>
          </div>
        </div>
        <div className="demo-tag">
          <span /> {t.demo}
        </div>
      </header>
      <section className="intro-row">
        <div>
          <div className="eyebrow">{t.eyebrow}</div>
          <h1>{t.heading}</h1>
          <p>{t.description}</p>
        </div>
        <span className="grounded-label">
          <Icon name="book" size={17} /> {c.document ? t.customGrounded : t.grounded}
        </span>
      </section>

      <div className="workspace">
        <aside className="sidebar">
          <div className="eyebrow">{t.choosePlan}</div>
          <label className="sr-only" htmlFor="plan">
            {t.selectPlan}
          </label>
          <select
            id="plan"
            className="mobile-plan"
            value={c.document ? "custom" : c.planId}
            onChange={(e) => {
              if (e.target.value !== "custom") c.selectPlan(e.target.value as PlanId);
              setDraft("");
            }}
          >
            {c.document && <option value="custom">{t.customDocument}</option>}
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {planCopy(p.id, c.language).name} · {p.number}
              </option>
            ))}
          </select>
          <div className="plan-list" role="group" aria-label={t.selectPlan}>
            {plans.map((p) => (
              <button
                key={p.id}
                data-plan={p.id}
                className={`plan-card ${!c.document && p.id === c.planId ? "selected" : ""}`}
                onClick={() => {
                  c.selectPlan(p.id);
                  setDraft("");
                }}
                aria-pressed={!c.document && p.id === c.planId}
              >
                <span className="plan-card-top">
                  <span>
                    {t.planCard} {p.number}
                  </span>
                  <span className="radio-dot" />
                </span>
                <strong>{planCopy(p.id, c.language).name}</strong>
                <span className="plan-category">
                  {planCopy(p.id, c.language).category}
                </span>
              </button>
            ))}
          </div>
          <DocumentContext language={c.language} document={c.document} onApply={(value) => {
            c.useDocument(value);
            setDraft("");
          }} />
          <div className="language-area">
            <div className="eyebrow">{t.yourLanguage}</div>
            <div
              className="language-control"
              role="group"
              aria-label={t.answerLanguage}
            >
              {(["en-IN", "hi-IN"] as Language[]).map((l) => (
                <button
                  key={l}
                  aria-pressed={c.language === l}
                  className={c.language === l ? "active" : ""}
                  onClick={() => c.selectLanguage(l)}
                >
                  {l === "en-IN" ? t.english : "हिन्दी"}
                </button>
              ))}
            </div>
          </div>
          <div className="answer-style-area">
            <label className="eyebrow" htmlFor="answer-style">
              {t.answerStyleHeading}
            </label>
            <input
              id="answer-style"
              type="range"
              min={0}
              max={2}
              step={1}
              value={answerStyles.indexOf(c.answerStyle)}
              aria-label={t.answerStyle}
              aria-valuetext={t.answerStyles[c.answerStyle]}
              aria-describedby="answer-style-hint"
              onChange={(event) =>
                c.selectAnswerStyle(answerStyles[Number(event.target.value)])
              }
            />
            <div className="answer-style-labels">
              {answerStyles.map((style) => (
                <button
                  key={style}
                  aria-pressed={c.answerStyle === style}
                  onClick={() => c.selectAnswerStyle(style)}
                >
                  {t.answerStyles[style]}
                </button>
              ))}
            </div>
            <p id="answer-style-hint">{t.answerStyleHint}</p>
          </div>
          <div className="sidebar-note">
            <Icon name="book" />
            <div>
              <strong>{t.sourceHeading}</strong>
              <p>{c.document ? t.customSourceHint : t.sourceHint}</p>
              {!c.document && <p>{t.coverageHint}</p>}
            </div>
          </div>
          <div className="smallprint">
            {t.independent}
            <br />
            {t.unofficial}
          </div>
        </aside>

        <section className="conversation-panel" aria-label={t.conversation}>
          <div className="conversation-header" data-plan={c.planId}>
            <div>
              <div className="plan-heading">
                <span className="live-dot" />
                <strong>{c.document?.title || details.name}</strong>
              </div>
              <span className="plan-meta">
                {c.document ? t.customDocument : <>{t.plan} {plan.number}<span>·</span>{t.uin} {plan.uin}</>}
              </span>
            </div>
            <button
              className="text-button"
              onClick={() => {
                c.reset();
                setDraft("");
              }}
            >
              <Icon name="reset" size={16} />
              {t.reset}
            </button>
          </div>

          <div className="priority-area">
            <label htmlFor="priority">{t.priorityLabel}</label>
            <textarea id="priority" rows={1} maxLength={240} value={c.priority}
              onChange={(e) => c.setPriority(e.target.value)} placeholder={t.priorityHint}
              aria-describedby="priority-hint" />
            <p id="priority-hint">{t.prioritySaved}</p>
          </div>
          <div
            className="conversation-scroll"
            ref={conversation}
            onScroll={(event) => {
              const { scrollHeight, scrollTop, clientHeight } =
                event.currentTarget;
              nearBottom.current = scrollHeight - scrollTop - clientHeight <= 64;
            }}
          >
            {c.configured === false && (
              <div className="alert">{t.unconfigured}</div>
            )}
            {!c.messages.length && (
              <div className="welcome">
                <div className="welcome-symbol">
                  <Icon name="sound" size={34} />
                </div>
                <span className="eyebrow">{t.welcomeEyebrow}</span>
                <h2>{t.welcome}</h2>
                <p>{t.welcomeHint}</p>
                <div className="welcome-actions">
                  <button className="explain-button" disabled={disabled} onClick={() => send(t.pitch)}>
                    <Icon name="spark" size={18} /> {t.pitch}
                  </button>
                  <button
                    className="text-button"
                    disabled={disabled}
                    onClick={() => send(t.explain)}
                  >
                    <Icon name="spark" size={18} />
                    {t.explain}
                    <span aria-hidden="true">↗</span>
                  </button>
                </div>
                <div className="welcome-hint">{c.document ? t.customNote : details.note}</div>
              </div>
            )}
            <div
              className="messages"
              role="log"
              aria-label={t.conversationLog}
              aria-live="polite"
              aria-relevant="additions text"
            >
              {c.messages.map((m) => (
                <article key={m.id} className={`message ${m.role}`}>
                  <div className="message-label">
                    {m.role === "user" ? (
                      m.spoken ? (
                        t.youVoice
                      ) : (
                        t.you
                      )
                    ) : (
                      <>
                        <span className="mini-mark">
                          <Icon name="sound" size={13} />
                        </span>{" "}
                        {t.assistant}
                      </>
                    )}
                  </div>
                  <div className="message-body">
                    {m.role === "assistant" &&
                      (m.kind === "clarification" || m.kind === "unsupported") && (
                        <div className={`answer-badge ${m.kind}`}>
                          {m.kind === "clarification"
                            ? t.needsClarification
                            : t.notCovered}
                        </div>
                      )}
                    <p lang={m.language === "hi-IN" ? "hi" : "en"}>{m.text}</p>
                    {m.role === "assistant" && (
                      <div className="answer-controls">
                        {!!m.sources?.length && (
                          <details>
                            <summary>
                              <Icon name="book" size={14} />
                              {t.sources}{" "}
                              <span className="source-count">
                                {m.sources.length}
                              </span>
                            </summary>
                            <ul>
                              {m.sources.map((s) => (
                                <li key={s.id}>
                                  {s.url ? <a
                                    href={s.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {sourceCopy(s, c.language).title} ↗
                                  </a> : <strong>{sourceCopy(s, c.language).title}</strong>}
                                  <span>
                                    {sourceCopy(s, c.language).section}
                                  </span>
                                  {s.excerpt && <blockquote className="source-excerpt">{s.excerpt}</blockquote>}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                        <button
                          className="audio-button"
                          disabled={
                            c.processing ||
                            c.status === "Listening" ||
                            c.status === "Preparing audio"
                          }
                          onClick={() =>
                            m.audio
                              ? void c.play(m.id, m.audio)
                              : void c.prepareAudio(m)
                          }
                        >
                          <Icon name="play" size={14} />
                          {c.playingId === m.id
                            ? t.playing
                            : m.audio
                              ? t.replay
                              : m.audioError
                                ? t.retryAudio
                                : t.listen}
                        </button>
                        <CopyAnswer message={m} language={c.language} />
                      </div>
                    )}
                    {m.audioError && (
                      <div className="audio-error">
                        {messageCopy(m.audioError, c.language)}
                      </div>
                    )}
                    {m.failed && (
                      <button
                        className="retry-button"
                        disabled={disabled}
                        onClick={() => void c.submit(m.text, { retryId: m.id })}
                      >
                        {t.retry}
                      </button>
                    )}
                    {m.spoken && m.id === lastUserId && <button className="retry-button" disabled={disabled}
                      onClick={() => { setDraft(c.correctTranscript(m.id)); document.getElementById("question")?.focus(); }}>
                      {t.correctTranscript}
                    </button>}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="composer-area">
            {c.error && (
              <div className="alert" role="alert">
                {messageCopy(c.error, c.language)}
              </div>
            )}
            {c.notice && (
              <div className="notice" role="status">
                {messageCopy(c.notice, c.language)}
              </div>
            )}
            <div className="suggestions" aria-label={t.suggestions}>
              {!!c.messages.length && <button disabled={disabled} onClick={() => send(t.pitch)}>{t.pitch}</button>}
              {suggestions.map((q) => (
                <button key={q} disabled={disabled} onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
              className={`composer ${c.status === "Listening" ? "recording" : ""}`}
            >
              <label htmlFor="question" className="sr-only">
                {t.question}
              </label>
              <textarea
                id="question"
                rows={1}
                maxLength={1200}
                value={draft}
                disabled={disabled}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t.placeholder}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    send(draft);
                  }
                }}
              />
              <button
                type="button"
                className={`mic-button ${c.status === "Listening" ? "is-recording" : ""}`}
                disabled={c.processing || c.configured === false}
                onClick={() => void c.microphone()}
                aria-label={
                  c.status === "Listening" ? t.stopRecording : t.startRecording
                }
                title={
                  c.status === "Listening" ? t.stopSubmit : t.recordQuestion
                }
              >
                <Icon name={c.status === "Listening" ? "stop" : "mic"} />
              </button>
              <button
                type="submit"
                className="send-button"
                disabled={disabled || !draft.trim()}
                aria-label={t.send}
              >
                <Icon name="send" />
              </button>
            </form>
            <div className="composer-footer">
              <div
                className={`status ${c.status === "Listening" ? "recording-status" : ""}`}
                role="status"
              >
                <span />
                {t.statuses[c.status]}
                {c.status === "Listening" &&
                  ` · ${c.seconds}${t.seconds} / 25${t.seconds} · ${t.micHint}`}
              </div>
              <div className="voice-controls">
                {["Speaking", "Preparing audio"].includes(c.status) && (
                  <button onClick={c.stopAudio} className="stop-audio">
                    <Icon name="stop" size={12} />
                    {t.stopAudio}
                  </button>
                )}
                <button
                  role="switch"
                  aria-checked={c.voice}
                  aria-label={t.spokenAnswers}
                  className="voice-toggle"
                  onClick={c.toggleVoice}
                >
                  <Icon name="sound" size={15} />
                  <span>{c.voice ? t.voiceOn : t.voiceOff}</span>
                  <span className={`switch ${c.voice ? "on" : ""}`} />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
      <footer className="page-footer">
        <span>{t.footer}</span>
        <span>
          {t.languages} <span className="footer-dot">·</span> {t.powered}
        </span>
      </footer>
    </main>
  );
}
