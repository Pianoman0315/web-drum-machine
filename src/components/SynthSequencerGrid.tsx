import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { SynthNoteRow, SynthState } from "../types";

type SynthSequencerGridProps = {
  embedded?: boolean;
  synth: SynthState;
  rows: SynthNoteRow[];
  currentStep: number;
  onSetStepSpan: (stepIndex: number, rowId: string, length: number) => void;
  onClearStep: (stepIndex: number) => void;
  onPreviewRowStart: (row: SynthNoteRow) => void;
  onPreviewRowEnd: () => void;
};

type TouchButtonProps = {
  className: string;
  onPressStart: () => void;
  onPressEnd: () => void;
  children?: ReactNode;
  ariaPressed?: boolean;
};

function TouchButton({ className, onPressStart, onPressEnd, children, ariaPressed }: TouchButtonProps) {
  const activePointerRef = useRef<number | null>(null);

  const finishPress = (pointerId?: number) => {
    if (activePointerRef.current === null) {
      return;
    }

    if (pointerId !== undefined && activePointerRef.current !== pointerId) {
      return;
    }

    activePointerRef.current = null;
    onPressEnd();
  };

  return (
    <button
      type="button"
      className={className}
      onPointerDown={(event) => {
        if (event.button !== 0 && event.pointerType === "mouse") {
          return;
        }

        if (activePointerRef.current !== null) {
          return;
        }

        if (event.pointerType === "touch" || event.pointerType === "pen") {
          const rect = event.currentTarget.getBoundingClientRect();
          const offsetX = event.clientX - rect.left;
          const offsetY = event.clientY - rect.top;
          const isStepButton = className.includes("step-button");
          const safeInsetX = isStepButton ? 3 : 6;
          const safeInsetY = isStepButton ? 3 : 4;
          if (
            offsetX < safeInsetX ||
            offsetX > rect.width - safeInsetX ||
            offsetY < safeInsetY ||
            offsetY > rect.height - safeInsetY
          ) {
            event.preventDefault();
            return;
          }
        }

        activePointerRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
        onPressStart();
      }}
      onPointerUp={(event) => {
        event.preventDefault();
        finishPress(event.pointerId);
      }}
      onPointerCancel={(event) => {
        finishPress(event.pointerId);
      }}
      onLostPointerCapture={(event) => {
        finishPress(event.pointerId);
      }}
      aria-pressed={ariaPressed}
    >
      {children}
    </button>
  );
}

export function SynthSequencerGrid({
  embedded = false,
  synth,
  rows,
  currentStep,
  onSetStepSpan,
  onClearStep,
  onPreviewRowStart,
  onPreviewRowEnd,
}: SynthSequencerGridProps) {
  const [dragState, setDragState] = useState<{
    rowId: string;
    startIndex: number;
    currentIndex: number;
    pointerId: number;
    mode: "create" | "clear";
  } | null>(null);
  const dragStateRef = useRef<typeof dragState>(null);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  const occupancy = useMemo(() => {
    const map = new Map<string, { startIndex: number; spanLength: number; isStart: boolean }>();

    rows.forEach((row) => {
      synth.steps.forEach((step, stepIndex) => {
        if (step.rowId !== row.id) {
          return;
        }

        const spanLength = Math.max(1, step.length || 1);
        for (let offset = 0; offset < spanLength && stepIndex + offset < synth.steps.length; offset += 1) {
          map.set(`${row.id}-${stepIndex + offset}`, {
            startIndex: stepIndex,
            spanLength,
            isStart: offset === 0,
          });
        }
      });
    });

    return map;
  }, [rows, synth.steps]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

      const handlePointerMove = (event: PointerEvent) => {
        const current = dragStateRef.current;
        if (!current || current.pointerId !== event.pointerId || current.mode !== "create") {
          return;
        }

        event.preventDefault();
        const target = document.elementFromPoint(event.clientX, event.clientY);
      const stepButton = target instanceof HTMLElement ? target.closest<HTMLElement>("[data-synth-step-button='true']") : null;
      if (!stepButton || stepButton.dataset.rowId !== current.rowId) {
        return;
      }

      const nextIndex = Number(stepButton.dataset.stepIndex);
      if (Number.isNaN(nextIndex) || nextIndex < current.startIndex) {
        return;
      }

      setDragState((active) => (active ? { ...active, currentIndex: nextIndex } : active));
    };

    const handlePointerEnd = (event: PointerEvent) => {
      const current = dragStateRef.current;
      if (!current || current.pointerId !== event.pointerId) {
        return;
      }

      if (current.mode === "clear") {
        onClearStep(current.startIndex);
      } else {
        onSetStepSpan(current.startIndex, current.rowId, current.currentIndex - current.startIndex + 1);
      }

      setDragState(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [dragState, onClearStep, onSetStepSpan]);

  return (
    <section className={embedded ? "synth-sequencer-body" : "panel synth-sequencer-panel"}>
      {!embedded ? (
        <div className="section-header">
          <h2>Pattern</h2>
        </div>
      ) : null}

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

      <div className="track-list synth-note-grid">
        {rows.map((row) => (
          <div key={row.id} className="track-row synth-track-row">
            <div className="track-controls synth-track-controls">
              <TouchButton
                className={`track-name-button synth-note-button ${row.isLowerOctave ? "is-lower-octave" : ""}`.trim()}
                onPressStart={() => onPreviewRowStart(row)}
                onPressEnd={onPreviewRowEnd}
              >
                {row.label}
              </TouchButton>
            </div>

            <div className="step-grid" role="group" aria-label={`${row.label} note pattern`}>
              {synth.steps.map((_, stepIndex) => {
                const occupied = occupancy.get(`${row.id}-${stepIndex}`);
                const isDragRow = dragState?.rowId === row.id;
                const isDragCovered =
                  dragState &&
                  isDragRow &&
                  dragState.mode === "create" &&
                  stepIndex >= dragState.startIndex &&
                  stepIndex <= dragState.currentIndex;
                const spanLength =
                  dragState &&
                  isDragRow &&
                  dragState.mode === "create" &&
                  stepIndex === dragState.startIndex
                    ? dragState.currentIndex - dragState.startIndex + 1
                    : occupied?.spanLength ?? 1;
                const spanEndIndex = stepIndex + spanLength - 1;
                const extraGroupGaps = Math.floor(spanEndIndex / 4) - Math.floor(stepIndex / 4);
                const active = Boolean(occupied || isDragCovered);
                const currentInsideSpan =
                  currentStep >= stepIndex &&
                  currentStep <= (occupied?.startIndex === stepIndex || isDragCovered ? spanEndIndex : stepIndex);

                if (occupied && !occupied.isStart) {
                  return <div key={`${row.id}-${stepIndex}`} className="synth-step-slot step-span-placeholder" aria-hidden="true" />;
                }

                return (
                  <div key={`${row.id}-${stepIndex}`} className="synth-step-slot">
                    <button
                      type="button"
                      className={[
                        "step-button",
                        occupied?.isStart || isDragCovered ? "is-span-start" : "",
                        isDragCovered ? "is-drag-preview" : "",
                        active ? "is-active" : "",
                        currentInsideSpan ? "is-current" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={
                        occupied?.isStart || isDragCovered
                          ? ({
                              "--span": spanLength,
                              "--extra-group-gaps": extraGroupGaps,
                            } as CSSProperties)
                          : undefined
                      }
                      data-synth-step-button="true"
                      data-row-id={row.id}
                      data-step-index={stepIndex}
                      onPointerDown={(event) => {
                        if (event.button !== 0 && event.pointerType === "mouse") {
                          return;
                        }

                        if (occupied) {
                          setDragState({
                            rowId: row.id,
                            startIndex: occupied.startIndex,
                            currentIndex: occupied.startIndex,
                            pointerId: event.pointerId,
                            mode: "clear",
                          });
                          event.currentTarget.setPointerCapture(event.pointerId);
                          event.preventDefault();
                          return;
                        }

                        setDragState({
                          rowId: row.id,
                          startIndex: stepIndex,
                          currentIndex: stepIndex,
                          pointerId: event.pointerId,
                          mode: "create",
                        });
                        event.currentTarget.setPointerCapture(event.pointerId);
                        event.preventDefault();
                      }}
                      aria-pressed={active}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
