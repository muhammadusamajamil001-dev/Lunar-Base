import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArtifactArchiveModal } from './components/ArtifactArchiveModal';
import { GameHud } from './components/GameHud';
import { LunarEngine } from './engine/LunarEngine';
import { getArchiveArtifacts } from './engine/lunarSurfaceObjects';
import { GameMode, HudSnapshot } from './types/game';

const INITIAL_HUD: HudSnapshot = {
  oxygen: 92,
  energy: 88,
  pressureKpa: 101,
  cabinTempC: 21,
  solarState: 'interior',
  powerDeltaPerSec: -0.1,
  frostLevel: 0,
  sectorName: 'OBSERVATION DECK',
  viewMode: 'first',
  lightingPreset: 'nominal',
  pointerLocked: false,
  nearbyTerminal: null,
  statusBanner: null,
  narrativeStage: 'alarm',
  finaleActive: false,
  finalePhase: 'none',
  finaleElapsed: 0,
  transmissionOpen: false,
  studyTerminalOpen: false,
  sortieBriefed: false,
  activeTargetIndex: 0,
  activeTarget: null,
  baseReturnDistanceMeters: 0,
  baseReturnBearingDeg: 0,
  environmentZone: 'interior',
  controlMode: 'foot',
  artifactsCollected: 0,
  artifactsTotal: 10,
  artifacts: [],
  nearbyArtifact: null,
  inspectedArtifact: null,
  canBoardRover: false,
  canUseAirlock: false,
  roverSpeedKmh: 0,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<LunarEngine | null>(null);

  const [mode, setMode] = useState<GameMode>('title');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [dockExpanded, setDockExpanded] = useState(true);
  const [manifestOpen, setManifestOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const archiveArtifacts = useMemo(
    () => (hud.artifacts.length > 0 ? hud.artifacts : getArchiveArtifacts()),
    [hud.artifacts],
  );

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new LunarEngine(mount, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onModeChange: (nextMode) => setMode(nextMode),
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      engineRef.current?.setMuted(next);
      return next;
    });
  }, []);

  useEffect(() => {
    engineRef.current?.setRenderingPaused(archiveOpen);
  }, [archiveOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || archiveOpen) return;
      if (e.code === 'KeyH' && mode === 'playing') {
        setDockExpanded((prev) => !prev);
      } else if (e.code === 'KeyM') {
        handleToggleMute();
      } else if (e.code === 'Tab' && mode === 'playing') {
        e.preventDefault();
        setManifestOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, archiveOpen, handleToggleMute]);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#030712]">
      <div ref={canvasMountRef} className="h-full w-full" />

      <GameHud
        mode={mode}
        hud={hud}
        muted={muted}
        dockExpanded={dockExpanded}
        manifestOpen={manifestOpen}
        onStart={() => engineRef.current?.startGame()}
        onResume={() => engineRef.current?.resumeGame()}
        onPause={() => engineRef.current?.pauseGame()}
        onRestart={() => engineRef.current?.restartSurvival()}
        onToggleView={() => engineRef.current?.toggleViewMode()}
        onToggleLighting={() => engineRef.current?.toggleLightingPreset()}
        onToggleMute={handleToggleMute}
        onToggleDock={() => setDockExpanded((prev) => !prev)}
        onToggleManifest={() => setManifestOpen((prev) => !prev)}
        onInteract={() => engineRef.current?.triggerInteract()}
        onBoardRover={() => engineRef.current?.triggerBoardRover()}
        onAcknowledgeTransmission={() => engineRef.current?.acknowledgeTransmission()}
        onOpenTransmission={() => engineRef.current?.openTransmission()}
        onOpenStudyTerminal={() => engineRef.current?.openStudyTerminal()}
        onCompleteStudyBriefing={() => engineRef.current?.completeStudyBriefing()}
        onCloseStudyTerminal={() => engineRef.current?.closeStudyTerminal()}
        onQuizAnswer={(correct) => engineRef.current?.playQuizFeedback(correct)}
        onFailArtifactQuiz={() => engineRef.current?.failArtifactQuiz()}
        onCollectArtifact={() => engineRef.current?.collectInspectedArtifact()}
        onCloseInspection={() => engineRef.current?.closeArtifactInspection()}
        onOpenArchive={() => setArchiveOpen(true)}
        onExitFinaleToRoam={() => engineRef.current?.exitFinaleToRoam()}
      />

      <ArtifactArchiveModal
        open={archiveOpen}
        artifacts={archiveArtifacts}
        onClose={() => setArchiveOpen(false)}
      />
    </main>
  );
}
