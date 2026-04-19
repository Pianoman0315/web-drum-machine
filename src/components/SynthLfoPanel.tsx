import { useEffect, useRef, useState } from "react";
import { SynthLfo } from "../types";

type SynthLfoPanelProps = {
  lfo: SynthLfo;
  onLfoChange: (lfo: SynthLfo) => void;
  onPreviewChange: (lfo: SynthLfo) => void;
  onPreviewStart: () => void;
  onPreviewStop: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const createWavePath = (waveform: SynthLfo["waveform"], rate: number, depth: number) => {
  const width = 208;
  const centerY = 36;
  if (depth <= 0) {
    return `M0 ${centerY} L${width} ${centerY}`;
  }

  const amplitude = 8 + depth * 22;
  const cycles = clamp(1 + rate / 4, 1, 4.2);
  const points = 48;

  const samples = Array.from({ length: points + 1 }, (_, index) => {
    const x = (index / points) * width;
    const phase = (index / points) * cycles;
    const t = phase - Math.floor(phase);
    let normalized = 0;

    if (waveform === "sine") {
      normalized = Math.sin(phase * Math.PI * 2);
    } else if (waveform === "triangle") {
      normalized = 1 - 4 * Math.abs(t - 0.5);
    } else {
      normalized = t < 0.5 ? 1 : -1;
    }

    const y = centerY - normalized * amplitude;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  });

  return samples.join(" ");
};

export function SynthLfoPanel({
  lfo,
  onLfoChange,
  onPreviewChange,
  onPreviewStart,
  onPreviewStop,
}: SynthLfoPanelProps) {
  const [draftLfo, setDraftLfo] = useState(lfo);
  const rafRef = useRef<number | null>(null);
  const pendingLfoRef = useRef<SynthLfo | null>(null);
  const isInteractingRef = useRef(false);
  const lastTouchTimestampRef = useRef(0);
  const onPreviewStopRef = useRef(onPreviewStop);

  useEffect(() => {
    onPreviewStopRef.current = onPreviewStop;
  }, [onPreviewStop]);

  useEffect(() => {
    if (!isInteractingRef.current) {
      setDraftLfo(lfo);
    }
  }, [lfo]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      onPreviewStopRef.current();
    };
  }, []);

  const scheduleLfoCommit = (nextLfo: SynthLfo) => {
    setDraftLfo(nextLfo);
    pendingLfoRef.current = nextLfo;
    onPreviewChange(nextLfo);

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingLfoRef.current) {
          onLfoChange(pendingLfoRef.current);
          pendingLfoRef.current = null;
        }
      });
    }
  };

  const startInteraction = () => {
    if (isInteractingRef.current) {
      return;
    }

    isInteractingRef.current = true;
    onPreviewStart();
  };
  const finishInteraction = () => {
    if (!isInteractingRef.current && !pendingLfoRef.current) {
      onPreviewStop();
      return;
    }

    isInteractingRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (pendingLfoRef.current) {
      onLfoChange(pendingLfoRef.current);
      pendingLfoRef.current = null;
    }
    onPreviewStop();
  };

  const stopPreviewBeforeCommit = () => {
    if (isInteractingRef.current || pendingLfoRef.current) {
      finishInteraction();
      return;
    }

    onPreviewStop();
  };

  const handlePointerStart = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch" || event.pointerType === "pen") {
      lastTouchTimestampRef.current = Date.now();
      event.currentTarget.setPointerCapture(event.pointerId);
      startInteraction();
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    finishInteraction();
  };

  const handleMouseStart = () => {
    if (Date.now() - lastTouchTimestampRef.current < 800) {
      return;
    }

    startInteraction();
  };

  const handleMouseEnd = () => {
    if (Date.now() - lastTouchTimestampRef.current < 800) {
      return;
    }

    finishInteraction();
  };

  const updateRate = (value: string) => {
    scheduleLfoCommit({ ...draftLfo, rate: Number(value) });
  };

  const updateDepth = (value: string) => {
    scheduleLfoCommit({ ...draftLfo, depth: Number(value) });
  };

  return (
    <section className="panel synth-lfo-frame">
      <div className="section-header">
        <h2>LFO</h2>
      </div>

      <div className="synth-lfo-panel">
        <div className="synth-lfo-top">
          <div
            className="lfo-wave-preview"
            onPointerDownCapture={handlePointerStart}
            onPointerDown={handlePointerStart}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onLostPointerCapture={finishInteraction}
            onMouseDownCapture={handleMouseStart}
            onMouseDown={handleMouseStart}
            onMouseUp={handleMouseEnd}
            onMouseLeave={handleMouseEnd}
          >
            <svg viewBox="0 0 208 72" aria-hidden="true">
              <path d={createWavePath(draftLfo.waveform, draftLfo.rate, draftLfo.depth)} />
            </svg>
          </div>

          <div className="synth-lfo-selects">
            <label>
              <span>Wave</span>
              <select
                value={draftLfo.waveform}
                onChange={(event) => {
                  stopPreviewBeforeCommit();
                  scheduleLfoCommit({ ...draftLfo, waveform: event.target.value as SynthLfo["waveform"] });
                }}
              >
                <option value="sine">Sine</option>
                <option value="triangle">Triangle</option>
                <option value="square">Square</option>
              </select>
            </label>

            <label>
              <span>Target</span>
              <select
                value={draftLfo.destination}
                onChange={(event) => {
                  stopPreviewBeforeCommit();
                  scheduleLfoCommit({ ...draftLfo, destination: event.target.value as SynthLfo["destination"] });
                }}
              >
                <option value="pitch">Pitch</option>
                <option value="amp">Amp</option>
                <option value="pan">Pan</option>
              </select>
            </label>
          </div>
        </div>

        <div className="synth-lfo-sliders-row">
          <label>
            <span>Speed {draftLfo.rate.toFixed(1)}Hz</span>
            <input
              type="range"
              min={0.2}
              max={12}
              step={0.1}
              value={draftLfo.rate}
              onPointerDownCapture={handlePointerStart}
              onPointerDown={handlePointerStart}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onMouseDownCapture={handleMouseStart}
              onMouseDown={handleMouseStart}
              onMouseUp={handleMouseEnd}
              onMouseLeave={handleMouseEnd}
              onInput={(event) => updateRate(event.currentTarget.value)}
              onChange={(event) => updateRate(event.currentTarget.value)}
            />
          </label>

          <label>
            <span>Depth {Math.round(draftLfo.depth * 100)}%</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={draftLfo.depth}
              onPointerDownCapture={handlePointerStart}
              onPointerDown={handlePointerStart}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onMouseDownCapture={handleMouseStart}
              onMouseDown={handleMouseStart}
              onMouseUp={handleMouseEnd}
              onMouseLeave={handleMouseEnd}
              onInput={(event) => updateDepth(event.currentTarget.value)}
              onChange={(event) => updateDepth(event.currentTarget.value)}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
