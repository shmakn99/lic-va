import { plans, type Language, type PlanId, type Source } from "./plans";

const en = {
  navigation: "Main navigation",
  projectStory: "Project story",
  opensNewTab: " (opens in a new tab)",
  brand: "Plan Companion",
  subtitle: "LIC plans, explained simply",
  demo: "Independent voice demo",
  eyebrow: "A LITTLE CLARITY GOES A LONG WAY",
  heading: "Your questions. A clearer plan.",
  description: "Explore the details with a conversation, in English or Hindi.",
  grounded: "Grounded in official LIC documents",
  choosePlan: "01 / CHOOSE YOUR PLAN",
  selectPlan: "Select plan",
  plan: "Plan",
  planCard: "PLAN",
  uin: "UIN",
  yourLanguage: "02 / YOUR LANGUAGE",
  answerLanguage: "Answer language",
  answerStyleHeading: "03 / ANSWER STYLE",
  answerStyle: "Answer style",
  answerStyles: {
    "very-simple": "Very simple language",
    normal: "Normal language",
    technical: "Technical language",
  },
  answerStyleHint: "Applies to new answers. Policy details stay the same.",
  english: "English",
  sourceHeading: "A source for every answer",
  sourceHint:
    "Open Sources beneath an answer to see the official document and page.",
  independent: "An independent demonstration.",
  unofficial: "Not an official LIC service.",
  conversation: "Plan conversation",
  conversationLog: "Conversation",
  reset: "Reset",
  unconfigured:
    "Sarvam is not configured. Add SARVAM_API_KEY to .env.local and restart the app.",
  welcomeEyebrow: "LET’S MAKE IT SIMPLE",
  welcome: "What would you like to know?",
  welcomeHint:
    "Start with the benefits and trade-offs, then explore your questions. Add a priority to make the pitch more relevant.",
  explain: "Explain this plan",
  pitch: "Pitch this plan",
  priorityLabel: "What matters to you? (optional)",
  priorityHint: "For example: family protection, future savings, or regular income.",
  prioritySaved: "Used for new answers until you reset or change the product.",
  addDocument: "Use your own product document",
  editDocument: "Review / replace document",
  documentTitle: "Product / document name",
  documentText: "Product document text",
  documentHint: "Paste text for one product, including its conditions and exclusions. Keep headings, tables and page labels where possible. Applying it starts a new conversation using only this text. Text is sent to the AI provider when you ask a question.",
  documentLimits: "characters · at least 80; stored in this tab until refresh",
  documentInvalid: "Enter a name of 3–160 characters and document text of 80–24,000 characters. Shorten oversized text deliberately; keep relevant conditions.",
  useDocument: "Use this document",
  customDocument: "Your document",
  customGrounded: "Based on your supplied document",
  customSourceHint: "Open Sources beneath an answer to read the cited text. Pasted text has not been independently verified.",
  customNote: "Explore the benefits, conditions, coverage period and claims information in your document.",
  coverageHint: "Prepared extracts cover benefits and selected policy conditions. Claim-submission procedures are not included.",
  correctTranscript: "Correct question",
  salesSuggestions: ["What should I watch out for?", "How do claims work?", "How long does coverage last?"],
  you: "YOU",
  youVoice: "YOU · VOICE",
  assistant: "PLAN COMPANION",
  sources: "Sources",
  needsClarification: "Needs clarification",
  notCovered: "Not covered in available documents",
  copyAnswer: "Copy answer",
  copied: "Copied",
  copyFailed: "Could not copy. Select the answer text to copy it.",
  playing: "Playing",
  replay: "Play / Replay",
  retryAudio: "Retry audio",
  listen: "Listen",
  retry: "Retry question",
  suggestions: "Suggested questions",
  question: "Your question",
  placeholder: "Type a question, or tap the microphone…",
  stopRecording: "Stop recording and submit",
  startRecording: "Start recording",
  stopSubmit: "Stop and submit",
  recordQuestion: "Record a question",
  send: "Send question",
  stopAudio: "Stop audio",
  spokenAnswers: "Spoken answers",
  voiceOn: "Voice on",
  voiceOff: "Voice off",
  seconds: "s",
  micHint: "tap mic to send",
  footer: "Understand the details. Keep the sources close.",
  languages: "English & हिन्दी",
  powered: "Powered by Sarvam",
  suggestionsList: {
    "new-jeevan-anand": [
      "How do I pay premiums?",
      "What happens on maturity?",
      "Does life cover continue after maturity?",
    ],
    "jeevan-utsav-single-premium": [
      "When does income start?",
      "How does Flexi Income work?",
      "What are guaranteed additions?",
    ],
    "digi-term": [
      "What are the life cover options?",
      "How can I pay premiums?",
      "Is there a maturity payout?",
    ],
  },
  statuses: {
    Ready: "Ready",
    Listening: "Listening",
    Transcribing: "Transcribing",
    Thinking: "Thinking",
    "Preparing audio": "Preparing audio",
    Speaking: "Speaking",
  },
};
const hi: typeof en = {
  navigation: "मुख्य नेविगेशन",
  projectStory: "प्रोजेक्ट की कहानी",
  opensNewTab: " (नए टैब में खुलेगा)",
  brand: "योजना साथी",
  subtitle: "एलआईसी की योजनाएँ, आसान शब्दों में",
  demo: "आवाज़ पर आधारित स्वतंत्र डेमो",
  eyebrow: "थोड़ी स्पष्टता, बेहतर समझ",
  heading: "आपके सवाल। योजना की बेहतर समझ।",
  description: "बातचीत के ज़रिए जानकारी पाएँ, अंग्रेज़ी या हिन्दी में।",
  grounded: "एलआईसी के आधिकारिक दस्तावेज़ों पर आधारित",
  choosePlan: "01 / अपनी योजना चुनें",
  selectPlan: "योजना चुनें",
  plan: "योजना",
  planCard: "योजना",
  uin: "विशिष्ट पहचान संख्या",
  yourLanguage: "02 / आपकी भाषा",
  answerLanguage: "जवाब की भाषा",
  answerStyleHeading: "03 / जवाब का अंदाज़",
  answerStyle: "जवाब का अंदाज़",
  answerStyles: {
    "very-simple": "बहुत आसान भाषा",
    normal: "सामान्य भाषा",
    technical: "तकनीकी भाषा",
  },
  answerStyleHint: "नए जवाबों पर लागू होगा। पॉलिसी की जानकारी वही रहेगी।",
  english: "अंग्रेज़ी",
  sourceHeading: "हर जवाब के साथ स्रोत",
  sourceHint:
    "आधिकारिक दस्तावेज़ और पृष्ठ देखने के लिए जवाब के नीचे ‘स्रोत’ खोलें।",
  independent: "एक स्वतंत्र प्रदर्शन।",
  unofficial: "यह एलआईसी की आधिकारिक सेवा नहीं है।",
  conversation: "योजना पर बातचीत",
  conversationLog: "बातचीत",
  reset: "रीसेट",
  unconfigured:
    "सर्वम की सेवा शुरू नहीं हुई है। .env.local में SARVAM_API_KEY जोड़कर ऐप दोबारा शुरू करें।",
  welcomeEyebrow: "आइए, इसे आसान बनाएँ",
  welcome: "आप क्या जानना चाहेंगे?",
  welcomeHint:
    "पहले लाभ और सीमाएँ समझें, फिर अपने सवाल पूछें। अपनी प्राथमिकता बताएँ ताकि योजना की खूबियाँ आपके संदर्भ में समझा सकें।",
  explain: "यह योजना समझाइए",
  pitch: "इस योजना की खूबियाँ बताइए",
  priorityLabel: "आपके लिए क्या ज़रूरी है? (वैकल्पिक)",
  priorityHint: "जैसे: परिवार की सुरक्षा, भविष्य की बचत या नियमित आय।",
  prioritySaved: "रीसेट करने या उत्पाद बदलने तक नए जवाबों में इस्तेमाल होगा।",
  addDocument: "अपना उत्पाद दस्तावेज़ इस्तेमाल करें",
  editDocument: "दस्तावेज़ देखें / बदलें",
  documentTitle: "उत्पाद / दस्तावेज़ का नाम",
  documentText: "उत्पाद दस्तावेज़ का पाठ",
  documentHint: "एक उत्पाद का पाठ उसकी शर्तों और अपवर्जनों सहित चिपकाएँ। जहाँ संभव हो, शीर्षक, तालिकाएँ और पृष्ठ संख्या बनाए रखें। इसे लागू करने पर केवल इस पाठ से नई बातचीत शुरू होगी। सवाल पूछने पर यह पाठ एआई सेवा को भेजा जाता है।",
  documentLimits: "अक्षर · कम से कम 80; रीफ़्रेश तक इसी टैब में रहेगा",
  documentInvalid: "नाम में 3–160 और दस्तावेज़ में 80–24,000 अक्षर रखें। लंबे पाठ को सावधानी से छोटा करें; ज़रूरी शर्तें बनाए रखें।",
  useDocument: "यह दस्तावेज़ इस्तेमाल करें",
  customDocument: "आपका दस्तावेज़",
  customGrounded: "आपके दिए दस्तावेज़ पर आधारित",
  customSourceHint: "उद्धृत पाठ पढ़ने के लिए जवाब के नीचे ‘स्रोत’ खोलें। चिपकाए गए पाठ की स्वतंत्र पुष्टि नहीं हुई है।",
  customNote: "अपने दस्तावेज़ में दिए लाभ, शर्तें, बीमा अवधि और दावे की जानकारी समझें।",
  coverageHint: "तैयार अंशों में लाभ और कुछ पॉलिसी शर्तें हैं। दावा जमा करने की प्रक्रिया शामिल नहीं है।",
  correctTranscript: "सवाल सुधारें",
  salesSuggestions: ["किन बातों का ध्यान रखना चाहिए?", "दावा कैसे किया जाता है?", "बीमा कितने समय तक रहता है?"],
  you: "आप",
  youVoice: "आप · आवाज़",
  assistant: "योजना साथी",
  sources: "स्रोत",
  needsClarification: "थोड़ी और जानकारी चाहिए",
  notCovered: "उपलब्ध दस्तावेज़ों में जानकारी नहीं है",
  copyAnswer: "जवाब कॉपी करें",
  copied: "कॉपी हो गया",
  copyFailed: "कॉपी नहीं हो सका। जवाब का पाठ चुनकर कॉपी करें।",
  playing: "सुनाया जा रहा है",
  replay: "सुनें / फिर सुनें",
  retryAudio: "आवाज़ फिर आज़माएँ",
  listen: "सुनें",
  retry: "सवाल फिर भेजें",
  suggestions: "सुझाए गए सवाल",
  question: "आपका सवाल",
  placeholder: "अपना सवाल लिखें या माइक दबाएँ…",
  stopRecording: "रिकॉर्डिंग रोकें और भेजें",
  startRecording: "रिकॉर्डिंग शुरू करें",
  stopSubmit: "रोकें और भेजें",
  recordQuestion: "सवाल रिकॉर्ड करें",
  send: "सवाल भेजें",
  stopAudio: "आवाज़ रोकें",
  spokenAnswers: "जवाब सुनाएँ",
  voiceOn: "आवाज़ चालू",
  voiceOff: "आवाज़ बंद",
  seconds: "सेकंड",
  micHint: "भेजने के लिए माइक दबाएँ",
  footer: "विवरण समझें। स्रोत साथ रखें।",
  languages: "अंग्रेज़ी और हिन्दी",
  powered: "सर्वम द्वारा संचालित",
  suggestionsList: {
    "new-jeevan-anand": [
      "प्रीमियम कैसे भर सकते हैं?",
      "मैच्योरिटी पर क्या मिलता है?",
      "क्या मैच्योरिटी के बाद जीवन बीमा जारी रहता है?",
    ],
    "jeevan-utsav-single-premium": [
      "आय कब शुरू होती है?",
      "फ्लेक्सी इनकम कैसे काम करती है?",
      "गारंटीकृत अतिरिक्त लाभ क्या हैं?",
    ],
    "digi-term": [
      "जीवन बीमा के क्या विकल्प हैं?",
      "प्रीमियम भुगतान के क्या तरीके हैं?",
      "क्या मैच्योरिटी पर कोई राशि मिलती है?",
    ],
  },
  statuses: {
    Ready: "तैयार",
    Listening: "सुन रहे हैं",
    Transcribing: "आवाज़ को लिख रहे हैं",
    Thinking: "जवाब तैयार कर रहे हैं",
    "Preparing audio": "आवाज़ तैयार कर रहे हैं",
    Speaking: "बोल रहे हैं",
  },
};
export const ui = (language: Language) => (language === "hi-IN" ? hi : en);

const hindiPlans: Record<
  PlanId,
  { name: string; category: string; note: string }
> = {
  "new-jeevan-anand": {
    name: "न्यू जीवन आनंद",
    category: "सुरक्षा और बचत",
    note: "पॉलिसी अवधि के लाभ और मैच्योरिटी के बाद मिलने वाले जीवन बीमा को समझें।",
  },
  "jeevan-utsav-single-premium": {
    name: "जीवन उत्सव सिंगल प्रीमियम",
    category: "आजीवन सुरक्षा और आय",
    note: "एकमुश्त प्रीमियम, आय के विकल्प और गारंटीकृत अतिरिक्त लाभों को समझें।",
  },
  "digi-term": {
    name: "डिजि टर्म",
    category: "सावधि जीवन बीमा",
    note: "जीवन बीमा, लाभ के विकल्प और प्रीमियम भुगतान के तरीकों को जानें।",
  },
};
export function planCopy(id: PlanId, language: Language) {
  return language === "hi-IN"
    ? hindiPlans[id]
    : plans.find((p) => p.id === id)!;
}
const sections: Record<string, string> = {
  "NJA-overview": "परिचय और पात्रता",
  "NJA-benefits": "मृत्यु, मैच्योरिटी और लाभ में भागीदारी",
  "NJA-premiums": "भुगतान की आवृत्ति और छूट अवधि",
  "NJA-surrender": "समर्पण मूल्य की पात्रता",
  "NJA-loans": "पॉलिसी ऋण, कटौतियाँ और पॉलिसी बंद होना",
  "NJA-freelook": "फ्री लुक अवधि में रद्द करना",
  "NJA-exclusion": "आत्महत्या संबंधी अपवर्जन और शर्तें",
  "JUSP-overview": "परिचय और मुख्य विशेषताएँ",
  "JUSP-eligibility": "पात्रता और जोखिम की शुरुआत",
  "JUSP-benefits": "मृत्यु, आय, मैच्योरिटी और गारंटीकृत अतिरिक्त लाभ",
  "JUSP-exit": "समर्पण मूल्य और पॉलिसी की समाप्ति",
  "JUSP-loans": "पॉलिसी ऋण और शर्तें",
  "JUSP-freelook": "फ्री लुक अवधि में रद्द करना",
  "JUSP-exclusion": "आत्महत्या संबंधी अपवर्जन और आयु का अपवाद",
  "DT-overview": "परिचय और प्रवेश की पात्रता",
  "DT-terms": "बीमित राशि और भुगतान की अवधि",
  "DT-benefits": "मृत्यु लाभ के विकल्प और मैच्योरिटी लाभ का अभाव",
  "DT-exit": "प्रदत्त पॉलिसी, समर्पण और ऋण",
  "DT-freelook": "फ्री लुक अवधि में रद्द करना",
  "DT-exclusion": "भुगतान के प्रकार के अनुसार आत्महत्या संबंधी अपवर्जन",
};
export function sourceCopy(source: Source, language: Language) {
  if (source.planId === "custom") return {
    title: source.documentTitle,
    section: language === "hi-IN" ? `चिपकाया हुआ पाठ · अंश ${source.id.replace("DOC-", "")}` : source.pageOrSection,
  };
  if (language !== "hi-IN")
    return { title: source.documentTitle, section: source.pageOrSection };
  const pages = source.pageOrSection.match(/^PDF pages? ([\d, ]+)/)?.[1].trim();
  return {
    title: `एलआईसी ${hindiPlans[source.planId as PlanId]?.name || "योजना"} — आधिकारिक विवरणिका`,
    section: `${pages ? `पीडीएफ पृष्ठ ${pages} · ` : ""}${sections[source.id] || "योजना का विवरण"}`,
  };
}

const messages: Record<string, string> = {
  "The answer could not be verified. Please retry your question.":
    "जवाब की पुष्टि नहीं हो सकी। कृपया सवाल फिर भेजें।",
  "Something went wrong. Please retry.":
    "कुछ गड़बड़ हुई। कृपया फिर कोशिश करें।",
  "The request failed. Please retry.":
    "अनुरोध पूरा नहीं हुआ। कृपया फिर कोशिश करें।",
  "The request timed out or was cancelled. Please retry.":
    "अनुरोध का समय समाप्त हो गया या वह रद्द हुआ। कृपया फिर कोशिश करें।",
  "Could not reach the local app. Check that it is running and retry.":
    "स्थानीय ऐप से संपर्क नहीं हुआ। ऐप चालू होने की जाँच करके फिर कोशिश करें।",
  "Playback failed. Try replaying the answer.":
    "आवाज़ नहीं चल सकी। जवाब फिर से सुनने की कोशिश करें।",
  "Audio is ready. Press Play on the answer to listen.":
    "आवाज़ तैयार है। सुनने के लिए जवाब पर ‘सुनें’ दबाएँ।",
  "No speech was detected. Try recording again or type a question.":
    "कोई आवाज़ सुनाई नहीं दी। दोबारा रिकॉर्ड करें या सवाल लिखें।",
  "Recording is unavailable in this browser. Open localhost in Chrome or Edge, or type your question.":
    "इस ब्राउज़र में रिकॉर्डिंग उपलब्ध नहीं है। स्थानीय ऐप क्रोम या एज में खोलें, या सवाल लिखें।",
  "No supported recording format was found. Please type your question.":
    "रिकॉर्डिंग का कोई समर्थित प्रारूप नहीं मिला। कृपया सवाल लिखें।",
  "Microphone recording failed. Please retry or type a question.":
    "माइक से रिकॉर्डिंग नहीं हो सकी। फिर कोशिश करें या सवाल लिखें।",
  "The recording was empty. Please try again.":
    "रिकॉर्डिंग खाली थी। कृपया फिर कोशिश करें।",
  "Microphone permission was denied. Allow microphone access in your browser, or type a question below.":
    "माइक की अनुमति नहीं मिली। ब्राउज़र में माइक की अनुमति दें या नीचे सवाल लिखें।",
  "Add SARVAM_API_KEY to .env.local and restart the local app.":
    hi.unconfigured,
  "Sarvam rejected the API key or model access. Check the server credentials.":
    "सर्वम ने एपीआई कुंजी या मॉडल की अनुमति स्वीकार नहीं की। सर्वर की सेटिंग जाँचें।",
  "Sarvam is rate-limiting requests. Wait a moment, then retry.":
    "सर्वम पर अनुरोधों की सीमा पूरी हो गई है। कुछ देर बाद फिर कोशिश करें।",
  "Sarvam could not read this recording. Refresh the page and record again, or type your question.":
    "सर्वम इस रिकॉर्डिंग को पढ़ नहीं सका। पृष्ठ रीफ़्रेश करके दोबारा रिकॉर्ड करें या सवाल लिखें।",
  "Sarvam could not process this request. Check model access or try a shorter question.":
    "सर्वम अनुरोध पूरा नहीं कर सका। मॉडल की अनुमति जाँचें या छोटा सवाल पूछें।",
  "Sarvam is unavailable right now. Please retry.":
    "सर्वम अभी उपलब्ध नहीं है। कृपया फिर कोशिश करें।",
  "This request is too large. Please shorten it.":
    "यह अनुरोध बहुत बड़ा है। कृपया इसे छोटा करें।",
  "Please check the selected plan, language and question length.":
    "चुनी हुई योजना, भाषा और सवाल की लंबाई जाँचें।",
  "The recording is empty. Please record again or type a question.":
    "रिकॉर्डिंग खाली है। दोबारा रिकॉर्ड करें या सवाल लिखें।",
  "This audio format is not supported. Please type your question.":
    "आवाज़ का यह प्रारूप समर्थित नहीं है। कृपया सवाल लिखें।",
  "Transcription failed. Please record again or type your question.":
    "आवाज़ को शब्दों में नहीं बदल सके। दोबारा रिकॉर्ड करें या सवाल लिखें।",
  "Please ask a shorter question, or type it in the text box.":
    "कृपया छोटा सवाल पूछें या नीचे लिखें।",
  "Audio was unavailable. You can read the answer or retry audio.":
    "आवाज़ उपलब्ध नहीं थी। जवाब पढ़ें या आवाज़ फिर आज़माएँ।",
};
export function messageCopy(message: string, language: Language): string {
  return language === "hi-IN"
    ? messages[message] || messages["Something went wrong. Please retry."]
    : message;
}
