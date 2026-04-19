import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useState } from "react";
import { SynthNoteRow } from "../types";

type SynthPlayPadProps = {
  className?: string;
  embedded?: boolean;
  rows: SynthNoteRow[];
  onStart: (frequency: number, brightness: number) => void;
  onMove: (frequency: number, brightness: number) => void;
  onEnd: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const midiToFrequency = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export function SynthPlayPad({ className = "", embedded = false, rows, onStart, onMove, onEnd }: SynthPlayPadProps) {
  const [activeFrequency, setActiveFrequency] = useState<number | null>(null);
  const [brightness, setBrightness] = useState(0.5);

  useEffect(() => {
    return () => {
      onEnd();
    };
  }, [onEnd]);

  const frequencyRange = useMemo(() => {
    const midiValues = rows.map((row) => row.midi);
    const minMidi = Math.min(...midiValues);
    const maxMidi = Math.max(...midiValues);
    return {
      min: midiToFrequency(minMidi),
      max: midiToFrequency(maxMidi),
    };
  }, [rows]);

  const getPadData = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const relativeY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    const pitchRatio = 1 - relativeY;
    const frequency =
      frequencyRange.min *
      Math.pow(frequencyRange.max / frequencyRange.min, pitchRatio);

    return {
      frequency,
      brightnessValue: relativeX,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const { frequency, brightnessValue } = getPadData(event);
    setActiveFrequency(frequency);
    setBrightness(brightnessValue);
    onStart(frequency, brightnessValue);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!(event.buttons & 1)) {
      return;
    }

    const { frequency, brightnessValue } = getPadData(event);
    setActiveFrequency(frequency);
    setBrightness(brightnessValue);
    onMove(frequency, brightnessValue);
  };

  const handlePointerEnd = () => {
    setActiveFrequency(null);
    onEnd();
  };

  return (
    <section className={`${embedded ? "synth-play-body" : "panel synth-play-panel"} ${className}`.trim()}>
      {!embedded ? (
        <div className="section-header">
          <h2>Pad</h2>
        </div>
      ) : null}

      <div className="synth-play-layout">
        <div
          className="synth-play-pad"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onLostPointerCapture={handlePointerEnd}
          onPointerLeave={(event) => {
            if (event.pointerType === "touch" || event.pointerType === "pen") {
              handlePointerEnd();
            }
          }}
        >
          <div className="play-pad-axis top">High Pitch</div>
          <div className="play-pad-axis bottom">Low Pitch</div>
          <div className="play-pad-axis left">Dark</div>
          <div className="play-pad-axis right">Bright</div>
          {activeFrequency ? <div className="play-pad-readout">{activeFrequency.toFixed(1)} Hz</div> : null}
        </div>

        <div className="play-pad-info">
          <div>
            <span className="range-label">Current Pitch</span>
            <p>{activeFrequency ? `${activeFrequency.toFixed(1)} Hz` : "Touch the pad"}</p>
          </div>
          <div>
            <span className="range-label">Brightness</span>
            <p>{Math.round(brightness * 100)}%</p>
          </div>
          <p className="play-pad-helper">
            Vertical movement changes pitch. Horizontal movement changes brightness and filter tone.
          </p>
        </div>
      </div>
    </section>
  );
}
