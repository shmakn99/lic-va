/* Runs on the audio rendering thread. No network, React or provider credentials. */
class VoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capture = false; this.accum = 0; this.weight = 0;
    this.frame = new Int16Array(640); this.frameAt = 0;
    this.queue = []; this.head = 0; this.position = 0; this.buffered = 0;
    this.responseId = null; this.started = false; this.releasing = false;
    this.speech = false; this.loud = 0; this.quiet = 0; this.noise = .003;
    this.port.onmessage = ({ data }) => {
      if (data.type === "capture") {
        this.capture = data.enabled;
        if (!data.enabled) {
          // A reconnect must not carry partial microphone frames or VAD state.
          this.accum = 0; this.weight = 0; this.frameAt = 0;
          this.speech = false; this.loud = 0; this.quiet = 0;
        }
      }
      else if (data.type === "reset") {
        const hadAudio = this.started;
        this.queue = []; this.head = 0; this.position = 0; this.buffered = 0;
        this.started = false; this.releasing = false; this.responseId = data.responseId || null;
        this.port.postMessage({ type: "cleared", requestId: data.requestId, hadAudio, time: currentTime });
      } else if (data.responseId === this.responseId) {
        if (data.type === "audio") {
          if (this.buffered + data.samples.length > 24000 * 60) { this.port.postMessage({ type: "overflow" }); return; }
          this.queue.push({ samples: data.samples, segment: data.segment }); this.buffered += data.samples.length;
        } else if (data.type === "segment.end") this.queue.push({ marker: data.segment });
        else if (data.type === "response.end") { this.queue.push({ end: true }); this.releasing = true; }
      }
    };
  }
  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    if (this.capture && input) {
      let energy = 0;
      for (const value of input) {
        energy += value * value;
        // Area averaging preserves time across 44.1/48 kHz input blocks.
        let remaining = 16000 / sampleRate;
        while (remaining > 0) {
          const part = Math.min(1 - this.weight, remaining);
          this.accum += value * part; this.weight += part; remaining -= part;
          if (this.weight >= .999999) {
            this.frame[this.frameAt++] = Math.round(Math.max(-1, Math.min(1, this.accum)) * 32767);
            this.accum = 0; this.weight = 0;
            if (this.frameAt === this.frame.length) {
              this.port.postMessage({ type: "input", buffer: this.frame.buffer }, [this.frame.buffer]);
              this.frame = new Int16Array(640); this.frameAt = 0;
            }
          }
        }
      }
      const rms = Math.sqrt(energy / input.length);
      const duration = input.length / sampleRate;
      const voiced = rms > Math.max(.012, this.noise * 3);
      if (!this.speech && !voiced) this.noise = .99 * this.noise + .01 * rms;
      if (voiced) { this.loud += duration; this.quiet = 0; }
      else { this.quiet += duration; this.loud = 0; }
      if (!this.speech && this.loud >= .16) { this.speech = true; this.port.postMessage({ type: "speech.start", time: currentTime - this.loud }); }
      if (this.speech && this.quiet >= .2) { this.speech = false; this.port.postMessage({ type: "speech.end", time: currentTime - this.quiet }); }
    }
    const output = outputs[0]?.[0];
    if (!output) return true;
    if (!this.started && this.buffered < 1440 && !this.releasing) return true;
    let underrun = false;
    for (let i = 0; i < output.length; i++) {
      let chunk = this.queue[this.head];
      while (chunk && !chunk.samples) {
        if (chunk.end) { this.port.postMessage({ type: "ended", responseId: this.responseId, time: currentTime + i / sampleRate }); this.started = false; this.releasing = false; }
        else this.port.postMessage({ type: "played", responseId: this.responseId, segment: chunk.marker, time: currentTime + i / sampleRate });
        this.head++; chunk = this.queue[this.head];
      }
      if (!chunk) { if (this.started) underrun = true; break; }
      const at = Math.floor(this.position);
      const fraction = this.position - at;
      const value = chunk.samples[at] * (1 - fraction) + chunk.samples[Math.min(at + 1, chunk.samples.length - 1)] * fraction;
      output[i] = value;
      if (!this.started && Math.abs(value) > .0001) { this.started = true; this.port.postMessage({ type: "first", responseId: this.responseId, time: currentTime + i / sampleRate }); }
      const step = 24000 / sampleRate;
      this.position += step; this.buffered = Math.max(0, this.buffered - step);
      if (this.position >= chunk.samples.length) { this.position -= chunk.samples.length; this.head++; }
    }
    if (this.head > 32) { this.queue = this.queue.slice(this.head); this.head = 0; }
    if (underrun && !this.underrun) this.port.postMessage({ type: "underrun", responseId: this.responseId });
    this.underrun = underrun;
    return true;
  }
}
registerProcessor("voice-duplex", VoiceProcessor);
