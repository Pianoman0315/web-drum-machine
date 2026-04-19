import {
  DrumMachineState,
  GlobalSettings,
  ProjectFileV2,
  ProjectState,
  ROOT_NOTES,
  RootNote,
  SaveKind,
  ScaleType,
  LfoDestination,
  SynthState,
  TRACK_NAMES,
  TrackPattern,
} from "../types";
import { MAX_BPM, MAX_FILTER_TONE, MIN_BPM, MIN_FILTER_TONE, STEP_COUNT } from "../data/defaultPattern";
import {
  createDefaultDrumState,
  createDefaultGlobalSettings,
  createDefaultProjectState,
  createDefaultSynthState,
} from "../data/projectDefaults";

const SCALE_TYPES: ScaleType[] = ["pentatonic", "diatonic", "chromatic"];
const SAVE_KINDS: SaveKind[] = ["drum", "synth", "full"];
const LFO_DESTINATIONS = ["pitch", "pan", "amp", "resonance", "filter"];
const normalizeLfoDestination = (destination: string): LfoDestination => {
  if (destination === "pan" || destination === "amp") {
    return destination;
  }

  return "pitch";
};

const isTrackPattern = (value: unknown): value is TrackPattern => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as TrackPattern;
  return (
    typeof candidate.name === "string" &&
    TRACK_NAMES.includes(candidate.name) &&
    Array.isArray(candidate.steps) &&
    candidate.steps.length === STEP_COUNT &&
    candidate.steps.every((step) => typeof step === "boolean")
  );
};

const isGlobalSettings = (value: unknown): value is GlobalSettings => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as GlobalSettings;
  return (
    typeof candidate.bpm === "number" &&
    candidate.bpm >= MIN_BPM &&
    candidate.bpm <= MAX_BPM &&
    typeof candidate.masterVolume === "number" &&
    candidate.masterVolume >= 0 &&
    candidate.masterVolume <= 1 &&
    typeof candidate.filter === "number" &&
    candidate.filter >= MIN_FILTER_TONE &&
    candidate.filter <= MAX_FILTER_TONE &&
    typeof candidate.reverb === "number" &&
    candidate.reverb >= 0 &&
    candidate.reverb <= 1
  );
};

const isDrumState = (value: unknown): value is DrumMachineState => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as DrumMachineState;
  return (
    Array.isArray(candidate.tracks) &&
    candidate.tracks.length === TRACK_NAMES.length &&
    candidate.tracks.every(isTrackPattern) &&
    TRACK_NAMES.every((name) => typeof candidate.mutedTracks?.[name] === "boolean")
  );
};

const isRootNote = (value: unknown): value is RootNote =>
  typeof value === "string" && ROOT_NOTES.includes(value as RootNote);

const isSynthState = (value: unknown): value is SynthState => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as SynthState;
  return (
    SCALE_TYPES.includes(candidate.scaleType) &&
    isRootNote(candidate.rootNote) &&
    (candidate.octaveRange === 1 || candidate.octaveRange === 2) &&
    Array.isArray(candidate.steps) &&
    candidate.steps.length === STEP_COUNT &&
    candidate.steps.every(
      (step) =>
        step &&
        typeof step === "object" &&
        (step.rowId === null || typeof step.rowId === "string") &&
        (step.length === undefined ||
          (typeof step.length === "number" && step.length >= 1 && step.length <= STEP_COUNT)),
    ) &&
    typeof candidate.envelope?.attack === "number" &&
    typeof candidate.envelope?.decay === "number" &&
    typeof candidate.envelope?.sustain === "number" &&
    typeof candidate.envelope?.release === "number" &&
    typeof candidate.lfo?.enabled === "boolean" &&
    typeof candidate.lfo?.rate === "number" &&
    typeof candidate.lfo?.depth === "number" &&
    typeof candidate.lfo?.destination === "string" &&
    LFO_DESTINATIONS.includes(candidate.lfo.destination)
  );
};

export const createProjectBlob = (project: ProjectState, kind: SaveKind) => {
  const payload: ProjectFileV2 = {
    version: 2,
    kind,
  };

  if (kind === "drum" || kind === "full") {
    payload.drum = project.drum;
  }

  if (kind === "synth" || kind === "full") {
    payload.synth = project.synth;
  }

  if (kind === "full") {
    payload.global = project.global;
  }

  return new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
};

export const getProjectFileName = (kind: SaveKind) => {
  if (kind === "drum") {
    return "pattern.drmpat";
  }

  if (kind === "synth") {
    return "pattern.synthpat";
  }

  return "pattern.fullpat";
};

export const validateProjectFile = (value: unknown) => {
  if (!value || typeof value !== "object") {
    throw new Error("Project file format is invalid.");
  }

  const candidate = value as Partial<ProjectFileV2>;
  if (candidate.version !== 2) {
    throw new Error("This file is not a version 2 project.");
  }

  if (!candidate.kind || !SAVE_KINDS.includes(candidate.kind)) {
    throw new Error("Project file kind is invalid.");
  }

  if (!candidate.drum && !candidate.synth && !candidate.global) {
    throw new Error("Project file is empty.");
  }

  if (candidate.global && !isGlobalSettings(candidate.global)) {
    throw new Error("Global settings are invalid.");
  }

  if (candidate.drum && !isDrumState(candidate.drum)) {
    throw new Error("Drum data is invalid.");
  }

  if (candidate.synth && !isSynthState(candidate.synth)) {
    throw new Error("Synth data is invalid.");
  }

  const normalizedSynth = candidate.synth
    ? {
        ...candidate.synth,
        lfo: {
          ...candidate.synth.lfo,
          destination: normalizeLfoDestination(String(candidate.synth.lfo.destination)),
        },
        steps: candidate.synth.steps.map((step) => ({
          rowId: step.rowId,
          length: typeof step.length === "number" ? step.length : 1,
        })),
      }
    : createDefaultSynthState();

  return {
    version: 2 as const,
    kind: candidate.kind,
    global: candidate.global ?? createDefaultGlobalSettings(),
    drum: candidate.drum ?? createDefaultDrumState(),
    synth: normalizedSynth,
  };
};

export const applyProjectFile = (current: ProjectState, loaded: ReturnType<typeof validateProjectFile>): ProjectState => {
  if (loaded.kind === "drum") {
    return {
      ...current,
      drum: loaded.drum,
    };
  }

  if (loaded.kind === "synth") {
    return {
      ...current,
      synth: loaded.synth,
    };
  }

  return {
    version: 2,
    global: loaded.global,
    drum: loaded.drum,
    synth: loaded.synth,
  };
};

export const createEmptyProject = () => createDefaultProjectState();
