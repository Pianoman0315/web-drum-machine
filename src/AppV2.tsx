import { useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import { ControlStrip } from "./components/ControlStrip";
import { SaveLoadPanel } from "./components/SaveLoadPanel";
import { SequencerGrid } from "./components/SequencerGrid";
import { SpectrumPanel } from "./components/SpectrumPanel";
import { SynthAdsrPanel } from "./components/SynthAdsrPanel";
import { SynthLfoPanel } from "./components/SynthLfoPanel";
import { SynthPlayPad } from "./components/SynthPlayPad";
import { SynthSequencerGrid } from "./components/SynthSequencerGrid";
import { createDefaultProjectState, getScaleRows } from "./data/projectDefaults";
import { AppTab, ProjectState, SaveKind, SynthNoteRow, SynthSubTab } from "./types";
import { DrumAudioEngine } from "./services/audioEngine";
import { SynthAudioEngine } from "./services/synthEngine";
import { applyProjectFile, createProjectBlob, getProjectFileName, validateProjectFile } from "./utils/projectFileV2";

function AppV2() {
  const [project, setProject] = useState<ProjectState>(() => createDefaultProjectState());
  const [activeTab, setActiveTab] = useState<AppTab>("Drum");
  const [activeSynthTab, setActiveSynthTab] = useState<SynthSubTab>("Pattern");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [statusMessage, setStatusMessage] = useState("Version 2 ready.");
  const [envelopeProgress, setEnvelopeProgress] = useState(0);
  const [isSynthMuted, setIsSynthMuted] = useState(false);

  const playbackLoopRef = useRef<number | null>(null);
  const projectRef = useRef(project);
  const noteRowsRef = useRef<SynthNoteRow[]>([]);
  const drumEngineRef = useRef<DrumAudioEngine | null>(null);
  const synthEngineRef = useRef<SynthAudioEngine | null>(null);
  const envelopeAnimationRef = useRef<number | null>(null);
  const envelopeProgressRef = useRef(0);

  const noteRows = useMemo(() => getScaleRows(), []);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    noteRowsRef.current = noteRows;
  }, [noteRows]);

  useEffect(() => {
    const drumEngine = drumEngineRef.current;
    const synthEngine = synthEngineRef.current;

    if (drumEngine) {
      drumEngine.setBpm(project.global.bpm);
      drumEngine.setFilterTone(project.global.filter);
      drumEngine.setReverbMix(project.global.reverb);
      drumEngine.setMasterVolume(project.global.masterVolume);
    }

    if (synthEngine) {
      synthEngine.setFilterTone(project.global.filter);
      synthEngine.setReverbMix(project.global.reverb);
      synthEngine.setMasterVolume(project.global.masterVolume);
      synthEngine.setMuted(isSynthMuted);
      synthEngine.setEnvelope(project.synth.envelope);
      synthEngine.setLfo(project.synth.lfo);
    }
  }, [project, isSynthMuted]);

  useEffect(() => {
    return () => {
      if (playbackLoopRef.current !== null) {
        Tone.Transport.clear(playbackLoopRef.current);
      }
      if (envelopeAnimationRef.current !== null) {
        cancelAnimationFrame(envelopeAnimationRef.current);
      }
      drumEngineRef.current?.dispose();
      synthEngineRef.current?.dispose();
    };
  }, []);

  const getEnvelopeGraph = () => {
    const envelope = projectRef.current.synth.envelope;
    const maxAttack = 0.9;
    const maxDecay = 1.1;
    const maxRelease = 1.35;
    const attackSpan = 0.22;
    const decaySpan = 0.28;
    const releaseSpan = 0.3;
    const attackX = Math.min(attackSpan, (envelope.attack / maxAttack) * attackSpan);
    const decayX = Math.min(attackX + decaySpan, attackX + (envelope.decay / maxDecay) * decaySpan);
    const releaseX = Math.min(decayX + releaseSpan, decayX + (envelope.release / maxRelease) * releaseSpan);

    return {
      attackX,
      decayX,
      sustainX: (decayX + releaseX) / 2,
      releaseX,
    };
  };

  const setEnvelopePlayhead = (progress: number) => {
    envelopeProgressRef.current = progress;
    setEnvelopeProgress(progress);
  };

  const getEnvelopeProgressAt = (elapsedSeconds: number, releaseStartSeconds: number) => {
    const envelope = projectRef.current.synth.envelope;
    const graph = getEnvelopeGraph();
    const attackSeconds = Math.max(0.001, envelope.attack);
    const decaySeconds = Math.max(0.001, envelope.decay);
    const decayEndSeconds = attackSeconds + decaySeconds;

    if (elapsedSeconds <= attackSeconds) {
      return (elapsedSeconds / attackSeconds) * graph.attackX;
    }

    if (elapsedSeconds <= decayEndSeconds && elapsedSeconds < releaseStartSeconds) {
      const decayProgress = (elapsedSeconds - attackSeconds) / decaySeconds;
      return graph.attackX + decayProgress * (graph.decayX - graph.attackX);
    }

    return graph.sustainX;
  };

  const runEnvelopeReleaseAnimation = (fromProgress = envelopeProgressRef.current) => {
    if (envelopeAnimationRef.current !== null) {
      cancelAnimationFrame(envelopeAnimationRef.current);
    }

    const envelope = projectRef.current.synth.envelope;
    const graph = getEnvelopeGraph();
    const releaseSeconds = Math.max(0.01, envelope.release);
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsedSeconds = (now - startTime) / 1000;
      const releaseProgress = Math.min(1, elapsedSeconds / releaseSeconds);
      const progress = fromProgress + releaseProgress * (graph.releaseX - fromProgress);

      setEnvelopePlayhead(progress);
      if (releaseProgress < 1) {
        envelopeAnimationRef.current = requestAnimationFrame(animate);
      }
    };

    setEnvelopePlayhead(fromProgress);
    envelopeAnimationRef.current = requestAnimationFrame(animate);
  };

  const runEnvelopeAnimation = (releaseStartSeconds = 0.12) => {
    if (envelopeAnimationRef.current !== null) {
      cancelAnimationFrame(envelopeAnimationRef.current);
    }

    const envelope = projectRef.current.synth.envelope;
    const graph = getEnvelopeGraph();
    const safeReleaseStartSeconds = Math.max(0.001, releaseStartSeconds);
    const releaseSeconds = Math.max(0.01, envelope.release);
    const totalSeconds = Number.isFinite(safeReleaseStartSeconds)
      ? safeReleaseStartSeconds + releaseSeconds
      : Number.POSITIVE_INFINITY;
    const startTime = performance.now();
    const releaseStartProgress = getEnvelopeProgressAt(safeReleaseStartSeconds, safeReleaseStartSeconds);

    const animate = (now: number) => {
      const elapsedSeconds = (now - startTime) / 1000;

      if (elapsedSeconds < safeReleaseStartSeconds) {
        setEnvelopePlayhead(getEnvelopeProgressAt(elapsedSeconds, safeReleaseStartSeconds));
      } else if (Number.isFinite(safeReleaseStartSeconds)) {
        const releaseProgress = Math.min(1, (elapsedSeconds - safeReleaseStartSeconds) / releaseSeconds);
        setEnvelopePlayhead(releaseStartProgress + releaseProgress * (graph.releaseX - releaseStartProgress));
      } else {
        setEnvelopePlayhead(graph.sustainX);
      }

      if (elapsedSeconds < totalSeconds) {
        envelopeAnimationRef.current = requestAnimationFrame(animate);
      }
    };

    setEnvelopePlayhead(0);
    envelopeAnimationRef.current = requestAnimationFrame(animate);
  };

  const ensureDrumEngine = async () => {
    if (!drumEngineRef.current) {
      drumEngineRef.current = new DrumAudioEngine();
    }

    const engine = drumEngineRef.current;
    await engine.startAudio();
    engine.setBpm(projectRef.current.global.bpm);
    engine.setFilterTone(projectRef.current.global.filter);
    engine.setReverbMix(projectRef.current.global.reverb);
    engine.setMasterVolume(projectRef.current.global.masterVolume);
    return engine;
  };

  const ensureSynthEngine = async () => {
    if (!synthEngineRef.current) {
      synthEngineRef.current = new SynthAudioEngine();
    }

    const engine = synthEngineRef.current;
    await engine.initialize();
    engine.setEnvelope(projectRef.current.synth.envelope);
    engine.setLfo(projectRef.current.synth.lfo);
    engine.setFilterTone(projectRef.current.global.filter);
    engine.setReverbMix(projectRef.current.global.reverb);
    engine.setMasterVolume(projectRef.current.global.masterVolume);
    engine.setMuted(isSynthMuted);
    return engine;
  };

  const ensureAudioEngines = async () => {
    const [drumEngine, synthEngine] = await Promise.all([ensureDrumEngine(), ensureSynthEngine()]);
    return { drumEngine, synthEngine };
  };

  const stopPlayback = () => {
    Tone.Transport.stop();
    if (playbackLoopRef.current !== null) {
      Tone.Transport.clear(playbackLoopRef.current);
      playbackLoopRef.current = null;
    }

    if (envelopeAnimationRef.current !== null) {
      cancelAnimationFrame(envelopeAnimationRef.current);
      envelopeAnimationRef.current = null;
    }

    synthEngineRef.current?.stopPad();
    setCurrentStep(-1);
    setIsPlaying(false);
    setEnvelopePlayhead(0);
    setStatusMessage("Stopped.");
  };

  const startPlayback = async () => {
    try {
      if (Tone.Transport.state === "started") {
        return;
      }

      const { drumEngine, synthEngine } = await ensureAudioEngines();
      if (playbackLoopRef.current !== null) {
        Tone.Transport.clear(playbackLoopRef.current);
      }

      let step = 0;
      playbackLoopRef.current = Tone.Transport.scheduleRepeat((time) => {
        setCurrentStep(step);

        const activeDrumTracks = projectRef.current.drum.tracks.filter(
          (track) => track.steps[step] && !projectRef.current.drum.mutedTracks[track.name],
        );
        const accentActive = activeDrumTracks.some((track) => track.name === "Accent");
        const drumTracks = activeDrumTracks.filter((track) => track.name !== "Accent");
        const hasClosedHat = drumTracks.some((track) => track.name === "C-Hat");

        if (hasClosedHat) {
          drumEngine.stopTrack("O-Hat", time);
        }

        drumTracks.forEach((track) => {
          if (track.name === "O-Hat" && hasClosedHat) {
            return;
          }
          drumEngine.triggerTrack(track.name, time, accentActive);
        });

        const synthStep = projectRef.current.synth.steps[step];
        if (synthStep.rowId) {
          const row = noteRowsRef.current.find((candidate) => candidate.id === synthStep.rowId);
          if (row) {
            synthEngine.triggerStep(row.midi, time, synthStep.length);
            runEnvelopeAnimation(Tone.Time("16n").toSeconds() * synthStep.length);
          }
        }

        step = (step + 1) % 16;
      }, "16n");

      Tone.Transport.bpm.rampTo(projectRef.current.global.bpm, 0.05);
      Tone.Transport.position = 0;
      Tone.Transport.start();
      setIsPlaying(true);
      setStatusMessage("Playing.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Audio start failed.");
    }
  };

  const toggleDrumStep = (trackIndex: number, stepIndex: number) => {
    setProject((current) => ({
      ...current,
      drum: {
        ...current.drum,
        tracks: current.drum.tracks.map((track, currentTrackIndex) =>
          currentTrackIndex === trackIndex
            ? {
                ...track,
                steps: track.steps.map((step, currentStepIndex) =>
                  currentStepIndex === stepIndex ? !step : step,
                ),
              }
            : track,
        ),
      },
    }));
  };

  const previewDrumTrack = async (trackIndex: number) => {
    try {
      const engine = await ensureDrumEngine();
      const track = projectRef.current.drum.tracks[trackIndex];
      if (track.name === "Accent") {
        setStatusMessage("Accent boosts the volume of other drum hits on active steps.");
        return;
      }

      engine.previewTrack(track.name);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Track preview failed.");
    }
  };

  const toggleDrumMute = (trackIndex: number) => {
    const trackName = projectRef.current.drum.tracks[trackIndex].name;
    setProject((current) => ({
      ...current,
      drum: {
        ...current.drum,
        mutedTracks: {
          ...current.drum.mutedTracks,
          [trackName]: !current.drum.mutedTracks[trackName],
        },
      },
    }));
  };

  const startSynthRowPreview = async (row: SynthNoteRow) => {
    try {
      const engine = await ensureSynthEngine();
      engine.startNotePreview(row.midi, projectRef.current.synth.lfo);
      runEnvelopeAnimation(Number.POSITIVE_INFINITY);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Synth preview failed.");
    }
  };

  const stopSynthRowPreview = () => {
    synthEngineRef.current?.stopNotePreview();
    runEnvelopeReleaseAnimation();
  };

  const withNormalizedSynthSteps = (steps: ProjectState["synth"]["steps"]) => {
    const normalized: ProjectState["synth"]["steps"] = Array.from({ length: steps.length }, () => ({
      rowId: null,
      length: 1,
    }));

    steps.forEach((step, index) => {
      if (!step.rowId) {
        return;
      }

      normalized[index] = {
        rowId: step.rowId,
        length: Math.max(1, Math.min(steps.length - index, step.length || 1)),
      };
    });

    return normalized;
  };

  const insertSynthSpan = (
    steps: ProjectState["synth"]["steps"],
    rowId: string,
    startIndex: number,
    length: number,
  ) => {
    const normalized = withNormalizedSynthSteps(steps);
    const endIndex = startIndex + length - 1;
    const segments: Array<{ rowId: string; startIndex: number; length: number }> = [];

    normalized.forEach((step, index) => {
      if (!step.rowId) {
        return;
      }

      const segmentEnd = index + step.length - 1;
      if (segmentEnd < startIndex || index > endIndex) {
        segments.push({ rowId: step.rowId, startIndex: index, length: step.length });
        return;
      }

      if (index < startIndex) {
        segments.push({
          rowId: step.rowId,
          startIndex: index,
          length: startIndex - index,
        });
      }

      if (segmentEnd > endIndex) {
        segments.push({
          rowId: step.rowId,
          startIndex: endIndex + 1,
          length: segmentEnd - endIndex,
        });
      }
    });

    segments.push({ rowId, startIndex, length });
    segments.sort((left, right) => left.startIndex - right.startIndex);

    const nextSteps: ProjectState["synth"]["steps"] = Array.from({ length: steps.length }, () => ({
      rowId: null,
      length: 1,
    }));
    segments.forEach((segment) => {
      nextSteps[segment.startIndex] = {
        rowId: segment.rowId,
        length: Math.max(1, Math.min(steps.length - segment.startIndex, segment.length)),
      };
    });

    return nextSteps;
  };

  const setSynthStepSpan = (stepIndex: number, rowId: string, length: number) => {
    const clampedLength = Math.max(1, Math.min(16 - stepIndex, length));
    setProject((current) => ({
      ...current,
      synth: {
        ...current.synth,
        steps: insertSynthSpan(current.synth.steps, rowId, stepIndex, clampedLength),
      },
    }));
  };

  const clearSynthStep = (stepIndex: number) => {
    setProject((current) => {
      const targetStep = current.synth.steps[stepIndex];
      let startIndex = stepIndex;

      if (targetStep.rowId === null) {
        for (let index = stepIndex - 1; index >= 0; index -= 1) {
          const candidate = current.synth.steps[index];
          if (candidate.rowId === null) {
            continue;
          }

          const candidateEnd = index + Math.max(1, candidate.length || 1) - 1;
          if (candidateEnd >= stepIndex) {
            startIndex = index;
            break;
          }
        }
      }

      return {
        ...current,
        synth: {
          ...current.synth,
          steps: current.synth.steps.map((step, currentStepIndex) =>
            currentStepIndex === startIndex
              ? {
                  rowId: null,
                  length: 1,
                }
              : step,
          ),
        },
      };
    });
  };

  const readFileAsText = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        resolve(result.replace(/^\uFEFF/, ""));
      };
      reader.onerror = () => reject(new Error("Could not read the selected file."));
      reader.readAsText(file);
    });

  const updateGlobal = <K extends keyof ProjectState["global"]>(key: K, value: ProjectState["global"][K]) => {
    setProject((current) => ({
      ...current,
      global: {
        ...current.global,
        [key]: value,
      },
    }));
  };

  const updateSynth = <K extends keyof ProjectState["synth"]>(key: K, value: ProjectState["synth"][K]) => {
    setProject((current) => ({
      ...current,
      synth: {
        ...current.synth,
        [key]: value,
      },
    }));
  };

  const handleSave = (kind: SaveKind) => {
    const blob = createProjectBlob(projectRef.current, kind);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getProjectFileName(kind);
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage(`Saved ${kind} data.`);
  };

  const handleLoad = async (file: File) => {
    try {
      const text = await readFileAsText(file);
      const parsed = JSON.parse(text) as unknown;
      const loaded = validateProjectFile(parsed);
      const nextProject = applyProjectFile(projectRef.current, loaded);
      stopPlayback();
      projectRef.current = nextProject;
      setProject(nextProject);
      setStatusMessage(`Loaded ${file.name}.`);
      void ensureAudioEngines().catch((warmupError) => {
        console.warn("Audio warm-up after loading failed.", warmupError);
      });
      window.alert(`${file.name} loaded.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load file.";
      setStatusMessage(message);
      window.alert(message);
    }
  };

  const handlePadStart = async (frequency: number, brightness: number) => {
    const engine = await ensureSynthEngine();
    engine.startPad(frequency, brightness);
    runEnvelopeAnimation(Number.POSITIVE_INFINITY);
  };

  const handlePadMove = async (frequency: number, brightness: number) => {
    const engine = await ensureSynthEngine();
    engine.movePad(frequency, brightness);
  };

  const handlePadEnd = () => {
    synthEngineRef.current?.stopPad();
    runEnvelopeReleaseAnimation();
  };

  const handleLfoPreviewStart = async () => {
    try {
      const engine = await ensureSynthEngine();
      engine.startLfoPreview(projectRef.current.synth.lfo, 440);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "LFO preview failed.");
    }
  };

  const handleLfoPreviewStop = () => {
    synthEngineRef.current?.stopLfoPreview();
  };

  const handleLfoPreviewChange = (lfo: ProjectState["synth"]["lfo"]) => {
    synthEngineRef.current?.setLfo(lfo);
    synthEngineRef.current?.updateLfoPreview(lfo);
  };

  useEffect(() => {
    const shouldHandleGlobalSpace = (event: KeyboardEvent) => {
      return event.code === "Space";
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!shouldHandleGlobalSpace(event) || event.repeat) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      if (isPlaying) {
        stopPlayback();
        return;
      }

      void startPlayback();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!shouldHandleGlobalSpace(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [isPlaying]);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    window.addEventListener("contextmenu", handleContextMenu, true);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu, true);
    };
  }, []);

  const saveActions = [
    { kind: "synth" as const, label: "Save Synth" },
    { kind: "drum" as const, label: "Save Drum" },
    { kind: "full" as const, label: "Save Full" },
  ];

  const fileTone = activeTab === "Synth" ? "synth" : "drum";
  const fileSaveActions =
    activeTab === "Drum"
      ? ([
          { kind: "drum" as const, label: "Save Drum" },
          { kind: "full" as const, label: "Save Full" },
        ] satisfies typeof saveActions)
      : ([
          { kind: "synth" as const, label: "Save Synth" },
          { kind: "full" as const, label: "Save Full" },
        ] satisfies typeof saveActions);

  const renderSynthSubtabs = () => (
    <div className="pattern-subtabs">
      {(["Pattern", "Pad"] as SynthSubTab[]).map((tab) => (
        <button
          key={tab}
          type="button"
          className={`pattern-subtab-button ${activeSynthTab === tab ? "is-active" : ""}`}
          onClick={() => setActiveSynthTab(tab)}
        >
          {tab}
        </button>
      ))}
      <button
        type="button"
        className={`pattern-subtab-button synth-mute-tab-button ${isSynthMuted ? "is-muted" : ""}`}
        aria-pressed={isSynthMuted}
        aria-label="Mute Synth"
        onClick={() => setIsSynthMuted((current) => !current)}
      >
        M
      </button>
    </div>
  );

  const renderTopLeftFrame = () => {
    if (activeTab === "Drum") {
      return (
        <SequencerGrid
          className="studio-span-rows drum-pattern-panel"
          tracks={project.drum.tracks}
          currentStep={currentStep}
          mutedTracks={project.drum.mutedTracks}
          onPreviewTrack={previewDrumTrack}
          onToggleMute={toggleDrumMute}
          onToggleStep={toggleDrumStep}
        />
      );
    }

    return activeSynthTab === "Pattern" ? (
      <section className="panel synth-sequencer-panel studio-span-rows synth-main-panel">
        <div className="section-header synth-main-header">
          {renderSynthSubtabs()}
        </div>

        <SynthSequencerGrid
          embedded
          synth={project.synth}
          rows={noteRows}
          currentStep={currentStep}
          onSetStepSpan={setSynthStepSpan}
          onClearStep={clearSynthStep}
          onPreviewRowStart={startSynthRowPreview}
          onPreviewRowEnd={stopSynthRowPreview}
        />
      </section>
    ) : (
      <section className="panel synth-play-panel studio-span-rows synth-main-panel">
        <div className="section-header synth-main-header">
          {renderSynthSubtabs()}
        </div>

        <SynthPlayPad embedded rows={noteRows} onStart={handlePadStart} onMove={handlePadMove} onEnd={handlePadEnd} />
      </section>
    );
  };

  const renderTopRightFrame = () => {
    if (activeTab === "Drum") {
      return (
        <section className="panel studio-frame spectrum-frame">
          <div className="section-header">
            <h2>Spectrum</h2>
          </div>
          <div className="spectrum-frame-body">
            <SpectrumPanel getValues={() => drumEngineRef.current?.getSpectrumValues() ?? []} />
          </div>
        </section>
      );
    }

    return (
      <SynthAdsrPanel
        envelope={project.synth.envelope}
        envelopeProgress={envelopeProgress}
        onEnvelopeChange={(envelope) => updateSynth("envelope", envelope)}
      />
    );
  };

  const renderMainLeftFrame = () => {
    if (activeTab === "Drum") {
      return null;
    }
    return null;
  };

  const renderMainRightFrame = () => {
    if (activeTab === "Drum") {
      return (
        <section className="panel studio-frame empty-frame">
          <div className="placeholder-frame-body is-empty">
            <p />
          </div>
        </section>
      );
    }

    return (
      <SynthLfoPanel
        lfo={project.synth.lfo}
        onLfoChange={(lfo) => updateSynth("lfo", lfo)}
        onPreviewChange={handleLfoPreviewChange}
        onPreviewStart={() => void handleLfoPreviewStart()}
        onPreviewStop={handleLfoPreviewStop}
      />
    );
  };

  return (
    <main className="app-shell">
      <section className="top-bar">
        <div className="title-stack">
          <h1>Web-Drum-Machine</h1>
          <div className="top-tabs">
            {(["Drum", "Synth"] as AppTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`app-tab-button ${activeTab === tab ? "is-active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section
        className={`studio-layout ${activeTab === "Drum" ? "is-drum" : "is-synth"}${activeTab === "Synth" && activeSynthTab === "Pad" ? " is-synth-pad" : ""}`}
      >
        <div
          className={`studio-main-grid ${activeTab === "Drum" ? "is-drum" : "is-synth"}${activeTab === "Synth" && activeSynthTab === "Pad" ? " is-synth-pad" : ""}`}
        >
          {renderTopLeftFrame()}
          {renderTopRightFrame()}
          {renderMainLeftFrame()}
          {renderMainRightFrame()}
        </div>

        <div className="studio-bottom-grid">
          <ControlStrip
            isPlaying={isPlaying}
            bpm={project.global.bpm}
            filter={project.global.filter}
            reverb={project.global.reverb}
            masterVolume={project.global.masterVolume}
            onPlay={() => void startPlayback()}
            onStop={stopPlayback}
            onBpmChange={(value) => updateGlobal("bpm", value)}
            onFilterChange={(value) => updateGlobal("filter", value)}
            onReverbChange={(value) => updateGlobal("reverb", value)}
            onMasterVolumeChange={(value) => updateGlobal("masterVolume", value)}
          />

          <aside className="side-panel">
            <SaveLoadPanel
            title="File"
            subtitle="version 2 project save / load"
            saveActions={fileSaveActions}
            onSave={handleSave}
            onLoad={handleLoad}
            tone={fileTone}
            />
          </aside>
        </div>
      </section>

      <p className="app-credit">by Haruki Nakao</p>
      <p className="status-copy" aria-live="polite">
        {statusMessage}
      </p>
    </main>
  );
}

export default AppV2;
