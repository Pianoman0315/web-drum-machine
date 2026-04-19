import * as Tone from "tone";
import { TrackName } from "../types";

const SAMPLE_MAP: Record<TrackName, string> = {
  Accent: "/samples/house-kick.wav",
  Bass: "/samples/house-kick.wav",
  Snare: "/samples/808-snare-drum-2.wav",
  Clap: "/samples/clap-house_C_minor.wav",
  "C-Hat": "/samples/ultimate-uk-drill-hi-hat_140bpm_C.wav",
  "Tom 2": "/samples/bomb-tom-5.wav",
  "Tom 1": "/samples/bomb-tom-2.wav",
  "O-Hat": "/samples/playboi-carti-open-hihat_156bpm.wav",
  Cow: "/samples/phonk-cow-bell.wav",
};

export class DrumAudioEngine {
  private lowpassFilter = new Tone.Filter(20000, "lowpass");
  private highpassFilter = new Tone.Filter(20, "highpass");
  private reverb = new Tone.Reverb({ decay: 1.4, wet: 0.2 });
  private analyser = new Tone.Analyser("fft", 64);
  private output = new Tone.Volume(0);
  private players: Record<TrackName, Tone.Player>;
  private previewPlayers: Record<TrackName, Tone.Player>;
  private readyPromise: Promise<void> | null = null;

  constructor() {
    this.players = {
      Accent: new Tone.Player(SAMPLE_MAP.Accent),
      Bass: new Tone.Player(SAMPLE_MAP.Bass),
      Snare: new Tone.Player(SAMPLE_MAP.Snare),
      Clap: new Tone.Player(SAMPLE_MAP.Clap),
      "C-Hat": new Tone.Player(SAMPLE_MAP["C-Hat"]),
      "Tom 2": new Tone.Player(SAMPLE_MAP["Tom 2"]),
      "Tom 1": new Tone.Player(SAMPLE_MAP["Tom 1"]),
      "O-Hat": new Tone.Player(SAMPLE_MAP["O-Hat"]),
      Cow: new Tone.Player(SAMPLE_MAP.Cow),
    };
    this.previewPlayers = {
      Accent: new Tone.Player(SAMPLE_MAP.Accent),
      Bass: new Tone.Player(SAMPLE_MAP.Bass),
      Snare: new Tone.Player(SAMPLE_MAP.Snare),
      Clap: new Tone.Player(SAMPLE_MAP.Clap),
      "C-Hat": new Tone.Player(SAMPLE_MAP["C-Hat"]),
      "Tom 2": new Tone.Player(SAMPLE_MAP["Tom 2"]),
      "Tom 1": new Tone.Player(SAMPLE_MAP["Tom 1"]),
      "O-Hat": new Tone.Player(SAMPLE_MAP["O-Hat"]),
      Cow: new Tone.Player(SAMPLE_MAP.Cow),
    };

    [...Object.values(this.players), ...Object.values(this.previewPlayers)].forEach((player) => {
      player.connect(this.lowpassFilter);
    });

    this.lowpassFilter.connect(this.highpassFilter);
    this.highpassFilter.connect(this.reverb);
    this.reverb.connect(this.analyser);
    this.analyser.connect(this.output);
    this.output.toDestination();
  }

  async initialize() {
    if (!this.readyPromise) {
      this.readyPromise = Promise.all([
        Tone.loaded(),
        this.reverb.generate(),
      ]).then(() => undefined);
    }

    return this.readyPromise;
  }

  async startAudio() {
    await Tone.start();
    await this.initialize();
  }

  setBpm(bpm: number) {
    Tone.Transport.bpm.rampTo(bpm, 0.05);
  }

  setFilterTone(value: number) {
    const clamped = Math.max(-1, Math.min(1, value));
    const normalized = Math.abs(clamped) <= 0.05 ? 0 : clamped;

    if (normalized < 0) {
      const amount = Math.abs(normalized);
      this.lowpassFilter.frequency.rampTo(20000 - amount * 19000, 0.05);
      this.highpassFilter.frequency.rampTo(20, 0.05);
      return;
    }

    if (normalized > 0) {
      this.lowpassFilter.frequency.rampTo(20000, 0.05);
      this.highpassFilter.frequency.rampTo(20 + normalized * 3980, 0.05);
      return;
    }

    this.lowpassFilter.frequency.rampTo(20000, 0.05);
    this.highpassFilter.frequency.rampTo(20, 0.05);
  }

  setReverbMix(value: number) {
    this.reverb.wet.rampTo(value, 0.05);
  }

  setMasterVolume(value: number) {
    const safeValue = Math.max(0.001, value);
    this.output.volume.rampTo(Tone.gainToDb(safeValue), 0.05);
  }

  getSpectrumValues() {
    const values = this.analyser.getValue();
    if (values instanceof Float32Array) {
      return values;
    }

    return Array.isArray(values) ? values.flatMap((value) => Array.from(value)) : [];
  }

  stopTrack(name: TrackName, time: number) {
    const player = this.players[name];

    if (!player.loaded) {
      return;
    }

    player.stop(time);
  }

  previewTrack(name: TrackName) {
    if (name === "Accent") {
      return;
    }

    const now = Tone.now();

    Object.entries(this.previewPlayers).forEach(([trackName, player]) => {
      if (trackName === "Accent" || !player.loaded) {
        return;
      }

      player.stop();
    });

    const player = this.previewPlayers[name];
    if (!player.loaded) {
      console.warn(`Sample for ${name} is not loaded yet.`);
      return;
    }

    player.volume.cancelScheduledValues(now);
    player.volume.setValueAtTime(0, now);
    player.stop();
    player.start();
  }

  triggerTrack(name: TrackName, time: number, accented = false) {
    if (name === "Accent") {
      return;
    }

    const player = this.players[name];

    if (!player.loaded) {
      console.warn(`Sample for ${name} is not loaded yet.`);
      return;
    }

    if (name === "O-Hat") {
      player.stop(time);
    }

    player.volume.cancelScheduledValues(time);
    player.volume.setValueAtTime(accented ? 7 : 0, time);
    player.start(time);
  }

  dispose() {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    [...Object.values(this.players), ...Object.values(this.previewPlayers)].forEach((player) =>
      player.dispose(),
    );
    this.lowpassFilter.dispose();
    this.highpassFilter.dispose();
    this.analyser.dispose();
    this.reverb.dispose();
    this.output.dispose();
  }
}
