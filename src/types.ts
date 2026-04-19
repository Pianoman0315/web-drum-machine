export const TRACK_NAMES = [
  "Accent",
  "Bass",
  "Snare",
  "Clap",
  "C-Hat",
  "O-Hat",
  "Tom 2",
  "Tom 1",
  "Cow",
] as const;

export const ROOT_NOTES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export const SYNTH_TAB_NAMES = ["Pattern", "Pad"] as const;

export type TrackName = (typeof TRACK_NAMES)[number];
export type RootNote = (typeof ROOT_NOTES)[number];
export type SynthSubTab = (typeof SYNTH_TAB_NAMES)[number];
export type AppTab = "Drum" | "Synth";
export type SaveKind = "drum" | "synth" | "full";
export type ScaleType = "pentatonic" | "diatonic" | "chromatic";
export type LfoWaveform = "sine" | "triangle" | "square";
export type LfoDestination = "pitch" | "amp" | "pan";

export type TrackPattern = {
  name: TrackName;
  steps: boolean[];
};

export type MutedTracks = Record<TrackName, boolean>;

export type PatternFile = {
  version: number;
  bpm: number;
  masterVolume: number;
  filter: number;
  reverb: number;
  mutedTracks: MutedTracks;
  tracks: TrackPattern[];
};

export type GlobalSettings = {
  bpm: number;
  masterVolume: number;
  filter: number;
  reverb: number;
};

export type DrumMachineState = {
  tracks: TrackPattern[];
  mutedTracks: MutedTracks;
};

export type EnvelopeGraph = {
  attackX: number;
  attackY: number;
  decayX: number;
  decayY: number;
  sustainX: number;
  sustainY: number;
  releaseX: number;
  releaseY: number;
};

export type SynthEnvelope = {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  graph: EnvelopeGraph;
};

export type SynthLfo = {
  enabled: boolean;
  waveform: LfoWaveform;
  rate: number;
  depth: number;
  destination: LfoDestination;
};

export type SynthNoteRow = {
  id: string;
  label: string;
  midi: number;
  isLowerOctave?: boolean;
};

export type SynthStep = {
  rowId: string | null;
  length: number;
};

export type SynthState = {
  scaleType: ScaleType;
  rootNote: RootNote;
  octaveRange: 1 | 2;
  steps: SynthStep[];
  envelope: SynthEnvelope;
  lfo: SynthLfo;
};

export type ProjectState = {
  version: 2;
  global: GlobalSettings;
  drum: DrumMachineState;
  synth: SynthState;
};

export type ProjectFileV2 = {
  version: 2;
  kind: SaveKind;
  global?: GlobalSettings;
  drum?: DrumMachineState;
  synth?: SynthState;
};
