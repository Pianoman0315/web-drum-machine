import { useRef } from "react";

type StepButtonProps = {
  active: boolean;
  isCurrentStep: boolean;
  stepIndex: number;
  onToggle: () => void;
};

export function StepButton({
  active,
  isCurrentStep,
  stepIndex,
  onToggle,
}: StepButtonProps) {
  const skipClickRef = useRef(false);

  return (
    <button
      type="button"
      className={[
        "step-button",
        active ? "is-active" : "",
        isCurrentStep ? "is-current" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onPointerDown={(event) => {
        if (event.pointerType === "touch" || event.pointerType === "pen") {
          const rect = event.currentTarget.getBoundingClientRect();
          const offsetX = event.clientX - rect.left;
          const offsetY = event.clientY - rect.top;
          const safeInsetX = 3;
          const safeInsetY = 3;
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
          onToggle();
        }
      }}
      onClick={() => {
        if (skipClickRef.current) {
          skipClickRef.current = false;
          return;
        }

        onToggle();
      }}
      aria-pressed={active}
      aria-label={`Step ${stepIndex + 1}`}
    />
  );
}
