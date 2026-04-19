import { PointerEvent as ReactPointerEvent, useMemo, useRef, useState } from "react";
import { SynthEnvelope, SynthLfo } from "../types";

type SynthModPanelProps = {
  envelope: SynthEnvelope;
  lfo: SynthLfo;
  envelopeProgress: number;
  onEnvelopeChange: (envelope: SynthEnvelope) => void;
  onLfoChange: (lfo: SynthLfo) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function SynthModPanel({
  envelope,
  lfo,
  envelopeProgress,
  onEnvelopeChange,
  onLfoChange,
}: SynthModPanelProps) {
  const [draggingPoint, setDraggingPoint] = useState<keyof SynthEnvelope["graph"] | null>(null);
  const graphRef = useRef<SVGSVGElement | null>(null);
  const graphWidth = 260;
  const graphHeight = 180;

  const points = useMemo(
    () => [
      { key: "attackX" as const, x: envelope.graph.attackX, y: envelope.graph.attackY },
      { key: "decayX" as const, x: envelope.graph.decayX, y: envelope.graph.decayY },
      { key: "sustainX" as const, x: envelope.graph.sustainX, y: envelope.graph.sustainY },
      { key: "releaseX" as const, x: envelope.graph.releaseX, y: envelope.graph.releaseY },
    ],
    [envelope.graph],
  );

  const updateGraph = (nextX: number, nextY: number) => {
    if (!draggingPoint) {
      return;
    }

    const graph = { ...envelope.graph };

    if (draggingPoint === "attackX") {
      graph.attackX = clamp(nextX, 0.08, graph.decayX - 0.08);
      graph.attackY = clamp(nextY, 0.02, 0.35);
    } else if (draggingPoint === "decayX") {
      graph.decayX = clamp(nextX, graph.attackX + 0.08, graph.sustainX - 0.08);
      graph.decayY = clamp(nextY, 0.12, 0.62);
    } else if (draggingPoint === "sustainX") {
      graph.sustainX = clamp(nextX, graph.decayX + 0.08, graph.releaseX - 0.08);
      graph.sustainY = clamp(nextY, 0.18, 0.78);
    } else if (draggingPoint === "releaseX") {
      graph.releaseX = clamp(nextX, graph.sustainX + 0.08, 0.98);
      graph.releaseY = clamp(nextY, 0.78, 0.98);
    }

    onEnvelopeChange({
      attack: clamp(graph.attackX * 0.8, 0.01, 1.2),
      decay: clamp((graph.decayX - graph.attackX) * 1.1, 0.02, 1.4),
      sustain: clamp(1 - graph.sustainY, 0.05, 1),
      release: clamp((graph.releaseX - graph.sustainX) * 1.5, 0.04, 1.8),
      graph,
    });
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draggingPoint) {
      return;
    }

    const rect = graphRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const nextX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const nextY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    updateGraph(nextX, nextY);
  };

  const handlePointerUp = (event?: ReactPointerEvent<SVGSVGElement>) => {
    if (event && graphRef.current?.hasPointerCapture(event.pointerId)) {
      graphRef.current.releasePointerCapture(event.pointerId);
    }

    setDraggingPoint(null);
  };

  return (
    <section className="panel synth-mod-panel">
      <div className="section-header">
        <h2>ADSR</h2>
      </div>

      <svg
        ref={graphRef}
        className="envelope-graph"
        viewBox={`0 0 ${graphWidth} ${graphHeight}`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <polyline
          className="envelope-line"
          points={[
            `0,${graphHeight - 10}`,
            `${envelope.graph.attackX * graphWidth},${envelope.graph.attackY * graphHeight}`,
            `${envelope.graph.decayX * graphWidth},${envelope.graph.decayY * graphHeight}`,
            `${envelope.graph.sustainX * graphWidth},${envelope.graph.sustainY * graphHeight}`,
            `${envelope.graph.releaseX * graphWidth},${envelope.graph.releaseY * graphHeight}`,
            `${graphWidth},${graphHeight - 10}`,
          ].join(" ")}
        />

        <line
          className="envelope-playhead"
          x1={envelopeProgress * graphWidth}
          x2={envelopeProgress * graphWidth}
          y1={12}
          y2={graphHeight - 12}
        />

        {points.map((point) => (
          <circle
            key={point.key}
            className="envelope-handle"
            cx={point.x * graphWidth}
            cy={point.y * graphHeight}
            r={8}
            onPointerDown={(event) => {
              setDraggingPoint(point.key);
              graphRef.current?.setPointerCapture(event.pointerId);
            }}
          />
        ))}
      </svg>

      <div className="envelope-values">
        <span>A {envelope.attack.toFixed(2)}</span>
        <span>D {envelope.decay.toFixed(2)}</span>
        <span>S {Math.round(envelope.sustain * 100)}%</span>
        <span>R {envelope.release.toFixed(2)}</span>
      </div>

      <div className="section-header synth-lfo-header">
        <h2>LFO</h2>
      </div>

      <div className="synth-lfo-panel">
        <label>
          <span>Wave</span>
          <select
            value={lfo.waveform}
            onChange={(event) => onLfoChange({ ...lfo, waveform: event.target.value as SynthLfo["waveform"] })}
          >
            <option value="sine">Sine</option>
            <option value="triangle">Triangle</option>
            <option value="square">Square</option>
          </select>
        </label>

        <label>
          <span>Destination</span>
          <select
            value={lfo.destination}
            onChange={(event) =>
              onLfoChange({ ...lfo, destination: event.target.value as SynthLfo["destination"] })
            }
          >
            <option value="pitch">Pitch</option>
            <option value="amp">Amp</option>
            <option value="pan">Pan</option>
          </select>
        </label>

        <label>
          <span>Rate {lfo.rate.toFixed(1)}Hz</span>
          <input
            type="range"
            min={0.2}
            max={12}
            step={0.1}
            value={lfo.rate}
            onChange={(event) => onLfoChange({ ...lfo, rate: Number(event.target.value) })}
          />
        </label>

        <label>
          <span>Depth {Math.round(lfo.depth * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={lfo.depth}
            onChange={(event) => onLfoChange({ ...lfo, depth: Number(event.target.value) })}
          />
        </label>
      </div>
    </section>
  );
}
