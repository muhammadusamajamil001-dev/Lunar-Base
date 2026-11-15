import React from 'react';
import {
  AlertTriangle,
  BookOpen,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Cpu,
  Crosshair,
  DoorOpen,
  Eye,
  Gauge,
  HelpCircle,
  Landmark,
  ListChecks,
  Lock,
  Navigation,
  PackageCheck,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ScanSearch,
  Sparkles,
  Sun,
  Terminal,
  Thermometer,
  Volume2,
  VolumeX,
  Wind,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { generateArtifactThumbnailUrls } from '../engine/lunarSurfaceObjects';
import { ArtifactKind, GameMode, HudSnapshot } from '../types/game';

interface GameHudProps {
  mode: GameMode;
  hud: HudSnapshot;
  muted: boolean;
  dockExpanded: boolean;
  manifestOpen: boolean;
  onStart: () => void;
  onResume: () => void;
  onPause: () => void;
  onRestart: () => void;
  onToggleView: () => void;
  onToggleLighting: () => void;
  onToggleMute: () => void;
  onToggleDock: () => void;
  onToggleManifest: () => void;
  onInteract: () => void;
  onBoardRover: () => void;
  onAcknowledgeTransmission: () => void;
  onOpenTransmission: () => void;
  onOpenStudyTerminal: () => void;
  onCompleteStudyBriefing: () => void;
  onCloseStudyTerminal: () => void;
  onQuizAnswer: (correct: boolean) => void;
  onFailArtifactQuiz: () => void;
  onCollectArtifact: () => void;
  onCloseInspection: () => void;
  onOpenArchive: () => void;
  onExitFinaleToRoam: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  mode,
  hud,
  muted,
  dockExpanded,
  manifestOpen,
  onStart,
  onResume,
  onPause,
  onRestart,
  onToggleView,
  onToggleLighting,
  onToggleMute,
  onToggleDock,
  onToggleManifest,
  onInteract,
  onBoardRover,
  onAcknowledgeTransmission,
  onOpenTransmission,
  onOpenStudyTerminal,
  onCompleteStudyBriefing,
  onCloseStudyTerminal,
  onQuizAnswer,
  onFailArtifactQuiz,
  onCollectArtifact,
  onCloseInspection,
  onOpenArchive,
  onExitFinaleToRoam,
}) => {
  const [quizIndex, setQuizIndex] = React.useState(0);
  const [selectedQuizOption, setSelectedQuizOption] = React.useState<number | null>(null);
  const [quizPassed, setQuizPassed] = React.useState(false);
  const [quizFailed, setQuizFailed] = React.useState(false);
  const [relicIcons, setRelicIcons] = React.useState<Partial<Record<ArtifactKind, string>>>({});
  const advanceTimerRef = React.useRef<number | null>(null);

  const inspectedId = hud.inspectedArtifact?.id ?? null;
  React.useEffect(() => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setQuizIndex(0);
    setSelectedQuizOption(null);
    setQuizPassed(false);
    setQuizFailed(false);
  }, [inspectedId]);

  React.useEffect(() => {
    if (hud.finalePhase === 'transmission' && Object.keys(relicIcons).length === 0) {
      setRelicIcons(generateArtifactThumbnailUrls());
    }
  }, [hud.finalePhase, relicIcons]);

  React.useEffect(() => {
    return () => {
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current);
      }
    };
  }, []);

  if (mode === 'title') {
    return (
      <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-6 sm:p-10 text-slate-100 select-none">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2.5 rounded-md border border-rose-500/45 bg-[#12070c]/88 px-3.5 py-1.5 text-xs font-mono tracking-widest text-rose-300">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
            CORE ALERT // INCOMING EARTH HQ SIGNAL
          </div>
          <button
            type="button"
            onClick={onToggleMute}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-md border border-slate-600/40 bg-[#07101f]/88 px-3 py-1.5 text-xs font-mono text-slate-300 transition-colors hover:border-sky-400/60 hover:text-sky-200 cursor-pointer"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            {muted ? 'AUDIO OFF' : 'AUDIO ON'}
          </button>
        </div>

        <div className="max-w-xl space-y-5">
          <div className="space-y-3 rounded-lg border border-sky-400/25 bg-[#060d1a]/88 p-6 sm:p-8 shadow-2xl">
            <svg
              viewBox="0 0 420 74"
              className="w-full max-w-[360px] h-auto"
              role="img"
              aria-label="ASAAR Lunar Habitat"
            >
              <defs>
                <linearGradient id="asaarTitleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f8fafc" />
                  <stop offset="65%" stopColor="#bae6fd" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
              </defs>
              <circle cx="24" cy="34" r="16" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
              <path d="M 15 26 A 12 12 0 0 0 31 44" fill="none" stroke="#bae6fd" strokeWidth="2" />
              <circle cx="33" cy="24" r="3" fill="#38bdf8" />
              <text
                x="54"
                y="43"
                fill="url(#asaarTitleGrad)"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontWeight="800"
                fontSize="36"
                letterSpacing="5"
              >
                ASAAR
              </text>
              <line x1="54" y1="54" x2="395" y2="54" stroke="#38bdf8" strokeOpacity="0.35" strokeWidth="1.5" />
              <text
                x="54"
                y="68"
                fill="#7dd3fc"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                fontWeight="600"
                fontSize="11"
                letterSpacing="3.5"
              >
                LUNAR SURVIVAL &amp; SALVAGE
              </text>
            </svg>

            <p className="text-sm leading-relaxed text-slate-300">
              Primary power failure detected across Sector 07. Answer the Earth Headquarters
              transmission, study each target dossier at the base terminal, and follow the 3D
              waypoint arrow in your lunar rover to salvage 10 historic parts one sortie at a time.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onStart}
                className="pointer-events-auto inline-flex items-center gap-2.5 rounded-md bg-sky-500 px-6 py-3 text-sm font-mono font-bold tracking-wider text-slate-950 transition-colors hover:bg-sky-400 cursor-pointer"
              >
                <Play className="h-4 w-4 fill-current" />
                ENTER HABITAT
              </button>
              <button
                type="button"
                onClick={onOpenArchive}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-md border border-amber-400/55 bg-amber-500/15 px-4 py-3 text-xs font-mono font-bold tracking-wider text-amber-200 transition-colors hover:bg-amber-500/25 cursor-pointer"
              >
                <Landmark className="h-4 w-4 text-amber-300" />
                COMPLETED MISSION ARCHIVE
              </button>
            </div>
            <div className="text-[11px] font-mono text-sky-300/80">
              PRESS ENTER OR SPACE TO LAUNCH MISSION
            </div>
          </div>

          <div className="inline-block rounded border border-slate-700/60 bg-[#060d1a]/86 px-3.5 py-1.5 text-[11px] font-mono tracking-wide text-slate-300">
            WASD Move/Drive · Mouse Look · V 1P/3P · E Interact/Salvage · F Rover · Tab Manifest
          </div>
        </div>
      </div>
    );
  }

  const o2Danger = hud.oxygen <= 25;
  const pwrDanger = hud.energy <= 25;
  const isAlarming = hud.narrativeStage === 'alarm' || hud.narrativeStage === 'transmission';
  const activeTarget = hud.activeTarget;
  const showActiveWaypoint =
    hud.narrativeStage === 'salvage' && hud.sortieBriefed && activeTarget !== null;
  const needsBaseReturn =
    hud.narrativeStage === 'core_ready' ||
    (hud.narrativeStage === 'salvage' && !hud.sortieBriefed && hud.environmentZone === 'surface');

  const objectiveText =
    hud.narrativeStage === 'alarm' || hud.narrativeStage === 'transmission'
      ? 'Receive Earth HQ Priority Transmission at Main Terminal [E]'
      : hud.narrativeStage === 'salvage'
        ? !hud.sortieBriefed
          ? hud.environmentZone === 'interior'
            ? `Study Target ${hud.activeTargetIndex + 1}/${hud.artifactsTotal} at Main Computer Terminal [E]`
            : `Sortie locked — Return to Base Main Terminal [E]`
          : hud.environmentZone === 'interior'
            ? 'Cycle South Airlock [E] & follow 3D Waypoint Arrow'
            : `Follow 3D Arrow & salvage Target ${hud.activeTargetIndex + 1}/${hud.artifactsTotal} [E]`
        : hud.narrativeStage === 'core_ready'
          ? hud.environmentZone === 'surface'
            ? 'All 10 parts secured — Return inside via Airlock Ramp [E]'
            : 'Approach Base Main Computer Terminal [E] to Restore Power'
          : 'Base Power Core Online — Systems Nominal';

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-5 text-slate-100 select-none">
      {/* TOP BAR: Life Support (Top-Left) + Waypoint Distance Meter (Center) + Sequential Tracker (Top-Right) */}
      <div className="flex items-start justify-between gap-4">
        <div
          className={`w-76 sm:w-84 rounded-lg border bg-[#060d1a]/90 p-3.5 shadow-lg ${
            isAlarming
              ? 'border-rose-500/60'
              : hud.solarState === 'shadow'
                ? 'border-cyan-300/65'
                : 'border-sky-400/25'
          }`}
        >
          <div className="mb-2.5 flex items-center justify-between border-b border-slate-700/60 pb-2">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  isAlarming
                    ? 'bg-rose-500'
                    : hud.narrativeStage === 'restored'
                      ? 'bg-emerald-400'
                      : hud.solarState === 'shadow'
                        ? 'bg-cyan-300'
                        : 'bg-sky-400'
                }`}
              />
              <span className="text-[11px] font-mono font-bold tracking-widest text-sky-300">
                {hud.sectorName}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {hud.controlMode === 'rover'
                ? `${hud.roverSpeedKmh} KM/H`
                : hud.viewMode === 'first'
                  ? '1P VISOR'
                  : '3P SUIT'}
            </span>
          </div>

          <div className="space-y-2.5">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-mono">
                <span className="inline-flex items-center gap-1.5 text-sky-200">
                  <Wind className="h-3.5 w-3.5 text-sky-400" />
                  OXYGEN CAPACITY
                </span>
                <span
                  className={`font-bold tabular-nums ${
                    o2Danger ? 'text-rose-400' : 'text-sky-300'
                  }`}
                >
                  {hud.oxygen}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-sm bg-slate-800/90">
                <div
                  className={`h-full transition-all duration-150 ${
                    o2Danger ? 'bg-rose-500' : 'bg-sky-400'
                  }`}
                  style={{ width: `${hud.oxygen}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-xs font-mono">
                <span className="inline-flex items-center gap-1.5 text-emerald-200">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  {hud.controlMode === 'rover' ? 'ROVER BATTERY' : 'SUIT BATTERY'}
                </span>
                <div className="flex items-center gap-2 tabular-nums">
                  {hud.environmentZone === 'surface' && hud.narrativeStage !== 'restored' && (
                    <span
                      className={`text-[10px] font-bold ${
                        hud.powerDeltaPerSec >= 0 ? 'text-emerald-300' : 'text-cyan-300'
                      }`}
                    >
                      {hud.powerDeltaPerSec >= 0
                        ? `+${hud.powerDeltaPerSec.toFixed(1)}%/s SOLAR`
                        : `${hud.powerDeltaPerSec.toFixed(1)}%/s FROST`}
                    </span>
                  )}
                  <span
                    className={`font-bold ${
                      pwrDanger
                        ? 'text-rose-400'
                        : hud.powerDeltaPerSec > 0.2
                          ? 'text-emerald-300'
                          : 'text-amber-300'
                    }`}
                  >
                    {hud.energy}%
                  </span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-sm bg-slate-800/90">
                <div
                  className={`h-full transition-all duration-150 ${
                    pwrDanger
                      ? 'bg-rose-500'
                      : hud.solarState === 'shadow'
                        ? 'bg-cyan-400'
                        : hud.powerDeltaPerSec > 0.2
                          ? 'bg-emerald-400'
                          : 'bg-amber-400'
                  }`}
                  style={{ width: `${hud.energy}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-slate-400 tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Gauge className="h-3 w-3 text-sky-400/80" />
                {hud.pressureKpa} kPa
              </span>
              <span
                className={`inline-flex items-center gap-1 ${
                  hud.solarState === 'shadow'
                    ? 'text-cyan-300 font-bold'
                    : hud.solarState === 'sunlight'
                      ? 'text-amber-300'
                      : 'text-slate-300'
                }`}
              >
                <Thermometer className="h-3 w-3" />
                {hud.cabinTempC}°C
              </span>
              <span
                className={`font-semibold ${
                  hud.solarState === 'shadow'
                    ? 'text-cyan-300'
                    : hud.solarState === 'sunlight'
                      ? 'text-emerald-300'
                      : 'text-sky-400/80'
                }`}
              >
                {hud.environmentZone === 'interior'
                  ? 'PRESSURIZED'
                  : hud.solarState === 'shadow'
                    ? 'SHADOW DRAIN'
                    : 'SOLAR CHARGE'}
              </span>
            </div>
          </div>
        </div>

        {/* TOP-CENTER DYNAMIC WAYPOINT DISTANCE METER (ARTIFACT OR RETURN TO BASE) */}
        {mode === 'playing' &&
          !hud.finaleActive &&
          showActiveWaypoint &&
          activeTarget &&
          !hud.studyTerminalOpen &&
          !hud.transmissionOpen &&
          !hud.inspectedArtifact && (
            <div
              className={`flex flex-col items-center rounded-lg border px-3.5 sm:px-4 py-1.5 sm:py-2 shadow-lg bg-[#051020]/90 ${
                activeTarget.distanceMeters <= 10
                  ? 'border-amber-400/75'
                  : 'border-sky-400/45'
              }`}
            >
              <div className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-widest text-sky-300">
                <Navigation className="h-3 w-3 text-sky-400" />
                <span>
                  WAYPOINT {String(hud.activeTargetIndex + 1).padStart(2, '0')}/{hud.artifactsTotal}
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-amber-300">{activeTarget.mission.toUpperCase()}</span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-3 font-mono tabular-nums">
                <span
                  className={`text-lg font-extrabold ${
                    activeTarget.distanceMeters <= 10 ? 'text-amber-300' : 'text-slate-50'
                  }`}
                >
                  {activeTarget.distanceMeters} m
                </span>
                <span className="text-xs font-semibold text-sky-300">
                  {activeTarget.bearingDeg}° BRG
                </span>
                <span className="text-[10px] text-slate-400">[{activeTarget.coordLabel}]</span>
              </div>
              {activeTarget.distanceMeters <= 8 && (
                <div className="mt-0.5 text-[10px] font-mono font-bold tracking-wider text-amber-300">
                  IN RANGE — PRESS [E] TO COMPLETE QUIZ &amp; SALVAGE
                </div>
              )}
            </div>
          )}

        {mode === 'playing' &&
          !hud.finaleActive &&
          !showActiveWaypoint &&
          needsBaseReturn &&
          hud.environmentZone === 'surface' &&
          !hud.studyTerminalOpen &&
          !hud.transmissionOpen &&
          !hud.inspectedArtifact && (
            <div className="flex flex-col items-center rounded-lg border border-emerald-400/60 bg-[#051817]/90 px-4 py-2 shadow-lg">
              <div className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-widest text-emerald-300">
                <Navigation className="h-3 w-3 text-emerald-400" />
                <span>
                  {hud.narrativeStage === 'core_ready'
                    ? 'ALL 10 PARTS SECURED // RETURN TO BASE CORE'
                    : 'PART SECURED // RETURN TO BASE TERMINAL'}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-3 font-mono tabular-nums">
                <span className="text-lg font-extrabold text-slate-50">
                  {hud.baseReturnDistanceMeters} m
                </span>
                <span className="text-xs font-semibold text-emerald-300">
                  {hud.baseReturnBearingDeg}° BRG
                </span>
                <span className="text-[10px] text-slate-300">[SOUTH AIRLOCK]</span>
              </div>
            </div>
          )}

        {/* Top-Right Compact Sequential Story Mission Tracker */}
        <div className="flex flex-col items-end gap-2">
          <div
            className={`w-72 sm:w-80 rounded-lg border bg-[#060d1a]/90 p-3 shadow-lg ${
              hud.narrativeStage === 'restored'
                ? 'border-emerald-400/45'
                : isAlarming
                  ? 'border-rose-500/60'
                  : !hud.sortieBriefed && hud.narrativeStage === 'salvage'
                    ? 'border-amber-400/55'
                    : 'border-sky-400/25'
            }`}
          >
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-700/60">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold tracking-wider text-sky-300">
                {hud.narrativeStage === 'restored' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Radio className="h-3.5 w-3.5 text-rose-400" />
                )}
                STORY MODE // SORTIE
              </span>
              <span className="text-xs font-mono font-bold tabular-nums text-amber-300">
                {hud.artifactsCollected} / {hud.artifactsTotal}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug font-mono text-slate-200">
              {objectiveText}
            </p>
            {showActiveWaypoint && activeTarget && (
              <div className="mt-2 flex items-center justify-between rounded border border-sky-400/30 bg-slate-900/90 px-2.5 py-1.5 text-[11px] font-mono text-sky-300 tabular-nums">
                <span className="inline-flex items-center gap-1.5 truncate">
                  <Crosshair className="h-3 w-3 shrink-0 text-sky-400" />
                  {activeTarget.mission}
                </span>
                <span className="shrink-0 font-bold text-amber-300">
                  {activeTarget.distanceMeters}m · {activeTarget.bearingDeg}°
                </span>
              </div>
            )}
            {needsBaseReturn && (
              <div className="mt-2 flex items-center justify-between rounded border border-amber-400/35 bg-slate-900/90 px-2.5 py-1.5 text-[11px] font-mono text-amber-200 tabular-nums">
                <span className="inline-flex items-center gap-1.5 truncate">
                  <Compass className="h-3 w-3 shrink-0 text-amber-300" />
                  ASAAR AIRLOCK
                </span>
                <span className="shrink-0 font-bold text-amber-300">
                  {hud.baseReturnDistanceMeters}m · {hud.baseReturnBearingDeg}°
                </span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onToggleManifest}
                className="pointer-events-auto inline-flex items-center gap-1 rounded border border-slate-600/60 bg-slate-800/80 px-2 py-1 text-[10px] font-mono text-slate-200 hover:border-sky-400/50 cursor-pointer"
              >
                <ListChecks className="h-3 w-3 text-sky-400" />
                Manifest (Tab)
              </button>
              {hud.narrativeStage === 'salvage' && hud.sortieBriefed ? (
                <button
                  type="button"
                  onClick={onOpenStudyTerminal}
                  className="pointer-events-auto inline-flex items-center gap-1 rounded border border-sky-400/35 bg-sky-500/15 px-2 py-1 text-[10px] font-mono text-sky-200 hover:bg-sky-500/25 cursor-pointer"
                >
                  <BookOpen className="h-3 w-3 text-sky-400" />
                  Target Notes
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenTransmission}
                  className="pointer-events-auto inline-flex items-center gap-1 rounded border border-sky-400/35 bg-sky-500/15 px-2 py-1 text-[10px] font-mono text-sky-200 hover:bg-sky-500/25 cursor-pointer"
                >
                  <Radio className="h-3 w-3 text-sky-400" />
                  HQ Comms
                </button>
              )}
            </div>
          </div>

          {hud.statusBanner && (
            <div className="max-w-sm rounded-md border border-sky-400/40 bg-[#060d1a]/92 px-3.5 py-1.5 text-[11px] font-mono tracking-wide text-sky-200 shadow-lg text-right">
              {hud.statusBanner}
            </div>
          )}
        </div>
      </div>

      {/* CENTER RETICLE & CONTEXTUAL INTERACTION PROMPTS */}
      {mode === 'playing' &&
        !hud.finaleActive &&
        !hud.transmissionOpen &&
        !hud.studyTerminalOpen &&
        !hud.inspectedArtifact && (
        <div className="fixed inset-0 pointer-events-none flex flex-col items-center justify-center">
          <div className="relative h-4 w-4 opacity-75">
            <span className="absolute left-1/2 top-0 h-1.5 w-[1.5px] -translate-x-1/2 bg-sky-300" />
            <span className="absolute left-1/2 bottom-0 h-1.5 w-[1.5px] -translate-x-1/2 bg-sky-300" />
            <span className="absolute top-1/2 left-0 h-[1.5px] w-1.5 -translate-y-1/2 bg-sky-300" />
            <span className="absolute top-1/2 right-0 h-[1.5px] w-1.5 -translate-y-1/2 bg-sky-300" />
          </div>

          {/* Priority Artifact Scan Prompt */}
          {hud.nearbyArtifact && (
            <button
              type="button"
              onClick={onInteract}
              className="pointer-events-auto mt-6 flex items-center gap-3 rounded-md border border-sky-400/75 bg-[#061224]/92 px-4 py-2 text-left shadow-xl cursor-pointer hover:border-amber-300/80"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded border border-amber-400/70 bg-amber-500/20 text-xs font-mono font-bold text-amber-300">
                E
              </span>
              <div>
                <div className="text-xs font-mono font-bold text-slate-100">
                  Inspect {hud.nearbyArtifact.name}
                </div>
                <div className="text-[11px] font-mono text-sky-300">
                  Open Holo-Scanner · {hud.nearbyArtifact.mission} ({hud.nearbyArtifact.year})
                </div>
              </div>
            </button>
          )}

          {/* Airlock Transition Prompt */}
          {!hud.nearbyArtifact && hud.canUseAirlock && (
            <button
              type="button"
              onClick={onInteract}
              className={`pointer-events-auto mt-6 flex items-center gap-3 rounded-md border px-4 py-2 text-left shadow-xl cursor-pointer ${
                hud.environmentZone === 'interior' &&
                hud.narrativeStage === 'salvage' &&
                !hud.sortieBriefed
                  ? 'border-amber-400/70 bg-[#1c1008]/94'
                  : 'border-sky-400/65 bg-[#060d1a]/94'
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded border text-xs font-mono font-bold ${
                  hud.environmentZone === 'interior' &&
                  hud.narrativeStage === 'salvage' &&
                  !hud.sortieBriefed
                    ? 'border-amber-400/60 bg-amber-500/20 text-amber-300'
                    : 'border-sky-400/50 bg-sky-500/20 text-sky-300'
                }`}
              >
                {hud.environmentZone === 'interior' &&
                hud.narrativeStage === 'salvage' &&
                !hud.sortieBriefed ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  'E'
                )}
              </span>
              <div>
                <div className="text-xs font-mono font-bold text-slate-100">
                  {hud.environmentZone === 'interior'
                    ? hud.narrativeStage === 'salvage' && !hud.sortieBriefed
                      ? 'South Airlock Sealed — Briefing Required'
                      : 'Cycle South Airlock -> Lunar Surface'
                    : 'Enter Asaar Pressurized Airlock'}
                </div>
                <div
                  className={`text-[11px] font-mono ${
                    hud.environmentZone === 'interior' &&
                    hud.narrativeStage === 'salvage' &&
                    !hud.sortieBriefed
                      ? 'text-amber-300'
                      : 'text-sky-300'
                  }`}
                >
                  {hud.environmentZone === 'interior'
                    ? hud.narrativeStage === 'salvage' && !hud.sortieBriefed
                      ? `Study Target ${hud.activeTargetIndex + 1}/${hud.artifactsTotal} at Main Terminal [E] first`
                      : 'Deploy outside beside the Lunar Rover'
                    : 'Return inside Observation & Engineering bays'}
                </div>
              </div>
            </button>
          )}

          {/* Board Rover Prompt */}
          {!hud.nearbyArtifact && hud.canBoardRover && (
            <button
              type="button"
              onClick={onBoardRover}
              className="pointer-events-auto mt-3 flex items-center gap-3 rounded-md border border-emerald-400/65 bg-[#06121a]/94 px-4 py-2 text-left shadow-xl cursor-pointer"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded border border-emerald-400/50 bg-emerald-500/20 text-xs font-mono font-bold text-emerald-300">
                F
              </span>
              <div>
                <div className="text-xs font-mono font-bold text-slate-100">
                  Board Lunar Reconnaissance Rover
                </div>
                <div className="text-[11px] font-mono text-emerald-300">
                  High-speed crater traversal · Headlights &amp; Salvage Rack
                </div>
              </div>
            </button>
          )}

          {/* Interior Control Console Prompt */}
          {!hud.nearbyArtifact && !hud.canUseAirlock && hud.nearbyTerminal && (
            <button
              type="button"
              onClick={onInteract}
              className="pointer-events-auto mt-6 flex items-center gap-3 rounded-md border border-sky-400/60 bg-[#060d1a]/92 px-4 py-2 text-left shadow-xl transition-colors hover:border-sky-300 cursor-pointer"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded border border-sky-400/50 bg-sky-500/20 text-xs font-mono font-bold text-sky-300">
                E
              </span>
              <div>
                <div className="text-xs font-mono font-bold text-slate-100">
                  {hud.nearbyTerminal.actionLabel}
                </div>
                <div className="text-[11px] font-mono text-sky-300">
                  {hud.nearbyTerminal.label} · {hud.nearbyTerminal.effectText}
                </div>
              </div>
            </button>
          )}

          {hud.narrativeStage === 'alarm' && (
            <div className="mt-6 rounded-md border border-rose-500/70 bg-[#26060b]/92 px-5 py-2.5 text-xs font-mono font-bold tracking-widest text-rose-200 shadow-xl">
              ALERT // PRIMARY POWER CORE FAILURE — RECEIVING EARTH HQ SIGNAL...
            </div>
          )}

          {!hud.pointerLocked &&
            !hud.nearbyTerminal &&
            !hud.nearbyArtifact &&
            !hud.canUseAirlock &&
            !hud.canBoardRover &&
            hud.narrativeStage !== 'alarm' && (
              <div className="mt-8 rounded border border-slate-600/40 bg-[#060d1a]/78 px-3 py-1 text-[11px] font-mono text-slate-300">
                Click or Drag Viewport to Look · WASD to {hud.controlMode === 'rover' ? 'Drive' : 'Walk'}
              </div>
            )}
        </div>
      )}

      {/* COLLAPSIBLE BOTTOM-CENTER CONTROL DOCK */}
      {!hud.finaleActive && (
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={onToggleDock}
          className="pointer-events-auto mb-1.5 inline-flex items-center gap-1.5 rounded-t-md border border-b-0 border-sky-400/25 bg-[#060d1a]/88 px-3 py-1 text-[11px] font-mono text-sky-300 hover:text-sky-100 cursor-pointer"
        >
          {dockExpanded ? (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Hide Controls (H)
            </>
          ) : (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Show Controls (H)
            </>
          )}
        </button>

        {dockExpanded && (
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-lg border border-sky-400/25 bg-[#060d1a]/88 px-3.5 py-2 shadow-xl">
            <button
              type="button"
              onClick={onToggleView}
              className="inline-flex items-center gap-1.5 rounded border border-sky-400/35 bg-sky-500/15 px-3 py-1.5 text-xs font-mono text-sky-200 transition-colors hover:bg-sky-500/25 cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5 text-sky-400" />
              {hud.viewMode === 'first' ? '1P View' : '3P View'} (V)
            </button>

            {(hud.controlMode === 'rover' || hud.canBoardRover) && (
              <button
                type="button"
                onClick={onBoardRover}
                className="inline-flex items-center gap-1.5 rounded border border-emerald-400/45 bg-emerald-500/20 px-3 py-1.5 text-xs font-mono text-emerald-200 hover:bg-emerald-500/30 cursor-pointer"
              >
                <Car className="h-3.5 w-3.5 text-emerald-300" />
                {hud.controlMode === 'rover' ? 'Exit Rover (F)' : 'Board Rover (F)'}
              </button>
            )}

            {hud.canUseAirlock && (
              <button
                type="button"
                onClick={onInteract}
                className="inline-flex items-center gap-1.5 rounded border border-sky-400/50 bg-sky-500/25 px-3 py-1.5 text-xs font-mono text-sky-100 hover:bg-sky-500/35 cursor-pointer"
              >
                <DoorOpen className="h-3.5 w-3.5 text-sky-300" />
                {hud.environmentZone === 'interior' ? 'Exit Airlock (E)' : 'Enter Base (E)'}
              </button>
            )}

            {(hud.nearbyTerminal || hud.nearbyArtifact) && (
              <button
                type="button"
                onClick={onInteract}
                className="inline-flex items-center gap-1.5 rounded border border-amber-400/55 bg-amber-500/20 px-3 py-1.5 text-xs font-mono font-semibold text-amber-100 hover:bg-amber-500/30 cursor-pointer"
              >
                <Terminal className="h-3.5 w-3.5 text-amber-300" />
                {hud.nearbyArtifact ? 'Inspect Part (E)' : 'Use Console (E)'}
              </button>
            )}

            <button
              type="button"
              onClick={onToggleLighting}
              className="inline-flex items-center gap-1.5 rounded border border-slate-600/50 bg-slate-800/70 px-3 py-1.5 text-xs font-mono text-slate-200 transition-colors hover:border-sky-400/40 cursor-pointer"
            >
              <Sun className="h-3.5 w-3.5 text-amber-300" />
              {hud.lightingPreset === 'nominal' ? 'Cyan' : 'Amber'}
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              className="inline-flex items-center gap-1.5 rounded border border-slate-600/50 bg-slate-800/70 px-3 py-1.5 text-xs font-mono text-slate-200 transition-colors hover:border-sky-400/40 cursor-pointer"
            >
              {muted ? (
                <VolumeX className="h-3.5 w-3.5 text-slate-400" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-sky-400" />
              )}
              {muted ? 'Muted' : 'Audio'} (M)
            </button>

            <button
              type="button"
              onClick={onPause}
              className="inline-flex items-center gap-1.5 rounded border border-slate-600/50 bg-slate-800/70 px-3 py-1.5 text-xs font-mono text-slate-200 transition-colors hover:border-sky-400/40 cursor-pointer"
            >
              <Pause className="h-3.5 w-3.5" />
              Pause (Esc)
            </button>
          </div>
        )}
      </div>
      )}

      {/* GRAND FINALE CINEMATIC STATUS + HOLOGRAPHIC 'HISTORY REVIVED' TRANSMISSION */}
      {mode === 'playing' && hud.finaleActive && hud.finalePhase !== 'transmission' && (
        <div className="pointer-events-none flex flex-col items-center pb-3">
          <div className="rounded border border-sky-400/50 bg-[#040d1d]/82 px-5 py-2 text-xs font-mono font-bold tracking-widest text-sky-200 shadow-lg">
            {hud.finalePhase === 'ignition'
              ? 'REACTOR CORE IGNITION // SYNCHRONIZING 10 LUNAR RELICS...'
              : 'ORBITAL ASCENSION // SOLAR DAWN ACROSS SECTOR 07...'}
          </div>
        </div>
      )}

      {mode === 'playing' && hud.finaleActive && hud.finalePhase === 'transmission' && (
        <div className="pointer-events-none flex flex-col items-center justify-end pb-2 sm:pb-4">
          <div className="holo-glitch-enter holo-scanline-bg pointer-events-auto relative w-full max-w-4xl rounded-lg border border-sky-300/65 bg-[#030d1e]/82 p-5 sm:p-6 shadow-[0_0_55px_rgba(56,189,248,0.28)]">
            {/* Glowing Holographic Particle Corner Brackets */}
            <span className="pointer-events-none absolute -top-px -left-px h-5 w-5 border-t-2 border-l-2 border-amber-300" />
            <span className="pointer-events-none absolute -top-px -right-px h-5 w-5 border-t-2 border-r-2 border-sky-300" />
            <span className="pointer-events-none absolute -bottom-px -left-px h-5 w-5 border-b-2 border-l-2 border-sky-300" />
            <span className="pointer-events-none absolute -bottom-px -right-px h-5 w-5 border-b-2 border-r-2 border-amber-300" />

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-400/35 pb-3">
              <div className="flex items-center gap-2 text-[11px] font-mono font-bold tracking-widest text-sky-300">
                <Radio className="h-4 w-4 text-amber-300" />
                EARTH HEADQUARTERS // HOLOGRAPHIC TRANSMISSION · HISTORY REVIVED
              </div>
              <span className="rounded border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-200">
                10 / 10 RELICS INTEGRATED · CORE 100%
              </span>
            </div>

            <h2 className="mt-3 text-base sm:text-xl font-mono font-extrabold tracking-wide text-slate-50 leading-snug">
              MISSION ACCOMPLISHED — CONGRATULATIONS, ASTRONAUT. YOU HAVE REVIVED HUMANITY&apos;S
              LUNAR HISTORY.
            </h2>

            {/* Sleek Holographic Scroll of Mini 3D Icons for All 10 Rescued Relics */}
            <div className="mt-3.5 rounded border border-sky-400/35 bg-[#05142b]/80 p-3">
              <div className="mb-2 flex items-center justify-between text-[10px] font-mono font-bold tracking-widest text-amber-300">
                <span>RESCUED LUNAR HERITAGE ARCHIVE (1967 – 2024)</span>
                <span className="text-sky-300">APOLLO 11 → IM-1 ODYSSEUS</span>
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-1.5">
                {[...hud.artifacts]
                  .sort((a, b) => a.year - b.year)
                  .map((art) => (
                    <div
                      key={art.id}
                      className="flex w-28 shrink-0 flex-col items-center rounded border border-sky-400/30 bg-[#071c3a]/90 p-2 text-center"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded border border-amber-300/35 bg-[#030b18]">
                        {relicIcons[art.kind] ? (
                          <img
                            src={relicIcons[art.kind]}
                            alt={art.name}
                            className="h-12 w-12 object-contain"
                          />
                        ) : (
                          <Sparkles className="h-5 w-5 text-sky-300" />
                        )}
                      </div>
                      <div className="mt-1.5 text-[10px] font-mono font-bold text-amber-300">
                        {art.year}
                      </div>
                      <div className="line-clamp-2 text-[10px] font-mono leading-tight text-slate-100">
                        {art.mission}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <p className="mt-3 text-xs sm:text-sm font-mono leading-relaxed text-sky-100">
              From the first steps of 1969 to modern private landers, the pioneers of the Moon live
              on through your mission.
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2.5 border-t border-sky-400/25 pt-3.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={onOpenArchive}
                  className="inline-flex items-center gap-2 rounded-md bg-amber-400 px-5 py-2.5 text-xs font-mono font-bold tracking-wider text-slate-950 shadow-lg transition-colors hover:bg-amber-300 cursor-pointer"
                >
                  <Landmark className="h-4 w-4" />
                  Explore Lunar Museum (Inspect All 10 Relics)
                </button>
                <button
                  type="button"
                  onClick={onRestart}
                  className="inline-flex items-center gap-2 rounded-md border border-sky-300/60 bg-sky-500/25 px-4 py-2.5 text-xs font-mono font-bold tracking-wider text-sky-100 transition-colors hover:bg-sky-500/35 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  Replay Story Mode
                </button>
              </div>

              <button
                type="button"
                onClick={onExitFinaleToRoam}
                className="inline-flex items-center gap-1.5 rounded border border-slate-600/80 bg-slate-900/85 px-3.5 py-2.5 text-xs font-mono font-semibold text-slate-300 hover:border-sky-400/60 hover:text-white cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" />
                Free Roam Base
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EARTH HQ INCOMING TRANSMISSION MODAL */}
      {hud.transmissionOpen && mode === 'playing' && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-[#02050d]/72 p-4">
          <div className="w-full max-w-xl rounded-lg border border-rose-500/60 bg-[#080d1a] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-rose-500/30 pb-3">
              <div className="flex items-center gap-2.5">
                <Radio className="h-5 w-5 text-rose-400" />
                <div>
                  <div className="text-[11px] font-mono font-bold tracking-widest text-rose-400">
                    PRIORITY TRANSMISSION // EARTH HEADQUARTERS
                  </div>
                  <h2 className="text-lg font-mono font-bold text-slate-100">
                    ASAAR PRIMARY POWER CORE FAILURE
                  </h2>
                </div>
              </div>
              <span className="rounded border border-sky-400/40 bg-sky-500/15 px-2.5 py-1 text-[10px] font-mono text-sky-300">
                HOUSTON DSN-01
              </span>
            </div>

            <div className="space-y-3 rounded border border-slate-700/70 bg-[#050a14] p-4 text-xs sm:text-sm leading-relaxed font-mono text-slate-200">
              <p>
                &ldquo;Commander, Earth telemetry confirms catastrophic failure of the Asaar
                primary fusion power core. Backup cells will not sustain habitat life support
                indefinitely.&rdquo;
              </p>
              <p className="text-sky-200">
                &ldquo;Protocol requires recovering{' '}
                <span className="font-bold text-amber-300">10 historic mission parts one sortie at a time</span>.
                Before each deployment, study the next target at the{' '}
                <span className="font-bold text-sky-300">Base Main Computer Terminal [E]</span>{' '}
                to unlock your 3D holographic navigation arrow and surface coordinates.&rdquo;
              </p>
              <p className="text-slate-400 text-xs">
                Use the South Airlock [E] and Lunar Rover [F] for each sortie, then bring all 10
                salvaged parts back to restore full base power.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={onToggleManifest}
                className="inline-flex items-center gap-2 rounded border border-slate-600 bg-slate-800 px-3.5 py-2.5 text-xs font-mono text-slate-200 hover:border-sky-400/50 cursor-pointer"
              >
                <ListChecks className="h-4 w-4 text-sky-400" />
                SALVAGE LOG
              </button>

              <button
                type="button"
                onClick={onAcknowledgeTransmission}
                className="inline-flex items-center gap-2 rounded-md bg-sky-500 px-5 py-2.5 text-xs font-mono font-bold tracking-wider text-slate-950 hover:bg-sky-400 cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" />
                ACKNOWLEDGE &amp; PROCEED TO TERMINAL (ENTER)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BASE MAIN COMPUTER: TARGET STUDY TERMINAL (BULLET-POINT BRIEFING) */}
      {hud.studyTerminalOpen && hud.activeTarget && mode === 'playing' && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-[#020814]/65 p-4">
          <div className="relative w-full max-w-2xl rounded-lg border border-sky-400/65 bg-[#041022]/92 p-5 sm:p-6 shadow-2xl">
            <span className="pointer-events-none absolute -top-px -left-px h-4 w-4 border-t-2 border-l-2 border-sky-300" />
            <span className="pointer-events-none absolute -top-px -right-px h-4 w-4 border-t-2 border-r-2 border-sky-300" />
            <span className="pointer-events-none absolute -bottom-px -left-px h-4 w-4 border-b-2 border-l-2 border-emerald-400" />
            <span className="pointer-events-none absolute -bottom-px -right-px h-4 w-4 border-b-2 border-r-2 border-emerald-400" />

            <div className="flex items-start justify-between gap-3 border-b border-sky-400/30 pb-3.5">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono font-bold tracking-widest">
                  <span className="inline-flex items-center gap-1.5 text-sky-300">
                    <Terminal className="h-3.5 w-3.5 text-sky-400" />
                    BASE STUDY TERMINAL // SORTIE{' '}
                    {String(hud.activeTargetIndex + 1).padStart(2, '0')} OF {hud.artifactsTotal}
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="text-amber-300">{hud.activeTarget.partCategory}</span>
                </div>
                <h2 className="text-base sm:text-xl font-mono font-bold text-slate-50 leading-tight">
                  {hud.activeTarget.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] font-mono">
                  <span className="rounded border border-sky-400/40 bg-sky-500/15 px-2 py-0.5 text-sky-200">
                    GRID {hud.activeTarget.coordLabel}
                  </span>
                  <span className="rounded border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-200 tabular-nums">
                    RANGE ~{hud.activeTarget.distanceMeters}m · BRG {hud.activeTarget.bearingDeg}°
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onCloseStudyTerminal}
                aria-label="Close Base Study Terminal"
                className="rounded border border-sky-400/35 bg-slate-900/80 p-1.5 text-slate-300 hover:border-sky-300 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Clean, Punchy Single-Line Bullet Points */}
            <ul className="mt-4 space-y-2">
              {hud.activeTarget.studyBullets.map((bullet) => (
                <li
                  key={bullet.label}
                  className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 rounded border border-sky-400/20 bg-[#07162b]/85 px-3.5 py-2 font-mono"
                >
                  <div className="flex items-center gap-2 w-40 shrink-0">
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        bullet.label === 'FAILURE CAUSE'
                          ? 'bg-rose-400'
                          : bullet.label === 'SALVAGE USE'
                            ? 'bg-emerald-400'
                            : 'bg-sky-400'
                      }`}
                    />
                    <span
                      className={`text-[10px] font-bold tracking-widest ${
                        bullet.label === 'FAILURE CAUSE'
                          ? 'text-rose-300'
                          : bullet.label === 'SALVAGE USE'
                            ? 'text-emerald-300'
                            : 'text-sky-300'
                      }`}
                    >
                      {bullet.label}
                    </span>
                  </div>
                  <span className="text-xs sm:text-[13px] text-slate-100 leading-snug">
                    {bullet.value}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-sky-400/25 pt-3.5">
              <button
                type="button"
                onClick={onCloseStudyTerminal}
                className="inline-flex items-center gap-2 rounded border border-slate-600/80 bg-slate-900/80 px-3.5 py-2 text-xs font-mono text-slate-300 hover:border-sky-400/60 hover:text-white cursor-pointer"
              >
                CLOSE (ESC)
              </button>

              <button
                type="button"
                onClick={onCompleteStudyBriefing}
                className="inline-flex items-center gap-2 rounded-md bg-sky-400 px-5 py-2.5 text-xs font-mono font-bold tracking-wider text-slate-950 shadow-lg transition-colors hover:bg-sky-300 cursor-pointer"
              >
                <Navigation className="h-4 w-4" />
                {hud.sortieBriefed
                  ? 'RESUME ACTIVE SORTIE (ENTER)'
                  : 'ACTIVATE 3D WAYPOINT & DEPLOY (ENTER)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUIZ-ONLY HOLOGRAPHIC FIELD VERIFICATION OVERLAY */}
      {hud.inspectedArtifact && mode === 'playing' && (() => {
        const quizzes = hud.inspectedArtifact.quizzes;
        const currentQuiz = quizzes[Math.min(quizIndex, Math.max(0, quizzes.length - 1))];
        const answeredCurrentCorrect =
          selectedQuizOption !== null && currentQuiz && selectedQuizOption === currentQuiz.correctIndex;

        return (
          <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-[#020814]/60 p-4">
            <div className="relative w-full max-w-xl flex flex-col rounded-lg border border-sky-400/65 bg-[#041022]/90 p-5 sm:p-6 shadow-2xl">
              {/* Holographic Corner Reticles */}
              <span className="pointer-events-none absolute -top-px -left-px h-4 w-4 border-t-2 border-l-2 border-sky-300" />
              <span className="pointer-events-none absolute -top-px -right-px h-4 w-4 border-t-2 border-r-2 border-sky-300" />
              <span className="pointer-events-none absolute -bottom-px -left-px h-4 w-4 border-b-2 border-l-2 border-amber-300" />
              <span className="pointer-events-none absolute -bottom-px -right-px h-4 w-4 border-b-2 border-r-2 border-amber-300" />

              {/* Header (No study answers shown here!) */}
              <div className="flex items-start justify-between gap-3 border-b border-sky-400/30 pb-3.5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono tracking-widest">
                    <span className="inline-flex items-center gap-1.5 text-sky-300 font-bold">
                      <ScanSearch className="h-3.5 w-3.5 text-sky-400" />
                      FIELD EXTRACTION QUIZ // BRIEFING RECALL TEST
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-mono font-bold text-slate-50 leading-tight">
                    {hud.inspectedArtifact.name}
                  </h2>
                  <div className="text-[11px] font-mono text-slate-400">
                    Answer all {quizzes.length} Base Terminal briefing questions accurately to unlock collection.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={quizFailed ? onFailArtifactQuiz : onCloseInspection}
                  aria-label="Close quiz overlay"
                  className="rounded border border-sky-400/35 bg-slate-900/80 p-1.5 text-slate-300 hover:border-sky-300 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Question Progress Strip */}
              <div className="mt-3.5 flex items-center justify-between gap-3">
                <div className="flex flex-1 gap-1.5">
                  {quizzes.map((q, idx) => (
                    <div
                      key={q.question}
                      className={`h-1.5 flex-1 rounded-sm transition-colors ${
                        quizPassed || idx < quizIndex
                          ? 'bg-emerald-400'
                          : idx === quizIndex
                            ? quizFailed
                              ? 'bg-rose-500'
                              : 'bg-amber-400'
                            : 'bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-mono font-bold text-sky-300 tabular-nums">
                  Q{Math.min(quizIndex + 1, quizzes.length)} / {quizzes.length}
                </span>
              </div>

              {/* Active Question Card */}
              {currentQuiz && (
                <div
                  className={`mt-3.5 rounded border p-4 ${
                    quizPassed
                      ? 'border-emerald-400/65 bg-emerald-950/35'
                      : quizFailed
                        ? 'border-rose-500/70 bg-rose-950/45'
                        : 'border-amber-400/55 bg-[#0a162b]/92'
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-widest ${
                        quizPassed
                          ? 'text-emerald-300'
                          : quizFailed
                            ? 'text-rose-300'
                            : 'text-amber-300'
                      }`}
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      {quizPassed
                        ? 'ALL QUESTIONS VERIFIED // PART UNLOCKED'
                        : quizFailed
                          ? 'VERIFICATION FAILED // SORTIE LOCKED'
                          : 'REQUIRED FIELD CHECK'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-300 tabular-nums">
                      INVENTORY {hud.artifactsCollected}/{hud.artifactsTotal}
                    </span>
                  </div>

                  <p className="font-mono text-xs sm:text-sm font-bold text-slate-50 leading-snug">
                    {currentQuiz.question}
                  </p>

                  <div className="mt-3 space-y-2">
                    {currentQuiz.options.map((optionText, optIdx) => {
                      const isCorrectOpt = optIdx === currentQuiz.correctIndex;
                      const isPicked = selectedQuizOption === optIdx;
                      let btnStyle =
                        'border-slate-600/70 bg-[#071224] text-slate-200 hover:border-sky-400/70';

                      if ((quizPassed || answeredCurrentCorrect) && isCorrectOpt) {
                        btnStyle = 'border-emerald-400 bg-emerald-500/25 text-emerald-100';
                      } else if (isPicked && !isCorrectOpt) {
                        btnStyle = 'border-rose-500 bg-rose-500/25 text-rose-100';
                      }

                      const locked = quizPassed || quizFailed || selectedQuizOption !== null;

                      return (
                        <button
                          key={optionText}
                          type="button"
                          disabled={locked}
                          onClick={() => {
                            setSelectedQuizOption(optIdx);
                            const correct = optIdx === currentQuiz.correctIndex;
                            if (!correct) {
                              setQuizFailed(true);
                              onQuizAnswer(false);
                              return;
                            }

                            onQuizAnswer(true);
                            if (quizIndex + 1 >= quizzes.length) {
                              setQuizPassed(true);
                            } else {
                              if (advanceTimerRef.current !== null) {
                                window.clearTimeout(advanceTimerRef.current);
                              }
                              advanceTimerRef.current = window.setTimeout(() => {
                                advanceTimerRef.current = null;
                                setQuizIndex((prev) => prev + 1);
                                setSelectedQuizOption(null);
                              }, 420);
                            }
                          }}
                          className={`flex w-full items-center justify-between gap-2 rounded border px-3.5 py-2.5 text-left font-mono text-xs transition-colors ${btnStyle} ${
                            locked ? 'cursor-default' : 'cursor-pointer'
                          }`}
                        >
                          <span>
                            <span className="mr-2 font-bold text-sky-400">
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            {optionText}
                          </span>
                          {(quizPassed || answeredCurrentCorrect) && isCorrectOpt && (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                          )}
                          {isPicked && !isCorrectOpt && (
                            <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {quizFailed && (
                    <div className="mt-3 rounded border border-rose-500/60 bg-rose-950/60 px-3.5 py-2.5 text-xs font-mono text-rose-200 leading-relaxed">
                      <span className="font-bold text-rose-300">INCORRECT ANSWER — SORTIE LOCKED:</span>{' '}
                      Head back to the Base Main Computer Terminal [E] to re-study this artifact&apos;s
                      dossier, then return to re-attempt extraction.
                    </div>
                  )}
                </div>
              )}

              {/* Footer Action Controls */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-sky-400/25 pt-3.5">
                {!quizFailed ? (
                  <button
                    type="button"
                    onClick={onCloseInspection}
                    className="inline-flex items-center gap-2 rounded border border-slate-600/80 bg-slate-900/80 px-3.5 py-2 text-xs font-mono text-slate-300 hover:border-sky-400/60 hover:text-white cursor-pointer"
                  >
                    STEP BACK (ESC)
                  </button>
                ) : (
                  <span className="text-[11px] font-mono text-rose-300">
                    BASE RE-STUDY REQUIRED
                  </span>
                )}

                <div className="flex items-center gap-3">
                  {!quizFailed && (
                    <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-sky-300 tabular-nums">
                      <Cpu className="h-3.5 w-3.5 text-sky-400" />
                      {hud.artifactsCollected}/{hud.artifactsTotal} →{' '}
                      {hud.artifactsCollected + 1}/{hud.artifactsTotal} PARTS
                    </span>
                  )}

                  {quizFailed ? (
                    <button
                      type="button"
                      onClick={onFailArtifactQuiz}
                      className="inline-flex items-center gap-2 rounded-md bg-rose-500 px-5 py-2.5 text-xs font-mono font-bold tracking-wider text-slate-950 shadow-lg transition-colors hover:bg-rose-400 cursor-pointer"
                    >
                      <Navigation className="h-4 w-4" />
                      RETURN TO BASE &amp; RE-STUDY
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!quizPassed}
                      onClick={onCollectArtifact}
                      className={`inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-xs font-mono font-bold tracking-wider shadow-lg transition-colors ${
                        quizPassed
                          ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300 cursor-pointer'
                          : 'border border-slate-700 bg-slate-800/80 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {quizPassed ? (
                        <PackageCheck className="h-4 w-4" />
                      ) : (
                        <Lock className="h-3.5 w-3.5" />
                      )}
                      {quizPassed
                        ? `COLLECT PART (${hud.artifactsCollected + 1}/${hud.artifactsTotal}) & HEAD TO BASE`
                        : `ANSWER ALL ${quizzes.length} QUESTIONS`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 10 HISTORICAL SALVAGE PARTS MANIFEST DRAWER/MODAL */}
      {manifestOpen && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[#020611]/78 p-4">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-lg border border-sky-400/35 bg-[#07101f] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700/70 pb-3">
              <div>
                <div className="text-[11px] font-mono tracking-widest text-sky-400">
                  EARTH HQ SALVAGE MANIFEST ({hud.artifactsCollected}/{hud.artifactsTotal} RECOVERED)
                </div>
                <h3 className="text-lg font-mono font-bold text-slate-100">
                  HISTORICAL LUNAR MISSION COMPONENTS
                </h3>
              </div>
              <button
                type="button"
                onClick={onToggleManifest}
                className="rounded border border-slate-600 p-1.5 text-slate-300 hover:border-sky-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto pr-1">
              {hud.artifacts.map((art, index) => {
                const isActive =
                  hud.narrativeStage === 'salvage' && index === hud.activeTargetIndex;
                const isLocked =
                  !art.collected &&
                  !(isActive && hud.sortieBriefed) &&
                  index > hud.activeTargetIndex;
                const isPendingStudy = isActive && !hud.sortieBriefed;

                return (
                  <div
                    key={art.id}
                    className={`rounded border p-3 font-mono ${
                      art.collected
                        ? 'border-emerald-500/40 bg-emerald-950/25'
                        : isActive
                          ? 'border-sky-400/60 bg-[#0b1f3b]'
                          : 'border-slate-800 bg-[#070f1d] opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-sky-300">
                        {isLocked
                          ? `SORTIE ${String(index + 1).padStart(2, '0')} // CLASSIFIED`
                          : `${art.mission} (${art.year})`}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                          art.collected
                            ? 'text-emerald-400'
                            : isActive
                              ? 'text-amber-300 tabular-nums'
                              : 'text-slate-500'
                        }`}
                      >
                        {art.collected ? (
                          'SALVAGED'
                        ) : isLocked ? (
                          <>
                            <Lock className="h-3 w-3" />
                            LOCKED
                          </>
                        ) : isPendingStudy ? (
                          'STUDY AT BASE'
                        ) : (
                          `${art.distanceMeters}m · ${art.bearingDeg}°`
                        )}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-100">
                      {isLocked ? 'Locked Dossier — Complete Active Sortie First' : art.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {isLocked
                        ? 'Interact with the Base Main Computer Terminal after previous sortie.'
                        : art.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PAUSE MODAL */}
      {mode === 'paused' && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-[#020611]/75 p-4">
          <div className="w-full max-w-md rounded-lg border border-sky-400/35 bg-[#07101f] p-6 shadow-2xl space-y-5">
            <div className="border-b border-slate-700/70 pb-3">
              <div className="text-xs font-mono tracking-widest text-sky-400">
                ASAAR // STANDBY
              </div>
              <h2 className="mt-1 text-xl font-mono font-bold text-slate-100">
                SIMULATION PAUSED
              </h2>
            </div>

            <div className="space-y-2 text-xs font-mono text-slate-300">
              <div className="flex justify-between">
                <span>Move / Drive Rover</span>
                <span className="text-sky-300">WASD / Shift</span>
              </div>
              <div className="flex justify-between">
                <span>Low-G Hop (0.16g)</span>
                <span className="text-sky-300">Space</span>
              </div>
              <div className="flex justify-between">
                <span>Board / Exit Lunar Rover</span>
                <span className="text-sky-300">F</span>
              </div>
              <div className="flex justify-between">
                <span>Airlock / Consoles / Salvage</span>
                <span className="text-sky-300">E</span>
              </div>
              <div className="flex justify-between">
                <span>Toggle 1P / 3P Camera</span>
                <span className="text-sky-300">V</span>
              </div>
              <div className="flex justify-between">
                <span>Salvage Manifest</span>
                <span className="text-sky-300">Tab</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={onResume}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-sky-500 px-4 py-2.5 text-xs font-mono font-bold tracking-wider text-slate-950 hover:bg-sky-400 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                RESUME
              </button>
              <button
                type="button"
                onClick={onOpenArchive}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-amber-400/55 bg-amber-500/15 px-4 py-2.5 text-xs font-mono font-bold tracking-wider text-amber-200 hover:bg-amber-500/25 cursor-pointer"
              >
                <Landmark className="h-3.5 w-3.5" />
                ARCHIVE
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-4 py-2.5 text-xs font-mono font-bold tracking-wider text-slate-200 hover:border-sky-400/50 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                RESTART
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CRITICAL TELEMETRY / GAME OVER MODAL */}
      {mode === 'critical' && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-[#020611]/82 p-4">
          <div className="w-full max-w-md rounded-lg border border-rose-500/50 bg-[#0b0f1c] p-6 shadow-2xl space-y-4">
            <div className="text-xs font-mono font-bold tracking-widest text-rose-400">
              EMERGENCY SUIT LOCKOUT
            </div>
            <h2 className="text-xl font-mono font-bold text-slate-100">
              LIFE SUPPORT RESERVES DEPLETED
            </h2>
            <p className="text-xs leading-relaxed font-mono text-slate-300">
              Your suit oxygen or power reserves dropped to zero. Sync with glowing blue control
              consoles inside the base or salvage mission hardware on the surface to sustain suit
              reserves.
            </p>
            <button
              type="button"
              onClick={onRestart}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-sky-500 px-4 py-2.5 text-xs font-mono font-bold tracking-wider text-slate-950 hover:bg-sky-400 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              REBOOT ASAAR MISSION
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
