"use client";
import { useState } from "react";
import type { VoiceMeasurements } from "@/lib/voice/metrics";
type Report = ReturnType<VoiceMeasurements["export"]>;
const scenarios = ["transcript_accuracy", "turn_boundary", "source_support", "material_conditions", "language", "false_interruption", "stale_output", "duplicate_turn"] as const;
const labels = {
  en: ["Transcript accuracy", "Turn boundary", "Source support", "Material conditions", "Language", "False interruption", "Stale output", "Duplicate turn"],
  hi: ["लिप्यंतरण की शुद्धता", "प्रश्न की सीमा", "स्रोत का समर्थन", "ज़रूरी शर्तें", "भाषा", "गलत व्यवधान", "पुराना उत्तर", "दोहराया गया प्रश्न"],
};
const metricLabels: Record<string, [string, string]> = {
  first_audible_response_estimate_ms: ["First audible response (estimate)", "पहली आवाज़ तक समय (अनुमान)"],
  response_start_to_audio_estimate_ms: ["Response start to audio (estimate)", "उत्तर शुरू होने से आवाज़ तक (अनुमान)"],
  interruption_to_output_stop_estimate_ms: ["Speech interruption to audio stop", "बोलकर रोकने से आवाज़ बंद होने तक"],
  interrupt_event_to_output_stop_estimate_ms: ["Stop event to audio stop", "रोकने के संकेत से आवाज़ बंद होने तक"],
  interrupt_detection_to_output_stop_estimate_ms: ["Interruption detection to audio stop", "व्यवधान पहचानने से आवाज़ बंद होने तक"],
  "stt.final_after_endpoint_ms": ["Turn boundary to final transcript", "प्रश्न समाप्त होने से अंतिम लिप्यंतरण तक"],
  "stt.final_ms": ["Transcription", "लिप्यंतरण"],
  "tts.first_audio_ms": ["Response start to first synthesized audio", "उत्तर शुरू होने से पहली बनी आवाज़ तक"],
  "response.generated_ms": ["Response generation", "उत्तर बनाने का समय"],
  "response.validated_ms": ["Validated answer", "जाँचे गए उत्तर तक समय"],
  "llm.first_token": ["First generated text", "पहला बना पाठ"],
  "validation.segment_rejected": ["Segments rejected", "अस्वीकृत उत्तर के हिस्से"],
  "validation.or_stream_failure": ["Validation or stream failures", "जाँच या स्ट्रीम में समस्याएँ"],
  "validation.whole_answer_fallback": ["Complete-answer fallbacks", "पूरे उत्तर की जाँच पर वापसी"],
  "audio.failure": ["Audio failures", "आवाज़ की समस्याएँ"],
  "response.failure": ["Response failures", "उत्तर की समस्याएँ"],
  "correctness.duplicate_turn_prevented": ["Duplicate turns prevented", "दोहराए गए प्रश्न रोके गए"],
  "correctness.duplicate_final_prevented": ["Duplicate transcripts prevented", "दोहराए गए लिप्यंतरण रोके गए"],
  "correctness.stale_event_prevented": ["Late events discarded", "देर से आए संकेत हटाए गए"],
  "correctness.stale_audio_prevented": ["Old audio discarded", "पुरानी आवाज़ हटाई गई"],
  "correctness.stale_segment_prevented": ["Old answer segments discarded", "पुराने उत्तर के हिस्से हटाए गए"],
  "correctness.segment_order_rejected": ["Out-of-order segments rejected", "गलत क्रम वाले हिस्से रोके गए"],
};
export function VoiceTracking({ read, record, download, hindi }: { read: () => Report; record: (scenario: string, result: string) => void; download: () => void; hindi: boolean }) {
  const [report, setReport] = useState<Report>();
  const [scenario, setScenario] = useState<string>(scenarios[0]);
  const [result, setResult] = useState("unreviewed");
  const [saved, setSaved] = useState(false);
  const samples = report?.observations.filter(r => r.name === "first_audible_response_estimate_ms" && r.value !== undefined).sort((a,b) => b.value! - a.value!).slice(0, 5) || [];
  function label(name: string) {
    if (name.startsWith("review.")) {
      const [, scenario, outcome] = name.split("."); const index = scenarios.indexOf(scenario as typeof scenarios[number]);
      const result = outcome === "pass" ? (hindi ? "सही" : "Correct") : outcome === "fail" ? (hindi ? "समस्या" : "Issue") : (hindi ? "अनिश्चित" : "Uncertain");
      return `${labels[hindi ? "hi" : "en"][index] || scenario}: ${result}`;
    }
    return metricLabels[name]?.[hindi ? 1 : 0] || (hindi ? "अन्य घटना" : "Other event");
  }
  return <details className="voice-tracking" onToggle={event => { if (event.currentTarget.open) setReport(read()); }}>
    <summary>{hindi ? "वॉइस माप और समीक्षा" : "Voice measurements and review"}</summary>
    <p>{hindi ? "समय ब्राउज़र के अनुमान हैं। कोई गति लक्ष्य लागू नहीं है। डेटा इस टैब में रहता है; सहेजने के लिए डाउनलोड करें।" : "Timing uses browser playback estimates. No latency targets are applied. Data stays in this tab; export it to keep a record."}</p>
    <div className="live-controls"><button type="button" onClick={() => setReport(read())}>{hindi ? "ताज़ा करें" : "Refresh measurements"}</button><button type="button" onClick={download}>{hindi ? "माप डाउनलोड करें" : "Export voice measurements"}</button></div>
    {report && Object.entries(report.summary).map(([mode, metrics]) => <div key={mode}>
      <strong>{mode === "classic" ? (hindi ? "रिकॉर्डिंग" : "Recording") : (hindi ? "लाइव" : "Live")}</strong>
      <div className="measurement-table"><table><thead><tr><th>{hindi ? "माप" : "Measurement"}</th><th>{hindi ? "संख्या" : "Count"}</th><th>{hindi ? "मध्य समय" : "p50 (ms)"}</th><th>{hindi ? "95वाँ प्रतिशतक" : "p95 (ms)"}</th><th>{hindi ? "अधिकतम" : "Max (ms)"}</th></tr></thead><tbody>
        {Object.entries(metrics).filter(([name]) => metricLabels[name] || name.startsWith("review.")).map(([name, value]) => <tr key={name}><td>{label(name)}</td><td>{value.count}</td><td>{value.p50?.toFixed(0) ?? "—"}</td><td>{value.p95?.toFixed(0) ?? "—"}</td><td>{value.max?.toFixed(0) ?? "—"}</td></tr>)}
      </tbody></table></div>
    </div>)}
    <p>{hindi ? "सबसे धीमे देखे गए उत्तर (मिलीसेकंड)" : "Slowest observed responses (milliseconds)"}: {samples.length ? samples.map(r => `${r.mode === "classic" ? (hindi ? "रिकॉर्डिंग" : "Recording") : (hindi ? "लाइव" : "Live")}: ${r.value!.toFixed(0)}`).join(" · ") : "—"}</p>
    <p>{hindi ? "आखिरी उत्तर की समीक्षा" : "Review the latest response"}</p>
    <div className="live-controls">
      <select aria-label={hindi ? "समीक्षा का विषय" : "Review scenario"} value={scenario} onChange={e => { setScenario(e.target.value); setSaved(false); }}>{scenarios.map((s,i) => <option value={s} key={s}>{labels[hindi ? "hi" : "en"][i]}</option>)}</select>
      <select aria-label={hindi ? "समीक्षा परिणाम" : "Review outcome"} value={result} onChange={e => { setResult(e.target.value); setSaved(false); }}><option value="unreviewed">{hindi ? "चुनें" : "Select outcome"}</option><option value="pass">{hindi ? "सही" : "Correct"}</option><option value="fail">{hindi ? "समस्या देखी" : "Issue observed"}</option><option value="uncertain">{hindi ? "अनिश्चित" : "Uncertain"}</option></select>
      <button type="button" disabled={result === "unreviewed"} onClick={() => { record(scenario, result); setReport(read()); setSaved(true); }}>{hindi ? "समीक्षा सहेजें" : "Record review"}</button>
      {saved && <span role="status">{hindi ? "समीक्षा दर्ज हुई" : "Review recorded"}</span>}
    </div>
  </details>;
}
