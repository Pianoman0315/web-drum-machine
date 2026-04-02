import {
  MAX_BPM,
  MAX_FILTER_TONE,
  MIN_BPM,
  MIN_FILTER_TONE,
} from "../data/defaultPattern";

type ControlStripProps = {
  isPlaying: boolean;
  bpm: number;
  filter: number;
  reverb: number;
  masterVolume: number;
  onPlay: () => void;
  onStop: () => void;
  onBpmChange: (value: number) => void;
  onFilterChange: (value: number) => void;
  onReverbChange: (value: number) => void;
  onMasterVolumeChange: (value: number) => void;
};

type KnobProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (value: number) => void;
};

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: KnobProps) {
  return (
    <label className="range-control">
      <span className="range-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="range-value">{displayValue}</span>
    </label>
  );
}

const FILTER_DEAD_ZONE = 0.05;

function normalizeFilterValue(value: number) {
  return Math.abs(value) < FILTER_DEAD_ZONE ? 0 : value;
}

function getFilterDisplayValue(value: number) {
  const normalized = normalizeFilterValue(value);

  if (normalized < 0) {
    return `High Cut ${Math.round(Math.abs(normalized) * 100)}%`;
  }

  if (normalized > 0) {
    return `Low Cut ${Math.round(normalized * 100)}%`;
  }

  return "Flat";
}

export function ControlStrip({
  isPlaying,
  bpm,
  filter,
  reverb,
  masterVolume,
  onPlay,
  onStop,
  onBpmChange,
  onFilterChange,
  onReverbChange,
  onMasterVolumeChange,
}: ControlStripProps) {
  return (
    <section className="panel control-panel">
      <div className="transport-group">
        <button
          type="button"
          className={`transport-toggle ${isPlaying ? "is-playing" : "is-stopped"}`}
          onClick={isPlaying ? onStop : onPlay}
          aria-label={isPlaying ? "Stop" : "Play"}
        >
          <span className="transport-icon" aria-hidden="true">
            <span className="transport-play-icon" />
            <span className="transport-stop-icon">
              <span />
              <span />
            </span>
          </span>
        </button>
      </div>

      <RangeControl
        label="BPM"
        value={bpm}
        min={MIN_BPM}
        max={MAX_BPM}
        step={1}
        displayValue={`${bpm}`}
        onChange={onBpmChange}
      />

      <RangeControl
        label="Filter"
        value={filter}
        min={MIN_FILTER_TONE}
        max={MAX_FILTER_TONE}
        step={0.01}
        displayValue={getFilterDisplayValue(filter)}
        onChange={(value) => onFilterChange(normalizeFilterValue(value))}
      />

      <RangeControl
        label="Reverb"
        value={reverb}
        min={0}
        max={1}
        step={0.01}
        displayValue={`${Math.round(reverb * 100)}%`}
        onChange={onReverbChange}
      />

      <RangeControl
        label="Master"
        value={masterVolume}
        min={0}
        max={1}
        step={0.01}
        displayValue={`${Math.round(masterVolume * 100)}%`}
        onChange={onMasterVolumeChange}
      />
    </section>
  );
}
