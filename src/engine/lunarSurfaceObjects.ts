import * as THREE from 'three';
import { ArtifactKind, ArtifactQuiz, SalvageArtifactInfo, StudyBullet } from '../types/game';

export const LUNAR_GRAVITY = 1.62; // Real 1/6 Earth gravity (m/s^2)

export interface WaypointArrowRig {
  root: THREE.Group;
  arrowBody: THREE.Group;
  holoMat: THREE.MeshStandardMaterial;
  tipMat: THREE.MeshStandardMaterial;
  ringMesh: THREE.Mesh;
}

export interface LunarRoverRig {
  root: THREE.Group;
  chassisGroup: THREE.Group;
  driverFigure: THREE.Group;
  steeringTBar: THREE.Group;
  wheelFL: THREE.Group;
  wheelFR: THREE.Group;
  wheelRL: THREE.Group;
  wheelRR: THREE.Group;
  steerPivotFL: THREE.Group;
  steerPivotFR: THREE.Group;
  wheelMountRL: THREE.Group;
  wheelMountRR: THREE.Group;
  dishGroup: THREE.Group;
  headLightSpot: THREE.PointLight;
  updateSuspensionAndWheels: (
    speed: number,
    steerAngle: number,
    chassisBounceY: number,
    flTravel: number,
    frTravel: number,
    rlTravel: number,
    rrTravel: number,
    dt: number,
    elapsed: number,
  ) => void;
}

export interface SurfaceDustTrailPool {
  points: THREE.Points;
  emit: (x: number, y: number, z: number, vx: number, vy: number, vz: number) => void;
  update: (dt: number) => void;
}

export interface SalvageArtifactEntity extends SalvageArtifactInfo {
  root: THREE.Group;
  beaconBeam: THREE.Mesh;
  beaconRing: THREE.Mesh;
  beaconDiamond: THREE.Mesh;
  position: THREE.Vector3;
}

const CRATERS = [
  { x: -18, z: -34, r: 12, depth: 2.8 },
  { x: 22, z: -44, r: 16, depth: 3.6 },
  { x: -46, z: -68, r: 22, depth: 4.6 },
  { x: 8, z: -24, r: 7, depth: 1.5 },
  { x: 52, z: -78, r: 26, depth: 5.2 },
  { x: -4, z: -92, r: 30, depth: 5.8 },
  { x: -48, z: 24, r: 15, depth: 3.1 },
  { x: 50, z: 34, r: 18, depth: 3.5 },
  { x: -30, z: 62, r: 16, depth: 3.0 },
  { x: 32, z: 70, r: 20, depth: 3.8 },
  { x: -88, z: -32, r: 24, depth: 4.8 },
  { x: 92, z: -22, r: 22, depth: 4.4 },
  { x: -76, z: 78, r: 25, depth: 5.1 },
  { x: 84, z: 86, r: 28, depth: 5.4 },
  { x: 0, z: 112, r: 26, depth: 4.9 },
  { x: -115, z: 18, r: 32, depth: 6.0 },
  { x: 118, z: 12, r: 30, depth: 5.7 },
  { x: 14, z: -135, r: 34, depth: 6.4 },
];

export const SUN_POSITION = new THREE.Vector3(24, 9.8, -36);
const _sunDirNorm = SUN_POSITION.clone().normalize();
const _sunHorizLen = Math.hypot(_sunDirNorm.x, _sunDirNorm.z);
const _sunHorizX = _sunDirNorm.x / _sunHorizLen;
const _sunHorizZ = _sunDirNorm.z / _sunHorizLen;
const _sunSlope = _sunDirNorm.y / _sunHorizLen;

// Zero-GC scratch objects for rover driver steering-yoke IK
const _downAxis = new THREE.Vector3(0, -1, 0);
const _shoulderLocal = new THREE.Vector3();
const _gripLocal = new THREE.Vector3();
const _armDelta = new THREE.Vector3();
const _armUnit = new THREE.Vector3();
const _armPole = new THREE.Vector3();
const _armBend = new THREE.Vector3();
const _elbowLocal = new THREE.Vector3();
const _foreDir = new THREE.Vector3();
const _torsoEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _torsoQuat = new THREE.Quaternion();
const _mountQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.58, 0, 0));
const _tbarQuat = new THREE.Quaternion();
const _tbarEuler = new THREE.Euler(0, 0, 0, 'YXZ');

export interface LunarThermalState {
  inShadow: boolean;
  sunlightFactor: number;
  surfaceTempC: number;
}

export function getLunarSurfaceHeight(x: number, z: number): number {
  // Keep Asaar base pad & south rover launch pad flat
  const insideBasePad = x > -15 && x < 15 && z > -12 && z < 20;
  if (insideBasePad) {
    return -0.35;
  }

  // Multi-octave rolling lunar hills & mare ridges
  let h = -0.35;
  h += Math.sin(x * 0.032 + 0.4) * Math.cos(z * 0.028 - 0.3) * 3.4;
  h += Math.sin(x * 0.068 - z * 0.052) * 1.45;
  h += Math.cos(x * 0.14 + z * 0.12) * 0.38;

  // Natural crater-wall basin mountains around the far perimeter
  const dist = Math.hypot(x, z);
  if (dist > 142) {
    h += Math.pow((dist - 142) * 0.09, 1.45) * (1 + 0.35 * Math.sin(x * 0.08 + z * 0.06));
  }

  for (const c of CRATERS) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < c.r * 1.38) {
      const norm = d / c.r;
      if (norm < 1.0) {
        h -= c.depth * (1 - norm * norm);
        // Subtle central uplift peak in larger craters
        if (c.r >= 22 && norm < 0.25) {
          h += (0.25 - norm) * 2.2;
        }
      } else {
        const rim = 1 - (norm - 1.0) / 0.38;
        h += c.depth * 0.32 * Math.sin(rim * Math.PI);
      }
    }
  }

  // Smooth transition apron around base pad
  const padDistX = Math.max(0, Math.abs(x) - 15);
  const padDistZ = z < -12 ? -12 - z : z > 20 ? z - 20 : 0;
  const padDist = Math.hypot(padDistX, padDistZ);
  if (padDist < 8) {
    const blend = padDist / 8;
    const smooth = blend * blend * (3 - 2 * blend);
    h = THREE.MathUtils.lerp(-0.35, h, smooth);
  }

  return h;
}

export function getLunarThermalState(x: number, z: number): LunarThermalState {
  // Base pad itself stays in clear sunlight
  if (Math.abs(x) < 16 && z > -13 && z < 21) {
    return { inShadow: false, sunlightFactor: 1, surfaceTempC: 94 };
  }

  const h0 = getLunarSurfaceHeight(x, z);
  let maxOcclusion = 0;

  // Raymarch toward the low-angle lunar Sun to detect terrain & crater-rim shadows
  const steps = [3, 6, 10, 15, 21, 28, 36];
  for (let i = 0; i < steps.length; i++) {
    const t = steps[i];
    const sampleH = getLunarSurfaceHeight(x + _sunHorizX * t, z + _sunHorizZ * t);
    const rayY = h0 + 0.55 + t * _sunSlope;
    const diff = sampleH - rayY;
    if (diff > -0.35) {
      maxOcclusion = Math.max(maxOcclusion, THREE.MathUtils.clamp((diff + 0.35) / 1.1, 0, 1));
    }
  }

  // Deep crater bowls trap cryogenic darkness (-150°C to -166°C)
  let craterShadowDepth = 0;
  for (const c of CRATERS) {
    const dx = x - c.x;
    const dz = z - c.z;
    const d = Math.hypot(dx, dz);
    if (d < c.r * 0.92) {
      const bowl = 1 - d / (c.r * 0.92);
      const sunwardDot = (dx * _sunHorizX + dz * _sunHorizZ) / Math.max(1, c.r);
      // Side nearest the sunward rim casts the longest cold shadow into the bowl
      const shadowBias = THREE.MathUtils.clamp(0.55 + sunwardDot * 0.65, 0.15, 1);
      craterShadowDepth = Math.max(craterShadowDepth, bowl * shadowBias * Math.min(1, c.depth / 2.8));
    }
  }

  const combinedShadow = Math.max(maxOcclusion, craterShadowDepth);
  const sunlightFactor = THREE.MathUtils.clamp(1 - combinedShadow, 0, 1);
  const inShadow = sunlightFactor < 0.45;
  const surfaceTempC = Math.round(THREE.MathUtils.lerp(-162, 104, sunlightFactor));

  return { inShadow, sunlightFactor, surfaceTempC };
}

export function createSurfaceDustPool(
  scene: THREE.Scene,
  particleTex: THREE.Texture,
  disposables: Array<{ dispose: () => void }>,
): SurfaceDustTrailPool {
  const MAX = 280;
  const positions = new Float32Array(MAX * 3);
  const velocities = new Float32Array(MAX * 3);
  const ages = new Float32Array(MAX);
  const maxAges = new Float32Array(MAX);

  for (let i = 0; i < MAX; i++) {
    positions[i * 3 + 1] = -999;
    ages[i] = 99;
    maxAges[i] = 1;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  disposables.push(geo);

  const mat = new THREE.PointsMaterial({
    map: particleTex,
    color: 0xcbd5e1,
    size: 0.42,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  disposables.push(mat);

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  let cursor = 0;

  const emit = (x: number, y: number, z: number, vx: number, vy: number, vz: number) => {
    const i = cursor;
    cursor = (cursor + 1) % MAX;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    velocities[i * 3] = vx;
    velocities[i * 3 + 1] = vy;
    velocities[i * 3 + 2] = vz;
    ages[i] = 0;
    maxAges[i] = 0.85 + (i % 5) * 0.18;
  };

  const update = (dt: number) => {
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    let activeChanged = false;

    for (let i = 0; i < MAX; i++) {
      if (ages[i] < maxAges[i]) {
        ages[i] += dt;
        if (ages[i] >= maxAges[i]) {
          positions[i * 3 + 1] = -999;
        } else {
          velocities[i * 3 + 1] -= LUNAR_GRAVITY * 0.85 * dt;
          positions[i * 3] += velocities[i * 3] * dt;
          positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
          positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
        }
        activeChanged = true;
      }
    }

    if (activeChanged) {
      posAttr.needsUpdate = true;
    }
  };

  return { points, emit, update };
}

export function createLunarRover(
  scene: THREE.Scene,
  disposables: Array<{ dispose: () => void }>,
): LunarRoverRig {
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const root = new THREE.Group();
  root.name = 'LunarRover';
  scene.add(root);

  const chassisGroup = new THREE.Group();
  root.add(chassisGroup);

  const frameMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xdbe4ef,
      roughness: 0.45,
      metalness: 0.72,
      flatShading: true,
    }),
  );

  const goldFoilMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.25,
      metalness: 0.88,
      flatShading: true,
    }),
  );

  const darkCarbonMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.78,
      metalness: 0.22,
      flatShading: true,
    }),
  );

  const wheelMeshMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.65,
      metalness: 0.65,
      flatShading: true,
    }),
  );

  const cyanGlowMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0.1,
    }),
  );

  const headlightMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      emissive: 0xfef08a,
      emissiveIntensity: 3.0,
      roughness: 0.1,
    }),
  );

  const suitWhiteMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xe6ecf5,
      roughness: 0.58,
      metalness: 0.12,
      flatShading: true,
    }),
  );

  const suitSlateMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.72,
      metalness: 0.25,
      flatShading: true,
    }),
  );

  const trimBlueMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.42,
      metalness: 0.35,
      flatShading: true,
    }),
  );

  const metalJointMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.32,
      metalness: 0.85,
      flatShading: true,
    }),
  );

  const visorMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      emissive: 0x3b1b00,
      emissiveIntensity: 0.28,
      roughness: 0.06,
      metalness: 0.94,
      clearcoat: 1.0,
    }),
  );

  // 1. Main chassis deck
  const chassis = new THREE.Mesh(track(new THREE.BoxGeometry(1.55, 0.22, 2.7)), frameMat);
  chassis.position.set(0, 0.56, 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  chassisGroup.add(chassis);

  // 2. Forward gold Kapton foil battery bay
  const frontBay = new THREE.Mesh(track(new THREE.BoxGeometry(1.25, 0.34, 0.75)), goldFoilMat);
  frontBay.position.set(0, 0.72, -0.95);
  frontBay.castShadow = true;
  chassisGroup.add(frontBay);

  // 3. Rear cargo & salvage storage rack
  const cargoBed = new THREE.Mesh(track(new THREE.BoxGeometry(1.4, 0.28, 0.82)), darkCarbonMat);
  cargoBed.position.set(0, 0.78, 0.92);
  cargoBed.castShadow = true;
  chassisGroup.add(cargoBed);

  const statusBar = new THREE.Mesh(track(new THREE.BoxGeometry(1.05, 0.06, 0.06)), cyanGlowMat);
  statusBar.position.set(0, 0.92, 1.33);
  chassisGroup.add(statusBar);

  // 4. Dual Crew Seats & Driver Foot Pedals
  [-0.38, 0.38].forEach((sx) => {
    const seatPan = new THREE.Mesh(track(new THREE.BoxGeometry(0.48, 0.12, 0.52)), darkCarbonMat);
    seatPan.position.set(sx, 0.73, 0.08);
    chassisGroup.add(seatPan);
    const seatBack = new THREE.Mesh(track(new THREE.BoxGeometry(0.46, 0.56, 0.12)), darkCarbonMat);
    seatBack.position.set(sx, 1.0, 0.34);
    seatBack.rotation.x = 0.15;
    seatBack.castShadow = true;
    chassisGroup.add(seatBack);
  });

  // Sculpted throttle & brake pedals beneath driver's boots
  const brakePedal = new THREE.Mesh(track(new THREE.BoxGeometry(0.11, 0.03, 0.14)), metalJointMat);
  brakePedal.position.set(-0.5, 0.685, -0.44);
  brakePedal.rotation.x = -0.36;
  chassisGroup.add(brakePedal);

  const throttlePedal = new THREE.Mesh(track(new THREE.BoxGeometry(0.11, 0.03, 0.14)), metalJointMat);
  throttlePedal.position.set(-0.26, 0.685, -0.44);
  throttlePedal.rotation.x = -0.36;
  chassisGroup.add(throttlePedal);

  // 5. Center Nav Display + Driver Steering Column & Aerospace Steering Yoke
  const consoleStem = new THREE.Mesh(track(new THREE.CylinderGeometry(0.055, 0.075, 0.54, 8)), frameMat);
  consoleStem.position.set(0, 0.9, -0.45);
  consoleStem.rotation.x = 0.25;
  chassisGroup.add(consoleStem);

  const navScreen = new THREE.Mesh(track(new THREE.BoxGeometry(0.38, 0.22, 0.06)), cyanGlowMat);
  navScreen.position.set(0, 1.15, -0.35);
  navScreen.rotation.x = -0.55;
  chassisGroup.add(navScreen);

  const steeringMount = new THREE.Group();
  steeringMount.position.set(-0.38, 1.07, -0.27);
  steeringMount.rotation.x = 0.58;
  chassisGroup.add(steeringMount);

  const steerShaft = new THREE.Mesh(track(new THREE.CylinderGeometry(0.032, 0.044, 0.48, 8)), metalJointMat);
  steerShaft.position.set(0, -0.24, 0);
  steeringMount.add(steerShaft);

  const steeringTBar = new THREE.Group();
  steeringMount.add(steeringTBar);

  const yokeHub = new THREE.Mesh(track(new THREE.CylinderGeometry(0.055, 0.055, 0.06, 10)), frameMat);
  steeringTBar.add(yokeHub);

  const yokeHubLed = new THREE.Mesh(track(new THREE.BoxGeometry(0.05, 0.015, 0.018)), cyanGlowMat);
  yokeHubLed.position.set(0, 0.032, 0.02);
  steeringTBar.add(yokeHubLed);

  const tHandle = new THREE.Mesh(track(new THREE.BoxGeometry(0.36, 0.038, 0.045)), darkCarbonMat);
  steeringTBar.add(tHandle);

  // Left & Right Yoke Grip Horns (hands lock onto these coordinates!)
  const gripGeo = track(new THREE.CylinderGeometry(0.024, 0.024, 0.11, 8));
  [-0.175, 0.175].forEach((gx) => {
    const gripHorn = new THREE.Mesh(gripGeo, trimBlueMat);
    gripHorn.rotation.x = Math.PI / 2;
    gripHorn.position.set(gx, 0.005, 0.035);
    steeringTBar.add(gripHorn);
  });

  // 6. Detailed Articulated Low-Poly Seated Astronaut Driver Figure
  const driverFigure = new THREE.Group();
  driverFigure.position.set(-0.38, 0.79, 0.08);
  driverFigure.visible = false;
  chassisGroup.add(driverFigure);

  // Pelvis & Utility Belt
  const drvPelvis = new THREE.Mesh(track(new THREE.BoxGeometry(0.32, 0.14, 0.24)), suitSlateMat);
  drvPelvis.position.set(0, 0.07, 0.02);
  drvPelvis.castShadow = true;
  driverFigure.add(drvPelvis);

  const drvBelt = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.055, 0.255)), trimBlueMat);
  drvBelt.position.set(0, 0.11, 0.02);
  driverFigure.add(drvBelt);

  // Articulated Upper Torso + Backpack + Helmet
  const drvTorsoGroup = new THREE.Group();
  drvTorsoGroup.position.set(0, 0.12, 0.04);
  drvTorsoGroup.rotation.x = -0.14;
  driverFigure.add(drvTorsoGroup);

  const drvTorso = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.35, 0.22)), suitWhiteMat);
  drvTorso.position.set(0, 0.19, 0);
  drvTorso.castShadow = true;
  drvTorsoGroup.add(drvTorso);

  const drvChestPack = new THREE.Mesh(track(new THREE.BoxGeometry(0.18, 0.16, 0.055)), trimBlueMat);
  drvChestPack.position.set(0, 0.22, -0.12);
  drvTorsoGroup.add(drvChestPack);

  const drvChestLed = new THREE.Mesh(track(new THREE.BoxGeometry(0.1, 0.025, 0.015)), cyanGlowMat);
  drvChestLed.position.set(0, 0.245, -0.15);
  drvTorsoGroup.add(drvChestLed);

  const drvCollar = new THREE.Mesh(track(new THREE.CylinderGeometry(0.13, 0.14, 0.05, 10)), metalJointMat);
  drvCollar.position.set(0, 0.37, -0.01);
  drvTorsoGroup.add(drvCollar);

  // PLSS Life-Support Backpack + Twin O2 Tanks + Whip Antenna
  const drvPack = new THREE.Mesh(track(new THREE.BoxGeometry(0.28, 0.38, 0.15)), suitWhiteMat);
  drvPack.position.set(0, 0.21, 0.175);
  drvPack.castShadow = true;
  drvTorsoGroup.add(drvPack);

  const drvPackCap = new THREE.Mesh(track(new THREE.BoxGeometry(0.29, 0.06, 0.16)), trimBlueMat);
  drvPackCap.position.set(0, 0.39, 0.175);
  drvTorsoGroup.add(drvPackCap);

  const drvPackGlow = new THREE.Mesh(track(new THREE.BoxGeometry(0.15, 0.04, 0.02)), cyanGlowMat);
  drvPackGlow.position.set(0, 0.25, 0.255);
  drvTorsoGroup.add(drvPackGlow);

  const drvTankGeo = track(new THREE.CylinderGeometry(0.04, 0.04, 0.27, 8));
  [-0.08, 0.08].forEach((tx) => {
    const tank = new THREE.Mesh(drvTankGeo, metalJointMat);
    tank.position.set(tx, 0.19, 0.24);
    drvTorsoGroup.add(tank);
  });

  const drvAntRod = new THREE.Mesh(track(new THREE.CylinderGeometry(0.008, 0.011, 0.26, 6)), metalJointMat);
  drvAntRod.position.set(0.11, 0.51, 0.2);
  drvTorsoGroup.add(drvAntRod);

  const drvAntTip = new THREE.Mesh(track(new THREE.SphereGeometry(0.02, 8, 8)), cyanGlowMat);
  drvAntTip.position.set(0.11, 0.64, 0.2);
  drvTorsoGroup.add(drvAntTip);

  // Articulated Helmet & Reflective Gold Visor
  const drvHeadGroup = new THREE.Group();
  drvHeadGroup.position.set(0, 0.49, -0.02);
  drvTorsoGroup.add(drvHeadGroup);

  const drvHelmet = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.165, 1)), suitWhiteMat);
  drvHelmet.castShadow = true;
  drvHeadGroup.add(drvHelmet);

  const drvVisor = new THREE.Mesh(track(new THREE.SphereGeometry(0.135, 14, 12)), visorMat);
  drvVisor.position.set(0, -0.005, -0.052);
  drvVisor.scale.set(1.06, 0.92, 0.88);
  drvHeadGroup.add(drvVisor);

  const earGeo = track(new THREE.CylinderGeometry(0.042, 0.042, 0.03, 8));
  [-0.155, 0.155].forEach((ex) => {
    const ear = new THREE.Mesh(earGeo, trimBlueMat);
    ear.rotation.z = Math.PI / 2;
    ear.position.set(ex, 0, 0.01);
    drvHeadGroup.add(ear);
  });

  // Bent Legs Resting on Throttle & Brake Pedals
  const thighGeo = track(new THREE.BoxGeometry(0.125, 0.125, 0.34));
  const kneeGeo = track(new THREE.BoxGeometry(0.135, 0.095, 0.075));
  const shinGeo = track(new THREE.BoxGeometry(0.115, 0.26, 0.12));
  const bootGeo = track(new THREE.BoxGeometry(0.12, 0.08, 0.2));

  const legSides = [-1, 1] as const;
  const driverBoots: THREE.Mesh[] = [];
  legSides.forEach((side) => {
    const thigh = new THREE.Mesh(thighGeo, suitWhiteMat);
    thigh.position.set(side * 0.11, 0.06, -0.18);
    thigh.rotation.set(0.08, -side * 0.06, 0);
    thigh.castShadow = true;
    driverFigure.add(thigh);

    const kneePad = new THREE.Mesh(kneeGeo, trimBlueMat);
    kneePad.position.set(side * 0.12, 0.055, -0.35);
    driverFigure.add(kneePad);

    const shin = new THREE.Mesh(shinGeo, suitSlateMat);
    shin.position.set(side * 0.12, -0.02, -0.43);
    shin.rotation.x = 0.64;
    shin.castShadow = true;
    driverFigure.add(shin);

    const boot = new THREE.Mesh(bootGeo, suitSlateMat);
    boot.position.set(side * 0.12, -0.075, -0.51);
    boot.rotation.x = -0.32;
    boot.castShadow = true;
    driverFigure.add(boot);
    driverBoots.push(boot);
  });

  // Articulated 2-Bone IK Left & Right Arms (Upper Arm, Elbow, Forearm, Gloved Hand)
  const UPPER_ARM_LEN = 0.24;
  const FOREARM_LEN = 0.24;
  const pauldronGeo = track(new THREE.SphereGeometry(0.068, 8, 8));
  const upperArmGeo = track(new THREE.BoxGeometry(0.092, UPPER_ARM_LEN, 0.092));
  const elbowJointGeo = track(new THREE.SphereGeometry(0.05, 8, 8));
  const foreArmGeo = track(new THREE.BoxGeometry(0.082, FOREARM_LEN, 0.082));
  const cuffGeo = track(new THREE.CylinderGeometry(0.048, 0.048, 0.04, 8));
  const gloveGeo = track(new THREE.BoxGeometry(0.072, 0.078, 0.082));

  const buildDriverArm = () => {
    const upperGroup = new THREE.Group();
    driverFigure.add(upperGroup);

    const pauldron = new THREE.Mesh(pauldronGeo, trimBlueMat);
    upperGroup.add(pauldron);

    const upperMesh = new THREE.Mesh(upperArmGeo, suitWhiteMat);
    upperMesh.position.y = -UPPER_ARM_LEN * 0.5;
    upperMesh.castShadow = true;
    upperGroup.add(upperMesh);

    const foreGroup = new THREE.Group();
    driverFigure.add(foreGroup);

    const elbowJoint = new THREE.Mesh(elbowJointGeo, metalJointMat);
    foreGroup.add(elbowJoint);

    const foreMesh = new THREE.Mesh(foreArmGeo, suitSlateMat);
    foreMesh.position.y = -FOREARM_LEN * 0.5;
    foreMesh.castShadow = true;
    foreGroup.add(foreMesh);

    const cuff = new THREE.Mesh(cuffGeo, trimBlueMat);
    cuff.position.y = -FOREARM_LEN + 0.03;
    foreGroup.add(cuff);

    const glove = new THREE.Mesh(gloveGeo, suitWhiteMat);
    glove.position.set(0, -FOREARM_LEN, 0);
    foreGroup.add(glove);

    return { upperGroup, foreGroup };
  };

  const leftDriverArm = buildDriverArm();
  const rightDriverArm = buildDriverArm();

  // Helper to orient an articulated arm from torso shoulder to yoke grip in driverFigure space
  const solveDriverArmIK = (
    arm: { upperGroup: THREE.Group; foreGroup: THREE.Group },
    side: -1 | 1,
    steerRotY: number,
    leanRotZ: number,
  ) => {
    _torsoEuler.set(-0.14, 0, leanRotZ);
    _torsoQuat.setFromEuler(_torsoEuler);
    _shoulderLocal.set(side * 0.215, 0.30, -0.01).applyQuaternion(_torsoQuat);
    _shoulderLocal.x += drvTorsoGroup.position.x;
    _shoulderLocal.y += drvTorsoGroup.position.y;
    _shoulderLocal.z += drvTorsoGroup.position.z;

    _tbarEuler.set(0, steerRotY, 0);
    _tbarQuat.setFromEuler(_tbarEuler);
    _gripLocal
      .set(side * 0.175, 0.005, 0.04)
      .applyQuaternion(_tbarQuat)
      .applyQuaternion(_mountQuat)
      .add(steeringMount.position)
      .sub(driverFigure.position);

    _armDelta.subVectors(_gripLocal, _shoulderLocal);
    const dist = THREE.MathUtils.clamp(_armDelta.length(), 0.08, UPPER_ARM_LEN + FOREARM_LEN - 0.004);
    _armUnit.copy(_armDelta).normalize();

    const cosAlpha = THREE.MathUtils.clamp(
      (UPPER_ARM_LEN * UPPER_ARM_LEN + dist * dist - FOREARM_LEN * FOREARM_LEN) /
        (2 * UPPER_ARM_LEN * dist),
      -1,
      1,
    );
    const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

    _armPole.set(side * 0.68, -0.72, 0.18);
    const poleDot = _armPole.dot(_armUnit);
    _armBend.copy(_armPole).addScaledVector(_armUnit, -poleDot).normalize();

    _elbowLocal
      .copy(_shoulderLocal)
      .addScaledVector(_armUnit, UPPER_ARM_LEN * cosAlpha)
      .addScaledVector(_armBend, UPPER_ARM_LEN * sinAlpha);

    _foreDir.subVectors(_elbowLocal, _shoulderLocal).normalize();
    arm.upperGroup.position.copy(_shoulderLocal);
    arm.upperGroup.quaternion.setFromUnitVectors(_downAxis, _foreDir);

    _foreDir.subVectors(_gripLocal, _elbowLocal).normalize();
    arm.foreGroup.position.copy(_elbowLocal);
    arm.foreGroup.quaternion.setFromUnitVectors(_downAxis, _foreDir);
  };

  // Initialize neutral seated grip pose
  solveDriverArmIK(leftDriverArm, -1, 0, 0);
  solveDriverArmIK(rightDriverArm, 1, 0, 0);

  // 7. High-Gain Mesh Dish Antenna
  const dishGroup = new THREE.Group();
  dishGroup.position.set(-0.46, 0.92, -1.08);
  chassisGroup.add(dishGroup);

  const dishMast = new THREE.Mesh(track(new THREE.CylinderGeometry(0.035, 0.045, 0.75, 6)), frameMat);
  dishMast.position.y = 0.36;
  dishGroup.add(dishMast);

  const dishBowl = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.42, 0.12, 0.18, 12, 1, true)),
    goldFoilMat,
  );
  dishBowl.position.set(0, 0.78, 0);
  dishBowl.rotation.x = -0.7;
  dishGroup.add(dishBowl);

  // 8. Dual Front Headlights + Local Illumination
  [-0.54, 0.54].forEach((lx) => {
    const lamp = new THREE.Mesh(track(new THREE.CylinderGeometry(0.09, 0.11, 0.12, 8)), headlightMat);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.set(lx, 0.74, -1.35);
    chassisGroup.add(lamp);
  });

  const headLightSpot = new THREE.PointLight(0xfef3c7, 3.6, 22, 1.4);
  headLightSpot.position.set(0, 1.15, -2.5);
  chassisGroup.add(headLightSpot);

  // 9. Four Articulated Suspension Wheel Assemblies (Radius 0.38m)
  const buildWheel = (x: number, z: number) => {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(x, 0.38, z);
    root.add(steerPivot);

    const strut = new THREE.Mesh(track(new THREE.BoxGeometry(0.32, 0.08, 0.08)), frameMat);
    strut.position.set(x > 0 ? -0.14 : 0.14, 0.14, 0);
    strut.rotation.z = x > 0 ? -0.25 : 0.25;
    steerPivot.add(strut);

    const wheelSpin = new THREE.Group();
    steerPivot.add(wheelSpin);

    const tire = new THREE.Mesh(track(new THREE.CylinderGeometry(0.38, 0.38, 0.24, 12)), wheelMeshMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheelSpin.add(tire);

    // Cleat tread bars so wheel rotation is crisp and readable
    for (let c = 0; c < 6; c++) {
      const cleat = new THREE.Mesh(track(new THREE.BoxGeometry(0.25, 0.04, 0.08)), darkCarbonMat);
      const ang = (c / 6) * Math.PI * 2;
      cleat.position.set(0, Math.cos(ang) * 0.38, Math.sin(ang) * 0.38);
      cleat.rotation.x = ang;
      wheelSpin.add(cleat);
    }

    const hub = new THREE.Mesh(track(new THREE.CylinderGeometry(0.18, 0.18, 0.27, 8)), goldFoilMat);
    hub.rotation.z = Math.PI / 2;
    wheelSpin.add(hub);

    return { steerPivot, wheelSpin };
  };

  const fl = buildWheel(-0.92, -0.96);
  const fr = buildWheel(0.92, -0.96);
  const rl = buildWheel(-0.92, 0.96);
  const rr = buildWheel(0.92, 0.96);

  let spinAngle = 0;

  return {
    root,
    chassisGroup,
    driverFigure,
    steeringTBar,
    wheelFL: fl.wheelSpin,
    wheelFR: fr.wheelSpin,
    wheelRL: rl.wheelSpin,
    wheelRR: rr.wheelSpin,
    steerPivotFL: fl.steerPivot,
    steerPivotFR: fr.steerPivot,
    wheelMountRL: rl.steerPivot,
    wheelMountRR: rr.steerPivot,
    dishGroup,
    headLightSpot,
    updateSuspensionAndWheels: (
      speed: number,
      steerAngle: number,
      chassisBounceY: number,
      flTravel: number,
      frTravel: number,
      rlTravel: number,
      rrTravel: number,
      dt: number,
      elapsed: number,
    ) => {
      spinAngle -= (speed / 0.38) * dt;
      fl.wheelSpin.rotation.x = spinAngle;
      fr.wheelSpin.rotation.x = spinAngle;
      rl.wheelSpin.rotation.x = spinAngle;
      rr.wheelSpin.rotation.x = spinAngle;

      fl.steerPivot.rotation.y = steerAngle;
      fr.steerPivot.rotation.y = steerAngle;

      const yokeRotY = steerAngle * 1.15;
      steeringTBar.rotation.y = yokeRotY;

      // Driver torso lean, helmet turn, pedal press, and articulated IK arms gripping the steering yoke
      const torsoLeanZ = steerAngle * 0.14;
      drvTorsoGroup.rotation.z = torsoLeanZ;
      drvHeadGroup.rotation.y = steerAngle * 0.42;
      drvHeadGroup.rotation.z = steerAngle * 0.08;

      const throttlePress = speed > 0.25 ? Math.min(1, speed / 8) * 0.02 : 0;
      const brakePress = speed < -0.25 ? Math.min(1, Math.abs(speed) / 6) * 0.02 : 0;
      brakePedal.position.y = 0.685 - brakePress * 0.45;
      throttlePedal.position.y = 0.685 - throttlePress * 0.45;
      driverBoots[0].position.y = -0.075 - brakePress;
      driverBoots[1].position.y = -0.075 - throttlePress;

      solveDriverArmIK(leftDriverArm, -1, yokeRotY, torsoLeanZ);
      solveDriverArmIK(rightDriverArm, 1, yokeRotY, torsoLeanZ);

      chassisGroup.position.y = chassisBounceY;
      fl.steerPivot.position.y = 0.38 + flTravel;
      fr.steerPivot.position.y = 0.38 + frTravel;
      rl.steerPivot.position.y = 0.38 + rlTravel;
      rr.steerPivot.position.y = 0.38 + rrTravel;

      dishGroup.rotation.y = Math.sin(elapsed * 0.7) * 0.35;
    },
  };
}

type RelicKind = ArtifactKind;

interface RelicSpec {
  id: string;
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
  studyBullets: StudyBullet[];
  quizzes: ArtifactQuiz[];
  kind: RelicKind;
  minRadius: number;
  maxRadius: number;
  sectorOffset: number;
}

const RELIC_SPECS: RelicSpec[] = [
  {
    id: 'apollo-lrv-battery',
    name: 'Apollo 15/16/17 LRV Silver-Zinc Battery Pack',
    mission: 'Apollo 15 / 16 / 17',
    year: 1971,
    agency: 'NASA',
    country: 'United States',
    partCategory: 'ELECTROCHEMICAL POWER',
    description: 'Twin 36-volt silver-zinc potassium-hydroxide rover power cells.',
    realHistory:
      'Built by Eagle-Picher for the Boeing/Delco Lunar Roving Vehicle, two 36-volt non-rechargeable silver-zinc batteries with 23 Plexiglas monoblocks powered four 0.25-horsepower wheel hub motors, steering servos, and the TV/comms mast across Hadley Rille, Descartes, and Taurus-Littrow.',
    failureReason:
      'Engineered as primary single-discharge batteries for a 78-hour EVA window. Once the astronauts departed, extreme lunar night freezes (-173 °C) solidified the potassium-hydroxide electrolyte and permanently ruptured cell separators.',
    missionSignificance:
      'Enabled crews to drive up to 35.9 km across mountainous lunar terrain, quintupling geological sample diversity. Its high-amperage silver-zinc busbars can stabilize Asaar emergency relay banks.',
    studyBullets: [
      { label: 'MISSION', value: 'Apollo 15 / 16 / 17 Lunar Roving Vehicle' },
      { label: 'COUNTRY / AGENCY', value: 'United States · NASA' },
      { label: 'YEAR', value: '1971–1972' },
      { label: 'HISTORY', value: 'Twin 36V silver-zinc cells drove 4 hub motors over 35.9 km.' },
      { label: 'FAILURE CAUSE', value: 'Single-use electrolyte froze & ruptured at -173 °C after crew departure.' },
      { label: 'SALVAGE USE', value: 'Stabilizes Asaar Sector 07 high-amperage relay banks.' },
    ],
    quizzes: [
      {
        question: 'Which crewed missions operated this Lunar Roving Vehicle Silver-Zinc Battery Pack?',
        options: ['Apollo 15 / 16 / 17', 'Apollo 11 / 12', 'Surveyor 3 & Luna 17'],
        correctIndex: 0,
        hint: 'Briefing MISSION line covers the final three J-class Apollo expeditions.',
      },
      {
        question: 'Which nation and agency deployed it, and in which years?',
        options: ['Soviet Union · Roscosmos (1968)', 'United States · NASA (1971–1972)', 'China · CNSA (2013)'],
        correctIndex: 1,
        hint: 'United States · NASA launched the three LRV missions in 1971–1972.',
      },
      {
        question: 'What did the twin 36V silver-zinc cells power across up to 35.9 km?',
        options: [
          'A liquid methane descent engine bell',
          'Four rover wheel hub motors, steering, and comms',
          'A Polonium-210 thermal radiator',
        ],
        correctIndex: 1,
        hint: 'Twin 36V cells drove the 4 wheel hub motors across 35.9 km.',
      },
      {
        question: 'Why did the batteries fail after the astronauts departed, and how does Asaar use them?',
        options: [
          'Electrolyte froze & ruptured at -173 °C; stabilizes Asaar high-amperage relay banks',
          'Solar flares melted copper coils; shields the airlock hatch',
          'IMU reset drained cells in orbit; seals exterior hull cracks',
        ],
        correctIndex: 0,
        hint: 'Single-use electrolyte froze at -173 °C; Asaar uses it to stabilize relay banks.',
      },
    ],
    kind: 'lrv_battery',
    minRadius: 34,
    maxRadius: 56,
    sectorOffset: 0.35,
  },
  {
    id: 'alsep-rtg-snap27',
    name: 'ALSEP RTG Nuclear Generator (Plutonium-238)',
    mission: 'Apollo 12–17 ALSEP',
    year: 1969,
    agency: 'NASA',
    country: 'United States',
    partCategory: 'RADIOISOTOPE THERMAL',
    description: 'SNAP-27 Pu-238 radioisotope thermoelectric generator with 8 radial fins.',
    realHistory:
      'After Apollo 11 solar panels struggled with lunar nightfall, Apollo 12 through 17 deployed SNAP-27 RTGs. Astronauts extracted a glowing Plutonium-238 fuel capsule from a graphite cask on the Lunar Module leg and inserted it into an 8-fin beryllium radiator delivering 70+ watts continuously.',
    failureReason:
      'The RTG never suffered hardware failure—it ran continuously for nearly eight years until NASA deactivated the ALSEP ground telemetry receivers on September 30, 1977 due to budget reallocations and gradual thermocouple degradation.',
    missionSignificance:
      'Proved long-duration nuclear power can survive two-week lunar nights without solar energy, powering seismometers and magnetometers for years. Its Pu-238 thermal core provides vital baseline wattage for Asaar.',
    studyBullets: [
      { label: 'MISSION', value: 'Apollo 12–17 ALSEP Surface Package' },
      { label: 'COUNTRY / AGENCY', value: 'United States · NASA' },
      { label: 'YEAR', value: '1969–1972' },
      { label: 'HISTORY', value: 'Plutonium-238 core delivered 70W+ through 14-day lunar nights.' },
      { label: 'FAILURE CAUSE', value: 'Outlived budget—NASA switched off receivers in Sept 1977 after 8 years.' },
      { label: 'SALVAGE USE', value: 'Supplies continuous nuclear thermal baseline for Asaar Core.' },
    ],
    quizzes: [
      {
        question: 'Which surface science network carried this SNAP-27 RTG generator?',
        options: ['Apollo 12–17 ALSEP', 'IM-1 Odysseus CLPS', 'Lunokhod 1'],
        correctIndex: 0,
        hint: 'Deployed across Apollo 12 through 17 as the ALSEP surface package.',
      },
      {
        question: 'Which agency and deployment timeframe belong to the SNAP-27 RTG?',
        options: ['ISRO (2019)', 'NASA · United States (1969–1972)', 'USSR (1970)'],
        correctIndex: 1,
        hint: 'United States · NASA deployed them from 1969 to 1972.',
      },
      {
        question: 'Which radioisotope fuel allowed it to deliver 70W+ through 14-day lunar nights?',
        options: ['Plutonium-238', 'Potassium Hydroxide', 'Liquid Oxygen'],
        correctIndex: 0,
        hint: 'Its glowing fuel capsule used Plutonium-238.',
      },
      {
        question: 'Why did its mission end in 1977, and what is its salvage role at Asaar?',
        options: [
          'Budget shutdown of receivers after 8 years; supplies continuous thermal baseline for Core',
          'Crushed during landing skid; reinforces airlock framing',
          'Overheated at +120 °C noon after 21 days; acts as voltage clock',
        ],
        correctIndex: 0,
        hint: 'NASA switched off receivers in Sept 1977; Asaar uses it for continuous core baseline wattage.',
      },
    ],
    kind: 'alsep_rtg',
    minRadius: 42,
    maxRadius: 72,
    sectorOffset: 0.95,
  },
  {
    id: 'apollo-lm-descent-tank',
    name: 'Apollo Lunar Module Descent Stage Tank',
    mission: 'Apollo 11–17 LM',
    year: 1969,
    agency: 'NASA',
    country: 'United States',
    partCategory: 'CRYO / PROPELLANT VESSEL',
    description: 'Spherical titanium cryo-oxidizer vessel inside a gold-kapton structural bay.',
    realHistory:
      'Housed within the octagonal aluminum and gold-kapton descent stage, four spherical titanium tanks stored Aerozine-50 fuel and nitrogen tetroxide oxidizer feeding the throttleable Descent Propulsion System, while serving as the structural launchpad for the ascent stage.',
    failureReason:
      'Intentionally abandoned after touchdown: hypergolic propellants were depleted during powered descent hover, and the descent stage remained behind as an expendable launch platform when the ascent engine ignited for lunar orbit.',
    missionSignificance:
      'Delivered twelve astronauts safely onto the Moon with zero descent engine failures. Its pressure-rated titanium shell and feed manifolds are ideal for rebuilding Asaar coolant circulation.',
    studyBullets: [
      { label: 'MISSION', value: 'Apollo 11–17 Lunar Module Descent Stage' },
      { label: 'COUNTRY / AGENCY', value: 'United States · NASA' },
      { label: 'YEAR', value: '1969–1972' },
      { label: 'HISTORY', value: 'Titanium hypergolic tank inside gold-kapton landing stage.' },
      { label: 'FAILURE CAUSE', value: 'Propellant spent at landing; left behind as ascent launchpad.' },
      { label: 'SALVAGE USE', value: 'Rebuilds Asaar high-pressure coolant loop & feed manifolds.' },
    ],
    quizzes: [
      {
        question: 'Which spacecraft stage housed this spherical titanium propellant tank?',
        options: ['Apollo 11–17 Lunar Module Descent Stage', 'Surveyor 3 Lander', 'Beresheet'],
        correctIndex: 0,
        hint: 'Built into the octagonal gold-kapton Apollo Lunar Module Descent Stage.',
      },
      {
        question: 'Which country/agency operated it, and during what years?',
        options: ['China · CNSA (2013)', 'United States · NASA (1969–1972)', 'Israel · SpaceIL (2019)'],
        correctIndex: 1,
        hint: 'United States · NASA flew all Apollo Lunar Module landings in 1969–1972.',
      },
      {
        question: 'What structural and propulsion role did this tank assembly serve?',
        options: [
          'Stored hypergolic propellant inside the gold-kapton landing stage',
          'Measured seismic moonquakes near Eagle',
          'Steered six motorized titanium rover wheels',
        ],
        correctIndex: 0,
        hint: 'Titanium hypergolic tank inside the gold-kapton landing stage.',
      },
      {
        question: 'Why were these descent tanks left on the Moon, and how does Asaar use them?',
        options: [
          'Propellant was spent & stage acted as ascent launchpad; rebuilds Asaar coolant loop & manifolds',
          'Laser altimeter switch stayed disabled; braces outer reactor legs',
          'Polonium isotope decayed; couples solar night buses',
        ],
        correctIndex: 0,
        hint: 'Depleted at landing and used as ascent launchpad; rebuilds Asaar coolant loop.',
      },
    ],
    kind: 'lm_tank',
    minRadius: 58,
    maxRadius: 94,
    sectorOffset: 1.62,
  },
  {
    id: 'apollo-11-pse',
    name: 'Apollo 11 Passive Seismic Experiment',
    mission: 'Apollo 11 EASEP',
    year: 1969,
    agency: 'NASA',
    country: 'United States',
    partCategory: 'SEISMIC TELEMETRY',
    description: 'Tranquility Base moonquake detector with gold mylar thermal skirt and solar wings.',
    realHistory:
      'Deployed by Buzz Aldrin just 16 meters from the Eagle Lunar Module on July 20, 1969, this 48-kg EASEP station used four ultra-sensitive seismometers wrapped in gold mylar thermal insulation and twin solar wings to listen to lunar interior vibrations.',
    failureReason:
      'With no nuclear heater, internal electronics endured extreme +120 °C noon heat during the first lunar day. On August 25, 1969, after just 21 Earth days, the command decoder overheated and stopped accepting Earth commands.',
    missionSignificance:
      'Recorded the first confirmed moonquakes and meteorite impacts in human history, proving the Moon is seismically active. Its precision voltage regulators and solar wings help synchronize Asaar core timing.',
    studyBullets: [
      { label: 'MISSION', value: 'Apollo 11 EASEP (Tranquility Base)' },
      { label: 'COUNTRY / AGENCY', value: 'United States · NASA' },
      { label: 'YEAR', value: '1969' },
      { label: 'HISTORY', value: 'First moonquake detector deployed by Buzz Aldrin on July 20.' },
      { label: 'FAILURE CAUSE', value: '+120 °C lunar noon heat cooked its command decoder after 21 days.' },
      { label: 'SALVAGE USE', value: 'Synchronizes Asaar core clock & auxiliary solar wings.' },
    ],
    quizzes: [
      {
        question: 'Which historic mission and landing site deployed this Passive Seismic Experiment?',
        options: ['Apollo 11 EASEP (Tranquility Base)', 'Chang’e 3 (Mare Imbrium)', 'Chandrayaan-2'],
        correctIndex: 0,
        hint: 'Deployed at Tranquility Base during the Apollo 11 EASEP EVA.',
      },
      {
        question: 'Which agency deployed it, and in what exact year?',
        options: ['NASA / JPL (1967)', 'NASA · United States (1969)', 'USSR (1970)'],
        correctIndex: 1,
        hint: 'Buzz Aldrin deployed it for NASA in 1969.',
      },
      {
        question: 'What scientific first did Buzz Aldrin’s EASEP station accomplish on July 20?',
        options: [
          'First moonquake detector deployed on the lunar surface',
          'First robotic soil trenching claw test',
          'First niobium throttleable braking burn',
        ],
        correctIndex: 0,
        hint: 'First moonquake detector deployed by Buzz Aldrin.',
      },
      {
        question: 'Why did it fail after 21 days, and what does it contribute to Asaar?',
        options: [
          '+120 °C lunar noon heat cooked its decoder; synchronizes core clock & solar wings',
          'Excess thrust caused a 2.1 km tumble; contains plasma exhaust',
          'Abrasive regolith jammed its mast; serves as turbine alternator',
        ],
        correctIndex: 0,
        hint: 'Lunar noon heat cooked its command decoder; synchronizes Asaar core clock & solar wings.',
      },
    ],
    kind: 'apollo11_pse',
    minRadius: 36,
    maxRadius: 64,
    sectorOffset: 2.28,
  },
  {
    id: 'surveyor-3-scoop',
    name: 'Surveyor 3 Soil Mechanics Robotic Scoop',
    mission: 'Surveyor 3',
    year: 1967,
    agency: 'NASA / JPL',
    country: 'United States',
    partCategory: 'SURFACE ROBOTICS',
    description: 'Motorized pantograph scissor boom and curved lunar regolith trenching claw.',
    realHistory:
      'Landed in Oceanus Procellarum in April 1967, Surveyor 3 carried an extendable lazy-tongs pantograph arm tipped with a 5-cm motorized scoop that dug four trenches up to 18 cm deep, testing regolith bearing strength for future Apollo landings.',
    failureReason:
      'Although Surveyor 3 survived two lunar nights before battery exhaustion and cold-soak electronics failure in May 1967, Apollo 12 astronauts later visited the crater in 1969 and retrieved its camera—leaving the trenching assembly behind.',
    missionSignificance:
      'Confirmed lunar soil was firm enough to support crewed landers rather than swallowing them in deep dust. Its high-torque DC actuators provide reliable mechanical drives for Asaar core control rods.',
    studyBullets: [
      { label: 'MISSION', value: 'Surveyor 3 (Oceanus Procellarum)' },
      { label: 'COUNTRY / AGENCY', value: 'United States · NASA / JPL' },
      { label: 'YEAR', value: '1967' },
      { label: 'HISTORY', value: 'Extendable robotic claw dug lunar trenches to prove safe footing.' },
      { label: 'FAILURE CAUSE', value: 'Battery exhaustion & deep lunar-night cold-soak electronics loss.' },
      { label: 'SALVAGE USE', value: 'Drives Asaar reactor core control-rod actuators.' },
    ],
    quizzes: [
      {
        question: 'Which robotic precursor spacecraft carried this pantograph trenching scoop?',
        options: ['Surveyor 3 (Oceanus Procellarum)', 'Luna 17', 'IM-1 Odysseus'],
        correctIndex: 0,
        hint: 'Landed in Oceanus Procellarum as Surveyor 3.',
      },
      {
        question: 'Which agency team operated this mission, and in what year?',
        options: ['Intuitive Machines (2024)', 'United States · NASA / JPL (1967)', 'CNSA (2013)'],
        correctIndex: 1,
        hint: 'NASA / JPL operated Surveyor 3 in 1967.',
      },
      {
        question: 'What crucial pre-Apollo engineering question did the scoop answer?',
        options: [
          'Proved lunar soil was firm enough to support crewed landers without sinking',
          'Confirmed plutonium thermal stability across 8 years',
          'Tested commercial methalox main propulsion in orbit',
        ],
        correctIndex: 0,
        hint: 'Dug lunar trenches to prove safe footing for crewed landers.',
      },
      {
        question: 'What ended Surveyor 3 operations, and what does its actuator do at Asaar?',
        options: [
          'Battery exhaustion & cold-soak electronics loss; drives core control-rod actuators',
          'Propellant depletion at landing; rebuilds coolant manifolds',
          'IMU reset at 14 km; restores helium pressurant lines',
        ],
        correctIndex: 0,
        hint: 'Battery exhaustion & cold-soak loss; drives reactor core control-rod actuators.',
      },
    ],
    kind: 'surveyor3_scoop',
    minRadius: 54,
    maxRadius: 88,
    sectorOffset: 2.95,
  },
  {
    id: 'lunokhod-1-solar-heater',
    name: 'Lunokhod 1 Solar Panels & Polonium Heater',
    mission: 'Luna 17 / Lunokhod 1',
    year: 1970,
    agency: 'USSR Space Program',
    country: 'Soviet Union (USSR)',
    partCategory: 'SOLAR & ISOTOPE THERMAL',
    description: 'Clam-shell photovoltaic solar lid assembly paired with a Po-210 thermal radiator.',
    realHistory:
      'The world’s first planetary rover rolled onto Mare Imbrium in November 1970. During lunar days, Lunokhod 1 opened its clam-shell solar lid to charge batteries; during freezing nights, it closed the lid while an aft Polonium-210 isotopic heater kept instruments warm.',
    failureReason:
      'After 322 Earth days and 10.5 km of driving—more than triple its 90-day design life—the Polonium-210 isotope (138-day half-life) decayed below minimum thermal output, causing the rover to freeze permanently on September 14, 1971.',
    missionSignificance:
      'Pioneered remote-controlled telerobotics across another world and carried a retroreflector still pinged by Earth lasers decades later. Its dual solar-thermal coupling boosts Asaar power conversion.',
    studyBullets: [
      { label: 'MISSION', value: 'Luna 17 / Lunokhod 1 (Mare Imbrium)' },
      { label: 'COUNTRY / AGENCY', value: 'Soviet Union · Lavochkin / USSR' },
      { label: 'YEAR', value: '1970' },
      { label: 'HISTORY', value: 'World’s first planetary rover; drove 10.5 km over 322 Earth days.' },
      { label: 'FAILURE CAUSE', value: 'Polonium-210 isotope decayed (138-day half-life) until rover froze.' },
      { label: 'SALVAGE USE', value: 'Couples photovoltaic capture with Asaar night thermal buses.' },
    ],
    quizzes: [
      {
        question: 'Which mission delivered the world’s first planetary rover onto Mare Imbrium?',
        options: ['Luna 17 / Lunokhod 1', 'Chang’e 3 / Yutu', 'Apollo 15 LRV'],
        correctIndex: 0,
        hint: 'Luna 17 carried Lunokhod 1 onto Mare Imbrium.',
      },
      {
        question: 'Which nation/program built Lunokhod 1, and in what year did it land?',
        options: ['Soviet Union · Lavochkin / USSR (1970)', 'United States · NASA (1969)', 'India · ISRO (2019)'],
        correctIndex: 0,
        hint: 'Soviet Union · Lavochkin / USSR landed Lunokhod 1 in 1970.',
      },
      {
        question: 'How far and long did Lunokhod 1 operate across Mare Imbrium?',
        options: [
          '10.5 km over 322 Earth days',
          '21 Earth days while stationary',
          '78 hours across Hadley Rille',
        ],
        correctIndex: 0,
        hint: 'World’s first planetary rover drove 10.5 km over 322 Earth days.',
      },
      {
        question: 'Why did Lunokhod 1 eventually freeze, and how does Asaar integrate this hardware?',
        options: [
          'Polonium-210 isotope decayed (138-day half-life); couples solar capture with night thermal buses',
          'Single-use electrolyte ruptured; stabilizes relay banks',
          'Excess thruster force saturated guidance; lines plasma exhaust',
        ],
        correctIndex: 0,
        hint: 'Polonium-210 decayed below thermal output; couples photovoltaic capture with night thermal buses.',
      },
    ],
    kind: 'lunokhod1_solar',
    minRadius: 74,
    maxRadius: 112,
    sectorOffset: 3.62,
  },
  {
    id: 'change-3-yutu-motor',
    name: "Chang'e 3 Yutu Rover Drive Motor",
    mission: "Chang'e 3 / Yutu",
    year: 2013,
    agency: 'CNSA',
    country: 'China',
    partCategory: 'ELECTRIC DRIVETRAIN',
    description: 'Gold-foil harmonic gearbox hub with spoked titanium mesh traction wheel.',
    realHistory:
      "Deployed from the Chang'e 3 lander in December 2013, China's Yutu ('Jade Rabbit') rover traversed Mare Imbrium using six independently driven titanium mesh wheels and harmonic-drive hub actuators wrapped in multi-layer gold thermal foil.",
    failureReason:
      'During its second lunar day in January 2014, abrasive regolith and thermal stress caused a mechanical control anomaly that prevented Yutu from folding its solar mast and drove it into permanent mobility lock, though its radar kept transmitting until 2016.',
    missionSignificance:
      'Executed the first soft lunar landing in 37 years since Luna 24 and mapped subsurface basalt layers with ground-penetrating radar. Its brushless harmonic drive motor acts as an auxiliary alternator for Asaar.',
    studyBullets: [
      { label: 'MISSION', value: "Chang'e 3 / Yutu ('Jade Rabbit')" },
      { label: 'COUNTRY / AGENCY', value: 'China · CNSA' },
      { label: 'YEAR', value: '2013' },
      { label: 'HISTORY', value: 'Ended a 37-year soft-landing gap & mapped subsurface basalt.' },
      { label: 'FAILURE CAUSE', value: 'Abrasive regolith & thermal stress locked mast-fold control in Jan 2014.' },
      { label: 'SALVAGE USE', value: 'Brushless harmonic hub serves as Asaar turbine alternator.' },
    ],
    quizzes: [
      {
        question: "Which mission deployed the 'Jade Rabbit' rover equipped with this harmonic wheel hub?",
        options: ["Chang'e 3 / Yutu", 'Chandrayaan-2', 'Surveyor 3'],
        correctIndex: 0,
        hint: "Yutu ('Jade Rabbit') rolled off the Chang'e 3 lander.",
      },
      {
        question: 'Which country and agency operated Yutu, and in what year did it land?',
        options: ['Israel · SpaceIL (2019)', 'China · CNSA (2013)', 'Soviet Union · USSR (1970)'],
        correctIndex: 1,
        hint: 'China · CNSA landed Chang’e 3 in December 2013.',
      },
      {
        question: 'What historic gap and scientific survey did this 2013 mission accomplish?',
        options: [
          'Ended a 37-year soft-landing gap & mapped subsurface basalt',
          'Performed the first crewed rover sortie in 1971',
          'Recorded the first moonquakes at Tranquility Base',
        ],
        correctIndex: 0,
        hint: 'First soft landing in 37 years; mapped subsurface basalt layers.',
      },
      {
        question: 'What locked Yutu’s mobility in Jan 2014, and how does Asaar repurpose the motor?',
        options: [
          'Abrasive regolith & thermal stress locked mast-fold control; acts as Asaar turbine alternator',
          'Laser-altimeter safety switch stayed disabled; braces core housing',
          'Command decoder overheated at +120 °C; synchronizes core clock',
        ],
        correctIndex: 0,
        hint: 'Abrasive dust & thermal stress jammed mast-fold control; serves as turbine alternator.',
      },
    ],
    kind: 'yutu_motor',
    minRadius: 68,
    maxRadius: 108,
    sectorOffset: 4.28,
  },
  {
    id: 'chandrayaan-2-vikram-thruster',
    name: 'Chandrayaan-2 Vikram Lander Braking Thruster',
    mission: 'Chandrayaan-2',
    year: 2019,
    agency: 'ISRO',
    country: 'India',
    partCategory: 'THROTTLEABLE PROPULSION',
    description: '800 N throttleable liquid braking engine bell with gimbal ring and feed lines.',
    realHistory:
      "ISRO's Vikram lander utilized four corner-mounted 800-Newton liquid bipropellant braking engines machined from high-temperature niobium alloy to decelerate from lunar orbit toward the south polar highlands near Manzinus C and Simpelius N.",
    failureReason:
      'During the fine-braking phase at 2.1 km altitude on September 6, 2019, higher-than-expected thruster force outpaced the attitude-control software authority limits, inducing a rapid roll tumble and a hard impact on the lunar surface.',
    missionSignificance:
      'The lessons from Vikram’s braking telemetry directly drove the redundant guidance upgrades behind Chandrayaan-3’s historic 2023 south pole touchdown. Its niobium bell resists extreme Asaar plasma exhaust.',
    studyBullets: [
      { label: 'MISSION', value: 'Chandrayaan-2 (Vikram Lander)' },
      { label: 'COUNTRY / AGENCY', value: 'India · ISRO' },
      { label: 'YEAR', value: '2019' },
      { label: 'HISTORY', value: '800 N niobium liquid engine aimed for south polar highlands.' },
      { label: 'FAILURE CAUSE', value: 'Excess thrust outpaced attitude software at 2.1 km altitude.' },
      { label: 'SALVAGE USE', value: 'Niobium nozzle liner contains Asaar core plasma exhaust.' },
    ],
    quizzes: [
      {
        question: 'Which lunar lander used four corner-mounted 800 N braking thrusters like this?',
        options: ['Chandrayaan-2 (Vikram Lander)', 'Beresheet', 'Apollo 11 Eagle'],
        correctIndex: 0,
        hint: 'Mounted on ISRO’s Chandrayaan-2 Vikram Lander.',
      },
      {
        question: 'Which nation/agency built Vikram, and in which year did descent occur?',
        options: ['India · ISRO (2019)', 'China · CNSA (2013)', 'United States · Intuitive Machines (2024)'],
        correctIndex: 0,
        hint: 'India · ISRO attempted landing in September 2019.',
      },
      {
        question: 'What material and thrust rating characterized Vikram’s braking engine?',
        options: [
          '800 N niobium liquid bipropellant engine aimed for south polar highlands',
          '36V silver-zinc electrochemical cell bank',
          '5-cm pantograph robotic trenching claw',
        ],
        correctIndex: 0,
        hint: 'High-temperature niobium alloy 800 N liquid engine.',
      },
      {
        question: 'What caused the 2.1 km descent anomaly, and how does Asaar use the nozzle?',
        options: [
          'Excess thrust outpaced attitude software; niobium liner contains core plasma exhaust',
          'Po-210 thermal output decayed; powers night thermal buses',
          'Electrolyte froze at -173 °C; stabilizes relay banks',
        ],
        correctIndex: 0,
        hint: 'Excess thrust outpaced attitude software at 2.1 km; nozzle liner contains plasma exhaust.',
      },
    ],
    kind: 'vikram_thruster',
    minRadius: 86,
    maxRadius: 126,
    sectorOffset: 4.92,
  },
  {
    id: 'beresheet-main-engine',
    name: 'Beresheet Main Engine',
    mission: 'Beresheet',
    year: 2019,
    agency: 'SpaceIL / IAI',
    country: 'Israel',
    partCategory: 'BIPROPELLANT THRUSTER',
    description: 'Compact bipropellant Leros thruster mounted beside a spherical helium tank.',
    realHistory:
      'Built by SpaceIL and Israel Aerospace Industries as the first privately funded lunar lander attempt, Beresheet relied on a compact Leros-2b hydrazine/MON-3 main engine fed by a spherical titanium helium pressurant bottle to perform seven orbital maneuvers and final braking.',
    failureReason:
      'At 14 km altitude during descent on April 11, 2019, a manual command to recover a failed IMU-2 gyroscope triggered a cascading computer reset. The main engine shut down for several critical minutes, restarting too late to arrest a 500 km/h vertical descent.',
    missionSignificance:
      'Demonstrated that compact commercial spacecraft can reach lunar orbit on a fraction of sovereign agency budgets. Its titanium pressurant bottle and valves restore Asaar high-pressure feed lines.',
    studyBullets: [
      { label: 'MISSION', value: 'Beresheet (Mare Serenitatis)' },
      { label: 'COUNTRY / AGENCY', value: 'Israel · SpaceIL / IAI' },
      { label: 'YEAR', value: '2019' },
      { label: 'HISTORY', value: 'World’s first privately funded mission to enter lunar orbit.' },
      { label: 'FAILURE CAUSE', value: 'IMU reset shut down main engine at 14 km; crashed at 500 km/h.' },
      { label: 'SALVAGE USE', value: 'Titanium helium bottle restores Asaar pressurant feed lines.' },
    ],
    quizzes: [
      {
        question: 'Which spacecraft targeting Mare Serenitatis used this compact Leros main engine?',
        options: ['Beresheet', 'Surveyor 3', 'Apollo 17 LM'],
        correctIndex: 0,
        hint: 'Target landing zone was Mare Serenitatis aboard Beresheet.',
      },
      {
        question: 'Which country/organizations built it, and in what year?',
        options: ['Israel · SpaceIL / IAI (2019)', 'Soviet Union · Lavochkin (1970)', 'United States · NASA (1967)'],
        correctIndex: 0,
        hint: 'Israel · SpaceIL / IAI flew Beresheet in 2019.',
      },
      {
        question: 'What milestone did Beresheet achieve before its final descent?',
        options: [
          'World’s first privately funded mission to enter lunar orbit',
          'First crewed commercial landing at Malapert A',
          'First seismometer placed on Tranquility Base',
        ],
        correctIndex: 0,
        hint: 'First privately funded spacecraft to achieve lunar orbit.',
      },
      {
        question: 'What triggered its 14 km crash, and how does Asaar use its salvaged bottle?',
        options: [
          'IMU reset shut down main engine; titanium helium bottle restores Asaar pressurant feed lines',
          'Disabled laser altimeter switch snapped a leg; braces core housing',
          'Cold-soak exhausted batteries; drives control-rod actuators',
        ],
        correctIndex: 0,
        hint: 'IMU reset shut down the main engine at 14 km; helium bottle restores pressurant feed lines.',
      },
    ],
    kind: 'beresheet_engine',
    minRadius: 78,
    maxRadius: 122,
    sectorOffset: 5.52,
  },
  {
    id: 'im1-odysseus-landing-gear',
    name: 'Intuitive Machines Odysseus (IM-1) Carbon-Fiber Landing Gear',
    mission: 'IM-1 Odysseus',
    year: 2024,
    agency: 'Intuitive Machines',
    country: 'United States',
    partCategory: 'COMPOSITE STRUCTURE',
    description: 'Carbon-composite tripod shock strut with honeycomb crush-core footpad.',
    realHistory:
      'Launched under NASA’s CLPS program in February 2024, the Nova-C lander Odysseus touched down near Malapert A in the lunar south pole region—marking the first U.S. soft lunar landing since Apollo 17 using lightweight carbon-fiber legs and crushable aluminum honeycomb pads.',
    failureReason:
      'A pre-flight laser-altimeter safety switch had been left disabled, forcing flight controllers to patch in NASA’s NDL lidar mid-orbit. Odysseus descended faster than planned with residual lateral drift, snapping a carbon-fiber leg on impact and tipping onto its side.',
    missionSignificance:
      'Achieved the southernmost lunar landing in history and proved commercial methalox propulsion on the Moon. Its high-stiffness carbon struts and honeycomb dampers brace the damaged Asaar core housing.',
    studyBullets: [
      { label: 'MISSION', value: 'IM-1 Odysseus (Malapert A South Pole)' },
      { label: 'COUNTRY / AGENCY', value: 'United States · Intuitive Machines' },
      { label: 'YEAR', value: '2024' },
      { label: 'HISTORY', value: 'Southernmost lunar landing & first U.S. soft touchdown since 1972.' },
      { label: 'FAILURE CAUSE', value: 'Laser-altimeter safety switch error led to fast skid & snapped leg.' },
      { label: 'SALVAGE USE', value: 'Carbon-composite struts brace damaged Asaar core housing.' },
    ],
    quizzes: [
      {
        question: 'Which south-pole lander near Malapert A used this carbon-composite landing strut?',
        options: ['IM-1 Odysseus', 'Chandrayaan-2 Vikram', 'Apollo 11 LM'],
        correctIndex: 0,
        hint: 'The IM-1 Odysseus (Nova-C) lander touched down near Malapert A.',
      },
      {
        question: 'Which country/company flew Odysseus, and in what year?',
        options: [
          'United States · Intuitive Machines (2024)',
          'India · ISRO (2019)',
          'China · CNSA (2013)',
        ],
        correctIndex: 0,
        hint: 'United States · Intuitive Machines launched IM-1 in February 2024.',
      },
      {
        question: 'What dual historic milestone did IM-1 Odysseus achieve in February 2024?',
        options: [
          'Southernmost lunar landing & first U.S. soft touchdown since 1972',
          'First robotic rover to drive 10.5 km on Mare Imbrium',
          'First moonquake recorded at Tranquility Base',
        ],
        correctIndex: 0,
        hint: 'Southernmost lunar landing and first U.S. soft touchdown since Apollo 17 in 1972.',
      },
      {
        question: 'Why did Odysseus snap a landing leg, and how does Asaar install it?',
        options: [
          'Laser-altimeter safety switch was left disabled; struts brace damaged Asaar core housing',
          'IMU reset shut down engine at 14 km; restores helium feed lines',
          'Abrasive dust locked mast control; acts as turbine alternator',
        ],
        correctIndex: 0,
        hint: 'Disabled laser-altimeter switch caused a fast skid; carbon struts brace the core housing.',
      },
    ],
    kind: 'odysseus_gear',
    minRadius: 96,
    maxRadius: 136,
    sectorOffset: 6.08,
  },
];

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scatterRelicCoordinates(): Array<{ x: number; z: number; yaw: number }> {
  const rng = createSeededRng(0x53454c37); // "SEL7"
  const placed: Array<{ x: number; z: number; yaw: number }> = [];

  for (let i = 0; i < RELIC_SPECS.length; i++) {
    const spec = RELIC_SPECS[i];
    let bestX = Math.cos(spec.sectorOffset) * ((spec.minRadius + spec.maxRadius) * 0.5);
    let bestZ = Math.sin(spec.sectorOffset) * ((spec.minRadius + spec.maxRadius) * 0.5);
    let found = false;

    for (let attempt = 0; attempt < 96; attempt++) {
      const sectorSpan = 0.56;
      const angle = spec.sectorOffset + (rng() - 0.5) * sectorSpan;
      const radius = spec.minRadius + rng() * (spec.maxRadius - spec.minRadius);
      const cx = Math.cos(angle) * radius;
      const cz = Math.sin(angle) * radius;

      // Keep clear of Asaar base & rover launch pad
      if (Math.abs(cx) < 22 && cz > -18 && cz < 28) continue;
      if (Math.hypot(cx, cz) > 138) continue;

      // Avoid overly steep crater rim walls
      const h0 = getLunarSurfaceHeight(cx, cz);
      const hx = getLunarSurfaceHeight(cx + 1.5, cz);
      const hz = getLunarSurfaceHeight(cx, cz + 1.5);
      const slope = Math.hypot(hx - h0, hz - h0) / 1.5;
      if (slope > 0.42 && attempt < 70) continue;

      // Guarantee generous separation across the entire lunar basin
      const tooClose = placed.some((p) => Math.hypot(p.x - cx, p.z - cz) < 34);
      if (tooClose) continue;

      bestX = cx;
      bestZ = cz;
      found = true;
      break;
    }

    if (!found) {
      const fallbackAngle = (i / RELIC_SPECS.length) * Math.PI * 2 + 0.25;
      const fallbackR = (spec.minRadius + spec.maxRadius) * 0.5;
      bestX = Math.cos(fallbackAngle) * fallbackR;
      bestZ = Math.sin(fallbackAngle) * fallbackR;
    }

    placed.push({ x: bestX, z: bestZ, yaw: rng() * Math.PI * 2 });
  }

  return placed;
}

interface ArtifactMaterialPalette {
  goldKaptonMat: THREE.MeshStandardMaterial;
  silverTitaniumMat: THREE.MeshStandardMaterial;
  brushedSteelMat: THREE.MeshStandardMaterial;
  carbonCompositeMat: THREE.MeshStandardMaterial;
  copperCoilMat: THREE.MeshStandardMaterial;
  niobiumNozzleMat: THREE.MeshStandardMaterial;
  solarCellMat: THREE.MeshStandardMaterial;
  isotopeGlowMat: THREE.MeshStandardMaterial;
  vikramNozzleGeo: THREE.LatheGeometry;
  beresheetNozzleGeo: THREE.LatheGeometry;
}

function createArtifactMaterialPalette(
  track: <T extends { dispose: () => void }>(item: T) => T,
): ArtifactMaterialPalette {
  return {
    goldKaptonMat: track(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.24,
        metalness: 0.92,
        flatShading: true,
      }),
    ),
    silverTitaniumMat: track(
      new THREE.MeshStandardMaterial({
        color: 0xd8e1ec,
        roughness: 0.34,
        metalness: 0.84,
        flatShading: true,
      }),
    ),
    brushedSteelMat: track(
      new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.48,
        metalness: 0.72,
        flatShading: true,
      }),
    ),
    carbonCompositeMat: track(
      new THREE.MeshStandardMaterial({
        color: 0x18212f,
        roughness: 0.74,
        metalness: 0.22,
        flatShading: true,
      }),
    ),
    copperCoilMat: track(
      new THREE.MeshStandardMaterial({
        color: 0xd97706,
        roughness: 0.28,
        metalness: 0.9,
        flatShading: true,
      }),
    ),
    niobiumNozzleMat: track(
      new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.38,
        metalness: 0.86,
        side: THREE.DoubleSide,
        flatShading: true,
      }),
    ),
    solarCellMat: track(
      new THREE.MeshStandardMaterial({
        color: 0x0f4c81,
        emissive: 0x082f49,
        emissiveIntensity: 0.45,
        roughness: 0.18,
        metalness: 0.85,
      }),
    ),
    isotopeGlowMat: track(
      new THREE.MeshStandardMaterial({
        color: 0xfb923c,
        emissive: 0xf97316,
        emissiveIntensity: 1.45,
        roughness: 0.35,
        metalness: 0.25,
      }),
    ),
    vikramNozzleGeo: track(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.14, 0.95),
          new THREE.Vector2(0.11, 0.78),
          new THREE.Vector2(0.24, 0.46),
          new THREE.Vector2(0.42, 0.16),
          new THREE.Vector2(0.52, 0.0),
        ],
        14,
      ),
    ),
    beresheetNozzleGeo: track(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.1, 0.68),
          new THREE.Vector2(0.08, 0.54),
          new THREE.Vector2(0.19, 0.28),
          new THREE.Vector2(0.32, 0.0),
        ],
        12,
      ),
    ),
  };
}

export function createArtifactMeshGroup(
  kind: ArtifactKind,
  disposables: Array<{ dispose: () => void }>,
  sharedPalette?: ArtifactMaterialPalette,
): THREE.Group {
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };
  const pal = sharedPalette ?? createArtifactMaterialPalette(track);
  const {
    goldKaptonMat,
    silverTitaniumMat,
    brushedSteelMat,
    carbonCompositeMat,
    copperCoilMat,
    niobiumNozzleMat,
    solarCellMat,
    isotopeGlowMat,
    vikramNozzleGeo,
    beresheetNozzleGeo,
  } = pal;

  const modelGroup = new THREE.Group();

  const addPart = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    px = 0,
    py = 0,
    pz = 0,
    rx = 0,
    ry = 0,
    rz = 0,
    castShadow = true,
  ) => {
    const m = new THREE.Mesh(track(geo), mat);
    m.position.set(px, py, pz);
    m.rotation.set(rx, ry, rz);
    m.castShadow = castShadow;
    m.receiveShadow = true;
    modelGroup.add(m);
    return m;
  };

  switch (kind) {
    case 'lrv_battery': {
      addPart(new THREE.BoxGeometry(1.36, 0.16, 0.92), goldKaptonMat, 0, 0.08, 0);
      addPart(new THREE.BoxGeometry(0.52, 0.62, 0.72), silverTitaniumMat, -0.32, 0.44, 0);
      addPart(new THREE.BoxGeometry(0.52, 0.62, 0.72), silverTitaniumMat, 0.32, 0.44, 0);
      addPart(new THREE.BoxGeometry(0.46, 0.08, 0.64), carbonCompositeMat, -0.32, 0.79, 0);
      addPart(new THREE.BoxGeometry(0.46, 0.08, 0.64), carbonCompositeMat, 0.32, 0.79, 0);
      for (const side of [-0.32, 0.32]) {
        addPart(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 8), copperCoilMat, side, 0.88, -0.18);
        addPart(new THREE.CylinderGeometry(0.05, 0.05, 0.14, 8), brushedSteelMat, side, 0.88, 0.18);
      }
      addPart(new THREE.TorusGeometry(0.32, 0.035, 8, 14, Math.PI), copperCoilMat, 0, 0.88, -0.18);
      break;
    }

    case 'alsep_rtg': {
      for (let k = 0; k < 3; k++) {
        const ang = (k / 3) * Math.PI * 2;
        addPart(
          new THREE.CylinderGeometry(0.04, 0.05, 0.68, 6),
          brushedSteelMat,
          Math.cos(ang) * 0.42,
          0.26,
          Math.sin(ang) * 0.42,
          Math.sin(ang) * 0.45,
          0,
          -Math.cos(ang) * 0.45,
        );
      }
      addPart(new THREE.CylinderGeometry(0.24, 0.25, 1.08, 10), carbonCompositeMat, 0, 0.72, 0);
      addPart(new THREE.CylinderGeometry(0.255, 0.255, 0.16, 10), isotopeGlowMat, 0, 0.72, 0, 0, 0, 0, false);
      for (let f = 0; f < 8; f++) {
        const ang = (f / 8) * Math.PI * 2;
        addPart(
          new THREE.BoxGeometry(0.04, 0.96, 0.36),
          silverTitaniumMat,
          Math.cos(ang) * 0.36,
          0.72,
          Math.sin(ang) * 0.36,
          0,
          -ang + Math.PI / 2,
          0,
        );
      }
      addPart(new THREE.CylinderGeometry(0.18, 0.24, 0.12, 10), goldKaptonMat, 0, 1.3, 0);
      addPart(new THREE.TorusGeometry(0.14, 0.03, 8, 14), brushedSteelMat, 0, 1.46, 0);
      break;
    }

    case 'lm_tank': {
      addPart(new THREE.CylinderGeometry(0.78, 0.84, 0.48, 8, 1, true), goldKaptonMat, 0, 0.28, 0);
      addPart(new THREE.CylinderGeometry(0.76, 0.76, 0.08, 8), carbonCompositeMat, 0, 0.06, 0);
      addPart(new THREE.IcosahedronGeometry(0.56, 2), silverTitaniumMat, 0, 0.68, 0);
      addPart(new THREE.TorusGeometry(0.57, 0.04, 8, 18), brushedSteelMat, 0, 0.68, 0, Math.PI / 2, 0, 0);
      addPart(new THREE.CylinderGeometry(0.14, 0.18, 0.22, 8), copperCoilMat, 0, 1.24, 0);
      addPart(new THREE.CylinderGeometry(0.035, 0.035, 0.48, 6), brushedSteelMat, 0.28, 1.05, 0, 0, 0, 0.65);
      addPart(new THREE.CylinderGeometry(0.035, 0.035, 0.48, 6), brushedSteelMat, -0.28, 1.05, 0, 0, 0, -0.65);
      break;
    }

    case 'apollo11_pse': {
      addPart(new THREE.CylinderGeometry(0.38, 0.82, 0.36, 12), goldKaptonMat, 0, 0.18, 0);
      addPart(new THREE.CylinderGeometry(0.32, 0.34, 0.56, 12), silverTitaniumMat, 0, 0.56, 0);
      addPart(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 12), carbonCompositeMat, 0, 0.86, 0);
      addPart(new THREE.BoxGeometry(0.82, 0.05, 0.48), solarCellMat, -0.78, 0.68, 0, 0.22, 0, -0.18);
      addPart(new THREE.BoxGeometry(0.82, 0.05, 0.48), solarCellMat, 0.78, 0.68, 0, 0.22, 0, 0.18);
      addPart(new THREE.BoxGeometry(0.28, 0.05, 0.12), brushedSteelMat, -0.36, 0.64, 0);
      addPart(new THREE.BoxGeometry(0.28, 0.05, 0.12), brushedSteelMat, 0.36, 0.64, 0);
      addPart(new THREE.CylinderGeometry(0.02, 0.03, 0.92, 6), brushedSteelMat, 0, 1.32, -0.12);
      addPart(new THREE.SphereGeometry(0.055, 8, 8), goldKaptonMat, 0, 1.78, -0.12);
      break;
    }

    case 'surveyor3_scoop': {
      addPart(new THREE.BoxGeometry(0.54, 0.22, 0.54), carbonCompositeMat, -0.45, 0.11, 0);
      addPart(new THREE.CylinderGeometry(0.2, 0.22, 0.44, 10), silverTitaniumMat, -0.45, 0.42, 0);
      addPart(new THREE.CylinderGeometry(0.14, 0.14, 0.36, 8), goldKaptonMat, -0.32, 0.58, 0, 0, 0, Math.PI / 2);
      addPart(new THREE.BoxGeometry(0.76, 0.06, 0.08), brushedSteelMat, -0.08, 0.78, 0.12, 0, 0, 0.32);
      addPart(new THREE.BoxGeometry(0.76, 0.06, 0.08), brushedSteelMat, -0.08, 0.78, -0.12, 0, 0, 0.32);
      addPart(new THREE.BoxGeometry(0.74, 0.06, 0.08), silverTitaniumMat, 0.42, 0.72, 0.12, 0, 0, -0.48);
      addPart(new THREE.BoxGeometry(0.74, 0.06, 0.08), silverTitaniumMat, 0.42, 0.72, -0.12, 0, 0, -0.48);
      addPart(new THREE.CylinderGeometry(0.07, 0.07, 0.32, 8), copperCoilMat, 0.2, 0.92, 0, Math.PI / 2, 0, 0);
      addPart(new THREE.CylinderGeometry(0.18, 0.18, 0.32, 10, 1, true, 0, Math.PI * 1.25), brushedSteelMat, 0.72, 0.44, 0, 0, Math.PI / 2, 0.35);
      addPart(new THREE.BoxGeometry(0.26, 0.05, 0.32), carbonCompositeMat, 0.78, 0.28, 0, 0, 0, -0.25);
      break;
    }

    case 'lunokhod1_solar': {
      addPart(new THREE.CylinderGeometry(0.68, 0.56, 0.44, 10), silverTitaniumMat, 0, 0.26, 0);
      addPart(new THREE.TorusGeometry(0.64, 0.055, 6, 12), brushedSteelMat, 0, 0.46, 0, Math.PI / 2, 0, 0);
      addPart(new THREE.CylinderGeometry(0.68, 0.68, 0.08, 12), solarCellMat, 0, 0.92, -0.28, -0.74, 0, 0);
      addPart(new THREE.TorusGeometry(0.69, 0.035, 6, 12), goldKaptonMat, 0, 0.92, -0.28, Math.PI / 2 - 0.74, 0, 0);
      addPart(new THREE.CylinderGeometry(0.24, 0.28, 0.26, 10), carbonCompositeMat, 0, 0.32, 0.76, Math.PI / 2, 0, 0);
      addPart(new THREE.SphereGeometry(0.22, 10, 8), isotopeGlowMat, 0, 0.32, 0.9, 0, 0, 0, false);
      addPart(new THREE.TorusGeometry(0.26, 0.03, 6, 12), copperCoilMat, 0, 0.32, 0.88);
      break;
    }

    case 'yutu_motor': {
      addPart(new THREE.BoxGeometry(0.46, 0.38, 0.42), goldKaptonMat, -0.34, 0.52, 0);
      addPart(new THREE.BoxGeometry(0.42, 0.14, 0.14), brushedSteelMat, -0.52, 0.78, 0, 0, 0, 0.55);
      addPart(new THREE.CylinderGeometry(0.14, 0.14, 0.64, 10), copperCoilMat, 0.04, 0.48, 0, 0, 0, Math.PI / 2);
      addPart(new THREE.TorusGeometry(0.42, 0.11, 8, 14), silverTitaniumMat, 0.28, 0.48, 0, 0, Math.PI / 2, 0);
      addPart(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 10), carbonCompositeMat, 0.28, 0.48, 0, 0, 0, Math.PI / 2);
      for (let s = 0; s < 6; s++) {
        const ang = (s / 6) * Math.PI * 2;
        addPart(new THREE.BoxGeometry(0.05, 0.06, 0.76), brushedSteelMat, 0.28, 0.48, 0, ang, 0, 0);
      }
      break;
    }

    case 'vikram_thruster': {
      addPart(new THREE.CylinderGeometry(0.56, 0.66, 0.16, 10, 1, true), brushedSteelMat, 0, 0.12, 0);
      const nozzle = new THREE.Mesh(vikramNozzleGeo, niobiumNozzleMat);
      nozzle.position.y = 0.08;
      nozzle.castShadow = true;
      nozzle.receiveShadow = true;
      modelGroup.add(nozzle);
      addPart(new THREE.CylinderGeometry(0.22, 0.22, 0.32, 10), goldKaptonMat, 0, 1.08, 0);
      addPart(new THREE.TorusGeometry(0.28, 0.045, 8, 16), silverTitaniumMat, 0, 0.88, 0, Math.PI / 2, 0, 0);
      addPart(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 6), copperCoilMat, 0.24, 0.94, 0, 0, 0, 0.28);
      addPart(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 6), copperCoilMat, -0.24, 0.94, 0, 0, 0, -0.28);
      break;
    }

    case 'beresheet_engine': {
      addPart(new THREE.CylinderGeometry(0.58, 0.66, 0.12, 8), carbonCompositeMat, 0, 0.08, 0);
      const bNozzle = new THREE.Mesh(beresheetNozzleGeo, niobiumNozzleMat);
      bNozzle.position.set(-0.22, 0.12, 0);
      bNozzle.castShadow = true;
      bNozzle.receiveShadow = true;
      modelGroup.add(bNozzle);
      addPart(new THREE.IcosahedronGeometry(0.32, 2), silverTitaniumMat, 0.34, 0.46, 0);
      addPart(new THREE.BoxGeometry(0.38, 0.32, 0.36), goldKaptonMat, -0.22, 0.92, 0);
      addPart(new THREE.CylinderGeometry(0.03, 0.03, 0.56, 6), brushedSteelMat, 0.06, 0.74, 0, 0, 0, 0.95);
      break;
    }

    case 'odysseus_gear': {
      addPart(new THREE.CylinderGeometry(0.56, 0.68, 0.14, 12), silverTitaniumMat, 0, 0.07, 0);
      addPart(new THREE.CylinderGeometry(0.38, 0.48, 0.08, 10), goldKaptonMat, 0, 0.16, 0);
      addPart(new THREE.CylinderGeometry(0.08, 0.1, 1.28, 8), carbonCompositeMat, 0, 0.78, -0.18, 0.28, 0, 0);
      addPart(new THREE.CylinderGeometry(0.055, 0.065, 1.18, 8), carbonCompositeMat, -0.28, 0.7, 0.18, -0.26, 0, -0.34);
      addPart(new THREE.CylinderGeometry(0.055, 0.065, 1.18, 8), carbonCompositeMat, 0.28, 0.7, 0.18, -0.26, 0, 0.34);
      addPart(new THREE.CylinderGeometry(0.045, 0.045, 0.85, 8), brushedSteelMat, 0, 0.64, 0);
      addPart(new THREE.BoxGeometry(0.42, 0.22, 0.36), goldKaptonMat, 0, 1.26, 0);
      break;
    }
  }

  return modelGroup;
}

export function getArchiveArtifacts(): SalvageArtifactInfo[] {
  const coords = scatterRelicCoordinates();
  return RELIC_SPECS.map((spec, idx) => {
    const { x, z } = coords[idx];
    return {
      id: spec.id,
      kind: spec.kind,
      name: spec.name,
      mission: spec.mission,
      year: spec.year,
      agency: spec.agency,
      country: spec.country,
      partCategory: spec.partCategory,
      description: spec.description,
      realHistory: spec.realHistory,
      failureReason: spec.failureReason,
      missionSignificance: spec.missionSignificance,
      coordLabel: `${Math.round(x)}E / ${Math.round(-z)}N`,
      studyBullets: spec.studyBullets,
      quizzes: spec.quizzes,
      collected: true,
      distanceMeters: Math.round(Math.hypot(x, z)),
      bearingDeg: Math.round(((Math.atan2(x, -z) * 180) / Math.PI + 360) % 360),
    };
  });
}

export function generateArtifactThumbnailUrls(): Partial<Record<ArtifactKind, string>> {
  const result: Partial<Record<ArtifactKind, string>> = {};
  const tempDisposables: Array<{ dispose: () => void }> = [];
  let renderer: THREE.WebGLRenderer | null = null;

  try {
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.setPixelRatio(1);
    renderer.setSize(128, 128);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.8);
    keyLight.position.set(3.5, 4.5, 4.2);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    rimLight.position.set(-4.0, 2.2, -3.5);
    scene.add(rimLight);

    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x0f172a, 1.25);
    scene.add(hemiLight);

    const sharedPalette = createArtifactMaterialPalette((item) => {
      tempDisposables.push(item);
      return item;
    });

    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    for (const spec of RELIC_SPECS) {
      const meshGroup = createArtifactMeshGroup(spec.kind, tempDisposables, sharedPalette);
      meshGroup.rotation.y = 0.55;
      scene.add(meshGroup);
      meshGroup.updateMatrixWorld(true);

      box.setFromObject(meshGroup);
      box.getSize(size);
      box.getCenter(center);

      const maxDim = Math.max(size.x, size.y, size.z, 0.8);
      const dist = maxDim * 2.15;
      camera.position.set(center.x + dist * 0.48, center.y + dist * 0.42, center.z + dist * 0.88);
      camera.lookAt(center);
      renderer.render(scene, camera);
      result[spec.kind] = renderer.domElement.toDataURL('image/png');
      scene.remove(meshGroup);
    }
  } catch {
    return {};
  } finally {
    tempDisposables.forEach((d) => d.dispose());
    renderer?.dispose();
  }

  return result;
}

export function createSalvageArtifacts(
  scene: THREE.Scene,
  disposables: Array<{ dispose: () => void }>,
): SalvageArtifactEntity[] {
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const sharedPalette = createArtifactMaterialPalette(track);

  const beaconBeamMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const ringMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 2.0,
      roughness: 0.2,
    }),
  );
  const diamondMarkerMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.85,
      roughness: 0.22,
      metalness: 0.4,
      flatShading: true,
    }),
  );

  const scatteredCoords = scatterRelicCoordinates();

  return RELIC_SPECS.map((spec, idx) => {
    const { x, z, yaw } = scatteredCoords[idx];
    const groundY = getLunarSurfaceHeight(x, z);

    const root = new THREE.Group();
    root.position.set(x, groundY, z);
    scene.add(root);

    const pad = new THREE.Mesh(
      track(new THREE.CylinderGeometry(1.18, 1.38, 0.1, 10)),
      sharedPalette.carbonCompositeMat,
    );
    pad.position.y = 0.05;
    pad.receiveShadow = true;
    root.add(pad);

    const modelGroup = createArtifactMeshGroup(spec.kind, disposables, sharedPalette);
    modelGroup.position.y = 0.1;
    modelGroup.rotation.y = yaw;
    root.add(modelGroup);

    const beaconBeam = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.08, 0.28, 28, 8, 1, true)),
      beaconBeamMat,
    );
    beaconBeam.position.y = 14.1;
    root.add(beaconBeam);

    const beaconRing = new THREE.Mesh(track(new THREE.TorusGeometry(1.48, 0.055, 8, 24)), ringMat);
    beaconRing.rotation.x = Math.PI / 2;
    beaconRing.position.y = 0.22;
    root.add(beaconRing);

    const beaconDiamond = new THREE.Mesh(
      track(new THREE.OctahedronGeometry(0.3, 0)),
      diamondMarkerMat,
    );
    beaconDiamond.position.y = 2.65;
    root.add(beaconDiamond);

    return {
      id: spec.id,
      kind: spec.kind,
      name: spec.name,
      mission: spec.mission,
      year: spec.year,
      agency: spec.agency,
      country: spec.country,
      partCategory: spec.partCategory,
      description: spec.description,
      realHistory: spec.realHistory,
      failureReason: spec.failureReason,
      missionSignificance: spec.missionSignificance,
      coordLabel: `${Math.round(x)}E / ${Math.round(-z)}N`,
      studyBullets: spec.studyBullets,
      quizzes: spec.quizzes,
      collected: false,
      distanceMeters: 0,
      bearingDeg: 0,
      root,
      beaconBeam,
      beaconRing,
      beaconDiamond,
      position: new THREE.Vector3(x, groundY, z),
    };
  });
}

export function createWaypointArrowRig(
  scene: THREE.Scene,
  disposables: Array<{ dispose: () => void }>,
): WaypointArrowRig {
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const root = new THREE.Group();
  root.name = 'WaypointHoloArrow';
  root.visible = false;
  scene.add(root);

  const arrowBody = new THREE.Group();
  root.add(arrowBody);

  const holoMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 2.35,
      roughness: 0.18,
      metalness: 0.2,
      transparent: true,
      opacity: 0.92,
    }),
  );

  const tipMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.6,
      roughness: 0.15,
      metalness: 0.2,
      transparent: true,
      opacity: 0.96,
      flatShading: true,
    }),
  );

  // Crisp extruded 3D arrow silhouette in XY (+Y tip), centered in Z, then rotated x = -PI/2 so tip points strictly along -Z
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, 0.56);
  arrowShape.lineTo(0.33, 0.04);
  arrowShape.lineTo(0.13, 0.04);
  arrowShape.lineTo(0.13, -0.44);
  arrowShape.lineTo(-0.13, -0.44);
  arrowShape.lineTo(-0.13, 0.04);
  arrowShape.lineTo(-0.33, 0.04);
  arrowShape.closePath();

  const arrowGeo = track(
    new THREE.ExtrudeGeometry(arrowShape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.022,
      bevelSize: 0.018,
      bevelSegments: 2,
    }),
  );
  arrowGeo.translate(0, 0, -0.05);

  const arrowMesh = new THREE.Mesh(arrowGeo, holoMat);
  arrowMesh.rotation.x = -Math.PI / 2;
  arrowBody.add(arrowMesh);

  // Subtle bright tip diamond just ahead of the arrow point
  const tipCore = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.075, 0)), tipMat);
  tipCore.position.set(0, 0, -0.63);
  arrowBody.add(tipCore);

  // Thin glowing holographic compass ring beneath the floating arrow
  const ringMesh = new THREE.Mesh(track(new THREE.TorusGeometry(0.52, 0.018, 6, 32)), holoMat);
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.set(0, -0.1, 0);
  arrowBody.add(ringMesh);

  return {
    root,
    arrowBody,
    holoMat,
    tipMat,
    ringMesh,
  };
}
