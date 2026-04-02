type PatternFilePanelProps = {
  onSave: () => void;
  onLoad: (file: File) => void;
};

export function PatternFilePanel({ onSave, onLoad }: PatternFilePanelProps) {
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

        <label className="file-button file-input-button">
          Load .drmpat
          <input
            type="file"
            accept=".drmpat,application/json"
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
