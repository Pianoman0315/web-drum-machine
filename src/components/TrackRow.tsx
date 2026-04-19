import { useRef } from "react";
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
  const skipClickRef = useRef(false);

  return (
    <div className="track-row">
      <div className="track-controls">
        <button
          type="button"
          className="track-name-button"
          onPointerDown={(event) => {
            if (event.pointerType === "touch" || event.pointerType === "pen") {
              const rect = event.currentTarget.getBoundingClientRect();
              const offsetX = event.clientX - rect.left;
              const offsetY = event.clientY - rect.top;
              const safeInsetX = 6;
              const safeInsetY = 4;
              if (
                offsetX < safeInsetX ||
                offsetX > rect.width - safeInsetX ||
                offsetY < safeInsetY ||
                offsetY > rect.height - safeInsetY
              ) {
                skipClickRef.current = true;
                event.preventDefault();
                return;
              }

              skipClickRef.current = true;
              event.preventDefault();
              onPreviewTrack();
            }
          }}
          onClick={() => {
            if (skipClickRef.current) {
              skipClickRef.current = false;
              return;
            }

            onPreviewTrack();
          }}
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
