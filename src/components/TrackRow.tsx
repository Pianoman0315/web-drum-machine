import { StepButton } from "./StepButton";
import { TrackPattern } from "../types";

type TrackRowProps = {
  track: TrackPattern;
  currentStep: number;
  isMuted: boolean;
  onPreviewTrack: () => void;
  onToggleMute: () => void;
  onToggleStep: (stepIndex: number) => void;
};

export function TrackRow({
  track,
  currentStep,
  isMuted,
  onPreviewTrack,
  onToggleMute,
  onToggleStep,
}: TrackRowProps) {
  return (
    <div className="track-row">
      <div className="track-controls">
        <button
          type="button"
          className="track-name-button"
          onClick={onPreviewTrack}
          aria-label={`${track.name} preview`}
        >
          {track.name}
        </button>
        <button
          type="button"
          className={`mute-button ${isMuted ? "is-muted" : ""}`}
          onClick={onToggleMute}
          aria-pressed={isMuted}
        >
          M
        </button>
      </div>
      <div className="step-grid" role="group" aria-label={`${track.name} pattern`}>
        {track.steps.map((active, stepIndex) => (
          <StepButton
            key={`${track.name}-${stepIndex}`}
            active={active}
            isCurrentStep={currentStep === stepIndex}
            stepIndex={stepIndex}
            onToggle={() => onToggleStep(stepIndex)}
          />
        ))}
      </div>
    </div>
  );
}
