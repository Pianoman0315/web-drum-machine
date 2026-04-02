import { PatternFile, TRACK_NAMES, TrackPattern } from "../types";
import { MAX_BPM, MIN_BPM, STEP_COUNT, createDefaultPattern } from "../data/defaultPattern";

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

export const validatePatternFile = (value: unknown): PatternFile => {
  const defaults = createDefaultPattern();

  if (!value || typeof value !== "object") {
    throw new Error("ファイルの形式が正しくありません。");
  }

  const candidate = value as Partial<PatternFile>;

  if (candidate.version !== 1) {
    throw new Error("この .drmpat の version には対応していません。");
  }

  if (
    typeof candidate.bpm !== "number" ||
    candidate.bpm < MIN_BPM ||
    candidate.bpm > MAX_BPM
  ) {
    throw new Error("BPM の値が不正です。");
  }

  if (typeof candidate.masterVolume !== "number" || candidate.masterVolume < 0 || candidate.masterVolume > 1) {
    throw new Error("Master volume の値が不正です。");
  }

  if (typeof candidate.filter !== "number" || candidate.filter < 200 || candidate.filter > 12000) {
    throw new Error("Filter の値が不正です。");
  }

  if (typeof candidate.reverb !== "number" || candidate.reverb < 0 || candidate.reverb > 1) {
    throw new Error("Reverb の値が不正です。");
  }

  if (!Array.isArray(candidate.tracks) || candidate.tracks.length !== defaults.tracks.length) {
    throw new Error("tracks の数が正しくありません。");
  }

  if (!candidate.tracks.every(isTrackPattern)) {
    throw new Error("tracks の内容が正しくありません。");
  }

  const orderedTracks = TRACK_NAMES.map((name) => {
    const track = candidate.tracks!.find((item) => item.name === name);
    if (!track) {
      throw new Error(`トラック ${name} が見つかりません。`);
    }
    return track;
  });

  return {
    version: 1,
    bpm: candidate.bpm,
    masterVolume: candidate.masterVolume,
    filter: candidate.filter,
    reverb: candidate.reverb,
    tracks: orderedTracks,
  };
};

export const createPatternBlob = (pattern: PatternFile) =>
  new Blob([JSON.stringify(pattern, null, 2)], {
    type: "application/json",
  });
