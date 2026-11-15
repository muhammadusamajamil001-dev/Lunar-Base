export type GameMode = 'title' | 'playing' | 'paused' | 'critical';

export type CameraViewMode = 'first' | 'third';

export type LightingPreset = 'nominal' | 'amber';

export type NarrativeStage =
  | 'alarm'
  | 'transmission'
  | 'salvage'
  | 'core_ready'
  | 'restored';

export type EnvironmentZone = 'interior' | 'surface';

export type ControlMode = 'foot' | 'rover';

export type FinalePhase = 'none' | 'ignition' | 'ascension' | 'transmission';

export type ArtifactKind =
  | 'lrv_battery'
  | 'alsep_rtg'
  | 'lm_tank'
  | 'apollo11_pse'
  | 'surveyor3_scoop'
  | 'lunokhod1_solar'
  | 'yutu_motor'
  | 'vikram_thruster'
  | 'beresheet_engine'
  | 'odysseus_gear';

export interface TerminalPromptInfo {
  id: string;
  label: string;
  actionLabel: string;
  effectText: string;
}

export interface StudyBullet {
  label: string;
  value: string;
}

export interface ArtifactQuiz {
  question: string;
  options: string[];
  correctIndex: number;
  hint: string;
}

export interface SalvageArtifactInfo {
  id: string;
  kind: ArtifactKind;
  name: string;
  mission: string;
  year: number;
  agency: string;
  country: string;
  partCategory: string;
  description: string;
  realHistory: string;
  failureReason: string;
  missionSignificance: string;
  coordLabel: string;
  studyBullets: StudyBullet[];
  quizzes: ArtifactQuiz[];
  collected: boolean;
  distanceMeters: number;
  bearingDeg: number;
}

export interface HudSnapshot {
  oxygen: number;
  energy: number;
  pressureKpa: number;
  cabinTempC: number;
  solarState: 'sunlight' | 'shadow' | 'interior';
  powerDeltaPerSec: number;
  frostLevel: number;
  sectorName: string;
  viewMode: CameraViewMode;
  lightingPreset: LightingPreset;
  pointerLocked: boolean;
  nearbyTerminal: TerminalPromptInfo | null;
  statusBanner: string | null;
  narrativeStage: NarrativeStage;
  finaleActive: boolean;
  finalePhase: FinalePhase;
  finaleElapsed: number;
  transmissionOpen: boolean;
  studyTerminalOpen: boolean;
  sortieBriefed: boolean;
  activeTargetIndex: number;
  activeTarget: SalvageArtifactInfo | null;
  baseReturnDistanceMeters: number;
  baseReturnBearingDeg: number;
  environmentZone: EnvironmentZone;
  controlMode: ControlMode;
  artifactsCollected: number;
  artifactsTotal: number;
  artifacts: SalvageArtifactInfo[];
  nearbyArtifact: SalvageArtifactInfo | null;
  inspectedArtifact: SalvageArtifactInfo | null;
  canBoardRover: boolean;
  canUseAirlock: boolean;
  roverSpeedKmh: number;
}
