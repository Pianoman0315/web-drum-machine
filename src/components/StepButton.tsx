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
      onClick={onToggle}
      aria-pressed={active}
      aria-label={`Step ${stepIndex + 1}`}
    />
  );
}
