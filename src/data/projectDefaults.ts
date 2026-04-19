import {
  DrumMachineState,
  EnvelopeGraph,
  GlobalSettings,
  MutedTracks,
  ProjectState,
  SynthNoteRow,
  SynthState,
  TRACK_NAMES,
} from "../types";
import { STEP_COUNT } from "./defaultPattern";

const FIXED_SYNTH_ROWS: SynthNoteRow[] = [
  { id: "D5-74", label: "D", midi: 74 },
  { id: "C5-72", label: "C", midi: 72 },
  { id: "B4-71", label: "B", midi: 71 },
  { id: "A4-69", label: "A", midi: 69 },
  { id: "G4-67", label: "G", midi: 67 },
  { id: "F4-65", label: "F", midi: 65 },
  { id: "E4-64", label: "E", midi: 64 },
  { id: "D4-62", label: "D", midi: 62, isLowerOctave: true },
  { id: "C4-60", label: "C", midi: 60, isLowerOctave: true },
];

export const createDefaultMutedTracks = (): MutedTracks =>
  Object.fromEntries(TRACK_NAMES.map((name) => [name, false])) as MutedTracks;

export const createDefaultGlobalSettings = (): GlobalSettings => ({
  bpm: 120,
  masterVolume: 0.8,
  filter: 0,
  reverb: 0.2,
});

export const createDefaultDrumState = (): DrumMachineState => ({
  tracks: TRACK_NAMES.map((name) => ({
    name,
    steps: Array.from({ length: STEP_COUNT }, () => false),
  })),
  mutedTracks: createDefaultMutedTracks(),
});

export const createDefaultEnvelopeGraph = (): EnvelopeGraph => ({
  attackX: 0.16,
  attackY: 0.08,
  decayX: 0.38,
  decayY: 0.52,
  sustainX: 0.62,
  sustainY: 0.52,
  releaseX: 0.82,
  releaseY: 1,
});

export const createDefaultSynthState = (): SynthState => ({
  scaleType: "diatonic",
  rootNote: "C",
  octaveRange: 2,
  steps: Array.from({ length: STEP_COUNT }, () => ({ rowId: null, length: 1 })),
  envelope: {
    attack: 0.14,
    decay: 0.28,
    sustain: 0.48,
    release: 0.42,
    graph: createDefaultEnvelopeGraph(),
  },
  lfo: {
    enabled: true,
    waveform: "sine",
    rate: 3.2,
    depth: 0,
    destination: "pitch",
  },
});

export const createDefaultProjectState = (): ProjectState => ({
  version: 2,
  global: createDefaultGlobalSettings(),
  drum: createDefaultDrumState(),
  synth: createDefaultSynthState(),
});

export const getScaleRows = (): SynthNoteRow[] => FIXED_SYNTH_ROWS;
