export const TRACK_NAMES = [
  "Bass",
  "Snare",
  "Clap",
  "C-Hat",
  "O-Hat",
  "Cow",
] as const;

export type TrackName = (typeof TRACK_NAMES)[number];

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
