export type AudioEvent = { type: string; responseId?: string; requestId?: string; segment?: number; time?: number; captureAt?: number; hadAudio?: boolean; buffer?: ArrayBuffer };
export class BrowserAudio {
  private context?: AudioContext;
  private media?: MediaStream;
  private node?: AudioWorkletNode;
  private source?: MediaStreamAudioSourceNode;
  private closed = false;
  constructor(private event: (event: AudioEvent, estimatedOutputAt: number) => void) {}
  async open() {
    this.context = new AudioContext({ latencyHint: "interactive" });
    // Resume in the initial button gesture, before awaiting microphone permission.
    await this.context.resume();
    await this.context.audioWorklet.addModule("/voice-worklet.js");
    if (this.closed) return;
    const media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (this.closed) { media.getTracks().forEach(t => t.stop()); return; }
    this.media = media;
    this.node = new AudioWorkletNode(this.context, "voice-duplex", { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    this.node.port.onmessage = ({ data }: MessageEvent<AudioEvent>) => {
      if (this.closed || !this.context) return;
      const timestamp = this.context.getOutputTimestamp?.();
      const estimate = timestamp?.contextTime && timestamp.performanceTime
        ? timestamp.performanceTime + ((data.time ?? this.context.currentTime) - timestamp.contextTime) * 1000
        : performance.now() + ((data.time ?? this.context.currentTime) - this.context.currentTime + this.context.baseLatency + (this.context.outputLatency || 0)) * 1000;
      this.event({ ...data, captureAt: data.time === undefined ? undefined : performance.now() + (data.time - this.context.currentTime) * 1000 }, estimate);
    };
    this.source = this.context.createMediaStreamSource(media);
    this.source.connect(this.node); this.node.connect(this.context.destination);
  }
  capture(enabled: boolean) { this.node?.port.postMessage({ type: "capture", enabled }); }
  reset(responseId?: string, requestId?: string) { this.node?.port.postMessage({ type: "reset", responseId, requestId }); }
  audio(responseId: string, segment: number, encoded: string) {
    const binary = atob(encoded);
    if (binary.length % 2) throw new Error("Invalid PCM frame");
    const samples = new Float32Array(binary.length / 2);
    for (let i = 0; i < samples.length; i++) {
      let value = binary.charCodeAt(i * 2) | binary.charCodeAt(i * 2 + 1) << 8;
      if (value > 32767) value -= 65536;
      samples[i] = value / 32768;
    }
    this.node?.port.postMessage({ type: "audio", responseId, segment, samples }, [samples.buffer]);
  }
  segmentEnd(responseId: string, segment: number) { this.node?.port.postMessage({ type: "segment.end", responseId, segment }); }
  end(responseId: string) { this.node?.port.postMessage({ type: "response.end", responseId }); }
  close() { this.closed = true; this.media?.getTracks().forEach(t => t.stop()); this.source?.disconnect(); this.node?.disconnect(); void this.context?.close(); }
}
