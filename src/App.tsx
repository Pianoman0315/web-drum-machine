import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { createDefaultMutedTracks, createDefaultPattern } from "./data/defaultPattern";
import { ControlStrip } from "./components/ControlStrip";
import { PatternFilePanel } from "./components/PatternFilePanel";
import { SequencerGrid } from "./components/SequencerGrid";
import { MutedTracks, PatternFile } from "./types";
import { createPatternBlob, validatePatternFile } from "./utils/patternFileV2";
import { DrumAudioEngine } from "./services/audioEngine";

function App() {
  const [pattern, setPattern] = useState<PatternFile>(() => createDefaultPattern());
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [mutedTracks, setMutedTracks] = useState<MutedTracks>(() => createDefaultMutedTracks());
  const [statusMessage, setStatusMessage] = useState(
    "Play を押すとシーケンサーが始まります。",
  );

  const audioEngineRef = useRef<DrumAudioEngine | null>(null);
  const loopIdRef = useRef<number | null>(null);
  const patternRef = useRef(pattern);
  const mutedTracksRef = useRef(mutedTracks);

  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);

  useEffect(() => {
    mutedTracksRef.current = mutedTracks;
  }, [mutedTracks]);

  useEffect(() => {
    const audioEngine = audioEngineRef.current;
    if (!audioEngine) {
      return;
    }

    audioEngine.setBpm(pattern.bpm);
    audioEngine.setFilterTone(pattern.filter);
    audioEngine.setReverbMix(pattern.reverb);
    audioEngine.setMasterVolume(pattern.masterVolume);
  }, [pattern.bpm, pattern.filter, pattern.masterVolume, pattern.reverb]);

  useEffect(() => {
    return () => {
      if (loopIdRef.current !== null) {
        Tone.Transport.clear(loopIdRef.current);
      }
      audioEngineRef.current?.dispose();
    };
  }, []);

  const toggleStep = (trackIndex: number, stepIndex: number) => {
    setPattern((current) => ({
      ...current,
      tracks: current.tracks.map((track, currentTrackIndex) =>
        currentTrackIndex === trackIndex
          ? {
              ...track,
              steps: track.steps.map((step, currentStepIndex) =>
                currentStepIndex === stepIndex ? !step : step,
              ),
            }
          : track,
      ),
    }));
  };

  const ensureAudioEngine = async () => {
    if (!audioEngineRef.current) {
      audioEngineRef.current = new DrumAudioEngine();
    }

    const audioEngine = audioEngineRef.current;
    await audioEngine.startAudio();
    audioEngine.setBpm(patternRef.current.bpm);
    audioEngine.setFilterTone(patternRef.current.filter);
    audioEngine.setReverbMix(patternRef.current.reverb);
    audioEngine.setMasterVolume(patternRef.current.masterVolume);
    return audioEngine;
  };

  const previewTrack = async (trackIndex: number) => {
    try {
      const audioEngine = await ensureAudioEngine();
      const track = patternRef.current.tracks[trackIndex];
      if (track.name === "C-Hat") {
        audioEngine.stopTrack("O-Hat", Tone.now());
      }
      audioEngine.triggerTrack(track.name, Tone.now());
    } catch (error) {
      console.error("Track preview failed", error);
    }
  };

  const toggleMute = (trackIndex: number) => {
    const trackName = patternRef.current.tracks[trackIndex].name;
    setMutedTracks((current) => ({
      ...current,
      [trackName]: !current[trackName],
    }));
  };

  const startPlayback = async () => {
    try {
      const audioEngine = await ensureAudioEngine();

      if (loopIdRef.current !== null) {
        Tone.Transport.clear(loopIdRef.current);
      }

      let step = 0;
      loopIdRef.current = Tone.Transport.scheduleRepeat((time) => {
        setCurrentStep(step);

        const activeTracks = patternRef.current.tracks.filter(
          (track) => track.steps[step] && !mutedTracksRef.current[track.name],
        );
        const hasClosedHat = activeTracks.some((track) => track.name === "C-Hat");

        if (hasClosedHat) {
          audioEngine.stopTrack("O-Hat", time);
        }

        activeTracks.forEach((track) => {
          if (track.name === "O-Hat" && hasClosedHat) {
            return;
          }

          audioEngine.triggerTrack(track.name, time);
        });

        step = (step + 1) % 16;
      }, "16n");

      Tone.Transport.position = 0;
      Tone.Transport.start();
      setIsPlaying(true);
      setStatusMessage("再生中です。編集したステップは次のループから反映されます。");
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `音声の初期化に失敗しました: ${error.message}`
          : "音声の初期化に失敗しました。",
      );
    }
  };

  const stopPlayback = () => {
    Tone.Transport.stop();
    if (loopIdRef.current !== null) {
      Tone.Transport.clear(loopIdRef.current);
      loopIdRef.current = null;
    }
    setCurrentStep(-1);
    setIsPlaying(false);
    setStatusMessage("停止しました。");
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;

      if (
        (target instanceof HTMLInputElement && target.type !== "range") ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (event.code !== "Space" || event.repeat) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      if (isPlaying) {
        Tone.Transport.stop();
        if (loopIdRef.current !== null) {
          Tone.Transport.clear(loopIdRef.current);
          loopIdRef.current = null;
        }
        setCurrentStep(-1);
        setIsPlaying(false);
        return;
      }

      void startPlayback();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isPlaying]);

  const updatePattern = <K extends keyof PatternFile>(key: K, value: PatternFile[K]) => {
    setPattern((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const savePattern = () => {
    const blob = createPatternBlob({
      ...pattern,
      mutedTracks,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "pattern.drmpat";
    link.click();

    URL.revokeObjectURL(url);
    setStatusMessage(".drmpat ファイルを保存しました。");
  };

  const loadPattern = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const nextPattern = validatePatternFile(parsed);
      setPattern(nextPattern);
      setMutedTracks(nextPattern.mutedTracks);
      setStatusMessage(`${file.name} を読み込みました。`);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `読み込みに失敗しました: ${error.message}`
          : "読み込みに失敗しました。",
      );
    }
  };

  return (
    <main className="app-shell">
      <section className="top-bar">
        <div>
          <p className="eyebrow">Tablet Landscape Drum Machine</p>
          <h1>Web-Drum-Machine</h1>
        </div>
        <div className="status-box" aria-live="polite">
          {statusMessage}
        </div>
      </section>

      <section className="workspace-layout">
        <SequencerGrid
          tracks={pattern.tracks}
          currentStep={currentStep}
          mutedTracks={mutedTracks}
          onPreviewTrack={previewTrack}
          onToggleMute={toggleMute}
          onToggleStep={toggleStep}
        />

        <aside className="side-panel">
          <PatternFilePanel onSave={savePattern} onLoad={loadPattern} />
        </aside>
      </section>

      <ControlStrip
        isPlaying={isPlaying}
        bpm={pattern.bpm}
        filter={pattern.filter}
        reverb={pattern.reverb}
        masterVolume={pattern.masterVolume}
        onPlay={startPlayback}
        onStop={stopPlayback}
        onBpmChange={(value) => updatePattern("bpm", value)}
        onFilterChange={(value) => updatePattern("filter", value)}
        onReverbChange={(value) => updatePattern("reverb", value)}
        onMasterVolumeChange={(value) => updatePattern("masterVolume", value)}
      />
    </main>
  );
}

export default App;
