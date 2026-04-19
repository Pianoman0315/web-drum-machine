import { useRef } from "react";
import { SaveKind } from "../types";

type SaveAction = {
  kind: SaveKind;
  label: string;
};

type SaveLoadPanelProps = {
  title?: string;
  subtitle?: string;
  saveActions: SaveAction[];
  onSave: (kind: SaveKind) => void;
  onLoad: (file: File) => void;
  tone?: "drum" | "synth";
};

export function SaveLoadPanel({
  title = "File",
  subtitle = "version 2 save / load",
  saveActions,
  onSave,
  onLoad,
  tone = "drum",
}: SaveLoadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = `file-panel-input-${tone}`;

  return (
    <section className={`panel file-panel ${tone === "synth" ? "synth-file-panel" : ""}`}>
      <div className="section-header file-header">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      <div className="file-actions">
        {saveActions.map((action) => (
          <button
            key={action.kind}
            type="button"
            className={`file-button ${tone === "synth" ? "is-synth" : ""}`}
            onClick={() => onSave(action.kind)}
          >
            {action.label}
          </button>
        ))}

        <button
          type="button"
          className={`file-button file-input-button ${tone === "synth" ? "is-synth" : ""}`}
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
              fileInputRef.current.click();
            }
          }}
        >
          Load
        </button>

        <input
          id={inputId}
          ref={fileInputRef}
          className="file-input-native"
          type="file"
          onClick={(event) => {
            event.stopPropagation();
          }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onLoad(file);
            }
          }}
        />
      </div>
    </section>
  );
}
