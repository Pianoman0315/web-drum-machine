import * as Tone from "tone";
import { SynthEnvelope, SynthLfo } from "../types";

const midiToFrequency = (midi: number) => Tone.Frequency(midi, "midi").toFrequency();

export class SynthAudioEngine {
  private synth = new Tone.MonoSynth({
    oscillator: {
      type: "sawtooth",
    },
    envelope: {
      attack: 0.08,
      decay: 0.2,
      sustain: 0.6,
      release: 0.3,
    },
    filter: {
      type: "lowpass",
      frequency: 1200,
      rolloff: -24,
      Q: 1,
    },
  });

  private reverb = new Tone.Reverb({ decay: 1.8, wet: 0.18 });
  private mainPanner = new Tone.Panner(0);
  private padHighpassFilter = new Tone.Filter({
    type: "highpass",
    frequency: 20,
    rolloff: -12,
    Q: 0.8,
  });
  private padDrive = new Tone.Distortion({
    distortion: 0,
    wet: 0,
  });
  private output = new Tone.Volume(0);
  private previewOscillator = new Tone.Oscillator({
    type: "sawtooth",
    frequency: 440,
  });
  private previewPanner = new Tone.Panner(0);
  private previewAmp = new Tone.Gain(0);
  private baseFilterFrequency = 1200;
  private heldNoteActive = false;
  private padOverrideActive = false;
  private lastHeldFrequency: number | null = null;
  private currentLfo: SynthLfo | null = null;
  private mainLfoStartedAt = 0;
  private mainLfoFrame: number | null = null;
  private scheduledReleaseTimer: ReturnType<typeof setTimeout> | null = null;
  private previewFrequency = 440;
  private previewActive = false;
  private previewBaseGain = 0.16;
  private previewLfo: SynthLfo | null = null;
  private previewStartedAt = 0;
  private previewFrame: number | null = null;
  private previewStopTimer: ReturnType<typeof setTimeout> | null = null;
  private previewSessionId = 0;

  private sanitizeTiny(value: number) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.abs(value) < 0.0001 ? 0 : value;
  }

  private setParamValue(param: { value: unknown }, value: number, minimum = 0) {
    param.value = Math.max(minimum, this.sanitizeTiny(value));
  }

  private getWaveValue(lfo: SynthLfo, elapsedSeconds: number) {
    const phase = (elapsedSeconds * lfo.rate) % 1;

    if (lfo.waveform === "sine") {
      return Math.sin(phase * Math.PI * 2);
    }

    if (lfo.waveform === "triangle") {
      return 1 - 4 * Math.abs(phase - 0.5);
    }

    return phase < 0.5 ? 1 : -1;
  }

  private stopPreviewLoop() {
    if (this.previewFrame !== null) {
      cancelAnimationFrame(this.previewFrame);
      this.previewFrame = null;
    }
  }

  private stopMainLfoLoop() {
    if (this.mainLfoFrame !== null) {
      cancelAnimationFrame(this.mainLfoFrame);
      this.mainLfoFrame = null;
    }
  }

  private resetMainLfoModulation() {
    this.synth.volume.value = 0;
    this.mainPanner.pan.value = 0;

    if (this.lastHeldFrequency !== null) {
      this.setParamValue(this.synth.frequency, this.lastHeldFrequency, 20);
    }
  }

  private updateMainLfoModulation = () => {
    if (!this.heldNoteActive || !this.currentLfo?.enabled || this.lastHeldFrequency === null) {
      this.mainLfoFrame = null;
      return;
    }

    try {
      const elapsedSeconds = (performance.now() - this.mainLfoStartedAt) / 1000;
      const waveValue = this.getWaveValue(this.currentLfo, elapsedSeconds);

      if (this.currentLfo.destination === "pitch") {
        const semitoneRange = 12 * this.currentLfo.depth;
        const modulatedFrequency = this.lastHeldFrequency * 2 ** ((waveValue * semitoneRange) / 12);
        this.setParamValue(this.synth.frequency, modulatedFrequency, 20);
      } else {
        this.setParamValue(this.synth.frequency, this.lastHeldFrequency, 20);
      }

      if (this.currentLfo.destination === "amp") {
        const gain = 1 - this.currentLfo.depth * 0.85 * ((waveValue + 1) / 2);
        this.synth.volume.value = Tone.gainToDb(Math.max(0.001, this.sanitizeTiny(gain)));
      } else {
        this.synth.volume.value = 0;
      }

      if (this.currentLfo.destination === "pan") {
        this.mainPanner.pan.value = Math.max(-1, Math.min(1, this.sanitizeTiny(waveValue * this.currentLfo.depth)));
      } else {
        this.mainPanner.pan.value = 0;
      }

      this.mainLfoFrame = requestAnimationFrame(this.updateMainLfoModulation);
    } catch {
      this.stopMainLfoLoop();
      this.resetMainLfoModulation();
    }
  };

  private startMainLfoLoop() {
    this.stopMainLfoLoop();
    this.resetMainLfoModulation();

    if (!this.currentLfo?.enabled) {
      return;
    }

    this.mainLfoStartedAt = performance.now();
    this.mainLfoFrame = requestAnimationFrame(this.updateMainLfoModulation);
  }

  private clearPreviewStopTimer() {
    if (this.previewStopTimer !== null) {
      clearTimeout(this.previewStopTimer);
      this.previewStopTimer = null;
    }
  }

  private clearScheduledReleaseTimer() {
    if (this.scheduledReleaseTimer !== null) {
      clearTimeout(this.scheduledReleaseTimer);
      this.scheduledReleaseTimer = null;
    }
  }

  private updatePreviewModulation = (sessionId: number) => {
    if (!this.previewActive || !this.previewLfo || sessionId !== this.previewSessionId) {
      this.previewFrame = null;
      return;
    }

    try {
      const elapsedSeconds = (performance.now() - this.previewStartedAt) / 1000;
      const waveValue = this.getWaveValue(this.previewLfo, elapsedSeconds);

      if (this.previewLfo.destination === "pitch") {
        const semitoneRange = 12 * this.previewLfo.depth;
        const modulatedFrequency = this.previewFrequency * 2 ** ((waveValue * semitoneRange) / 12);
        this.previewOscillator.frequency.value = Math.max(20, this.sanitizeTiny(modulatedFrequency));
      } else {
        this.previewOscillator.frequency.value = Math.max(20, this.sanitizeTiny(this.previewFrequency));
      }

      if (this.previewLfo.destination === "pan") {
        this.previewPanner.pan.value = Math.max(-1, Math.min(1, this.sanitizeTiny(waveValue * this.previewLfo.depth)));
      } else {
        this.previewPanner.pan.value = 0;
      }

      const previewGain = this.previewLfo.destination === "amp"
        ? this.previewBaseGain * (1 - this.previewLfo.depth * 0.85 * ((waveValue + 1) / 2))
        : this.previewBaseGain;

      if (sessionId !== this.previewSessionId || !this.previewActive) {
        this.previewAmp.gain.value = 0;
        this.previewFrame = null;
        return;
      }

      this.previewAmp.gain.value = Math.max(0, this.sanitizeTiny(previewGain));
      this.previewFrame = requestAnimationFrame(() => this.updatePreviewModulation(sessionId));
    } catch {
      this.stopLfoPreview();
    }
  };

  constructor() {
    this.synth.connect(this.mainPanner);
    this.mainPanner.connect(this.padHighpassFilter);
    this.padHighpassFilter.connect(this.padDrive);
    this.padDrive.connect(this.reverb);
    this.reverb.connect(this.output);
    this.output.toDestination();

    this.previewOscillator.connect(this.previewPanner);
    this.previewPanner.connect(this.previewAmp);
    this.previewAmp.connect(this.output);
  }

  async initialize() {
    await Tone.start();
    if (this.previewOscillator.state !== "started") {
      this.previewOscillator.start();
    }
  }

  setEnvelope(envelope: SynthEnvelope) {
    this.synth.set({
      envelope: {
        attack: envelope.attack,
        decay: envelope.decay,
        sustain: envelope.sustain,
        release: envelope.release,
      },
    });
  }

  setLfo(lfo: SynthLfo) {
    this.currentLfo = lfo;
    if (this.heldNoteActive) {
      this.startMainLfoLoop();
    }
  }

  startLfoPreview(lfo: SynthLfo, frequency = 440) {
    try {
      if (this.previewActive) {
        this.stopLfoPreview();
      }

      this.clearPreviewStopTimer();
      this.previewFrequency = frequency;
      this.previewActive = true;
      this.previewSessionId += 1;
      this.previewLfo = lfo;
      this.previewStartedAt = performance.now();
      this.previewOscillator.type = lfo.waveform;
      this.previewOscillator.frequency.value = Math.max(20, this.sanitizeTiny(frequency));
      this.previewPanner.pan.value = 0;
      this.previewAmp.gain.value = Math.max(0, this.sanitizeTiny(this.previewBaseGain));
      this.stopPreviewLoop();
      const sessionId = this.previewSessionId;
      this.previewFrame = requestAnimationFrame(() => this.updatePreviewModulation(sessionId));
    } catch {
      this.previewActive = false;
    }
  }

  updateLfoPreview(lfo: SynthLfo) {
    if (!this.previewActive) {
      return;
    }

    try {
      this.previewLfo = lfo;
      this.previewOscillator.type = lfo.waveform;
      if (this.previewFrame === null) {
        const sessionId = this.previewSessionId;
        this.previewFrame = requestAnimationFrame(() => this.updatePreviewModulation(sessionId));
      }
    } catch {
      this.stopLfoPreview();
    }
  }

  stopLfoPreview() {
    try {
      this.clearPreviewStopTimer();
      this.previewSessionId += 1;
      this.previewActive = false;
      this.previewLfo = null;
      this.stopPreviewLoop();
      this.previewAmp.gain.value = 0;
      this.previewOscillator.frequency.value = Math.max(20, this.sanitizeTiny(this.previewFrequency));
      this.previewPanner.pan.value = 0;
    } catch {
      this.previewSessionId += 1;
      this.previewActive = false;
      this.previewLfo = null;
      this.stopPreviewLoop();
      this.previewAmp.gain.value = 0;
    }
  }

  setFilterTone(value: number) {
    const clamped = Math.max(-1, Math.min(1, value));
    const normalized = Math.abs(clamped) <= 0.05 ? 0 : clamped;
    if (normalized < 0) {
      this.baseFilterFrequency = 2200 - Math.abs(normalized) * 1800;
    } else if (normalized > 0) {
      this.baseFilterFrequency = 600 + normalized * 3400;
    } else {
      this.baseFilterFrequency = 1800;
    }

    this.setParamValue(this.synth.filter.frequency, this.baseFilterFrequency, 20);
  }

  setBrightness(value: number) {
    const normalized = Math.max(0, Math.min(1, value));
    const cutoff = 900 + normalized ** 1.25 * 7600;
    const resonance = 0.65 + normalized ** 1.35 * 4.4;
    const highpass = normalized > 0.74 ? 20 + ((normalized - 0.74) / 0.26) ** 1.8 * 420 : 20;
    const driveAmount = Math.max(0, (normalized - 0.58) / 0.42) ** 1.5;

    this.setParamValue(this.synth.filter.frequency, cutoff, 20);
    this.setParamValue(this.synth.filter.Q, resonance, 0.1);
    this.setParamValue(this.padHighpassFilter.frequency, highpass, 20);
    this.padDrive.distortion = Math.max(0, this.sanitizeTiny(driveAmount * 0.14));
    this.setParamValue(this.padDrive.wet, driveAmount * 0.2, 0);
  }

  resetPadTone() {
    this.setParamValue(this.synth.filter.Q, 1, 0.1);
    this.setParamValue(this.padHighpassFilter.frequency, 20, 20);
    this.padDrive.distortion = 0;
    this.setParamValue(this.padDrive.wet, 0, 0);
  }

  setReverbMix(value: number) {
    this.setParamValue(this.reverb.wet, value, 0);
  }

  setMasterVolume(value: number) {
    const safeValue = Math.max(0.001, value);
    this.output.volume.value = Tone.gainToDb(safeValue);
  }

  setMuted(isMuted: boolean) {
    this.output.mute = isMuted;
  }

  triggerStep(midi: number, time: number, length = 1) {
    if (this.padOverrideActive) {
      return;
    }

    const frequency = midiToFrequency(midi);
    const durationSeconds = Tone.Time("16n").toSeconds() * length;

    if (!this.currentLfo?.enabled) {
      this.synth.triggerAttackRelease(frequency, durationSeconds, time);
      return;
    }

    Tone.Draw.schedule(() => {
      this.startHeldNote(frequency, 0.5);
      this.clearScheduledReleaseTimer();
      this.scheduledReleaseTimer = setTimeout(() => {
        this.stopHeldNote();
      }, durationSeconds * 1000);
    }, time);
  }

  preview(midi: number) {
    this.synth.triggerAttackRelease(midiToFrequency(midi), "8n", Tone.now());
  }

  previewWithLfo(midi: number, lfo: SynthLfo) {
    if (!lfo.enabled) {
      this.preview(midi);
      return;
    }

    this.setLfo(lfo);
    this.startHeldNote(midiToFrequency(midi), 0.5);
    this.clearPreviewStopTimer();
    this.previewStopTimer = setTimeout(() => {
      this.stopHeldNote();
      this.previewStopTimer = null;
    }, Tone.Time("8n").toSeconds() * 1000);
  }

  startNotePreview(midi: number, lfo: SynthLfo) {
    this.clearPreviewStopTimer();
    this.setLfo(lfo);
    this.startHeldNote(midiToFrequency(midi), 0.5);
  }

  stopNotePreview() {
    this.clearPreviewStopTimer();
    this.stopHeldNote();
  }

  startPad(frequency: number, brightness: number) {
    this.padOverrideActive = true;
    this.clearPreviewStopTimer();
    this.startHeldNote(frequency, brightness);
  }

  private startHeldNote(frequency: number, brightness: number) {
    this.clearScheduledReleaseTimer();
    this.stopLfoPreview();
    this.stopMainLfoLoop();
    this.synth.triggerRelease();
    this.synth.volume.value = 0;
    this.mainPanner.pan.value = 0;
    this.heldNoteActive = true;
    this.lastHeldFrequency = frequency;
    this.setBrightness(brightness);
    this.synth.triggerAttack(frequency);
    this.startMainLfoLoop();
  }

  movePad(frequency: number, brightness: number) {
    this.setBrightness(brightness);
    if (!this.heldNoteActive) {
      this.startPad(frequency, brightness);
      return;
    }

    if (this.lastHeldFrequency === null) {
      this.startPad(frequency, brightness);
      return;
    }

    this.lastHeldFrequency = frequency;
    if (this.currentLfo?.enabled && this.currentLfo.destination === "pitch") {
      return;
    }

    this.setParamValue(this.synth.frequency, frequency, 20);
  }

  stopPad() {
    this.padOverrideActive = false;
    this.stopHeldNote();
  }

  private stopHeldNote() {
    if (!this.heldNoteActive) {
      return;
    }

    this.clearScheduledReleaseTimer();
    this.heldNoteActive = false;
    this.stopMainLfoLoop();
    this.resetMainLfoModulation();
    this.synth.triggerRelease();
    this.setParamValue(this.synth.filter.frequency, this.baseFilterFrequency, 20);
    this.resetPadTone();
    this.lastHeldFrequency = null;
  }

  dispose() {
    this.stopPad();
    this.stopLfoPreview();
    this.clearPreviewStopTimer();
    this.clearScheduledReleaseTimer();
    this.reverb.dispose();
    this.padDrive.dispose();
    this.padHighpassFilter.dispose();
    this.mainPanner.dispose();
    this.previewAmp.dispose();
    this.previewPanner.dispose();
    this.previewOscillator.dispose();
    this.output.dispose();
    this.synth.dispose();
  }
}
