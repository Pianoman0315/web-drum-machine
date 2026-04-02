import { TrackName, TrackPattern } from "../types";
import { TrackRow } from "./TrackRow";

type SequencerGridProps = {
  tracks: TrackPattern[];
  currentStep: number;
  mutedTracks: Record<TrackName, boolean>;
  onPreviewTrack: (trackIndex: number) => void;
  onToggleMute: (trackIndex: number) => void;
  onToggleStep: (trackIndex: number, stepIndex: number) => void;
};

export function SequencerGrid({
  tracks,
  currentStep,
  mutedTracks,
  onPreviewTrack,
  onToggleMute,
  onToggleStep,
}: SequencerGridProps) {
  const reversedTracks = [...tracks]
    .map((track, trackIndex) => ({ track, trackIndex }))
    .reverse();

  return (
    <section className="panel sequencer-panel">
      <div className="section-header">
        <h2>Pattern</h2>
      </div>

      <div className="step-number-row" aria-hidden="true">
        <div className="track-label spacer" />
        <div className="step-grid">
          {Array.from({ length: 16 }, (_, index) => (
            <div key={index} className="step-number">
              {index + 1}
            </div>
          ))}
        </div>
      </div>

      <div className="track-list">
        {reversedTracks.map(({ track, trackIndex }) => (
          <TrackRow
            key={track.name}
            track={track}
            currentStep={currentStep}
            isMuted={mutedTracks[track.name]}
            onPreviewTrack={() => onPreviewTrack(trackIndex)}
            onToggleMute={() => onToggleMute(trackIndex)}
            onToggleStep={(stepIndex) => onToggleStep(trackIndex, stepIndex)}
          />
        ))}
      </div>
    </section>
  );
}
