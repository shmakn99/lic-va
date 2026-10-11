"use client";
import { useEffect, useRef, useState } from "react";
import type { Answer, Exchange, Language, PlanId, Source } from "./plans";
import { recordingFile } from "./audio";
import { defaultAnswerStyle, type AnswerStyle } from "./answer-style";
import type { ProductDocument } from "./product-document";
import { VoiceClient, type LiveState } from "./voice/client";
import { VoiceMeasurements } from "./voice/metrics";
import type { ServerEvent, VoiceConfig } from "./voice/protocol";

export type Status =
  | "Ready"
  | "Listening"
  | "Transcribing"
  | "Thinking"
  | "Preparing audio"
  | "Speaking";
export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  language: Language;
  sources?: Source[];
  kind?: Answer["kind"];
  audio?: string[];
  audioError?: string;
  failed?: boolean;
  completed?: boolean;
  spoken?: boolean;
  live?: boolean;
  interrupted?: boolean;
  playedText?: string;
};
type Reply = Answer & { sources: Source[] };
const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please retry.";

async function post(url: string, body: object | FormData, signal: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      signal,
      headers:
        body instanceof FormData ? {} : { "Content-Type": "application/json" },
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch (e) {
    if (signal.aborted)
      throw new Error("The request timed out or was cancelled. Please retry.");
    throw new Error(
      "Could not reach the local app. Check that it is running and retry.",
      { cause: e },
    );
  }
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "The request failed. Please retry.");
  return data;
}

export function useVoiceConversation() {
  const [planId, setPlanId] = useState<PlanId>("new-jeevan-anand");
  const [language, setLanguage] = useState<Language>("en-IN");
  const [answerStyle, setAnswerStyle] = useState<AnswerStyle>(defaultAnswerStyle);
  const [document, setDocument] = useState<ProductDocument | undefined>();
  const [priority, setPriority] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>("Ready");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [voice, setVoice] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const state = useRef({ planId, language, answerStyle, messages, document, priority });
  state.current = { planId, language, answerStyle, messages, document, priority };
  const voiceRef = useRef(true);
  const generation = useRef(0);
  const locked = useRef(false);
  const chain = useRef<AbortController | null>(null);
  const speech = useRef<AbortController | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const cap = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const playbackVersion = useRef(0);
  const objectUrls = useRef(new Set<string>());
  const mounted = useRef(true);
  const [liveState, setLiveState] = useState<LiveState>("off");
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [partialTranscript, setPartialTranscript] = useState("");
  const liveClient = useRef<VoiceClient | null>(null);
  const measurements = useRef(new VoiceMeasurements());
  const liveSegments = useRef(new Map<string, string[]>());
  const liveUsers = useRef(new Map<string, string>());
  const classicTurns = useRef(new Map<string, number>());

  function liveConfig(): VoiceConfig {
    const current = state.current;
    const history: Exchange[] = [];
    for (let i = 0; i < current.messages.length - 1; i++) {
      const user = current.messages[i], answer = current.messages[i + 1];
      if (user.role === "user" && !user.failed && answer.role === "assistant" && (answer.completed || answer.interrupted))
        history.push({ user: user.text, assistant: answer.live ? (answer.playedText || "") + (answer.interrupted || answer.playedText !== answer.text ? " [Response interrupted; do not assume the remaining text was heard.]" : "") : answer.text });
    }
    return { planId: current.planId, language: current.language, answerStyle: current.answerStyle, document: current.document, priority: current.priority, history: history.slice(-6), validation: "segments", voice: voiceRef.current };
  }
  function liveEvent(event: ServerEvent) {
    if (!mounted.current) return;
    if (event.type === "transcript.partial") setPartialTranscript(event.text);
    if (event.type === "transcript.final") {
      setPartialTranscript("");
      setMessages(ms => [...ms, { id: event.turnId, role: "user", text: event.text, language: state.current.language, spoken: event.spoken, live: true }]);
    }
    if (event.type === "response.start") {
      liveSegments.current.set(event.responseId, []); liveUsers.current.set(event.responseId, event.turnId);
      setMessages(ms => [...ms, { id: event.responseId, role: "assistant", text: "", language: state.current.language, sources: [], live: true }]);
    }
    if (event.type === "segment") {
      const segments = liveSegments.current.get(event.responseId);
      if (!segments || event.index !== segments.length) { measurements.current.record("correctness.segment_order_rejected"); return; }
      segments.push(event.answer.text);
      setMessages(ms => ms.map(m => m.id === event.responseId ? { ...m, text: segments.join(" "), kind: event.answer.kind,
        ...(!voiceRef.current ? { playedText: segments.join(" ") } : {}),
        sources: [...new Map([...(m.sources || []), ...event.answer.sources].map(s => [s.id, s])).values()] } : m));
    }
    if (event.type === "metric" && event.name === "playback.segment") {
      const segments = liveSegments.current.get(event.responseId!);
      if (segments) updateMessage(event.responseId!, { playedText: segments.slice(0, (event.value ?? -1) + 1).join(" ") });
    }
    if (event.type === "response.end") {
      updateMessage(event.responseId, { completed: true });
      const user = liveUsers.current.get(event.responseId); if (user) updateMessage(user, { completed: true });
    }
    if (event.type === "interrupted") {
      updateMessage(event.responseId, { interrupted: true, completed: true });
      const user = liveUsers.current.get(event.responseId); if (user) updateMessage(user, { completed: true });
      setPlayingId(null);
    }
    if (event.type === "error") {
      setError(event.message);
      if (event.responseId) updateMessage(event.responseId, { audioError: event.message });
      if (event.scope === "generation" && event.responseId) {
        const user = liveUsers.current.get(event.responseId); if (user) updateMessage(user, { failed: true });
      }
    }
  }
  function stopLive() { liveClient.current?.stop(); liveClient.current = null; setPartialTranscript(""); }
  async function startLive() {
    cancel(); setError("");
    const client = new VoiceClient(liveConfig, liveEvent, value => {
      if (!mounted.current) return;
      setLiveState(value);
      setStatus(value === "speaking" ? "Speaking" : value === "thinking" ? "Thinking" : "Ready");
    }, measurements.current);
    liveClient.current = client; await client.start();
  }
  function exportMeasurements() {
    const blob = new Blob([JSON.stringify(measurements.current.export(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = window.document.createElement("a");
    link.href = url; link.download = `voice-measurements-${new Date().toISOString().replace(/[:.]/g, "-")}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function clearTimers() {
    if (cap.current) clearTimeout(cap.current);
    if (ticker.current) clearInterval(ticker.current);
    cap.current = null;
    ticker.current = null;
  }
  function stopAudio() {
    liveClient.current?.interrupt("stop_audio");
    playbackVersion.current++;
    speech.current?.abort();
    speech.current = null;
    if (player.current) {
      player.current.pause();
      player.current.onended = null;
      player.current.onerror = null;
      player.current = null;
    }
    setPlayingId(null);
    setStatus((s) =>
      ["Speaking", "Preparing audio"].includes(s) ? "Ready" : s,
    );
  }
  function cancel() {
    stopLive();
    generation.current++;
    chain.current?.abort();
    chain.current = null;
    stopAudio();
    clearTimers();
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state !== "inactive") recorder.current.stop();
      recorder.current = null;
    }
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    locked.current = false;
    setStatus("Ready");
    setSeconds(0);
    setError("");
    setNotice("");
  }
  function releaseUrls() {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current.clear();
  }
  function reset() {
    cancel();
    releaseUrls();
    setMessages([]);
    setPriority("");
    liveSegments.current.clear(); liveUsers.current.clear();
  }
  function selectPlan(value: PlanId) {
    reset();
    setDocument(undefined);
    setPlanId(value);
  }
  function useDocument(value: ProductDocument) {
    reset();
    setDocument(value);
  }
  function correctTranscript(id: string) {
    const recent = state.current.messages;
    const index = recent.findIndex((m) => m.id === id && m.role === "user" && m.spoken);
    if (index < 0 || recent.slice(index + 1).some((m) => m.role === "user")) return "";
    cancel();
    for (const message of recent.slice(index)) {
      message.audio?.forEach((url) => {
        URL.revokeObjectURL(url);
        objectUrls.current.delete(url);
      });
    }
    const retained = recent.slice(0, index);
    state.current = { ...state.current, messages: retained };
    setMessages(retained);
    return recent[index].text;
  }
  function selectLanguage(value: Language) {
    cancel();
    setMessages((ms) => ms.filter((m) => m.completed));
    setLanguage(value);
  }
  function toggleVoice() {
    stopLive();
    voiceRef.current = !voiceRef.current;
    setVoice(voiceRef.current);
    if (!voiceRef.current) stopAudio();
  }
  function updateMessage(id: string, patch: Partial<Message>) {
    if (mounted.current)
      setMessages((ms) =>
        ms.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      );
  }

  async function play(id: string, urls: string[]) {
    if (locked.current || recorder.current) return;
    stopLive();
    stopAudio();
    setNotice("");
    const version = playbackVersion.current;
    const gen = generation.current;
    const next = async (index: number) => {
      if (
        gen !== generation.current ||
        version !== playbackVersion.current ||
        !mounted.current
      )
        return;
      if (index >= urls.length) {
        setStatus("Ready");
        setPlayingId(null);
        player.current = null;
        return;
      }
      const audio = new Audio(urls[index]);
      if (index === 0) audio.onplaying = () => {
        const started = classicTurns.current.get(id);
        if (started !== undefined) {
          measurements.current.record("first_audible_response_estimate_ms", performance.now() - started, id, undefined, "classic");
          classicTurns.current.delete(id);
        }
      };
      player.current = audio;
      audio.onended = () => {
        void next(index + 1);
      };
      audio.onerror = () => {
        if (version === playbackVersion.current) {
          setStatus("Ready");
          setPlayingId(null);
          updateMessage(id, {
            audioError: "Playback failed. Try replaying the answer.",
          });
        }
      };
      try {
        await audio.play();
        if (gen === generation.current && version === playbackVersion.current) {
          setStatus("Speaking");
          setPlayingId(id);
        } else audio.pause();
      } catch {
        if (gen === generation.current && version === playbackVersion.current) {
          setStatus("Ready");
          setPlayingId(null);
          setNotice("Audio is ready. Press Play on the answer to listen.");
        }
      }
    };
    await next(0);
  }

  async function prepareAudio(message: Message, gen = generation.current) {
    if (locked.current || recorder.current || gen !== generation.current)
      return;
    stopLive();
    stopAudio();
    const version = playbackVersion.current;
    const controller = new AbortController();
    speech.current = controller;
    setStatus("Preparing audio");
    updateMessage(message.id, { audioError: undefined });
    try {
      const data = (await post(
        "/api/speak",
        { text: message.text, language: message.language },
        AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      )) as { audios: string[]; mimeType: string };
      if (
        gen !== generation.current ||
        version !== playbackVersion.current ||
        controller.signal.aborted
      )
        return;
      const urls = data.audios.map((encoded) => {
        const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(
          new Blob([bytes], { type: data.mimeType }),
        );
        objectUrls.current.add(url);
        return url;
      });
      updateMessage(message.id, { audio: urls, audioError: undefined });
      await play(message.id, urls);
    } catch (e) {
      if (
        gen === generation.current &&
        version === playbackVersion.current &&
        !controller.signal.aborted
      ) {
        updateMessage(message.id, { audioError: errorText(e) });
        setStatus("Ready");
      }
    } finally {
      if (speech.current === controller) speech.current = null;
    }
  }

  async function submit(
    text: string,
    options: { audio?: Blob; retryId?: string } = {},
  ) {
    if (liveClient.current && liveState !== "off" && !options.audio) {
      if (options.retryId) {
        // Explicit retries use the existing validated HTTP recovery path.
        stopLive();
      } else { liveClient.current.text(text.trim()); return; }
    }
    if (locked.current || (!text.trim() && !options.audio)) return;
    if (options.retryId) {
      const current = state.current.messages;
      const index = current.findIndex(m => m.id === options.retryId && m.role === "user");
      if (index < 0 || current.slice(index + 1).some(m => m.role === "user")) return;
      const retained = current.slice(0, index + 1).map(m => m.id === options.retryId ? { ...m, completed: false, failed: false } : m);
      state.current = { ...state.current, messages: retained }; setMessages(retained);
    }
    stopAudio();
    setError("");
    setNotice("");
    locked.current = true;
    const gen = generation.current;
    const {
      planId: selectedPlan,
      language: selectedLanguage,
      answerStyle: selectedAnswerStyle,
      messages: recent,
      document: selectedDocument,
      priority: selectedPriority,
    } = state.current;
    const controller = new AbortController();
    chain.current = controller;
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(30000),
    ]);
    const classicStarted = performance.now();
    let userId = options.retryId;
    let question = text.trim();
    let answerMessage: Message | undefined;
    try {
      if (options.audio) {
        setStatus("Transcribing");
        const form = new FormData();
        form.set("file", recordingFile(options.audio));
        const data = await post("/api/transcribe", form, signal);
        if (gen !== generation.current) return;
        question = data.transcript.trim();
        measurements.current.record("stt.final_ms", performance.now() - classicStarted, undefined, undefined, "classic");
        if (!question) {
          setNotice(
            "No speech was detected. Try recording again or type a question.",
          );
          return;
        }
      }
      if (gen !== generation.current) return;
      if (!userId) {
        userId = crypto.randomUUID();
        setMessages((ms) => [
          ...ms,
          {
            id: userId!,
            role: "user",
            text: question,
            language: selectedLanguage,
            spoken: Boolean(options.audio),
          },
        ]);
      } else updateMessage(userId, { failed: false });
      setStatus("Thinking");
      const history: Exchange[] = [];
      for (let i = 0; i < recent.length - 1; i++) {
        if (
          recent[i].role === "user" &&
          !recent[i].failed &&
          recent[i].completed &&
          recent[i + 1].role === "assistant" &&
          recent[i + 1].completed
        )
          history.push({ user: recent[i].text, assistant: recent[i + 1].live && (recent[i + 1].interrupted || recent[i + 1].playedText !== recent[i + 1].text)
            ? `${recent[i + 1].playedText || ""} [Response interrupted; do not assume the remaining text was heard.]` : recent[i + 1].text });
      }
      const data: Reply = await post(
        "/api/chat",
        {
          planId: selectedPlan,
          language: selectedLanguage,
          answerStyle: selectedAnswerStyle,
          document: selectedDocument,
          priority: selectedPriority,
          question,
          history: history.slice(-6),
        },
        signal,
      );
      measurements.current.record("response.validated_ms", performance.now() - classicStarted, undefined, undefined, "classic");
      if (gen !== generation.current) return;
      answerMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: data.text,
        language: selectedLanguage,
        sources: data.sources,
        kind: data.kind,
        completed: true,
      };
      const completed = answerMessage;
      classicTurns.current.set(completed.id, classicStarted);
      setMessages((ms) => [
        ...ms.map((m) =>
          m.id === userId ? { ...m, completed: true, failed: false } : m,
        ),
        completed,
      ]);
    } catch (e) {
      if (gen === generation.current && !controller.signal.aborted) {
        setError(errorText(e));
        if (userId) updateMessage(userId, { failed: true });
      }
    } finally {
      if (gen === generation.current) {
        locked.current = false;
        chain.current = null;
        setStatus("Ready");
      }
    }
    if (answerMessage && voiceRef.current && gen === generation.current)
      await prepareAudio(answerMessage, gen);
  }

  async function microphone() {
    stopLive();
    if (recorder.current?.state === "recording") {
      recorder.current.stop();
      clearTimers();
      return;
    }
    if (locked.current) return;
    stopAudio();
    setError("");
    setNotice("");
    const gen = generation.current;
    locked.current = true;
    setStatus("Listening");
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw new Error(
          "Recording is unavailable in this browser. Open localhost in Chrome or Edge, or type your question.",
        );
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (gen !== generation.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType)
        throw new Error(
          "No supported recording format was found. Please type your question.",
        );
      const recording = new MediaRecorder(media, { mimeType });
      recorder.current = recording;
      const chunks: Blob[] = [];
      recording.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recording.onerror = () => {
        if (gen === generation.current) {
          cancel();
          setError(
            "Microphone recording failed. Please retry or type a question.",
          );
        }
      };
      recording.onstop = () => {
        media.getTracks().forEach((t) => t.stop());
        if (gen !== generation.current) return;
        clearTimers();
        recorder.current = null;
        stream.current = null;
        locked.current = false;
        const blob = new Blob(chunks, { type: recording.mimeType || mimeType });
        if (!blob.size) {
          setStatus("Ready");
          setNotice("The recording was empty. Please try again.");
          return;
        }
        void submit("", { audio: blob });
      };
      // Receive the complete container on stop, with its final metadata.
      recording.start();
      setSeconds(0);
      const started = Date.now();
      ticker.current = setInterval(
        () =>
          setSeconds(Math.min(25, Math.floor((Date.now() - started) / 1000))),
        250,
      );
      cap.current = setTimeout(() => {
        if (recording.state === "recording") recording.stop();
        clearTimers();
      }, 25000);
    } catch (e) {
      if (gen !== generation.current) return;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      locked.current = false;
      setStatus("Ready");
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access in your browser, or type a question below."
          : errorText(e),
      );
    }
  }

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    fetch("/api/status", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => { setConfigured(data.configured); setLiveAvailable(Boolean(data.streaming)); })
      .catch(() => {});
    return () => {
      mounted.current = false;
      liveClient.current?.stop();
      controller.abort();
      generation.current++;
      chain.current?.abort();
      speech.current?.abort();
      playbackVersion.current++;
      player.current?.pause();
      clearTimers();
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
      releaseUrls();
    };
  }, []);

  const processing = ["Transcribing", "Thinking"].includes(status) || ["connecting", "reconnecting"].includes(liveState);
  return {
    planId,
    language,
    answerStyle,
    document,
    priority,
    setPriority: (value: string) => { stopLive(); setPriority(value); },
    useDocument,
    correctTranscript,
    selectAnswerStyle: (value: AnswerStyle) => { stopLive(); setAnswerStyle(value); },
    messages,
    status,
    error,
    notice,
    voice,
    seconds,
    playingId,
    configured,
    processing,
    reset,
    selectPlan,
    selectLanguage,
    toggleVoice,
    stopAudio,
    microphone,
    submit,
    prepareAudio,
    play,
    liveState, liveAvailable, partialTranscript, startLive, stopLive,
    finishLiveTurn: () => liveClient.current?.finish(),
    exportMeasurements,
    readMeasurements: () => measurements.current.export(),
    recordVoiceReview: (scenario: string, result: string) => {
      const last = state.current.messages.findLast(m => m.role === "assistant");
      measurements.current.record(`review.${scenario}.${result}`, undefined, last?.id, undefined, last?.live ? "streaming" : "classic");
    },
  };
}
