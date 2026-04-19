import { MutedTracks, PatternFile, TRACK_NAMES } from "../types";

export const STEP_COUNT = 16;
export const MIN_BPM = 60;
export const MAX_BPM = 180;
export const MIN_FILTER_TONE = -1;
export const MAX_FILTER_TONE = 1;

const createEmptySteps = () => Array.from({ length: STEP_COUNT }, () => false);

export const createDefaultMutedTracks = (): MutedTracks =>
  Object.fromEntries(TRACK_NAMES.map((name) => [name, false])) as MutedTracks;

export const createDefaultPattern = (): PatternFile => ({
  version: 1,
  bpm: 120,
  masterVolume: 0.8,
  filter: 0,
  reverb: 0.2,
  mutedTracks: createDefaultMutedTracks(),
  tracks: TRACK_NAMES.map((name) => ({
    name,
    steps: createEmptySteps(),
  })),
});

export const createStarterPattern = (): PatternFile => {
  const pattern = createDefaultPattern();

  pattern.tracks[0].steps = [
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ];
  pattern.tracks[1].steps = [
    true,
    false,
    false,
    false,
    true,
    false,
    false,
    false,
    true,
    false,
    false,
    false,
    true,
    false,
    false,
    false,
  ];
  pattern.tracks[2].steps[4] = true;
  pattern.tracks[2].steps[12] = true;
  pattern.tracks[3].steps[12] = true;
  pattern.tracks[4].steps = pattern.tracks[4].steps.map((_, index) => index % 2 === 0);
  pattern.tracks[7].steps[3] = true;
  pattern.tracks[7].steps[7] = true;
  pattern.tracks[7].steps[11] = true;
  pattern.tracks[7].steps[15] = true;
  pattern.tracks[8].steps[10] = true;

  return pattern;
};
