import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { EnvelopeGraph, SynthEnvelope } from "../types";

type SynthAdsrPanelProps = {
  envelope: SynthEnvelope;
  envelopeProgress: number;
  onEnvelopeChange: (envelope: SynthEnvelope) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const MAX_ATTACK = 0.9;
const MAX_DECAY = 1.1;
const MAX_RELEASE = 1.35;
const ATTACK_SPAN = 0.22;
const DECAY_SPAN = 0.28;
const RELEASE_SPAN = 0.3;
const TOP_GRAPH_Y = 0.08;
const SUSTAIN_MIN_Y = TOP_GRAPH_Y;
const SUSTAIN_MAX_Y = 0.92;
const ATTACK_PEAK_Y = TOP_GRAPH_Y;

const formatEnvelopeTime = (value: number) =>
  value < 1 ? `${(value * 1000).toFixed(2)} ms` : `${value.toFixed(2)} s`;

const envelopeToGraph = (envelope: Pick<SynthEnvelope, "attack" | "decay" | "sustain" | "release">): EnvelopeGraph => {
  const attackX = clamp((envelope.attack / MAX_ATTACK) * ATTACK_SPAN, 0, ATTACK_SPAN);
  const decayX = clamp(attackX + (envelope.decay / MAX_DECAY) * DECAY_SPAN, attackX, attackX + DECAY_SPAN);
  const releaseX = clamp(decayX + (envelope.release / MAX_RELEASE) * RELEASE_SPAN, decayX, decayX + RELEASE_SPAN);
  const sustainY = clamp(1 - envelope.sustain, SUSTAIN_MIN_Y, SUSTAIN_MAX_Y);

  return {
    attackX,
    attackY: ATTACK_PEAK_Y,
    decayX,
    decayY: sustainY,
    sustainX: (decayX + releaseX) / 2,
    sustainY,
    releaseX,
    releaseY: 1,
  };
};

const withGraph = (envelope: Pick<SynthEnvelope, "attack" | "decay" | "sustain" | "release">): SynthEnvelope => ({
  ...envelope,
  graph: envelopeToGraph(envelope),
});

export function SynthAdsrPanel({ envelope, envelopeProgress, onEnvelopeChange }: SynthAdsrPanelProps) {
  const [draggingPoint, setDraggingPoint] = useState<"attackX" | "decayX" | "sustainY" | "releaseX" | null>(null);
  const [draftEnvelope, setDraftEnvelope] = useState<SynthEnvelope>(withGraph(envelope));
  const graphRef = useRef<SVGSVGElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingEnvelopeRef = useRef<SynthEnvelope | null>(null);
  const pendingDragRef = useRef<{
    key: "attackX" | "decayX" | "sustainY" | "releaseX";
    pointerId: number;
    pointerType: string;
    startClientX: number;
    startClientY: number;
  } | null>(null);
  const swipeRef = useRef<{
    key: "attack" | "decay" | "sustain" | "release";
    pointerId: number;
    startClientX: number;
    startValue: number;
  } | null>(null);
  const graphWidth = 260;
  const graphHeight = 180;
  const guideTop = 14;
  const guideBottom = graphHeight - 14;
  const plotHeight = guideBottom - guideTop;

  useEffect(() => {
    if (!draggingPoint && !pendingDragRef.current) {
      setDraftEnvelope(withGraph(envelope));
    }
  }, [draggingPoint, envelope]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const graph = useMemo(() => envelopeToGraph(draftEnvelope), [draftEnvelope]);
  const pointX = (value: number) => value * graphWidth;
  const pointY = (value: number) => guideTop + value * plotHeight;

  const points = useMemo(
    () => [
      {
        key: "attackX" as const,
        cx: pointX(graph.attackX),
        cy: pointY(graph.attackY),
        mode: "x" as const,
      },
      {
        key: "decayX" as const,
        cx: pointX(graph.decayX),
        cy: pointY(graph.decayY),
        mode: "x" as const,
      },
      {
        key: "sustainY" as const,
        cx: pointX(graph.sustainX),
        cy: pointY(graph.sustainY),
        mode: "y" as const,
      },
      {
        key: "releaseX" as const,
        cx: pointX(graph.releaseX),
        cy: guideBottom,
        mode: "x" as const,
      },
    ],
    [graph],
  );

  const scheduleEnvelopeCommit = (nextEnvelope: SynthEnvelope) => {
    setDraftEnvelope(nextEnvelope);
    pendingEnvelopeRef.current = nextEnvelope;

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingEnvelopeRef.current) {
          onEnvelopeChange(pendingEnvelopeRef.current);
          pendingEnvelopeRef.current = null;
        }
      });
    }
  };

  const updateEnvelopeFromGraph = (
    pointKey: "attackX" | "decayX" | "sustainY" | "releaseX",
    nextX: number,
    nextY: number,
  ) => {
    const nextEnvelope = {
      attack: draftEnvelope.attack,
      decay: draftEnvelope.decay,
      sustain: draftEnvelope.sustain,
      release: draftEnvelope.release,
    };

    if (pointKey === "attackX") {
      const clampedX = clamp(nextX, 0, graph.decayX);
      nextEnvelope.attack = clamp((clampedX / ATTACK_SPAN) * MAX_ATTACK, 0, MAX_ATTACK);
    } else if (pointKey === "decayX") {
      const clampedX = clamp(nextX, graph.attackX, graph.attackX + DECAY_SPAN);
      nextEnvelope.decay = clamp(((clampedX - graph.attackX) / DECAY_SPAN) * MAX_DECAY, 0, MAX_DECAY);
    } else if (pointKey === "sustainY") {
      const clampedY = clamp(nextY, SUSTAIN_MIN_Y, SUSTAIN_MAX_Y);
      nextEnvelope.sustain = clamp(1 - clampedY, 0, 1);
    } else if (pointKey === "releaseX") {
      const clampedX = clamp(nextX, graph.decayX, graph.decayX + RELEASE_SPAN);
      nextEnvelope.release = clamp(((clampedX - graph.decayX) / RELEASE_SPAN) * MAX_RELEASE, 0, MAX_RELEASE);
    }

    scheduleEnvelopeCommit(withGraph(nextEnvelope));
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    let activePoint = draggingPoint;

    if (!draggingPoint && pendingDragRef.current) {
      const threshold = pendingDragRef.current.pointerType === "touch" ? 0 : 2;
      const deltaX = event.clientX - pendingDragRef.current.startClientX;
      const deltaY = event.clientY - pendingDragRef.current.startClientY;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance >= threshold) {
        activePoint = pendingDragRef.current.key;
        setDraggingPoint(pendingDragRef.current.key);
      } else {
        return;
      }
    }

    if (!activePoint && !pendingDragRef.current) {
      return;
    }

    const rect = graphRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const sensitivity = pendingDragRef.current?.pointerType === "touch" || event.pointerType === "touch" ? 1.75 : 1;
    const normalizedX = (event.clientX - rect.left) / rect.width;
    const normalizedY = (event.clientY - rect.top) / rect.height;
    const nextX = clamp(0.5 + (normalizedX - 0.5) * sensitivity, 0, 1);
    const nextY = clamp(0.5 + (normalizedY - 0.5) * sensitivity, 0, 1);
    updateEnvelopeFromGraph(activePoint ?? pendingDragRef.current!.key, nextX, nextY);
  };

  const handlePointerUp = (event?: ReactPointerEvent<SVGSVGElement>) => {
    if (event && graphRef.current?.hasPointerCapture(event.pointerId)) {
      graphRef.current.releasePointerCapture(event.pointerId);
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (pendingEnvelopeRef.current) {
      onEnvelopeChange(pendingEnvelopeRef.current);
      pendingEnvelopeRef.current = null;
    }

    pendingDragRef.current = null;
    setDraggingPoint(null);
  };

  const handlePointerDown =
    (key: "attackX" | "decayX" | "sustainY" | "releaseX") => (event: ReactPointerEvent<SVGCircleElement>) => {
      pendingDragRef.current = {
        key,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startClientX: event.clientX,
        startClientY: event.clientY,
      };
      graphRef.current?.setPointerCapture(event.pointerId);
    };

  const updateEnvelopeValue = (
    key: "attack" | "decay" | "sustain" | "release",
    value: number,
  ) => {
      const nextEnvelope = {
        attack: draftEnvelope.attack,
        decay: draftEnvelope.decay,
        sustain: draftEnvelope.sustain,
        release: draftEnvelope.release,
        [key]: value,
      };
      scheduleEnvelopeCommit(withGraph(nextEnvelope));
    };

  const handleReadoutPointerDown =
    (key: "attack" | "decay" | "sustain" | "release") => (event: ReactPointerEvent<HTMLSpanElement>) => {
      if (event.pointerType !== "touch") {
        return;
      }

      event.preventDefault();
      swipeRef.current = {
        key,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startValue: draftEnvelope[key],
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    };

  const handleReadoutPointerMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!swipeRef.current || swipeRef.current.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const deltaX = event.clientX - swipeRef.current.startClientX;
    const key = swipeRef.current.key;
    const maxValue =
      key === "attack" ? MAX_ATTACK : key === "decay" ? MAX_DECAY : key === "release" ? MAX_RELEASE : 1;
    const nextValue = clamp(swipeRef.current.startValue + (deltaX / 160) * maxValue, 0, maxValue);
    updateEnvelopeValue(key, nextValue);
  };

  const handleReadoutPointerUp = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!swipeRef.current || swipeRef.current.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    swipeRef.current = null;
  };

  return (
    <section className="panel synth-adsr-panel">
      <div className="section-header">
        <h2>ADSR</h2>
      </div>

      <svg
        ref={graphRef}
        className="envelope-graph"
        viewBox={`0 0 ${graphWidth} ${graphHeight}`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <polyline
          className="envelope-line"
          points={[
            `0,${guideBottom}`,
            `${pointX(graph.attackX)},${pointY(graph.attackY)}`,
            `${pointX(graph.decayX)},${pointY(graph.decayY)}`,
            `${pointX(graph.sustainX)},${pointY(graph.sustainY)}`,
            `${pointX(graph.releaseX)},${guideBottom}`,
          ].join(" ")}
        />

        <line className="envelope-guide" x1={pointX(graph.attackX)} x2={pointX(graph.attackX)} y1={guideTop} y2={guideBottom} />
        <line className="envelope-guide" x1={pointX(graph.decayX)} x2={pointX(graph.decayX)} y1={guideTop} y2={guideBottom} />
        <line className="envelope-guide" x1={pointX(graph.releaseX)} x2={pointX(graph.releaseX)} y1={guideTop} y2={guideBottom} />
        <line className="envelope-guide" x1={0} x2={graphWidth} y1={pointY(graph.sustainY)} y2={pointY(graph.sustainY)} />

        <line
          className="envelope-playhead"
          x1={envelopeProgress * graphWidth}
          x2={envelopeProgress * graphWidth}
          y1={guideTop}
          y2={guideBottom}
        />

        {points.map((point) => (
          <g key={point.key}>
            <circle
              className="envelope-handle-hit"
              cx={point.cx}
              cy={point.cy}
              r={16}
              onPointerDown={handlePointerDown(point.key)}
            />
            <circle
              className={`envelope-handle ${point.mode === "y" ? "is-vertical" : "is-horizontal"}`}
              cx={point.cx}
              cy={point.cy}
              r={8}
              onPointerDown={handlePointerDown(point.key)}
            />
          </g>
        ))}
      </svg>

      <div className="envelope-readout" aria-label="ADSR values">
        <div className="envelope-readout-row">
          <span className="envelope-readout-label">Attack</span>
          <span className="envelope-readout-value-cell">
            <span
              className="envelope-readout-value"
              onPointerDown={handleReadoutPointerDown("attack")}
              onPointerMove={handleReadoutPointerMove}
              onPointerUp={handleReadoutPointerUp}
              onPointerCancel={handleReadoutPointerUp}
            >
              {formatEnvelopeTime(draftEnvelope.attack)}
            </span>
          </span>
        </div>
        <div className="envelope-readout-row">
          <span className="envelope-readout-label">Delay</span>
          <span className="envelope-readout-value-cell">
            <span
              className="envelope-readout-value"
              onPointerDown={handleReadoutPointerDown("decay")}
              onPointerMove={handleReadoutPointerMove}
              onPointerUp={handleReadoutPointerUp}
              onPointerCancel={handleReadoutPointerUp}
            >
              {formatEnvelopeTime(draftEnvelope.decay)}
            </span>
          </span>
        </div>
        <div className="envelope-readout-row">
          <span className="envelope-readout-label">Sustain</span>
          <span className="envelope-readout-value-cell">
            <span
              className="envelope-readout-value"
              onPointerDown={handleReadoutPointerDown("sustain")}
              onPointerMove={handleReadoutPointerMove}
              onPointerUp={handleReadoutPointerUp}
              onPointerCancel={handleReadoutPointerUp}
            >
              {`${(draftEnvelope.sustain * 100).toFixed(1)} %`}
            </span>
          </span>
        </div>
        <div className="envelope-readout-row">
          <span className="envelope-readout-label">Release</span>
          <span className="envelope-readout-value-cell">
            <span
              className="envelope-readout-value"
              onPointerDown={handleReadoutPointerDown("release")}
              onPointerMove={handleReadoutPointerMove}
              onPointerUp={handleReadoutPointerUp}
              onPointerCancel={handleReadoutPointerUp}
            >
              {formatEnvelopeTime(draftEnvelope.release)}
            </span>
          </span>
        </div>
      </div>

    </section>
  );
}
