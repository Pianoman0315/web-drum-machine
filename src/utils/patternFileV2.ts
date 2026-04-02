import { MutedTracks, PatternFile, TRACK_NAMES, TrackPattern } from "../types";
import {
  MAX_BPM,
  MAX_FILTER_TONE,
  MIN_BPM,
  MIN_FILTER_TONE,
  STEP_COUNT,
  createDefaultMutedTracks,
  createDefaultPattern,
} from "../data/defaultPattern";

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

const normalizeFilterValue = (value: number) => {
  if (value >= MIN_FILTER_TONE && value <= MAX_FILTER_TONE) {
    return value;
  }

  if (value >= 200 && value <= 12000) {
    const normalized = (12000 - value) / (12000 - 200);
    return -Math.min(1, Math.max(0, normalized));
  }

  throw new Error("Filter value is invalid.");
};

const isMutedTracks = (value: unknown): value is MutedTracks => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return TRACK_NAMES.every((name) => typeof (value as MutedTracks)[name] === "boolean");
};

export const validatePatternFile = (value: unknown): PatternFile => {
  const defaults = createDefaultPattern();

  if (!value || typeof value !== "object") {
    throw new Error("Pattern file format is invalid.");
  }

  const candidate = value as Partial<PatternFile>;

  if (candidate.version !== 1) {
    throw new Error("This .drmpat version is not supported.");
  }

  if (
    typeof candidate.bpm !== "number" ||
    candidate.bpm < MIN_BPM ||
    candidate.bpm > MAX_BPM
  ) {
    throw new Error("BPM value is invalid.");
  }

  if (
    typeof candidate.masterVolume !== "number" ||
    candidate.masterVolume < 0 ||
    candidate.masterVolume > 1
  ) {
    throw new Error("Master volume value is invalid.");
  }

  if (typeof candidate.filter !== "number") {
    throw new Error("Filter value is invalid.");
  }

  if (typeof candidate.reverb !== "number" || candidate.reverb < 0 || candidate.reverb > 1) {
    throw new Error("Reverb value is invalid.");
  }

  if (!Array.isArray(candidate.tracks) || candidate.tracks.length !== defaults.tracks.length) {
    throw new Error("Track count is invalid.");
  }

  if (!candidate.tracks.every(isTrackPattern)) {
    throw new Error("Track data is invalid.");
  }

  const orderedTracks = TRACK_NAMES.map((name) => {
    const track = candidate.tracks!.find((item) => item.name === name);
    if (!track) {
      throw new Error(`Track ${name} is missing.`);
    }
    return track;
  });

  const mutedTracks = isMutedTracks(candidate.mutedTracks)
    ? candidate.mutedTracks
    : createDefaultMutedTracks();

  return {
    version: 1,
    bpm: candidate.bpm,
    masterVolume: candidate.masterVolume,
    filter: normalizeFilterValue(candidate.filter),
    reverb: candidate.reverb,
    mutedTracks,
    tracks: orderedTracks,
  };
};

export const createPatternBlob = (pattern: PatternFile) =>
  new Blob([JSON.stringify(pattern, null, 2)], {
    type: "application/json",
  });
