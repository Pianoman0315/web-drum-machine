import { useRef } from "react";

type PatternFilePanelProps = {
  onSave: () => void;
  onLoad: (file: File) => void;
};

export function PatternFilePanel({ onSave, onLoad }: PatternFilePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = "pattern-file-input";

  return (
    <section className="panel file-panel">
      <div className="section-header file-header">
        <h2>File</h2>
        <p>.drmpat save / load</p>
      </div>

      <div className="file-actions">
        <button type="button" className="file-button" onClick={onSave}>
          Save .drmpat
        </button>

        <label
          className="file-button file-input-button"
          htmlFor={inputId}
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }}
        >
          Load .drmpat
          <input
            id={inputId}
            ref={fileInputRef}
            type="file"
            accept=".drmpat,.json,application/json,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onLoad(file);
                event.target.value = "";
              }
            }}
          />
        </label>
      </div>
    </section>
  );
}
