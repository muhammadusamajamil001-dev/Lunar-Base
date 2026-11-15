import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';
import { TerminalPromptInfo } from '../types/game';
import {
  createLunarRover,
  createSalvageArtifacts,
  createSurfaceDustPool,
  getLunarSurfaceHeight,
  LunarRoverRig,
  SalvageArtifactEntity,
  SurfaceDustTrailPool,
} from './lunarSurfaceObjects';

export interface WalkableRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  sectorName: string;
}

export interface ObstacleBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface InteractiveTerminal extends TerminalPromptInfo {
  position: THREE.Vector3;
  screenMesh: THREE.Mesh;
  beaconLight: THREE.PointLight;
  accentRing: THREE.Mesh;
  type: 'lifeSupport' | 'powerGrid' | 'lunarSurvey' | 'airlock';
}

export interface LunarBaseSceneData {
  walkableRects: WalkableRect[];
  obstacles: ObstacleBox[];
  terminals: InteractiveTerminal[];
  earthGroup: THREE.Group;
  earthMesh: THREE.Mesh;
  cloudMesh: THREE.Mesh;
  holoGlobe: THREE.Group;
  holoBannerMesh: THREE.Mesh;
  holoBannerMat: THREE.MeshStandardMaterial;
  holoMoonMat: THREE.MeshStandardMaterial;
  cyanEmissiveMat: THREE.MeshStandardMaterial;
  softBlueStripMat: THREE.MeshStandardMaterial;
  warmAccentMat: THREE.MeshStandardMaterial;
  exteriorFloodLight: THREE.PointLight;
  cabinDust: THREE.Points;
  exteriorDust: THREE.Points;
  interiorLights: THREE.PointLight[];
  windowStrips: THREE.Mesh[];
  rover: LunarRoverRig;
  artifacts: SalvageArtifactEntity[];
  dustPool: SurfaceDustTrailPool;
  dispose: () => void;
}

export function buildLunarBaseEnvironment(
  scene: THREE.Scene,
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean,
): LunarBaseSceneData {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // Shared PBR Materials
  const deckMat = track(
    new THREE.MeshStandardMaterial({
      map: textures.deckColor,
      roughnessMap: textures.deckRoughness,
      roughness: 0.78,
      metalness: 0.32,
    }),
  );

  const hullMat = track(
    new THREE.MeshStandardMaterial({
      map: textures.hullColor,
      roughnessMap: textures.hullRoughness,
      roughness: 0.56,
      metalness: 0.18,
      flatShading: true,
    }),
  );

  const darkFrameMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.42,
      metalness: 0.78,
      flatShading: true,
    }),
  );

  const titaniumTrimMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.34,
      metalness: 0.82,
      flatShading: true,
    }),
  );

  const cyanEmissiveMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 2.2,
      roughness: 0.25,
      metalness: 0.1,
    }),
  );

  const softBlueStripMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.5,
      roughness: 0.3,
      metalness: 0.1,
    }),
  );

  const warmAccentMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 1.2,
      roughness: 0.3,
      metalness: 0.2,
    }),
  );

  const glassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xbfe6ff,
      roughness: 0.06,
      metalness: 0.05,
      transmission: isSoftwareGl ? 0 : 0.9,
      transparent: true,
      opacity: isSoftwareGl ? 0.2 : 1,
      ior: 1.52,
      thickness: 0.15,
      clearcoat: 1.0,
      depthWrite: false,
    }),
  );

  const floraMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x15803d,
      emissiveIntensity: 0.45,
      roughness: 0.65,
      metalness: 0.05,
      flatShading: true,
    }),
  );

  const baseGroup = new THREE.Group();
  baseGroup.name = 'LunarBaseInterior';
  scene.add(baseGroup);

  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    castShadow = true,
    receiveShadow = true,
  ) => {
    const geo = track(new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    baseGroup.add(mesh);
    return mesh;
  };

  // =========================================================================
  // 1. FLOORS & CEILINGS (Offset slightly from ground to avoid Z-fighting)
  // =========================================================================
  // Observation Hub floor (x: -7..7, z: -8..0)
  addBox(14.2, 0.3, 8.2, 0, -0.15, -3.9, deckMat, false, true);
  // Central Spine Corridor floor (x: -2.4..2.4, z: 0..7)
  addBox(4.8, 0.3, 7.2, 0, -0.15, 3.5, deckMat, false, true);
  // West Wing + Corridor floor
  addBox(8.6, 0.3, 6.6, -6.5, -0.15, 1.6, deckMat, false, true);
  // East Wing + Corridor floor
  addBox(8.6, 0.3, 6.6, 6.5, -0.15, 1.6, deckMat, false, true);
  // South Airlock Bay floor
  addBox(9.8, 0.3, 4.6, 0, -0.15, 9.0, deckMat, false, true);

  // Glowing cyan perimeter floor trim strips (slightly raised y = 0.015 to avoid coplanar z-fighting)
  const windowStrips: THREE.Mesh[] = [];
  const addFloorStrip = (w: number, d: number, x: number, z: number) => {
    const strip = addBox(w, 0.03, d, x, 0.015, z, softBlueStripMat, false, false);
    windowStrips.push(strip);
  };
  addFloorStrip(12.6, 0.08, 0, -7.25);
  addFloorStrip(0.08, 7.2, -1.6, 3.2);
  addFloorStrip(0.08, 7.2, 1.6, 3.2);
  addFloorStrip(3.6, 0.08, -4.1, 1.35);
  addFloorStrip(3.6, 0.08, -4.1, 3.05);
  addFloorStrip(3.6, 0.08, 4.1, 1.35);
  addFloorStrip(3.6, 0.08, 4.1, 3.05);

  // Ceilings
  addBox(14.4, 0.35, 8.4, 0, 4.65, -3.9, hullMat, true, true);
  addBox(5.0, 0.35, 7.2, 0, 3.75, 3.5, hullMat, true, true);
  addBox(8.8, 0.35, 6.8, -6.5, 3.85, 1.6, hullMat, true, true);
  addBox(8.8, 0.35, 6.8, 6.5, 3.85, 1.6, hullMat, true, true);
  addBox(10.0, 0.35, 4.8, 0, 3.95, 9.0, hullMat, true, true);

  // =========================================================================
  // 2. LARGE PANORAMIC OBSERVATION WINDOW (North wall z = -7.8, overlooking Earth & Craters)
  // =========================================================================
  // Lower knee-wall sill
  addBox(14.2, 0.85, 0.45, 0, 0.425, -7.75, darkFrameMat);
  // Top bulkhead header above glass
  addBox(14.2, 0.55, 0.55, 0, 4.35, -7.75, darkFrameMat);

  // Angled heavy structural mullions dividing panoramic glass into 5 sweeping bays
  const mullionXs = [-6.9, -3.5, 0, 3.5, 6.9];
  mullionXs.forEach((mx) => {
    const mullion = addBox(0.24, 3.45, 0.36, mx, 2.52, -7.75, darkFrameMat);
    mullion.rotation.x = 0.06;
  });

  // Safety railing in front of window
  addBox(12.8, 0.06, 0.06, 0, 1.02, -7.32, titaniumTrimMat);
  for (let rx = -6.0; rx <= 6.0; rx += 2.0) {
    addBox(0.06, 1.02, 0.06, rx, 0.51, -7.32, darkFrameMat);
  }

  // Panoramic Window Optical Glass Pane
  const windowGlassGeo = track(new THREE.PlaneGeometry(13.6, 3.25));
  const windowGlass = new THREE.Mesh(windowGlassGeo, glassMat);
  windowGlass.position.set(0, 2.45, -7.75);
  windowGlass.rotation.x = 0.06;
  windowGlass.renderOrder = 6;
  baseGroup.add(windowGlass);

  // Overhead sloped observation canopy ribs + Exterior luminous roof crown & perimeter trim
  for (let rx = -5.25; rx <= 5.25; rx += 3.5) {
    const rib = addBox(0.32, 0.38, 7.6, rx, 4.38, -3.9, darkFrameMat);
    rib.castShadow = true;
    addBox(0.14, 0.08, 8.3, rx, 4.86, -3.9, softBlueStripMat, false, false);
  }
  // Exterior Observation Atrium Perimeter Glow Trim & Gold Crest Frame
  addBox(14.5, 0.14, 0.18, 0, 4.86, -8.0, warmAccentMat, false, false);
  addBox(14.5, 0.14, 0.18, 0, 4.86, 0.25, cyanEmissiveMat, false, false);
  addBox(0.18, 0.14, 8.4, -7.15, 4.86, -3.9, cyanEmissiveMat, false, false);
  addBox(0.18, 0.14, 8.4, 7.15, 4.86, -3.9, cyanEmissiveMat, false, false);
  // Exterior Wing & Airlock Roof Beacon Stripes
  addBox(8.6, 0.12, 0.18, -6.5, 4.06, -1.65, softBlueStripMat, false, false);
  addBox(8.6, 0.12, 0.18, 6.5, 4.06, -1.65, softBlueStripMat, false, false);
  addBox(9.8, 0.12, 0.18, 0, 4.18, 11.25, warmAccentMat, false, false);
  addBox(3.4, 0.12, 0.14, 0, 3.32, 11.25, cyanEmissiveMat, false, false);

  const exteriorFloodLight = new THREE.PointLight(0x38bdf8, 0.8, 42, 1.3);
  exteriorFloodLight.position.set(0, 7.8, -11.5);
  scene.add(exteriorFloodLight);

  // =========================================================================
  // 3. BULKHEAD WALLS & SLEEK SCI-FI CORRIDOR RIBS
  // =========================================================================
  // Observation Hub side & south walls (leaving center doorway x: -2.2..2.2)
  addBox(0.4, 4.5, 8.2, -7.0, 2.25, -3.9, hullMat);
  addBox(0.4, 4.5, 8.2, 7.0, 2.25, -3.9, hullMat);
  addBox(4.8, 4.5, 0.4, -4.6, 2.25, -0.2, hullMat);
  addBox(4.8, 4.5, 0.4, 4.6, 2.25, -0.2, hullMat);
  // Header over Observation->Corridor archway
  addBox(4.6, 1.0, 0.5, 0, 4.0, -0.2, darkFrameMat);

  // Central Corridor walls (z: -0.2..6.8) with doorways at z: 1.0..3.4
  addBox(0.4, 3.6, 1.4, -2.3, 1.8, 0.35, hullMat);
  addBox(0.4, 3.6, 3.6, -2.3, 1.8, 5.1, hullMat);
  addBox(0.4, 3.6, 1.4, 2.3, 1.8, 0.35, hullMat);
  addBox(0.4, 3.6, 3.6, 2.3, 1.8, 5.1, hullMat);

  // Chamfered octagon ribs along Central Corridor
  const corridorZ = [0.1, 2.2, 4.3, 6.4];
  corridorZ.forEach((cz) => {
    // Side pillars
    addBox(0.22, 3.4, 0.28, -2.05, 1.7, cz, darkFrameMat);
    addBox(0.22, 3.4, 0.28, 2.05, 1.7, cz, darkFrameMat);
    // Overhead rib + glowing cyan light strip
    addBox(4.3, 0.24, 0.28, 0, 3.52, cz, darkFrameMat);
    addBox(2.4, 0.06, 0.1, 0, 3.38, cz, softBlueStripMat, false, false);
    // Angled corner bevel struts
    const strutL = addBox(0.22, 0.9, 0.26, -1.78, 3.22, cz, titaniumTrimMat);
    strutL.rotation.z = -Math.PI / 4;
    const strutR = addBox(0.22, 0.9, 0.26, 1.78, 3.22, cz, titaniumTrimMat);
    strutR.rotation.z = Math.PI / 4;
  });

  // West Corridor connecting Central to West Life Support Bay
  addBox(3.6, 3.6, 0.35, -4.05, 1.8, 0.95, hullMat);
  addBox(3.6, 3.6, 0.35, -4.05, 1.8, 3.45, hullMat);
  addBox(3.6, 0.65, 2.8, -4.05, 3.35, 2.2, darkFrameMat);
  addBox(0.24, 0.06, 1.8, -3.5, 3.0, 2.2, softBlueStripMat, false, false);
  addBox(0.24, 0.06, 1.8, -4.8, 3.0, 2.2, softBlueStripMat, false, false);

  // East Corridor connecting Central to East Solar Bay
  addBox(3.6, 3.6, 0.35, 4.05, 1.8, 0.95, hullMat);
  addBox(3.6, 3.6, 0.35, 4.05, 1.8, 3.45, hullMat);
  addBox(3.6, 0.65, 2.8, 4.05, 3.35, 2.2, darkFrameMat);
  addBox(0.24, 0.06, 1.8, 3.5, 3.0, 2.2, softBlueStripMat, false, false);
  addBox(0.24, 0.06, 1.8, 4.8, 3.0, 2.2, softBlueStripMat, false, false);

  // West Life Support & Hydroponics Bay perimeter (x: -10.5..-5.7, z: -1.6..4.8)
  addBox(0.4, 3.8, 6.8, -10.5, 1.9, 1.6, hullMat);
  addBox(5.2, 3.8, 0.4, -8.1, 1.9, -1.6, hullMat);
  addBox(5.2, 3.8, 0.4, -8.1, 1.9, 4.8, hullMat);
  addBox(0.4, 3.8, 2.8, -5.7, 1.9, -0.3, hullMat);
  addBox(0.4, 3.8, 1.6, -5.7, 1.9, 4.1, hullMat);

  // East Solar & Comms Bay perimeter (x: 5.7..10.5, z: -1.6..4.8)
  addBox(0.4, 3.8, 6.8, 10.5, 1.9, 1.6, hullMat);
  addBox(5.2, 3.8, 0.4, 8.1, 1.9, -1.6, hullMat);
  addBox(5.2, 3.8, 0.4, 8.1, 1.9, 4.8, hullMat);
  addBox(0.4, 3.8, 2.8, 5.7, 1.9, -0.3, hullMat);
  addBox(0.4, 3.8, 1.6, 5.7, 1.9, 4.1, hullMat);

  // South Airlock Bay perimeter (x: -4.9..4.9, z: 6.7..11.2)
  addBox(2.8, 3.8, 0.4, -3.5, 1.9, 6.7, hullMat);
  addBox(2.8, 3.8, 0.4, 3.5, 1.9, 6.7, hullMat);
  addBox(0.4, 3.8, 4.8, -4.9, 1.9, 9.0, hullMat);
  addBox(0.4, 3.8, 4.8, 4.9, 1.9, 9.0, hullMat);
  addBox(10.0, 3.8, 0.4, 0, 1.9, 11.2, hullMat);

  // Heavy Composite Airlock Door on South Wall (multi-part 3-12 part assembly)
  const airlockGroup = new THREE.Group();
  airlockGroup.position.set(0, 0, 10.95);
  baseGroup.add(airlockGroup);

  const doorFrame = new THREE.Mesh(track(new THREE.BoxGeometry(3.2, 3.1, 0.32)), darkFrameMat);
  doorFrame.position.set(0, 1.55, 0);
  airlockGroup.add(doorFrame);

  const doorLeafL = new THREE.Mesh(track(new THREE.BoxGeometry(1.15, 2.55, 0.2)), titaniumTrimMat);
  doorLeafL.position.set(-0.6, 1.32, -0.06);
  airlockGroup.add(doorLeafL);

  const doorLeafR = new THREE.Mesh(track(new THREE.BoxGeometry(1.15, 2.55, 0.2)), titaniumTrimMat);
  doorLeafR.position.set(0.6, 1.32, -0.06);
  airlockGroup.add(doorLeafR);

  const lockWheel = new THREE.Mesh(track(new THREE.TorusGeometry(0.32, 0.05, 8, 18)), warmAccentMat);
  lockWheel.position.set(0, 1.4, -0.18);
  airlockGroup.add(lockWheel);

  const airlockHeaderGlow = new THREE.Mesh(track(new THREE.BoxGeometry(2.2, 0.1, 0.14)), cyanEmissiveMat);
  airlockHeaderGlow.position.set(0, 2.86, -0.14);
  airlockGroup.add(airlockHeaderGlow);

  // =========================================================================
  // 4. INTERIOR HERO PROPS & GLOWING BLUE CONTROL PANELS (Interactive!)
  // =========================================================================
  const obstacles: ObstacleBox[] = [];
  const terminals: InteractiveTerminal[] = [];
  const interiorLights: THREE.PointLight[] = [];

  // 4A. Central Holographic Lunar Globe Pedestal in Observation Hub (0, 0, -4.1)
  const holoPedestalGroup = new THREE.Group();
  holoPedestalGroup.position.set(0, 0, -4.1);
  baseGroup.add(holoPedestalGroup);

  const pedBase = new THREE.Mesh(track(new THREE.CylinderGeometry(1.05, 1.25, 0.35, 8)), darkFrameMat);
  pedBase.position.y = 0.175;
  pedBase.castShadow = true;
  pedBase.receiveShadow = true;
  holoPedestalGroup.add(pedBase);

  const pedColumn = new THREE.Mesh(track(new THREE.CylinderGeometry(0.72, 0.92, 0.65, 8)), titaniumTrimMat);
  pedColumn.position.y = 0.66;
  pedColumn.castShadow = true;
  holoPedestalGroup.add(pedColumn);

  const pedRing = new THREE.Mesh(track(new THREE.TorusGeometry(0.86, 0.045, 8, 24)), cyanEmissiveMat);
  pedRing.rotation.x = Math.PI / 2;
  pedRing.position.y = 1.02;
  holoPedestalGroup.add(pedRing);

  const holoGlobe = new THREE.Group();
  holoGlobe.position.y = 1.56;
  holoPedestalGroup.add(holoGlobe);

  const holoMoonMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.1,
      wireframe: true,
      transparent: true,
      opacity: 0.78,
    }),
  );
  const holoCoreMesh = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.46, 1)), holoMoonMat);
  holoGlobe.add(holoCoreMesh);

  const holoOrbitRing = new THREE.Mesh(track(new THREE.TorusGeometry(0.64, 0.015, 6, 36)), cyanEmissiveMat);
  holoOrbitRing.rotation.x = Math.PI / 3;
  holoGlobe.add(holoOrbitRing);

  // Floating Holographic Earth HQ Transmission Banner above central terminal
  const holoBannerMat = track(
    new THREE.MeshStandardMaterial({
      map: textures.holoTransmission,
      emissiveMap: textures.holoTransmission,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
      roughness: 0.2,
    }),
  );
  const holoBannerMesh = new THREE.Mesh(track(new THREE.PlaneGeometry(2.15, 1.08)), holoBannerMat);
  holoBannerMesh.position.set(0, 2.55, 0);
  holoPedestalGroup.add(holoBannerMesh);

  obstacles.push({ minX: -1.18, maxX: 1.18, minZ: -5.28, maxZ: -2.92 });

  // 4B. Hydroponic O2 Core Pod (West Wing: x = -8.6, z = 0.2)
  const hydroGroup = new THREE.Group();
  hydroGroup.position.set(-8.6, 0, 0.2);
  baseGroup.add(hydroGroup);

  const hydroBase = new THREE.Mesh(track(new THREE.CylinderGeometry(0.95, 1.08, 0.45, 10)), darkFrameMat);
  hydroBase.position.y = 0.225;
  hydroBase.castShadow = true;
  hydroGroup.add(hydroBase);

  const hydroGlass = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.78, 0.78, 2.4, 12)),
    glassMat,
  );
  hydroGlass.position.y = 1.62;
  hydroGlass.renderOrder = 4;
  hydroGroup.add(hydroGlass);

  const hydroCap = new THREE.Mesh(track(new THREE.CylinderGeometry(0.95, 0.88, 0.35, 10)), darkFrameMat);
  hydroCap.position.y = 2.95;
  hydroGroup.add(hydroCap);

  // Stylized low-poly hydroponic flora inside cylinder
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const stalk = new THREE.Mesh(track(new THREE.ConeGeometry(0.24, 1.35, 6)), floraMat);
    stalk.position.set(Math.cos(angle) * 0.28, 1.25 + (i % 2) * 0.22, Math.sin(angle) * 0.28);
    hydroGroup.add(stalk);
  }
  const hydroCoreGlow = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 8)), cyanEmissiveMat);
  hydroCoreGlow.position.y = 1.62;
  hydroGroup.add(hydroCoreGlow);

  obstacles.push({ minX: -9.6, maxX: -7.6, minZ: -0.8, maxZ: 1.2 });

  // 4C. Solar Capacitor Reactor Core (East Wing: x = 8.6, z = 0.2)
  const reactorGroup = new THREE.Group();
  reactorGroup.position.set(8.6, 0, 0.2);
  baseGroup.add(reactorGroup);

  const reacBase = new THREE.Mesh(track(new THREE.BoxGeometry(1.7, 0.5, 1.7)), darkFrameMat);
  reacBase.position.y = 0.25;
  reacBase.castShadow = true;
  reactorGroup.add(reacBase);

  const reacPillar = new THREE.Mesh(track(new THREE.CylinderGeometry(0.45, 0.52, 2.3, 8)), titaniumTrimMat);
  reacPillar.position.y = 1.6;
  reacPillar.castShadow = true;
  reactorGroup.add(reacPillar);

  for (let r = 0; r < 3; r++) {
    const coil = new THREE.Mesh(track(new THREE.TorusGeometry(0.62, 0.06, 8, 16)), cyanEmissiveMat);
    coil.rotation.x = Math.PI / 2;
    coil.position.y = 0.95 + r * 0.62;
    reactorGroup.add(coil);
  }
  obstacles.push({ minX: 7.7, maxX: 9.5, minZ: -0.7, maxZ: 1.1 });

  // Helper: Build a composite 6-part glowing blue control console
  const buildControlConsole = (
    id: string,
    type: 'lifeSupport' | 'powerGrid' | 'lunarSurvey' | 'airlock',
    label: string,
    actionLabel: string,
    effectText: string,
    x: number,
    z: number,
    rotY: number,
  ) => {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    baseGroup.add(group);

    // 1. Plinth base
    const plinth = new THREE.Mesh(track(new THREE.BoxGeometry(1.48, 0.22, 0.78)), darkFrameMat);
    plinth.position.y = 0.11;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);

    // 2. Pedestal body
    const body = new THREE.Mesh(track(new THREE.BoxGeometry(1.24, 0.85, 0.58)), hullMat);
    body.position.y = 0.62;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // 3. Angled keyboard desk shelf
    const desk = new THREE.Mesh(track(new THREE.BoxGeometry(1.38, 0.12, 0.68)), titaniumTrimMat);
    desk.position.set(0, 1.06, 0.1);
    desk.rotation.x = 0.22;
    desk.castShadow = true;
    group.add(desk);

    // 4. Dual upright display struts
    const strutGeo = track(new THREE.BoxGeometry(0.1, 0.68, 0.1));
    const strutL = new THREE.Mesh(strutGeo, darkFrameMat);
    strutL.position.set(-0.54, 1.38, -0.18);
    group.add(strutL);

    const strutR = new THREE.Mesh(strutGeo, darkFrameMat);
    strutR.position.set(0.54, 1.38, -0.18);
    group.add(strutR);

    // 5. Monitor bezel
    const bezel = new THREE.Mesh(track(new THREE.BoxGeometry(1.34, 0.82, 0.09)), darkFrameMat);
    bezel.position.set(0, 1.56, -0.16);
    bezel.rotation.x = -0.16;
    bezel.castShadow = true;
    group.add(bezel);

    // 6. Glowing blue holographic display screen
    const screenMat = track(
      new THREE.MeshStandardMaterial({
        map: textures.consoleScreens[type],
        emissiveMap: textures.consoleScreens[type],
        emissive: new THREE.Color(0x7dd3fc),
        emissiveIntensity: 1.55,
        roughness: 0.18,
        metalness: 0.08,
      }),
    );
    const screenMesh = new THREE.Mesh(track(new THREE.PlaneGeometry(1.22, 0.72)), screenMat);
    screenMesh.position.set(0, 1.56, -0.11);
    screenMesh.rotation.x = -0.16;
    group.add(screenMesh);

    // 7. Interactive cyan floor indicator ring in front of console
    const accentRing = new THREE.Mesh(
      track(new THREE.RingGeometry(0.32, 0.4, 24)),
      cyanEmissiveMat,
    );
    accentRing.rotation.x = -Math.PI / 2;
    accentRing.position.set(0, 0.025, 0.92);
    group.add(accentRing);

    // Console PointLight (blue glow spill)
    const beaconLight = new THREE.PointLight(0x38bdf8, 2.2, 6.5, 1.8);
    beaconLight.position.set(0, 1.75, 0.45);
    group.add(beaconLight);
    interiorLights.push(beaconLight);

    // Collider around console footprint
    obstacles.push({
      minX: x - 0.85,
      maxX: x + 0.85,
      minZ: z - 0.65,
      maxZ: z + 0.65,
    });

    terminals.push({
      id,
      type,
      label,
      actionLabel,
      effectText,
      position: new THREE.Vector3(x, 1.1, z),
      screenMesh,
      beaconLight,
      accentRing,
    });
  };

  // Place 4 Glowing Blue Control Panels across the lunar base
  buildControlConsole(
    'obs-survey',
    'lunarSurvey',
    'Observation Telemetry Console',
    'Run Crater & Earth-Link Scan',
    '+15% Suit Energy & Telemetry Sync',
    -3.8,
    -6.05,
    0,
  );
  buildControlConsole(
    'west-o2',
    'lifeSupport',
    'Atmospheric O2 Scrubber Console',
    'Refill Suit Oxygen Tank',
    '+45% Life Support O2',
    -8.4,
    3.55,
    Math.PI,
  );
  buildControlConsole(
    'east-pwr',
    'powerGrid',
    'Solar Capacitor Grid Terminal',
    'Recharge Suit Power Cell',
    '+50% Suit Energy',
    8.4,
    3.55,
    Math.PI,
  );
  buildControlConsole(
    'south-airlock',
    'airlock',
    'Airlock Pressure & Reserve Console',
    'Equalize & Top-Off Reserves',
    '+25% O2 & +25% Energy',
    2.6,
    9.85,
    -Math.PI * 0.75,
  );

  // Exterior South Airlock Ramp & Rover Pad (z: 11.4..14.8)
  addBox(3.8, 0.34, 3.6, 0, -0.18, 13.0, darkFrameMat, true, true);
  addBox(3.4, 0.06, 0.14, 0, 0.02, 14.7, cyanEmissiveMat, false, false);

  // =========================================================================
  // 5. EXTERIOR LUNAR VISTA: EXPANSIVE 440m CRATERED HILLS, ROCKS, STARFIELD & EARTH
  // =========================================================================
  textures.regolithColor.repeat.set(34, 34);
  const terrainGeo = track(new THREE.PlaneGeometry(440, 440, 128, 128));
  terrainGeo.rotateX(-Math.PI / 2);

  const posAttr = terrainGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    posAttr.setY(i, getLunarSurfaceHeight(vx, vz));
  }
  terrainGeo.computeVertexNormals();

  const regolithMat = track(
    new THREE.MeshStandardMaterial({
      map: textures.regolithColor,
      color: 0x9aa2b0,
      roughness: 0.94,
      metalness: 0.04,
      flatShading: true,
    }),
  );

  const lunarTerrain = new THREE.Mesh(terrainGeo, regolithMat);
  lunarTerrain.receiveShadow = true;
  scene.add(lunarTerrain);

  // InstancedMesh Low-Poly Basalt Boulders & Outcrops (420 rocks seated on surface)
  const rockCount = 420;
  const rockGeo = track(new THREE.DodecahedronGeometry(0.65, 0));
  const rockMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.08,
      flatShading: true,
    }),
  );
  const rocksInstanced = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rocksInstanced.castShadow = !isSoftwareGl;
  rocksInstanced.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const rockColor = new THREE.Color();
  let rockSeed = 9001;
  const rockRand = () => {
    rockSeed = (rockSeed * 16807) % 2147483647;
    return (rockSeed - 1) / 2147483646;
  };

  for (let i = 0; i < rockCount; i++) {
    const angle = rockRand() * Math.PI * 2;
    const dist = 21 + Math.pow(rockRand(), 0.72) * 148;
    const rx = Math.cos(angle) * dist;
    const rz = Math.sin(angle) * dist;

    // Mix small cobbles and larger lunar boulder outcrops
    const isLargeOutcrop = i % 11 === 0;
    const sx = (isLargeOutcrop ? 1.8 : 0.4) + rockRand() * (isLargeOutcrop ? 2.6 : 1.6);
    const sy = (isLargeOutcrop ? 1.1 : 0.3) + rockRand() * (isLargeOutcrop ? 1.8 : 1.0);
    const sz = (isLargeOutcrop ? 1.7 : 0.4) + rockRand() * (isLargeOutcrop ? 2.4 : 1.5);

    const surfY = getLunarSurfaceHeight(rx, rz);
    dummy.position.set(rx, surfY + sy * 0.18, rz);
    dummy.rotation.set(rockRand() * Math.PI, rockRand() * Math.PI, rockRand() * Math.PI);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    rocksInstanced.setMatrixAt(i, dummy.matrix);

    const shade = 0.38 + rockRand() * 0.28;
    rockColor.setRGB(shade, shade * 1.02, shade * 1.08);
    rocksInstanced.setColorAt(i, rockColor);
  }
  rocksInstanced.instanceMatrix.needsUpdate = true;
  if (rocksInstanced.instanceColor) rocksInstanced.instanceColor.needsUpdate = true;
  rocksInstanced.computeBoundingSphere();
  scene.add(rocksInstanced);

  // Exterior Solar Array Towers & Comm Dish visible through the Observation Window
  const buildSolarTower = (x: number, z: number, rotY: number) => {
    const g = new THREE.Group();
    g.position.set(x, -0.35, z);
    g.rotation.y = rotY;
    scene.add(g);

    const foot = new THREE.Mesh(track(new THREE.CylinderGeometry(0.45, 0.65, 0.4, 6)), darkFrameMat);
    foot.position.y = 0.2;
    g.add(foot);

    const mast = new THREE.Mesh(track(new THREE.CylinderGeometry(0.12, 0.16, 3.6, 8)), titaniumTrimMat);
    mast.position.y = 2.0;
    mast.castShadow = !isSoftwareGl;
    g.add(mast);

    const solarPanelMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x0f3b6e,
        emissive: 0x061b36,
        emissiveIntensity: 0.4,
        roughness: 0.2,
        metalness: 0.85,
      }),
    );
    const wing = new THREE.Mesh(track(new THREE.BoxGeometry(4.4, 0.08, 1.55)), solarPanelMat);
    wing.position.y = 3.7;
    wing.rotation.x = 0.42;
    wing.castShadow = !isSoftwareGl;
    g.add(wing);

    const beacon = new THREE.Mesh(track(new THREE.SphereGeometry(0.1, 8, 8)), cyanEmissiveMat);
    beacon.position.y = 3.95;
    g.add(beacon);
  };

  buildSolarTower(-13.5, -18.5, 0.35);
  buildSolarTower(14.5, -21.0, -0.4);
  buildSolarTower(-21.0, -29.0, 0.25);

  // Starfield Dome
  const starCount = 1800;
  const starGeo = track(new THREE.BufferGeometry());
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);

  let sSeed = 7777;
  const sRand = () => {
    sSeed = (sSeed * 16807) % 2147483647;
    return (sSeed - 1) / 2147483646;
  };
  for (let i = 0; i < starCount; i++) {
    const theta = sRand() * Math.PI * 2;
    const phi = Math.acos(sRand() * 0.92 + 0.04); // Upper hemisphere
    const r = 320 + sRand() * 45;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    const tint = sRand();
    if (tint < 0.25) {
      starCol[i * 3] = 0.72;
      starCol[i * 3 + 1] = 0.88;
      starCol[i * 3 + 2] = 1.0;
    } else if (tint < 0.4) {
      starCol[i * 3] = 1.0;
      starCol[i * 3 + 1] = 0.92;
      starCol[i * 3 + 2] = 0.78;
    } else {
      starCol[i * 3] = 0.95;
      starCol[i * 3 + 1] = 0.97;
      starCol[i * 3 + 2] = 1.0;
    }
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  const starMat = track(
    new THREE.PointsMaterial({
      size: 0.95,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      fog: false,
    }),
  );
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // Luminous Earth hanging above the horizon outside the panoramic observation window
  const earthGroup = new THREE.Group();
  earthGroup.position.set(28, 48, -240);
  earthGroup.scale.setScalar(1.85);
  scene.add(earthGroup);

  const earthMat = track(
    new THREE.MeshStandardMaterial({
      map: textures.earthColor,
      roughness: 0.65,
      metalness: 0.05,
      emissive: 0x0b2a52,
      emissiveIntensity: 0.45,
      fog: false,
    }),
  );
  const earthMesh = new THREE.Mesh(track(new THREE.SphereGeometry(12.5, 36, 36)), earthMat);
  earthMesh.rotation.z = 0.32;
  earthGroup.add(earthMesh);

  const cloudMat = track(
    new THREE.MeshStandardMaterial({
      map: textures.earthClouds,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      fog: false,
    }),
  );
  const cloudMesh = new THREE.Mesh(track(new THREE.SphereGeometry(12.75, 32, 32)), cloudMat);
  earthGroup.add(cloudMesh);

  // Atmospheric blue rim halo around Earth
  const earthHaloMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.16,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  const earthHalo = new THREE.Mesh(track(new THREE.SphereGeometry(13.6, 32, 32)), earthHaloMat);
  earthGroup.add(earthHalo);

  // =========================================================================
  // 6. SUBTLE LUNAR DUST & CABIN MOTE PARTICLES
  // =========================================================================
  const createDustField = (
    count: number,
    xSpan: number,
    yMin: number,
    yMax: number,
    zMin: number,
    zMax: number,
    size: number,
    opacity: number,
    colorHex: number,
  ) => {
    const geo = track(new THREE.BufferGeometry());
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (sRand() - 0.5) * xSpan;
      arr[i * 3 + 1] = yMin + sRand() * (yMax - yMin);
      arr[i * 3 + 2] = zMin + sRand() * (zMax - zMin);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = track(
      new THREE.PointsMaterial({
        map: textures.dustParticle,
        color: colorHex,
        size,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    return pts;
  };

  // Subtle floating cabin micro-motes catching sunbeams inside the base
  const cabinDust = createDustField(140, 20, 0.25, 3.8, -7.2, 10.5, 0.085, 0.42, 0xbae6fd);
  // Subtle lunar regolith dust drifting over craters outside the observation window
  const exteriorDust = createDustField(200, 56, 0.1, 4.2, -52, -10, 0.16, 0.28, 0xcbd5e1);

  // Corridor & Wing accent PointLights (<= 6 total lights for fast shaders)
  const createWingLight = (x: number, y: number, z: number, color: number, intensity: number, dist: number) => {
    const l = new THREE.PointLight(color, intensity, dist, 1.8);
    l.position.set(x, y, z);
    scene.add(l);
    interiorLights.push(l);
    return l;
  };
  createWingLight(0, 3.9, -4.0, 0xdbeafe, 6.5, 16);
  createWingLight(0, 3.1, 3.2, 0x7dd3fc, 4.0, 11);
  createWingLight(-8.2, 3.2, 1.4, 0x38bdf8, 4.5, 12);
  createWingLight(8.2, 3.2, 1.4, 0x38bdf8, 4.5, 12);
  createWingLight(0, 3.3, 8.8, 0x93c5fd, 4.2, 11);

  // Walkable floor zones (corridors overlap adjacent bays by >= 1.1m across every doorway)
  const walkableRects: WalkableRect[] = [
    { minX: -6.75, maxX: 6.75, minZ: -7.15, maxZ: -0.45, sectorName: 'OBSERVATION DECK' },
    { minX: -2.05, maxX: 2.05, minZ: -1.65, maxZ: 8.05, sectorName: 'CENTRAL CORRIDOR' },
    { minX: -7.05, maxX: -0.95, minZ: 1.15, maxZ: 3.25, sectorName: 'WEST CORRIDOR' },
    { minX: -10.25, maxX: -5.85, minZ: -1.35, maxZ: 4.55, sectorName: 'LIFE SUPPORT BAY' },
    { minX: 0.95, maxX: 7.05, minZ: 1.15, maxZ: 3.25, sectorName: 'EAST CORRIDOR' },
    { minX: 5.85, maxX: 10.25, minZ: -1.35, maxZ: 4.55, sectorName: 'SOLAR & COMMS BAY' },
    { minX: -4.65, maxX: 4.65, minZ: 6.85, maxZ: 10.85, sectorName: 'AIRLOCK BAY' },
  ];

  // Instantiate Lunar Rover on South Airlock Pad & 10 Historical Salvage Artifacts
  const rover = createLunarRover(scene, disposables);
  rover.root.position.set(0, getLunarSurfaceHeight(0, 16.8), 16.8);
  rover.root.rotation.y = Math.PI; // Facing outward (+Z) toward southern craters

  const artifacts = createSalvageArtifacts(scene, disposables);
  const dustPool = createSurfaceDustPool(scene, textures.dustParticle, disposables);

  return {
    walkableRects,
    obstacles,
    terminals,
    earthGroup,
    earthMesh,
    cloudMesh,
    holoGlobe,
    holoBannerMesh,
    holoBannerMat,
    holoMoonMat,
    cyanEmissiveMat,
    softBlueStripMat,
    warmAccentMat,
    exteriorFloodLight,
    cabinDust,
    exteriorDust,
    interiorLights,
    windowStrips,
    rover,
    artifacts,
    dustPool,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
