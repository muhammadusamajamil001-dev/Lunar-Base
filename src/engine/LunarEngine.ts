import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createAstronaut, AstronautRig } from './astronaut';
import { LunarAudioEngine } from './audio';
import { buildLunarBaseEnvironment, LunarBaseSceneData, InteractiveTerminal } from './lunarBase';
import {
  createArtifactMeshGroup,
  createWaypointArrowRig,
  getLunarSurfaceHeight,
  getLunarThermalState,
  LUNAR_GRAVITY,
  SalvageArtifactEntity,
  SUN_POSITION,
  WaypointArrowRig,
} from './lunarSurfaceObjects';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import {
  CameraViewMode,
  ControlMode,
  EnvironmentZone,
  FinalePhase,
  GameMode,
  HudSnapshot,
  LightingPreset,
  NarrativeStage,
} from '../types/game';

// Zero-GC module-level scratch math objects
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _camGoal = new THREE.Vector3();
const _lookGoal = new THREE.Vector3();
const _sunDir = SUN_POSITION.clone().normalize();
const _defaultSunDir = SUN_POSITION.clone().normalize();
const _sunriseLowColor = new THREE.Color(0xff9e44);
const _sunriseMidColor = new THREE.Color(0xffe1a8);
const _sunriseDayColor = new THREE.Color(0xfff5e0);
const _sunWorldPos = new THREE.Vector3();
const _sunNdc = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _flarePos = new THREE.Vector3();
const _roverFwd = new THREE.Vector3();
const _roverRight = new THREE.Vector3();
const _roverNormal = new THREE.Vector3();
const _roverBasis = new THREE.Matrix4();
const _roverTargetQuat = new THREE.Quaternion();
const _arrowGoalPos = new THREE.Vector3();
const _arrowEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _arrowQuat = new THREE.Quaternion();
const _finaleCamStart = new THREE.Vector3(0.45, 2.08, 0.45);
const _finaleCamPreBlast = new THREE.Vector3(0.95, 2.15, -1.25);
const _finaleCamWindow = new THREE.Vector3(1.75, 2.45, -7.75);
const _finaleCamExit = new THREE.Vector3(2.85, 3.65, -15.2);
const _finaleLookCore = new THREE.Vector3(0, 1.85, -4.1);
const _finaleLookOutside = new THREE.Vector3(2.2, 2.4, -28.0);
const _arcColorGold = new THREE.Color(0xfbbf24);
const _arcColorCyan = new THREE.Color(0x38bdf8);
const _arcColorWhite = new THREE.Color(0xf8fafc);

function detectSoftwareWebGL(): boolean {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

export interface LunarEngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onModeChange: (mode: GameMode) => void;
}

export class LunarEngine {
  private container: HTMLElement;
  private callbacks: LunarEngineCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;
  private textures: ProceduralTextureSet;
  private baseData: LunarBaseSceneData;
  private astronaut: AstronautRig;
  private audio: LunarAudioEngine;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private envRT: THREE.WebGLRenderTarget;

  private frameId = 0;
  private disposed = false;
  private renderingPaused = false;

  // Game & Survival State
  private mode: GameMode = 'title';
  private viewMode: CameraViewMode = 'first';
  private lightingPreset: LightingPreset = 'nominal';
  private oxygen = 92;
  private energy = 88;
  private statusBanner: string | null = null;
  private statusTimer = 0;
  private hudSyncTimer = 0;

  // Narrative Event & Sequential Story Salvage State
  private narrativeStage: NarrativeStage = 'alarm';
  private finaleActive = false;
  private finalePhase: FinalePhase = 'none';
  private finaleTimer = 0;
  private shockwaveTriggered = false;
  private navPingTimer = 0;
  private transmissionOpen = false;
  private studyTerminalOpen = false;
  private sortieBriefed = false;
  private activeTargetIndex = 0;
  private inspectedArtifact: SalvageArtifactEntity | null = null;
  private quizFailedOnInspect = false;
  private alarmTimer = 0;
  private sirenCount = 0;
  private sirenCooldown = 0;
  private environmentZone: EnvironmentZone = 'interior';
  private controlMode: ControlMode = 'foot';

  // Survival Thermal, Solar & Post-Processing Visual FX State
  private solarState: 'sunlight' | 'shadow' | 'interior' = 'interior';
  private surfaceTempC = 21;
  private powerDeltaPerSec = -0.12;
  private frostLevel = 0;
  private thermalBannerCooldown = 0;
  private lastSurfaceShadowState: boolean | null = null;
  private lowPowerWarned = false;
  private currentFlareStrength = 0;
  private postDisposables: Array<{ dispose: () => void }> = [];
  private waypointArrow: WaypointArrowRig | null = null;
  private sunSkyGroup: THREE.Group | null = null;
  private flareElements: Array<{
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    axisFactor: number;
    baseScale: number;
    baseOpacity: number;
  }> = [];
  private frostMesh: THREE.Mesh | null = null;
  private frostUniforms: {
    uFrost: { value: number };
    uTime: { value: number };
    uAspect: { value: number };
  } = {
    uFrost: { value: 0 },
    uTime: { value: 0 },
    uAspect: { value: 1.77 },
  };

  // Theatrical Finale VFX Rig (Floating 10-Artifact Ring, Arcs, Shockwave, Sun God-Rays)
  private ignitionGroup: THREE.Group | null = null;
  private ignitionArtifactNodes: Array<{ group: THREE.Group; baseAngle: number }> = [];
  private ignitionArcGeo: THREE.BufferGeometry | null = null;
  private ignitionArcPositions: Float32Array | null = null;
  private ignitionCoreMesh: THREE.Mesh | null = null;
  private ignitionCoreMat: THREE.MeshBasicMaterial | null = null;
  private shockwaveSphere: THREE.Mesh | null = null;
  private shockwaveUniforms = {
    uColorA: { value: new THREE.Color(0x38bdf8) },
    uColorB: { value: new THREE.Color(0xfbbf24) },
    uOpacity: { value: 0 },
  };
  private shockwaveRing: THREE.Mesh | null = null;
  private shockwaveRingMat: THREE.MeshBasicMaterial | null = null;
  private godRaysGroup: THREE.Group | null = null;
  private godRayMats: THREE.MeshBasicMaterial[] = [];

  // Astronaut Kinematics
  private playerPos = new THREE.Vector3(0, 0, -1.65);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private playerYaw = 0; // 0 looks toward -Z (Observation Window & Central Terminal)
  private camYaw = 0;
  private camPitch = -0.05;
  private isGrounded = true;
  private currentSector = 'OBSERVATION DECK';

  // Rover Kinematics & 4-Wheel Suspension Spring-Damper
  private roverPos = new THREE.Vector3(0, getLunarSurfaceHeight(0, 16.8), 16.8);
  private roverYaw = Math.PI;
  private roverSpeed = 0;
  private roverSteer = 0;
  private roverVelY = 0;
  private roverGrounded = true;
  private roverSuspOffset = 0;
  private roverSuspVel = 0;
  private roverRoll = 0;
  private prevSupportGroundY = getLunarSurfaceHeight(0, 16.8);
  private dustEmitTimer = 0;

  // Smooth Rover Enter / Exit Transition State
  private roverTransition: {
    active: boolean;
    dir: 'enter' | 'exit';
    t: number;
    duration: number;
    startPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    startYaw: number;
    targetYaw: number;
  } = {
    active: false,
    dir: 'enter',
    t: 0,
    duration: 0.52,
    startPos: new THREE.Vector3(),
    targetPos: new THREE.Vector3(),
    startYaw: 0,
    targetYaw: 0,
  };

  // Camera smoothing state
  private currentCamPos = new THREE.Vector3(0, 2.2, 5.5);
  private currentLookAt = new THREE.Vector3(0, 1.8, -6);

  // Input state
  private heldKeys = new Set<string>();
  private pointerLocked = false;
  private isDraggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private jumpBufferTimer = 0;
  private coyoteTimer = 0;

  constructor(container: HTMLElement, callbacks: LunarEngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.audio = new LunarAudioEngine();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight,
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x030712);
    this.scene.fog = new THREE.FogExp2(0x050b18, 0.0031);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(68, width / height, 0.1, 620);

    this.hemiLight = new THREE.HemisphereLight(0x8fd3fe, 0x1e293b, 0.68);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 2.45);
    this.sunLight.position.copy(SUN_POSITION);
    this.sunLight.target.position.set(0, 0, -2);
    this.scene.add(this.sunLight.target);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 65;
    this.sunLight.shadow.camera.left = -22;
    this.sunLight.shadow.camera.right = 22;
    this.sunLight.shadow.camera.top = 18;
    this.sunLight.shadow.camera.bottom = -18;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    const earthShine = new THREE.DirectionalLight(0x38bdf8, 0.55);
    earthShine.position.set(12, 18, -45);
    this.scene.add(earthShine);

    this.textures = createProceduralTextures(this.renderer);
    this.baseData = buildLunarBaseEnvironment(this.scene, this.textures, this.isSoftwareGl);
    this.createSunAndPostProcessing();
    this.createFinaleVfxRig();
    this.waypointArrow = createWaypointArrowRig(this.scene, this.postDisposables);
    this.syncSequentialTargetVisibility();
    this.alignRoverToGround(this.roverPos.x, this.roverPos.z, this.roverYaw, 0.016, true);

    this.astronaut = createAstronaut();
    this.astronaut.root.position.set(1.6, 0, -5.6);
    this.astronaut.root.rotation.y = 0.25;
    this.scene.add(this.astronaut.root);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.clock = new THREE.Clock();
    this.bindEvents();
    this.pushHudSnapshot();
    this.tick();
  }

  private createSunAndPostProcessing() {
    const track = <T extends { dispose: () => void }>(item: T): T => {
      this.postDisposables.push(item);
      return item;
    };

    // 1. Visible 3D Solar Disc & Corona in the lunar sky along the exact sun vector
    const sunGroup = new THREE.Group();
    sunGroup.position.copy(_sunDir).multiplyScalar(350);
    sunGroup.lookAt(0, 0, 0);
    this.scene.add(sunGroup);
    this.sunSkyGroup = sunGroup;

    const sunCoreMat = track(
      new THREE.MeshBasicMaterial({
        color: 0xfffbeb,
        fog: false,
      }),
    );
    const sunCore = new THREE.Mesh(track(new THREE.SphereGeometry(9.5, 20, 20)), sunCoreMat);
    sunGroup.add(sunCore);

    const sunCoronaMat = track(
      new THREE.MeshBasicMaterial({
        map: this.textures.flareMain,
        color: 0xffe4a0,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    const sunCorona = new THREE.Mesh(track(new THREE.PlaneGeometry(58, 58)), sunCoronaMat);
    sunGroup.add(sunCorona);

    // 2. Camera-space Optical Lens Flare Elements (additive starburst + chromatic hex ghosts)
    const flareSpecs = [
      { tex: this.textures.flareMain, color: 0xfff5d6, axis: 0.0, scale: 0.72, opacity: 0.85 },
      { tex: this.textures.flareGhost, color: 0xfbbf24, axis: 0.42, scale: 0.16, opacity: 0.34 },
      { tex: this.textures.flareGhost, color: 0x38bdf8, axis: 0.82, scale: 0.24, opacity: 0.28 },
      { tex: this.textures.flareGhost, color: 0x818cf8, axis: 1.32, scale: 0.13, opacity: 0.26 },
      { tex: this.textures.flareGhost, color: 0xfde68a, axis: -0.34, scale: 0.11, opacity: 0.24 },
    ];

    const flarePlaneGeo = track(new THREE.PlaneGeometry(1, 1));
    flareSpecs.forEach((spec, idx) => {
      const mat = track(
        new THREE.MeshBasicMaterial({
          map: spec.tex,
          color: spec.color,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthTest: false,
          depthWrite: false,
          fog: false,
        }),
      );
      const mesh = new THREE.Mesh(flarePlaneGeo, mat);
      mesh.renderOrder = 998 + idx;
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.scene.add(mesh);
      this.flareElements.push({
        mesh,
        mat,
        axisFactor: spec.axis,
        baseScale: spec.scale,
        baseOpacity: spec.opacity,
      });
    });

    // 3. Fullscreen GLSL Frost Vignette Shader Quad (creeps from edges when battery is low)
    const frostGeo = track(new THREE.PlaneGeometry(2, 2));
    const frostMat = track(
      new THREE.ShaderMaterial({
        uniforms: this.frostUniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uFrost;
          uniform float uTime;
          uniform float uAspect;
          varying vec2 vUv;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }

          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
              mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
              u.y
            );
          }

          float fbm(vec2 p) {
            float v = 0.0;
            float a = 0.5;
            for (int i = 0; i < 4; i++) {
              v += a * noise(p);
              p = p * 2.15 + vec2(1.7, 9.2);
              a *= 0.5;
            }
            return v;
          }

          void main() {
            if (uFrost <= 0.005) discard;
            vec2 centered = (vUv - 0.5) * 2.0;
            vec2 aspectUv = vec2(centered.x * uAspect, centered.y);
            float edgeDist = max(abs(centered.x), abs(centered.y));
            float radialDist = length(centered * vec2(0.95, 1.02));
            float rim = mix(edgeDist, radialDist, 0.45);

            // Crystalline branching ice noise along screen perimeter
            float crystalA = fbm(aspectUv * 9.5 + vec2(uTime * 0.03, -uTime * 0.02));
            float crystalB = abs(fbm(aspectUv * 22.0 - vec2(uTime * 0.02)) - 0.5) * 2.0;
            float shards = clamp(crystalA * 0.72 + (1.0 - crystalB) * 0.45, 0.0, 1.0);

            float reach = mix(1.08, 0.38, uFrost);
            float frostMask = smoothstep(reach, reach + 0.52, rim + shards * 0.34);
            float iceSparkle = pow(shards, 2.2) * frostMask;

            vec3 iceBlue = vec3(0.58, 0.84, 0.99);
            vec3 iceWhite = vec3(0.93, 0.98, 1.0);
            vec3 col = mix(iceBlue, iceWhite, clamp(iceSparkle * 1.4, 0.0, 1.0));
            float alpha = clamp(frostMask * (0.28 + 0.62 * uFrost), 0.0, 0.82);

            gl_FragColor = vec4(col, alpha);
          }
        `,
      }),
    );

    const frostMesh = new THREE.Mesh(frostGeo, frostMat);
    frostMesh.renderOrder = 1005;
    frostMesh.frustumCulled = false;
    frostMesh.visible = false;
    this.scene.add(frostMesh);
    this.frostMesh = frostMesh;
  }

  private createFinaleVfxRig() {
    const track = <T extends { dispose: () => void }>(item: T): T => {
      this.postDisposables.push(item);
      return item;
    };

    // 1. Floating 10-Artifact Ignition Ring & Golden-Blue Energy Arcs around Central Core (0, 1.85, -4.1)
    const igGroup = new THREE.Group();
    igGroup.position.set(0, 1.85, -4.1);
    igGroup.visible = false;
    this.scene.add(igGroup);
    this.ignitionGroup = igGroup;

    const artifacts = this.baseData.artifacts;
    for (let i = 0; i < artifacts.length; i++) {
      const baseAngle = (i / artifacts.length) * Math.PI * 2;
      const node = createArtifactMeshGroup(artifacts[i].kind, this.postDisposables);
      node.scale.setScalar(0.27);
      node.position.set(Math.cos(baseAngle) * 1.45, 0, Math.sin(baseAngle) * 1.45);
      igGroup.add(node);
      this.ignitionArtifactNodes.push({ group: node, baseAngle });
    }

    // 30 line segments: 10 perimeter ring arcs + 10 radial core arcs + 10 diagonal energy bridges
    const segmentCount = 30;
    const posArr = new Float32Array(segmentCount * 2 * 3);
    const colArr = new Float32Array(segmentCount * 2 * 3);
    for (let s = 0; s < segmentCount; s++) {
      const cA = s % 2 === 0 ? _arcColorGold : _arcColorCyan;
      const cB = s % 2 === 0 ? _arcColorWhite : _arcColorGold;
      colArr[s * 6] = cA.r;
      colArr[s * 6 + 1] = cA.g;
      colArr[s * 6 + 2] = cA.b;
      colArr[s * 6 + 3] = cB.r;
      colArr[s * 6 + 4] = cB.g;
      colArr[s * 6 + 5] = cB.b;
    }

    const arcGeo = track(new THREE.BufferGeometry());
    arcGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    arcGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    const arcMat = track(
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const arcLines = new THREE.LineSegments(arcGeo, arcMat);
    arcLines.frustumCulled = false;
    igGroup.add(arcLines);
    this.ignitionArcGeo = arcGeo;
    this.ignitionArcPositions = posArr;

    const coreMat = track(
      new THREE.MeshBasicMaterial({
        color: 0xfef3c7,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const coreMesh = new THREE.Mesh(track(new THREE.SphereGeometry(0.32, 18, 18)), coreMat);
    igGroup.add(coreMesh);
    this.ignitionCoreMat = coreMat;
    this.ignitionCoreMesh = coreMesh;

    // 2. Expanding Fresnel Energy Shockwave Sphere & Ground Wave Torus
    const waveGeo = track(new THREE.SphereGeometry(1, 32, 24));
    const waveMat = track(
      new THREE.ShaderMaterial({
        uniforms: this.shockwaveUniforms,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
        vertexShader: `
          varying vec3 vNormalDir;
          varying vec3 vViewDir;
          void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vNormalDir = normalize(mat3(modelMatrix) * normal);
            vViewDir = normalize(cameraPosition - worldPos.xyz);
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `,
        fragmentShader: `
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          uniform float uOpacity;
          varying vec3 vNormalDir;
          varying vec3 vViewDir;
          void main() {
            float ndotv = abs(dot(normalize(vNormalDir), normalize(vViewDir)));
            float rim = pow(1.0 - ndotv, 1.65);
            vec3 col = mix(uColorA, uColorB, clamp(rim * 1.15, 0.0, 1.0));
            col += vec3(0.45, 0.55, 0.7) * pow(rim, 3.0);
            gl_FragColor = vec4(col, clamp((0.18 + rim * 0.95) * uOpacity, 0.0, 1.0));
          }
        `,
      }),
    );
    const waveMesh = new THREE.Mesh(waveGeo, waveMat);
    waveMesh.position.set(0, 1.85, -4.1);
    waveMesh.visible = false;
    waveMesh.frustumCulled = false;
    this.scene.add(waveMesh);
    this.shockwaveSphere = waveMesh;

    const ringMat = track(
      new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const ringMesh = new THREE.Mesh(track(new THREE.TorusGeometry(1, 0.055, 10, 48)), ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.set(0, 1.35, -4.1);
    ringMesh.visible = false;
    ringMesh.frustumCulled = false;
    this.scene.add(ringMesh);
    this.shockwaveRing = ringMesh;
    this.shockwaveRingMat = ringMat;

    // 3. Procedural Sunrise Volumetric God-Ray Fan attached to Sky Sun
    if (this.sunSkyGroup) {
      const rayCanvas = document.createElement('canvas');
      rayCanvas.width = 64;
      rayCanvas.height = 256;
      const rCtx = rayCanvas.getContext('2d')!;
      const rGrad = rCtx.createLinearGradient(0, 0, 0, 256);
      rGrad.addColorStop(0, 'rgba(255, 245, 204, 0.0)');
      rGrad.addColorStop(0.18, 'rgba(254, 240, 138, 0.65)');
      rGrad.addColorStop(0.65, 'rgba(251, 191, 36, 0.25)');
      rGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
      rCtx.fillStyle = rGrad;
      rCtx.fillRect(0, 0, 64, 256);

      const rayHoriz = rCtx.createLinearGradient(0, 0, 64, 0);
      rayHoriz.addColorStop(0, 'rgba(0,0,0,0)');
      rayHoriz.addColorStop(0.5, 'rgba(255,255,255,1)');
      rayHoriz.addColorStop(1, 'rgba(0,0,0,0)');
      rCtx.globalCompositeOperation = 'destination-in';
      rCtx.fillStyle = rayHoriz;
      rCtx.fillRect(0, 0, 64, 256);

      const rayTex = track(new THREE.CanvasTexture(rayCanvas));
      rayTex.colorSpace = THREE.SRGBColorSpace;

      const raysGroup = new THREE.Group();
      raysGroup.visible = false;
      this.sunSkyGroup.add(raysGroup);
      this.godRaysGroup = raysGroup;

      const rayGeo = track(new THREE.PlaneGeometry(34, 230));
      rayGeo.translate(0, -108, 0);

      const rayAngles = [-0.72, -0.44, -0.18, 0.08, 0.34, 0.62];
      rayAngles.forEach((ang, idx) => {
        const mat = track(
          new THREE.MeshBasicMaterial({
            map: rayTex,
            color: idx % 2 === 0 ? 0xfef08a : 0xfed7aa,
            transparent: true,
            opacity: 0.26,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            fog: false,
          }),
        );
        const rayMesh = new THREE.Mesh(rayGeo, mat);
        rayMesh.rotation.z = ang;
        raysGroup.add(rayMesh);
        this.godRayMats.push(mat);
      });
    }
  }

  public startGame() {
    this.audio.unlock();
    if (this.mode === 'title' || this.mode === 'critical') {
      this.resetPlayerToSpawn();
      this.triggerAlarmSequence();
    }
    this.setMode('playing');
    this.applyViewMode(this.viewMode);
    this.requestPointerLockSafe();
  }

  public resumeGame() {
    this.audio.unlock();
    if (this.mode === 'paused') {
      this.setMode('playing');
      if (!this.transmissionOpen && !this.studyTerminalOpen) {
        this.requestPointerLockSafe();
      }
    }
  }

  public pauseGame() {
    if (this.mode === 'playing') {
      this.heldKeys.clear();
      this.isDraggingLook = false;
      this.inspectedArtifact = null;
      this.exitPointerLockSafe();
      this.setMode('paused');
    }
  }

  public restartSurvival() {
    this.audio.unlock();
    this.resetPlayerToSpawn();
    this.triggerAlarmSequence();
    this.setMode('playing');
    this.applyViewMode(this.viewMode);
    this.requestPointerLockSafe();
  }

  public acknowledgeTransmission() {
    this.audio.unlock();
    this.audio.playTerminalChime();
    this.transmissionOpen = false;
    if (this.narrativeStage === 'alarm' || this.narrativeStage === 'transmission') {
      this.narrativeStage = 'salvage';
      this.activeTargetIndex = 0;
      this.sortieBriefed = false;
      this.syncSequentialTargetVisibility();
    }
    if (this.narrativeStage === 'salvage' && !this.sortieBriefed) {
      this.showBanner('INTERACT WITH MAIN COMPUTER TERMINAL [E] TO STUDY TARGET 01/10');
    }
    this.requestPointerLockSafe();
    this.pushHudSnapshot();
  }

  public openTransmission() {
    this.audio.unlock();
    this.audio.playTransmissionSignal();
    this.transmissionOpen = true;
    this.studyTerminalOpen = false;
    this.inspectedArtifact = null;
    this.heldKeys.clear();
    this.exitPointerLockSafe();
    this.pushHudSnapshot();
  }

  public openStudyTerminal() {
    if (this.mode !== 'playing') return;
    if (this.narrativeStage !== 'salvage' || this.activeTargetIndex >= this.baseData.artifacts.length) {
      return;
    }
    this.audio.unlock();
    this.audio.playHoloScanOpen();
    this.studyTerminalOpen = true;
    this.transmissionOpen = false;
    this.inspectedArtifact = null;
    this.heldKeys.clear();
    this.isDraggingLook = false;
    this.playerVel.set(0, 0, 0);
    this.exitPointerLockSafe();
    this.pushHudSnapshot();
  }

  public completeStudyBriefing() {
    if (!this.studyTerminalOpen) return;
    this.audio.unlock();
    this.audio.playTerminalChime();
    this.audio.playNavigationPing(false);
    this.navPingTimer = 3.5;
    this.studyTerminalOpen = false;
    this.sortieBriefed = true;
    this.syncSequentialTargetVisibility();
    const target = this.baseData.artifacts[this.activeTargetIndex];
    if (target) {
      this.showBanner(
        `TARGET ${this.activeTargetIndex + 1}/10 LOCKED: ${target.mission.toUpperCase()} // FOLLOW 3D ARROW`,
      );
    }
    this.requestPointerLockSafe();
    this.pushHudSnapshot();
  }

  public closeStudyTerminal() {
    if (!this.studyTerminalOpen) return;
    this.studyTerminalOpen = false;
    this.audio.playVisorToggle();
    if (!this.sortieBriefed) {
      this.showBanner(
        `INTERACT WITH BASE MAIN TERMINAL [E] TO STUDY TARGET ${this.activeTargetIndex + 1}/10`,
      );
    }
    this.requestPointerLockSafe();
    this.pushHudSnapshot();
  }

  public playQuizFeedback(correct: boolean) {
    this.audio.unlock();
    this.audio.playQuizChime(correct);
    if (!correct) {
      this.quizFailedOnInspect = true;
    }
  }

  public failArtifactQuiz() {
    if (!this.inspectedArtifact) return;
    this.audio.unlock();
    if (!this.quizFailedOnInspect) {
      this.audio.playQuizChime(false);
    }
    this.quizFailedOnInspect = false;
    this.inspectedArtifact = null;
    this.sortieBriefed = false;
    this.syncSequentialTargetVisibility();
    this.showBanner(
      `VERIFICATION FAILED // RETURN TO BASE TERMINAL [E] TO RE-STUDY TARGET ${this.activeTargetIndex + 1}/10`,
    );
    this.requestPointerLockSafe();
    this.pushHudSnapshot();
  }

  public collectInspectedArtifact() {
    if (!this.inspectedArtifact) return;
    this.audio.unlock();
    const art = this.inspectedArtifact;
    this.quizFailedOnInspect = false;
    this.inspectedArtifact = null;
    this.collectArtifact(art);
    this.requestPointerLockSafe();
  }

  public closeArtifactInspection() {
    if (!this.inspectedArtifact) return;
    if (this.quizFailedOnInspect) {
      this.failArtifactQuiz();
      return;
    }
    this.inspectedArtifact = null;
    this.audio.playVisorToggle();
    this.requestPointerLockSafe();
    this.pushHudSnapshot();
  }

  public exitFinaleToRoam() {
    if (!this.finaleActive) return;
    this.audio.unlock();
    this.audio.playVisorToggle();
    this.finaleActive = false;
    this.finalePhase = 'none';
    this.shockwaveTriggered = false;
    if (this.ignitionGroup) this.ignitionGroup.visible = false;
    if (this.shockwaveSphere) this.shockwaveSphere.visible = false;
    if (this.shockwaveRing) this.shockwaveRing.visible = false;
    if (this.godRaysGroup) this.godRaysGroup.visible = false;
    this.baseData.exteriorFloodLight.intensity = 1.6;
    this.baseData.warmAccentMat.color.setHex(0xf59e0b);
    this.baseData.warmAccentMat.emissive.setHex(0xd97706);
    this.baseData.warmAccentMat.emissiveIntensity = 1.2;
    _sunDir.copy(_defaultSunDir);
    this.sunLight.position.copy(SUN_POSITION);
    this.sunLight.color.setHex(0xfff1d6);
    this.sunLight.intensity = 2.45;
    this.environmentZone = 'interior';
    this.controlMode = 'foot';
    this.playerPos.set(0, 0, -1.65);
    this.playerVel.set(0, 0, 0);
    this.playerYaw = 0;
    this.camYaw = 0;
    this.camPitch = -0.04;
    this.astronaut.root.visible = true;
    this.astronaut.root.position.copy(this.playerPos);
    this.applyViewMode(this.viewMode);
    this.showBanner('ASAAR POWER CORE NOMINAL // FREE ROAM ACTIVE');
    this.requestPointerLockSafe();
    this.pushHudSnapshot();
  }

  public toggleViewMode() {
    const next: CameraViewMode = this.viewMode === 'first' ? 'third' : 'first';
    this.applyViewMode(next);
    this.audio.playVisorToggle();
    this.showBanner(next === 'first' ? 'CAMERA: FIRST-PERSON VISOR' : 'CAMERA: THIRD-PERSON CHASE');
    this.pushHudSnapshot();
  }

  public toggleLightingPreset() {
    this.lightingPreset = this.lightingPreset === 'nominal' ? 'amber' : 'nominal';
    this.audio.playVisorToggle();
    this.showBanner(
      this.lightingPreset === 'amber'
        ? 'CABIN LIGHTING: AMBER LOW-GLARE'
        : 'CABIN LIGHTING: NOMINAL',
    );
    this.pushHudSnapshot();
  }

  public setMuted(muted: boolean) {
    this.audio.setMuted(muted);
  }

  public setRenderingPaused(paused: boolean) {
    this.renderingPaused = paused;
    if (paused) {
      this.heldKeys.clear();
      this.isDraggingLook = false;
      this.exitPointerLockSafe();
    } else {
      this.clock.getDelta();
    }
  }

  public triggerBoardRover() {
    if (this.mode !== 'playing' || this.environmentZone !== 'surface') return;
    if (this.roverTransition.active) return;

    if (this.controlMode === 'rover') {
      // Begin smooth exit transition from driver seat to lunar surface beside rover
      this.roverSpeed = 0;
      const exitX = this.roverPos.x - Math.cos(this.roverYaw) * 2.15;
      const exitZ = this.roverPos.z + Math.sin(this.roverYaw) * 2.15;
      const exitY = getLunarSurfaceHeight(exitX, exitZ);

      this.roverTransition.active = true;
      this.roverTransition.dir = 'exit';
      this.roverTransition.t = 0;
      this.roverTransition.duration = 0.48;
      this.roverTransition.startPos.set(this.roverPos.x, this.roverPos.y + 0.55, this.roverPos.z);
      this.roverTransition.targetPos.set(exitX, exitY, exitZ);
      this.roverTransition.startYaw = this.roverYaw;
      this.roverTransition.targetYaw = this.roverYaw + Math.PI * 0.5;

      this.baseData.rover.driverFigure.visible = false;
      this.astronaut.root.visible = true;
      this.astronaut.setFirstPersonHidden(false);
      this.audio.playVisorToggle();
      this.showBanner('EXITING LUNAR ROVER...');
      return;
    }

    const dist = Math.hypot(this.playerPos.x - this.roverPos.x, this.playerPos.z - this.roverPos.z);
    if (dist <= 4.4) {
      // Begin smooth boarding transition from foot to driver seat
      this.playerVel.set(0, 0, 0);
      this.roverTransition.active = true;
      this.roverTransition.dir = 'enter';
      this.roverTransition.t = 0;
      this.roverTransition.duration = 0.52;
      this.roverTransition.startPos.copy(this.playerPos);
      this.roverTransition.targetPos.set(this.roverPos.x, this.roverPos.y + 0.55, this.roverPos.z);
      this.roverTransition.startYaw = this.playerYaw;
      this.roverTransition.targetYaw = this.roverYaw;

      this.astronaut.root.visible = true;
      this.astronaut.setFirstPersonHidden(false);
      this.audio.playAirlockCycle();
      this.showBanner('BOARDING LUNAR ROVER...');
    }
  }

  public triggerInteract() {
    if (this.mode !== 'playing') return;
    this.audio.unlock();

    // 1. Check Central Holographic Base Study Terminal (HQ Transmission / Target Study / Restore Core)
    if (this.environmentZone === 'interior') {
      const coreDist = Math.hypot(this.playerPos.x - 0, this.playerPos.z - -4.1);
      if (coreDist <= 2.95) {
        if (this.narrativeStage === 'core_ready') {
          this.restoreBasePower();
          return;
        }
        if (this.narrativeStage === 'alarm' || this.narrativeStage === 'transmission') {
          this.openTransmission();
          return;
        }
        if (this.narrativeStage === 'salvage') {
          this.openStudyTerminal();
          return;
        }
        this.openTransmission();
        return;
      }

      // 2. Check South Airlock Door Exit to Surface
      if (this.playerPos.z >= 8.4 && Math.abs(this.playerPos.x) <= 2.6) {
        this.cycleAirlockToSurface();
        return;
      }

      // 3. Check 4 Glowing Blue Control Consoles
      const nearby = this.findNearbyTerminal();
      if (nearby) {
        this.audio.playTerminalChime();
        if (nearby.type === 'lifeSupport') {
          this.oxygen = Math.min(100, this.oxygen + 45);
          this.showBanner('O2 SCRUBBERS SYNCED (+45% OXYGEN)');
        } else if (nearby.type === 'powerGrid') {
          this.audio.playEnergyAbsorption();
          this.energy = Math.min(100, this.energy + 50);
          this.showBanner('SOLAR CAPACITOR CHARGED (+50% ENERGY)');
        } else if (nearby.type === 'lunarSurvey') {
          this.energy = Math.min(100, this.energy + 15);
          this.showBanner('EARTH-LINK TELEMETRY LOCKED (+15% ENERGY)');
        } else {
          this.audio.playEnergyAbsorption();
          this.oxygen = Math.min(100, this.oxygen + 25);
          this.energy = Math.min(100, this.energy + 25);
          this.showBanner('AIRLOCK RESERVES EQUALIZED (+25% O2 / +25% PWR)');
        }
        nearby.beaconLight.intensity = 5.5;
        this.pushHudSnapshot();
      }
      return;
    }

    // Surface Interactions:
    // A. Open Holographic Inspection Overlay for nearby historical artifact
    const nearArt = this.findNearbyArtifact();
    if (nearArt) {
      this.openArtifactInspection(nearArt);
      return;
    }

    // B. Re-enter Base via South Airlock Ramp
    const pos = this.controlMode === 'rover' ? this.roverPos : this.playerPos;
    const rampDist = Math.hypot(pos.x, pos.z - 13.3);
    if (rampDist <= 4.0) {
      this.cycleAirlockToInterior();
    }
  }

  private openArtifactInspection(art: SalvageArtifactEntity) {
    this.inspectedArtifact = art;
    this.quizFailedOnInspect = false;
    this.heldKeys.clear();
    this.isDraggingLook = false;
    this.playerVel.set(0, 0, 0);
    this.roverSpeed = 0;
    this.exitPointerLockSafe();
    this.audio.playHoloScanOpen();
    this.pushHudSnapshot();
  }

  private triggerAlarmSequence() {
    this.narrativeStage = 'alarm';
    this.alarmTimer = 0;
    this.sirenCount = 0;
    this.sirenCooldown = 0.15;
    this.transmissionOpen = false;
    this.showBanner('WARNING: PRIMARY POWER CORE OFFLINE // INCOMING EARTH HQ TRANSMISSION');
  }

  private cycleAirlockToSurface() {
    if (this.narrativeStage === 'salvage' && !this.sortieBriefed) {
      this.audio.playVisorToggle();
      this.showBanner(
        `AIRLOCK SEALED // STUDY TARGET ${this.activeTargetIndex + 1}/10 AT MAIN TERMINAL [E] FIRST`,
      );
      this.pushHudSnapshot();
      return;
    }

    this.audio.playAirlockCycle();
    this.environmentZone = 'surface';
    this.controlMode = 'foot';
    this.playerPos.set(0, getLunarSurfaceHeight(0, 13.4), 13.4);
    this.playerVel.set(0, 0, 0);
    this.playerYaw = Math.PI;
    this.camYaw = Math.PI;
    this.currentSector = 'SOUTH AIRLOCK RAMP';
    this.astronaut.root.visible = true;
    this.astronaut.root.position.copy(this.playerPos);
    this.showBanner('AIRLOCK DEPRESSURIZED // BOARD ROVER [F] & FOLLOW 3D ARROW');
    this.pushHudSnapshot();
  }

  private cycleAirlockToInterior() {
    this.audio.playAirlockCycle();
    if (this.controlMode === 'rover' || this.roverTransition.active) {
      // Park rover cleanly on pad before stepping inside
      this.roverTransition.active = false;
      this.roverSpeed = 0;
      this.controlMode = 'foot';
      this.baseData.rover.driverFigure.visible = false;
      this.astronaut.root.visible = true;
    }
    this.environmentZone = 'interior';
    this.playerPos.set(0, 0, 9.4);
    this.playerVel.set(0, 0, 0);
    this.playerYaw = 0;
    this.camYaw = 0;
    this.currentSector = 'AIRLOCK BAY';
    this.astronaut.root.position.copy(this.playerPos);
    this.applyViewMode(this.viewMode);

    if (this.narrativeStage === 'core_ready') {
      this.showBanner('PROCEED TO OBSERVATION CORE TERMINAL TO RESTORE POWER [E]');
    } else if (this.narrativeStage === 'salvage' && !this.sortieBriefed) {
      this.showBanner(
        `APPROACH MAIN COMPUTER TERMINAL [E] TO STUDY SORTIE ${this.activeTargetIndex + 1}/10`,
      );
    } else {
      this.showBanner('AIRLOCK PRESSURIZED // INSIDE ASAAR');
    }
    this.pushHudSnapshot();
  }

  private syncSequentialTargetVisibility() {
    for (let i = 0; i < this.baseData.artifacts.length; i++) {
      const art = this.baseData.artifacts[i];
      const isActiveTarget =
        this.narrativeStage === 'salvage' &&
        this.sortieBriefed &&
        !art.collected &&
        i === this.activeTargetIndex;
      art.root.visible = isActiveTarget;
      art.beaconBeam.visible = isActiveTarget;
      art.beaconRing.visible = isActiveTarget;
      art.beaconDiamond.visible = isActiveTarget;
    }
  }

  private collectArtifact(art: SalvageArtifactEntity) {
    art.collected = true;
    this.audio.playEnergyAbsorption();
    this.audio.playSalvageSuccess();
    this.audio.playNavigationPing(true);
    this.navPingTimer = 3.5;
    this.energy = Math.min(100, this.energy + 12);
    this.oxygen = Math.min(100, this.oxygen + 8);

    const collectedCount = this.baseData.artifacts.filter((a) => a.collected).length;
    if (collectedCount >= this.baseData.artifacts.length) {
      this.narrativeStage = 'core_ready';
      this.sortieBriefed = false;
      this.syncSequentialTargetVisibility();
      this.showBanner('10/10 PARTS SALVAGED! FOLLOW GREEN ARROW BACK TO BASE TO RESTORE POWER');
    } else {
      this.activeTargetIndex = collectedCount;
      this.sortieBriefed = false;
      this.syncSequentialTargetVisibility();
      this.showBanner(
        `PART ${collectedCount}/10 SECURED! FOLLOW GREEN ARROW TO BASE TERMINAL FOR SORTIE ${collectedCount + 1}`,
      );
    }
    this.pushHudSnapshot();
  }

  private restoreBasePower() {
    this.narrativeStage = 'restored';
    this.finaleActive = true;
    this.finalePhase = 'ignition';
    this.finaleTimer = 0;
    this.shockwaveTriggered = false;
    this.oxygen = 100;
    this.energy = 100;
    this.transmissionOpen = false;
    this.studyTerminalOpen = false;
    this.inspectedArtifact = null;
    this.heldKeys.clear();
    this.isDraggingLook = false;
    this.exitPointerLockSafe();

    // Begin theatrical Phase 1 inside Observation Hub looking at the Central Reactor Core
    this.environmentZone = 'interior';
    this.controlMode = 'foot';
    this.astronaut.root.visible = false;
    this.baseData.rover.driverFigure.visible = false;
    if (this.waypointArrow) {
      this.waypointArrow.root.visible = false;
    }

    if (this.ignitionGroup) {
      this.ignitionGroup.visible = true;
    }
    if (this.shockwaveSphere) this.shockwaveSphere.visible = false;
    if (this.shockwaveRing) this.shockwaveRing.visible = false;
    if (this.godRaysGroup) this.godRaysGroup.visible = false;

    this.currentCamPos.copy(_finaleCamStart);
    this.currentLookAt.copy(_finaleLookCore);
    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookAt);

    this.audio.playReactorIgnitionBuildup();
    this.showBanner('CORE IGNITION SEQUENCE // 10 HISTORICAL RELICS SYNCHRONIZING');
    this.pushHudSnapshot();
  }

  private resetPlayerToSpawn() {
    this.oxygen = 92;
    this.energy = 88;
    this.solarState = 'interior';
    this.surfaceTempC = 21;
    this.powerDeltaPerSec = -0.12;
    this.frostLevel = 0;
    this.thermalBannerCooldown = 0;
    this.lastSurfaceShadowState = null;
    this.lowPowerWarned = false;
    this.finaleActive = false;
    this.finalePhase = 'none';
    this.finaleTimer = 0;
    this.shockwaveTriggered = false;
    this.navPingTimer = 0;
    if (this.ignitionGroup) this.ignitionGroup.visible = false;
    if (this.shockwaveSphere) this.shockwaveSphere.visible = false;
    if (this.shockwaveRing) this.shockwaveRing.visible = false;
    if (this.godRaysGroup) this.godRaysGroup.visible = false;
    this.baseData.exteriorFloodLight.intensity = 0.8;
    this.baseData.warmAccentMat.color.setHex(0xf59e0b);
    this.baseData.warmAccentMat.emissive.setHex(0xd97706);
    this.baseData.warmAccentMat.emissiveIntensity = 1.2;
    _sunDir.copy(_defaultSunDir);
    this.sunLight.position.copy(SUN_POSITION);
    this.sunLight.color.setHex(0xfff1d6);
    this.sunLight.intensity = 2.45;
    this.environmentZone = 'interior';
    this.controlMode = 'foot';
    this.inspectedArtifact = null;
    this.studyTerminalOpen = false;
    this.sortieBriefed = false;
    this.activeTargetIndex = 0;
    this.playerPos.set(0, 0, -1.65);
    this.playerVel.set(0, 0, 0);
    this.playerYaw = 0;
    this.camYaw = 0;
    this.camPitch = -0.04;
    this.isGrounded = true;
    this.currentSector = 'OBSERVATION DECK';
    this.astronaut.root.visible = true;
    this.astronaut.root.position.copy(this.playerPos);
    this.astronaut.root.rotation.y = this.playerYaw;
    this.currentCamPos.set(0, 1.66, -1.65);

    // Reset rover & sequential artifacts on full restart
    this.roverTransition.active = false;
    this.roverYaw = Math.PI;
    this.roverSpeed = 0;
    this.roverSteer = 0;
    this.roverVelY = 0;
    this.roverGrounded = true;
    this.roverSuspOffset = 0;
    this.roverSuspVel = 0;
    this.roverRoll = 0;
    const spawnGround = this.alignRoverToGround(0, 16.8, this.roverYaw, 0.016, true);
    this.roverPos.set(0, spawnGround.supportGroundY, 16.8);
    this.prevSupportGroundY = spawnGround.supportGroundY;
    this.baseData.rover.driverFigure.visible = false;
    this.baseData.rover.root.position.copy(this.roverPos);
    this.baseData.rover.chassisGroup.rotation.set(0, 0, 0);
    this.baseData.rover.updateSuspensionAndWheels(0, 0, 0, 0, 0, 0, 0, 0.016, 0);

    for (const art of this.baseData.artifacts) {
      art.collected = false;
    }
    this.syncSequentialTargetVisibility();
    if (this.waypointArrow) {
      this.waypointArrow.root.visible = false;
    }

    this.baseData.holoBannerMat.map = this.textures.holoTransmission;
    this.baseData.holoBannerMat.emissiveMap = this.textures.holoTransmission;
    this.baseData.holoBannerMat.needsUpdate = true;
  }

  private applyViewMode(mode: CameraViewMode) {
    this.viewMode = mode;
    if (this.mode === 'title') {
      this.astronaut.setFirstPersonHidden(false);
    } else if (this.controlMode === 'rover') {
      this.astronaut.setFirstPersonHidden(true);
    } else {
      this.astronaut.setFirstPersonHidden(mode === 'first');
    }
  }

  private setMode(next: GameMode) {
    this.mode = next;
    if (next === 'title') {
      this.astronaut.root.visible = true;
      this.astronaut.setFirstPersonHidden(false);
      this.astronaut.root.position.set(1.6, 0, -5.6);
      this.astronaut.root.rotation.y = 0.25;
    } else {
      this.applyViewMode(this.viewMode);
    }
    this.callbacks.onModeChange(next);
    this.pushHudSnapshot();
  }

  private showBanner(msg: string) {
    this.statusBanner = msg;
    this.statusTimer = 4.2;
  }

  private requestPointerLockSafe() {
    try {
      if (document.pointerLockElement !== this.renderer.domElement) {
        const res = this.renderer.domElement.requestPointerLock?.() as unknown as
          | Promise<void>
          | undefined;
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      }
    } catch {
      // Ignore pointer lock rejection
    }
  }

  private exitPointerLockSafe() {
    try {
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
    } catch {
      // Ignore
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      if (this.inspectedArtifact) {
        this.closeArtifactInspection();
        return;
      }
      if (this.studyTerminalOpen) {
        this.closeStudyTerminal();
        return;
      }
      if (this.transmissionOpen) {
        this.acknowledgeTransmission();
        return;
      }
      if (this.mode === 'playing') {
        this.pauseGame();
      } else if (this.mode === 'paused') {
        this.resumeGame();
      }
      return;
    }

    if (this.mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      this.startGame();
      return;
    }

    if (this.inspectedArtifact || this.finaleActive) {
      return;
    }

    if (this.studyTerminalOpen) {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.completeStudyBriefing();
      }
      return;
    }

    if (this.transmissionOpen && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      this.acknowledgeTransmission();
      return;
    }

    if (this.mode !== 'playing' || this.transmissionOpen || this.studyTerminalOpen) return;

    if (!e.repeat) {
      if (e.code === 'KeyV') {
        this.toggleViewMode();
        return;
      }
      if (e.code === 'KeyE') {
        this.triggerInteract();
        return;
      }
      if (e.code === 'KeyF') {
        this.triggerBoardRover();
        return;
      }
      if (e.code === 'Space') {
        this.jumpBufferTimer = 0.14;
      }
    }

    this.heldKeys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private onWindowBlur = () => {
    this.heldKeys.clear();
    this.isDraggingLook = false;
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.pushHudSnapshot();
  };

  private onCanvasMouseDown = (e: MouseEvent) => {
    if (
      this.mode !== 'playing' ||
      this.finaleActive ||
      this.transmissionOpen ||
      this.studyTerminalOpen ||
      this.inspectedArtifact
    ) {
      return;
    }
    this.audio.unlock();
    this.isDraggingLook = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    if (!this.pointerLocked) {
      this.requestPointerLockSafe();
    }
  };

  private onMouseUp = () => {
    this.isDraggingLook = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (
      this.mode !== 'playing' ||
      this.finaleActive ||
      this.transmissionOpen ||
      this.studyTerminalOpen ||
      this.inspectedArtifact
    ) {
      return;
    }

    let dx = 0;
    let dy = 0;

    if (this.pointerLocked) {
      dx = e.movementX;
      dy = e.movementY;
    } else if (this.isDraggingLook) {
      dx = e.clientX - this.lastPointerX;
      dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    } else {
      return;
    }

    const sensitivity = 0.0024;
    this.camYaw -= dx * sensitivity;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch - dy * sensitivity, -1.05, 1.05);
  };

  private onResize = () => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    if (w <= 0 || h <= 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };

  private bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.addEventListener('mousedown', this.onCanvasMouseDown);
  }

  private unbindEvents() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.removeEventListener('mousedown', this.onCanvasMouseDown);
  }

  private isPointInWalkableRects(x: number, z: number): string | null {
    for (const r of this.baseData.walkableRects) {
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
        return r.sectorName;
      }
    }
    return null;
  }

  private isInsideWalkable(x: number, z: number, radius = 0.4): string | null {
    const centerSector = this.isPointInWalkableRects(x, z);
    if (!centerSector) return null;

    // Verify full circular footprint lies within the union of room & corridor rects
    const diag = radius * 0.7071;
    if (
      this.isPointInWalkableRects(x + radius, z) &&
      this.isPointInWalkableRects(x - radius, z) &&
      this.isPointInWalkableRects(x, z + radius) &&
      this.isPointInWalkableRects(x, z - radius) &&
      this.isPointInWalkableRects(x + diag, z + diag) &&
      this.isPointInWalkableRects(x - diag, z + diag) &&
      this.isPointInWalkableRects(x + diag, z - diag) &&
      this.isPointInWalkableRects(x - diag, z - diag)
    ) {
      return centerSector;
    }
    return null;
  }

  private resolveObstacles(x: number, z: number, radius = 0.42): { x: number; z: number } {
    let rx = x;
    let rz = z;
    for (const ob of this.baseData.obstacles) {
      const minX = ob.minX - radius;
      const maxX = ob.maxX + radius;
      const minZ = ob.minZ - radius;
      const maxZ = ob.maxZ + radius;
      if (rx > minX && rx < maxX && rz > minZ && rz < maxZ) {
        const dLeft = rx - minX;
        const dRight = maxX - rx;
        const dTop = rz - minZ;
        const dBot = maxZ - rz;
        const minD = Math.min(dLeft, dRight, dTop, dBot);
        if (minD === dLeft) rx = minX;
        else if (minD === dRight) rx = maxX;
        else if (minD === dTop) rz = minZ;
        else rz = maxZ;
      }
    }
    return { x: rx, z: rz };
  }

  private isBlockedByBaseExterior(x: number, z: number, pad: number): boolean {
    // Keep surface player/rover outside the sealed interior hull walls
    return x > -11.4 - pad && x < 11.4 + pad && z > -8.6 - pad && z < 11.6 + pad;
  }

  private findNearbyTerminal(): InteractiveTerminal | null {
    if (this.environmentZone !== 'interior') return null;
    let best: InteractiveTerminal | null = null;
    let bestDist = 2.65;
    for (const t of this.baseData.terminals) {
      const d = Math.hypot(this.playerPos.x - t.position.x, this.playerPos.z - t.position.z);
      if (d < bestDist) {
        bestDist = d;
        best = t;
      }
    }
    return best;
  }

  private findNearbyArtifact(): SalvageArtifactEntity | null {
    if (
      this.environmentZone !== 'surface' ||
      this.narrativeStage !== 'salvage' ||
      !this.sortieBriefed
    ) {
      return null;
    }
    const activeArt = this.baseData.artifacts[this.activeTargetIndex];
    if (!activeArt || activeArt.collected) return null;

    const pos = this.controlMode === 'rover' ? this.roverPos : this.playerPos;
    const range = this.controlMode === 'rover' ? 5.8 : 3.8;
    const d = Math.hypot(pos.x - activeArt.position.x, pos.z - activeArt.position.z);
    return d < range ? activeArt : null;
  }

  private updateLightingAndNarrative(dt: number, elapsed: number) {
    // Narrative alarm sequence when game starts
    if (this.mode === 'playing' && this.narrativeStage === 'alarm') {
      this.alarmTimer += dt;
      this.sirenCooldown -= dt;
      if (this.sirenCooldown <= 0 && this.sirenCount < 3) {
        this.audio.playAlarmSirenPulse();
        this.sirenCount += 1;
        this.sirenCooldown = 0.85;
      }
      if (this.alarmTimer >= 2.6) {
        this.narrativeStage = 'transmission';
        this.openTransmission();
      }
    }

    // Dynamic base lighting color & red emergency flicker
    if (this.narrativeStage === 'alarm' || this.narrativeStage === 'transmission') {
      // Dramatic red klaxon strobe flicker
      const flicker =
        0.35 +
        0.65 * Math.pow(0.5 + 0.5 * Math.sin(elapsed * 8.5), 2) *
          (Math.sin(elapsed * 27) > -0.6 ? 1 : 0.35);

      this.baseData.interiorLights.forEach((l, idx) => {
        l.color.setHex(0xef4444);
        l.intensity = (idx < 4 ? 2.4 : 4.2) * flicker;
      });
      this.baseData.softBlueStripMat.color.setHex(0xfca5a5);
      this.baseData.softBlueStripMat.emissive.setHex(0xef4444);
      this.baseData.softBlueStripMat.emissiveIntensity = 1.6 * flicker;
      this.baseData.holoMoonMat.color.setHex(0xf87171);
      this.baseData.holoMoonMat.emissive.setHex(0xdc2626);
      this.hemiLight.color.setHex(0xef4444);
      this.hemiLight.intensity = 0.42 + 0.16 * flicker;
    } else if (this.narrativeStage === 'salvage' || this.narrativeStage === 'core_ready') {
      // Low-power emergency crimson/amber state while core is offline
      const pulse = 0.72 + 0.28 * Math.sin(elapsed * 2.4);
      const col = this.narrativeStage === 'core_ready' ? 0x38bdf8 : 0xe11d48;
      this.baseData.interiorLights.forEach((l, idx) => {
        l.color.setHex(idx < 4 ? 0x38bdf8 : col);
        l.intensity = idx < 4 ? 2.2 : 2.6 * pulse;
      });
      this.baseData.softBlueStripMat.color.setHex(0xfda4af);
      this.baseData.softBlueStripMat.emissive.setHex(col);
      this.baseData.softBlueStripMat.emissiveIntensity = 1.1 * pulse;
      this.baseData.holoMoonMat.color.setHex(col);
      this.baseData.holoMoonMat.emissive.setHex(col);
      this.hemiLight.color.setHex(0x64748b);
      this.hemiLight.intensity = 0.48;
    } else if (this.finaleActive && this.finaleTimer < 3.0) {
      // Pre-ignition surge: crimson lights pulse faster and brighten toward golden-white ignition
      const p = THREE.MathUtils.clamp(this.finaleTimer / 3.0, 0, 1);
      const pulse = 0.65 + 0.35 * Math.sin(elapsed * (8 + p * 22));
      this.baseData.interiorLights.forEach((l, idx) => {
        l.color.setHex(p > 0.72 ? 0xfbbf24 : 0xef4444);
        l.intensity = (idx < 4 ? 2.6 : 4.4) * pulse * (1 + p * 0.9);
      });
      this.baseData.softBlueStripMat.color.setHex(p > 0.72 ? 0xfde68a : 0xfca5a5);
      this.baseData.softBlueStripMat.emissive.setHex(p > 0.72 ? 0xf59e0b : 0xe11d48);
      this.baseData.softBlueStripMat.emissiveIntensity = 1.4 + p * 1.8;
      this.baseData.holoMoonMat.color.setHex(0xfbbf24);
      this.baseData.holoMoonMat.emissive.setHex(0x38bdf8);
      this.hemiLight.color.setHex(0x94a3b8);
      this.hemiLight.intensity = 0.55 + p * 0.25;
    } else {
      // Full power restored! Radiant cyan, gold, and white illumination across base interior & exterior
      const isAmber = this.lightingPreset === 'amber';
      const hex = isAmber ? 0xf59e0b : 0x38bdf8;
      this.baseData.interiorLights.forEach((l, idx) => {
        l.color.setHex(idx === 4 ? 0xf8fafc : hex);
        l.intensity = THREE.MathUtils.damp(l.intensity, idx < 4 ? 3.2 : 6.4, 4, dt);
      });
      this.baseData.softBlueStripMat.color.setHex(0xe0f2fe);
      this.baseData.softBlueStripMat.emissive.setHex(hex);
      this.baseData.softBlueStripMat.emissiveIntensity = this.finaleActive ? 2.5 : 1.75;
      this.baseData.cyanEmissiveMat.emissiveIntensity = this.finaleActive ? 2.85 : 2.2;
      this.baseData.warmAccentMat.color.setHex(0xfde68a);
      this.baseData.warmAccentMat.emissive.setHex(0xfbbf24);
      this.baseData.warmAccentMat.emissiveIntensity = this.finaleActive ? 2.4 : 1.35;
      this.baseData.exteriorFloodLight.color.setHex(0xbae6fd);
      this.baseData.exteriorFloodLight.intensity = THREE.MathUtils.damp(
        this.baseData.exteriorFloodLight.intensity,
        this.finaleActive ? 7.5 : 2.2,
        4,
        dt,
      );
      this.baseData.holoMoonMat.color.setHex(0x7dd3fc);
      this.baseData.holoMoonMat.emissive.setHex(0x0ea5e9);
      this.hemiLight.color.setHex(isAmber ? 0xfdba74 : 0xbae6fd);
      this.hemiLight.intensity = 0.78;
    }
  }

  private updateParticlesAndWorld(dt: number, elapsed: number) {
    this.baseData.earthMesh.rotation.y += dt * 0.015;
    this.baseData.cloudMesh.rotation.y += dt * 0.022;

    this.baseData.holoGlobe.rotation.y += dt * 0.45;
    this.baseData.holoGlobe.position.y = 1.56 + Math.sin(elapsed * 1.8) * 0.05;

    // Gentle hover & billboard orientation for the central HQ Transmission Holo Banner
    this.baseData.holoBannerMesh.position.y = 2.52 + Math.sin(elapsed * 2.1) * 0.04;
    this.baseData.holoBannerMesh.lookAt(
      this.camera.position.x,
      this.baseData.holoBannerMesh.getWorldPosition(_lookGoal).y,
      this.camera.position.z,
    );

    for (const term of this.baseData.terminals) {
      term.accentRing.rotation.z += dt * 0.5;
    }

    for (const art of this.baseData.artifacts) {
      if (!art.collected) {
        art.beaconRing.rotation.z += dt * 0.9;
        art.beaconRing.scale.setScalar(1 + Math.sin(elapsed * 3.0) * 0.08);
        art.beaconDiamond.rotation.y += dt * 1.45;
        art.beaconDiamond.position.y = 2.65 + Math.sin(elapsed * 2.4 + art.position.x) * 0.16;
      }
    }

    const cabinPos = this.baseData.cabinDust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < cabinPos.count; i++) {
      let y = cabinPos.getY(i) + dt * (0.045 + (i % 5) * 0.008);
      const x = cabinPos.getX(i) + Math.sin(elapsed * 0.4 + i) * dt * 0.03;
      if (y > 3.9) y = 0.25;
      cabinPos.setXY(i, x, y);
    }
    cabinPos.needsUpdate = true;

    const extPos = this.baseData.exteriorDust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < extPos.count; i++) {
      let x = extPos.getX(i) + dt * (0.28 + (i % 4) * 0.06);
      const y = extPos.getY(i) + Math.sin(elapsed * 0.6 + i * 0.7) * dt * 0.08;
      if (x > 28) x = -28;
      extPos.setXY(i, x, y);
    }
    extPos.needsUpdate = true;

    this.baseData.dustPool.update(dt);
  }

  private updateTitleCamera(elapsed: number, dt: number) {
    const panX = Math.sin(elapsed * 0.18) * 3.6;
    const panZ = -1.8 + Math.cos(elapsed * 0.14) * 1.4;
    _camGoal.set(panX, 2.25 + Math.sin(elapsed * 0.25) * 0.15, panZ);
    _lookGoal.set(panX * 0.25, 2.25, -18);

    this.currentCamPos.lerp(_camGoal, 1 - Math.exp(-3 * dt));
    this.currentLookAt.lerp(_lookGoal, 1 - Math.exp(-3 * dt));

    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookAt);

    this.astronaut.updateAnimation(0, true, elapsed, dt, () => {});
  }

  private updateRoverTransition(dt: number, elapsed: number) {
    const tr = this.roverTransition;
    tr.t = Math.min(1, tr.t + dt / tr.duration);
    const ease = tr.t * tr.t * (3 - 2 * tr.t);
    const arcY = Math.sin(tr.t * Math.PI) * 0.42;

    this.playerPos.lerpVectors(tr.startPos, tr.targetPos, ease);
    this.playerPos.y += arcY;
    this.astronaut.root.position.copy(this.playerPos);
    this.astronaut.root.rotation.y = THREE.MathUtils.lerp(tr.startYaw, tr.targetYaw, ease);
    this.astronaut.updateAnimation(0.5, false, elapsed, dt, () => {});

    // Smoothly sweep camera toward rover chase or astronaut EVA position
    if (tr.dir === 'enter') {
      const chaseDist = 5.6;
      const cosP = Math.cos(this.camPitch * 0.65);
      _camGoal.set(
        this.roverPos.x + Math.sin(this.camYaw) * cosP * chaseDist,
        this.roverPos.y + 2.6 - Math.sin(this.camPitch) * 2.2,
        this.roverPos.z + Math.cos(this.camYaw) * cosP * chaseDist,
      );
      _lookGoal.set(this.roverPos.x, this.roverPos.y + 1.15, this.roverPos.z);
    } else {
      _camGoal.set(
        tr.targetPos.x + Math.sin(this.camYaw) * 3.1,
        tr.targetPos.y + 1.85,
        tr.targetPos.z + Math.cos(this.camYaw) * 3.1,
      );
      _lookGoal.set(tr.targetPos.x, tr.targetPos.y + 1.35, tr.targetPos.z);
    }
    this.currentCamPos.lerp(_camGoal, 1 - Math.exp(-8 * dt));
    this.currentLookAt.lerp(_lookGoal, 1 - Math.exp(-10 * dt));
    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookAt);

    if (tr.t >= 1) {
      tr.active = false;
      if (tr.dir === 'enter') {
        this.controlMode = 'rover';
        this.astronaut.root.visible = false;
        this.baseData.rover.driverFigure.visible = true;
        if (this.viewMode === 'first') this.viewMode = 'third';
        this.showBanner('ROVER ENGAGED // WASD DRIVE · E SALVAGE · F EXIT');
      } else {
        this.controlMode = 'foot';
        this.playerPos.copy(tr.targetPos);
        this.playerYaw = tr.targetYaw;
        this.astronaut.root.position.copy(this.playerPos);
        this.astronaut.root.visible = true;
        this.applyViewMode(this.viewMode);
        this.showBanner('EXITED LUNAR ROVER // 1/6g EVA MODE');
      }
      this.pushHudSnapshot();
    }
  }

  private emitSurfaceDustBurst(x: number, y: number, z: number, count: number, spreadSpeed: number) {
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      this.baseData.dustPool.emit(
        x + Math.cos(ang) * 0.25,
        y + 0.08,
        z + Math.sin(ang) * 0.25,
        Math.cos(ang) * spreadSpeed,
        0.55 + Math.random() * 0.65,
        Math.sin(ang) * spreadSpeed,
      );
    }
  }

  private alignRoverToGround(
    nx: number,
    nz: number,
    yaw: number,
    dt: number,
    immediate: boolean,
  ) {
    const fwdX = -Math.sin(yaw);
    const fwdZ = -Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    const hFL = getLunarSurfaceHeight(nx - rightX * 0.92 + fwdX * 0.96, nz - rightZ * 0.92 + fwdZ * 0.96);
    const hFR = getLunarSurfaceHeight(nx + rightX * 0.92 + fwdX * 0.96, nz + rightZ * 0.92 + fwdZ * 0.96);
    const hRL = getLunarSurfaceHeight(nx - rightX * 0.92 - fwdX * 0.96, nz - rightZ * 0.92 - fwdZ * 0.96);
    const hRR = getLunarSurfaceHeight(nx + rightX * 0.92 - fwdX * 0.96, nz + rightZ * 0.92 - fwdZ * 0.96);
    const hCenter = getLunarSurfaceHeight(nx, nz);

    const avgGroundY = (hFL + hFR + hRL + hRR) * 0.25;
    const dFwd = (hFL + hFR) * 0.5 - (hRL + hRR) * 0.5;
    const dRight = (hFR + hRR) * 0.5 - (hFL + hRL) * 0.5;

    const planeFL = avgGroundY + 0.5 * dFwd - 0.5 * dRight;
    const planeFR = avgGroundY + 0.5 * dFwd + 0.5 * dRight;
    const planeRL = avgGroundY - 0.5 * dFwd - 0.5 * dRight;
    const planeRR = avgGroundY - 0.5 * dFwd + 0.5 * dRight;

    const clearanceLift = Math.max(
      0,
      hFL - planeFL,
      hFR - planeFR,
      hRL - planeRL,
      hRR - planeRR,
      hCenter - avgGroundY,
    );
    const supportGroundY = avgGroundY + clearanceLift;

    _roverFwd.set(fwdX * 1.92, dFwd, fwdZ * 1.92).normalize();
    _roverRight.set(rightX * 1.84, dRight, rightZ * 1.84).normalize();
    _roverNormal.crossVectors(_roverRight, _roverFwd).normalize();

    if (!this.roverGrounded && !immediate) {
      _roverNormal.y += 0.45;
      _roverNormal.normalize();
    }

    // Build orthonormal basis aligned with rover yaw heading & terrain ground normal
    _roverRight.set(rightX, 0, rightZ);
    _roverFwd.crossVectors(_roverNormal, _roverRight).normalize();
    _roverRight.crossVectors(_roverFwd, _roverNormal).normalize();
    _roverFwd.negate();
    _roverBasis.makeBasis(_roverRight, _roverNormal, _roverFwd);
    _roverTargetQuat.setFromRotationMatrix(_roverBasis);

    if (immediate) {
      this.baseData.rover.root.quaternion.copy(_roverTargetQuat);
    } else {
      const alignRate = this.roverGrounded ? 15 : 4.0;
      this.baseData.rover.root.quaternion.slerp(_roverTargetQuat, 1 - Math.exp(-alignRate * dt));
    }

    return {
      hFL,
      hFR,
      hRL,
      hRR,
      planeFL,
      planeFR,
      planeRL,
      planeRR,
      avgGroundY,
      clearanceLift,
      supportGroundY,
    };
  }

  private updateRoverPlaying(dt: number, elapsed: number) {
    const throttle =
      (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp') ? 1 : 0) -
      (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown') ? 1 : 0);
    const steerInput =
      (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft') ? 1 : 0) -
      (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight') ? 1 : 0);
    const boost = this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight');

    const maxSpeed = boost ? 19.5 : 13.5;
    const targetSpd = throttle * maxSpeed;
    const prevSpeed = this.roverSpeed;
    this.roverSpeed = THREE.MathUtils.damp(
      this.roverSpeed,
      targetSpd,
      throttle !== 0 ? 4.2 : 2.6,
      dt,
    );
    const accelPitch = THREE.MathUtils.clamp((this.roverSpeed - prevSpeed) * 0.02, -0.08, 0.08);
    this.roverSteer = THREE.MathUtils.damp(this.roverSteer, steerInput * 0.52, 9, dt);

    if (Math.abs(this.roverSpeed) > 0.2) {
      const turnDir = this.roverSpeed >= 0 ? 1 : -1;
      this.roverYaw +=
        this.roverSteer * turnDir * Math.min(1, Math.abs(this.roverSpeed) / 4.5) * 2.25 * dt;
    }

    const fwdX = -Math.sin(this.roverYaw);
    const fwdZ = -Math.cos(this.roverYaw);
    const rightX = Math.cos(this.roverYaw);
    const rightZ = -Math.sin(this.roverYaw);

    let nx = this.roverPos.x + fwdX * this.roverSpeed * dt;
    let nz = this.roverPos.z + fwdZ * this.roverSpeed * dt;

    // Keep rover within expansive 168m crater basin & outside base walls
    const distOrigin = Math.hypot(nx, nz);
    if (distOrigin > 168) {
      const scale = 168 / distOrigin;
      nx *= scale;
      nz *= scale;
      this.roverSpeed *= 0.5;
    }
    if (this.isBlockedByBaseExterior(nx, nz, 1.45)) {
      if (!this.isBlockedByBaseExterior(nx, this.roverPos.z, 1.45)) {
        nz = this.roverPos.z;
      } else if (!this.isBlockedByBaseExterior(this.roverPos.x, nz, 1.45)) {
        nx = this.roverPos.x;
      } else {
        nx = this.roverPos.x;
        nz = this.roverPos.z;
        this.roverSpeed = 0;
      }
    }

    // 4-Corner Wheel Height Sampling, Ground Normal Alignment & Zero-Clip Terrain Floor
    const ground = this.alignRoverToGround(nx, nz, this.roverYaw, dt, false);
    const terrainSlopeVel = (ground.supportGroundY - this.prevSupportGroundY) / Math.max(dt, 0.008);
    this.prevSupportGroundY = ground.supportGroundY;

    // Clamped 1/6th Lunar Gravity Vertical Physics (no wild slope launches or ground bouncing)
    this.roverVelY -= LUNAR_GRAVITY * dt;
    this.roverVelY = THREE.MathUtils.clamp(this.roverVelY, -8.5, 3.6);
    let nextY = this.roverPos.y + this.roverVelY * dt;

    if (nextY <= ground.supportGroundY + 0.03) {
      if (!this.roverGrounded && this.roverVelY < -0.65) {
        // Absorb landing into chassis suspension springs without bouncing upward
        this.roverSuspVel += Math.max(-2.4, this.roverVelY * 0.55);
        this.emitSurfaceDustBurst(nx, ground.supportGroundY, nz, 12, 1.8);
      }
      nextY = ground.supportGroundY;
      this.roverGrounded = true;
      // Only carry gentle clamped crest momentum at high speed; normal bumps stay planted
      this.roverVelY =
        Math.abs(this.roverSpeed) > 7.5 && terrainSlopeVel > 0.35
          ? THREE.MathUtils.clamp(terrainSlopeVel * 0.32, 0, 2.35)
          : 0;
    } else if (
      this.roverGrounded &&
      this.roverVelY <= 0.1 &&
      nextY - ground.supportGroundY <= 0.075 &&
      Math.abs(this.roverSpeed) < 9.5
    ) {
      // Smooth downhill slope tracking without micro-hopping
      nextY = ground.supportGroundY;
      this.roverVelY = 0;
    } else {
      this.roverGrounded = false;
    }

    nextY = Math.max(ground.supportGroundY, nextY);

    // 2nd-order spring-damper chassis suspension cushion
    const stiffness = 62;
    const damping = 10.5;
    const bumpExcite = this.roverGrounded
      ? Math.sin(elapsed * 16) * Math.min(0.06, Math.abs(this.roverSpeed) * 0.004)
      : 0;
    this.roverSuspVel += (-stiffness * (this.roverSuspOffset - bumpExcite) - damping * this.roverSuspVel) * dt;
    this.roverSuspOffset = THREE.MathUtils.clamp(this.roverSuspOffset + this.roverSuspVel * dt, -0.16, 0.16);

    const airDroop = -0.11;
    const flTravel = this.roverGrounded
      ? THREE.MathUtils.clamp(ground.hFL - ground.planeFL - ground.clearanceLift, -0.2, 0.14)
      : airDroop;
    const frTravel = this.roverGrounded
      ? THREE.MathUtils.clamp(ground.hFR - ground.planeFR - ground.clearanceLift, -0.2, 0.14)
      : airDroop;
    const rlTravel = this.roverGrounded
      ? THREE.MathUtils.clamp(ground.hRL - ground.planeRL - ground.clearanceLift, -0.2, 0.14)
      : airDroop;
    const rrTravel = this.roverGrounded
      ? THREE.MathUtils.clamp(ground.hRR - ground.planeRR - ground.clearanceLift, -0.2, 0.14)
      : airDroop;

    this.roverRoll = THREE.MathUtils.damp(
      this.roverRoll,
      -this.roverSteer * Math.min(1, Math.abs(this.roverSpeed) / 14) * 0.08,
      9,
      dt,
    );

    this.roverPos.set(nx, nextY, nz);
    this.playerPos.copy(this.roverPos);

    this.baseData.rover.root.position.copy(this.roverPos);
    this.baseData.rover.chassisGroup.rotation.x = THREE.MathUtils.damp(
      this.baseData.rover.chassisGroup.rotation.x,
      accelPitch,
      10,
      dt,
    );
    this.baseData.rover.chassisGroup.rotation.z = this.roverRoll;
    this.baseData.rover.updateSuspensionAndWheels(
      this.roverSpeed,
      this.roverSteer,
      this.roverSuspOffset,
      flTravel,
      frTravel,
      rlTravel,
      rrTravel,
      dt,
      elapsed,
    );

    // Dust-kicking particle trails behind rear wheels when moving on regolith
    if (this.roverGrounded && Math.abs(this.roverSpeed) > 1.3) {
      this.dustEmitTimer -= dt;
      if (this.dustEmitTimer <= 0) {
        const rate = Math.max(0.022, 0.09 - Math.abs(this.roverSpeed) * 0.004);
        this.dustEmitTimer = rate;
        const speedSign = this.roverSpeed >= 0 ? 1 : -1;
        const kickSpd = Math.min(3.5, Math.abs(this.roverSpeed) * 0.22);

        // Left & Right rear wheel dust plumes
        [-0.92, 0.92].forEach((side) => {
          const wx = nx + rightX * side - fwdX * 1.15 * speedSign;
          const wz = nz + rightZ * side - fwdZ * 1.15 * speedSign;
          const wy = getLunarSurfaceHeight(wx, wz) + 0.12;
          this.baseData.dustPool.emit(
            wx,
            wy,
            wz,
            -fwdX * kickSpd * speedSign + (Math.random() - 0.5) * 0.7,
            0.55 + Math.random() * 0.85,
            -fwdZ * kickSpd * speedSign + (Math.random() - 0.5) * 0.7,
          );
        });
      }
    }

    this.currentSector = 'LUNAR SURFACE // ROVER EVA';

    if (this.viewMode === 'first') {
      _camGoal.set(
        this.roverPos.x - rightX * 0.38,
        this.roverPos.y + 1.56 + this.roverSuspOffset,
        this.roverPos.z - rightZ * 0.38,
      );
      this.currentCamPos.lerp(_camGoal, 1 - Math.exp(-22 * dt));
      const lookDist = 14;
      _lookGoal.set(
        this.currentCamPos.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * lookDist,
        this.currentCamPos.y + Math.sin(this.camPitch) * lookDist,
        this.currentCamPos.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * lookDist,
      );
      this.camera.position.copy(this.currentCamPos);
      this.camera.lookAt(_lookGoal);
    } else {
      const chaseDist = 5.8;
      const cosP = Math.cos(this.camPitch * 0.65);
      const dirX = Math.sin(this.camYaw) * cosP;
      const dirZ = Math.cos(this.camYaw) * cosP;

      const camX = this.roverPos.x + dirX * chaseDist;
      const camZ = this.roverPos.z + dirZ * chaseDist;
      const minCamY = getLunarSurfaceHeight(camX, camZ) + 0.95;
      _camGoal.set(
        camX,
        Math.max(minCamY, this.roverPos.y + 2.65 - Math.sin(this.camPitch) * 2.2),
        camZ,
      );
      _lookGoal.set(
        this.roverPos.x - Math.sin(this.camYaw) * 2.2,
        this.roverPos.y + 1.15 + Math.sin(this.camPitch) * 1.4,
        this.roverPos.z - Math.cos(this.camYaw) * 2.2,
      );

      this.currentCamPos.lerp(_camGoal, 1 - Math.exp(-12 * dt));
      this.currentLookAt.lerp(_lookGoal, 1 - Math.exp(-15 * dt));
      this.camera.position.copy(this.currentCamPos);
      this.camera.lookAt(this.currentLookAt);
    }
  }

  private updateFootPlaying(dt: number, elapsed: number) {
    const isMoving =
      this.heldKeys.has('KeyW') ||
      this.heldKeys.has('KeyS') ||
      this.heldKeys.has('KeyA') ||
      this.heldKeys.has('KeyD') ||
      this.heldKeys.has('ArrowUp') ||
      this.heldKeys.has('ArrowDown') ||
      this.heldKeys.has('ArrowLeft') ||
      this.heldKeys.has('ArrowRight');
    const isSprinting =
      isMoving && (this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight'));

    _forward.set(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    _right.set(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));

    _moveDir.set(0, 0, 0);
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) _moveDir.add(_forward);
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) _moveDir.sub(_forward);
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) _moveDir.add(_right);
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) _moveDir.sub(_right);

    const hasInput = _moveDir.lengthSq() > 0.001;
    if (hasInput) _moveDir.normalize();

    const targetSpeed = hasInput ? (isSprinting ? 6.4 : 3.9) : 0;
    const accel = this.isGrounded ? 11 : 2.6; // Authentic lower air-control in 1/6g

    this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, _moveDir.x * targetSpeed, accel, dt);
    this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, _moveDir.z * targetSpeed, accel, dt);

    if (this.isGrounded) {
      this.coyoteTimer = 0.14;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
      if (this.coyoteTimer > 0) {
        // Real 1/6g Moon jump: 2.15 m/s impulse @ 1.62 m/s^2 gravity -> ~1.43m arc & ~2.6s hangtime!
        this.playerVel.y = 2.15;
        this.isGrounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.audio.playJumpThrust();
        if (this.environmentZone === 'surface') {
          this.emitSurfaceDustBurst(this.playerPos.x, this.playerPos.y, this.playerPos.z, 8, 1.1);
        }
      }
    }

    const floorY =
      this.environmentZone === 'interior'
        ? 0
        : getLunarSurfaceHeight(this.playerPos.x, this.playerPos.z);

    const wasGrounded = this.isGrounded;
    this.playerVel.y -= LUNAR_GRAVITY * dt;
    this.playerPos.y += this.playerVel.y * dt;
    if (this.playerPos.y <= floorY) {
      if (!wasGrounded && this.playerVel.y < -0.6 && this.environmentZone === 'surface') {
        this.emitSurfaceDustBurst(this.playerPos.x, floorY, this.playerPos.z, 10, 1.3);
        this.audio.playFootstep(true);
      }
      this.playerPos.y = floorY;
      this.playerVel.y = 0;
      this.isGrounded = true;
    } else if (this.playerPos.y > floorY + 0.18) {
      this.isGrounded = false;
    }

    const nextX = this.playerPos.x + this.playerVel.x * dt;
    const nextZ = this.playerPos.z + this.playerVel.z * dt;

    if (this.environmentZone === 'interior') {
      let candidateX = this.playerPos.x;
      let candidateZ = this.playerPos.z;

      if (this.isInsideWalkable(nextX, nextZ)) {
        candidateX = nextX;
        candidateZ = nextZ;
      } else {
        if (this.isInsideWalkable(nextX, this.playerPos.z)) {
          candidateX = nextX;
        } else {
          this.playerVel.x = 0;
        }
        if (this.isInsideWalkable(candidateX, nextZ)) {
          candidateZ = nextZ;
        } else {
          this.playerVel.z = 0;
        }
      }

      const resolved = this.resolveObstacles(candidateX, candidateZ);
      if (this.isInsideWalkable(resolved.x, resolved.z)) {
        this.playerPos.x = resolved.x;
        this.playerPos.z = resolved.z;
      }
      const sector = this.isInsideWalkable(this.playerPos.x, this.playerPos.z);
      if (sector) this.currentSector = sector;
    } else {
      // Exterior lunar surface exploration on foot (168m basin radius)
      let sx = nextX;
      let sz = nextZ;
      const distOrigin = Math.hypot(sx, sz);
      if (distOrigin > 168) {
        sx *= 168 / distOrigin;
        sz *= 168 / distOrigin;
      }
      if (this.isBlockedByBaseExterior(sx, sz, 0.5)) {
        if (!this.isBlockedByBaseExterior(sx, this.playerPos.z, 0.5)) sz = this.playerPos.z;
        else if (!this.isBlockedByBaseExterior(this.playerPos.x, sz, 0.5)) sx = this.playerPos.x;
        else {
          sx = this.playerPos.x;
          sz = this.playerPos.z;
        }
      }
      this.playerPos.x = sx;
      this.playerPos.z = sz;
      if (this.isGrounded) {
        this.playerPos.y = getLunarSurfaceHeight(sx, sz);
      }
      this.currentSector = 'LUNAR SURFACE // 1/6g EVA';
    }

    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    if (this.viewMode === 'first') {
      this.playerYaw = this.camYaw;
    } else if (horizSpeed > 0.35) {
      const targetYaw = Math.atan2(-this.playerVel.x, -this.playerVel.z);
      let diff = targetYaw - this.playerYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.playerYaw += diff * Math.min(1, 10 * dt);
    }

    this.astronaut.root.position.copy(this.playerPos);
    this.astronaut.root.rotation.y = this.playerYaw;
    this.astronaut.updateAnimation(horizSpeed / 6.0, this.isGrounded, elapsed, dt, () => {
      this.audio.playFootstep(isSprinting);
      if (this.environmentZone === 'surface' && horizSpeed > 1.5) {
        this.baseData.dustPool.emit(
          this.playerPos.x,
          this.playerPos.y + 0.05,
          this.playerPos.z,
          (Math.random() - 0.5) * 0.5,
          0.35 + Math.random() * 0.35,
          (Math.random() - 0.5) * 0.5,
        );
      }
    });

    if (this.viewMode === 'first') {
      const bob = this.isGrounded && horizSpeed > 0.4 ? Math.sin(elapsed * 8.5) * 0.036 : 0;
      _camGoal.set(this.playerPos.x, this.playerPos.y + 1.66 + bob, this.playerPos.z);
      this.currentCamPos.lerp(_camGoal, 1 - Math.exp(-26 * dt));

      const lookDist = 10;
      _lookGoal.set(
        this.currentCamPos.x - Math.sin(this.camYaw) * Math.cos(this.camPitch) * lookDist,
        this.currentCamPos.y + Math.sin(this.camPitch) * lookDist,
        this.currentCamPos.z - Math.cos(this.camYaw) * Math.cos(this.camPitch) * lookDist,
      );
      this.camera.position.copy(this.currentCamPos);
      this.camera.lookAt(_lookGoal);
    } else {
      let chaseDist = 3.1;
      const cosP = Math.cos(this.camPitch * 0.65);
      const dirX = Math.sin(this.camYaw) * cosP;
      const dirZ = Math.cos(this.camYaw) * cosP;

      if (this.environmentZone === 'interior') {
        for (let d = 0.6; d <= 3.1; d += 0.25) {
          const testX = this.playerPos.x + dirX * d;
          const testZ = this.playerPos.z + dirZ * d;
          if (!this.isInsideWalkable(testX, testZ, 0.2)) {
            chaseDist = Math.max(0.75, d - 0.25);
            break;
          }
        }
      }

      const maxCamY = this.environmentZone === 'interior' ? 3.35 : 34;
      _camGoal.set(
        this.playerPos.x + dirX * chaseDist,
        THREE.MathUtils.clamp(
          this.playerPos.y + 1.95 - Math.sin(this.camPitch) * 1.4,
          this.playerPos.y + 0.65,
          maxCamY,
        ),
        this.playerPos.z + dirZ * chaseDist,
      );
      _lookGoal.set(
        this.playerPos.x - Math.sin(this.camYaw) * 1.8,
        this.playerPos.y + 1.42 + Math.sin(this.camPitch) * 1.1,
        this.playerPos.z - Math.cos(this.camYaw) * 1.8,
      );

      this.currentCamPos.lerp(_camGoal, 1 - Math.exp(-14 * dt));
      this.currentLookAt.lerp(_lookGoal, 1 - Math.exp(-16 * dt));
      this.camera.position.copy(this.currentCamPos);
      this.camera.lookAt(this.currentLookAt);
    }
  }

  private updateFinaleCinematic(dt: number) {
    this.finaleTimer += dt;
    const t = this.finaleTimer;

    // 1. Animate Floating 10-Artifact Circle + Golden-Blue Energy Arcs
    if (this.ignitionGroup && this.ignitionGroup.visible) {
      const preP = THREE.MathUtils.clamp(t / 3.0, 0, 1);
      const orbitSpin = t * (1.5 + preP * preP * 6.5);
      const radius = t < 3.0 ? THREE.MathUtils.lerp(1.55, 1.08, preP * preP) : Math.max(0.05, 1.08 - (t - 3.0) * 1.6);

      for (let i = 0; i < this.ignitionArtifactNodes.length; i++) {
        const node = this.ignitionArtifactNodes[i];
        const ang = node.baseAngle + orbitSpin;
        const bob = Math.sin(t * 5.2 + i * 0.9) * 0.12 * (1 - preP * 0.4);
        node.group.position.set(Math.cos(ang) * radius, bob, Math.sin(ang) * radius);
        node.group.rotation.y += dt * (2.8 + preP * 11);
        node.group.rotation.z = Math.sin(t * 4 + i) * 0.18;
      }

      if (this.ignitionArcPositions && this.ignitionArcGeo) {
        const arr = this.ignitionArcPositions;
        const n = this.ignitionArtifactNodes.length;
        for (let i = 0; i < n; i++) {
          const pA = this.ignitionArtifactNodes[i].group.position;
          const pB = this.ignitionArtifactNodes[(i + 1) % n].group.position;
          const pOpp = this.ignitionArtifactNodes[(i + 3) % n].group.position;

          // Perimeter ring arc (segments 0..9)
          const rIdx = i * 6;
          arr[rIdx] = pA.x;
          arr[rIdx + 1] = pA.y + 0.1;
          arr[rIdx + 2] = pA.z;
          arr[rIdx + 3] = pB.x;
          arr[rIdx + 4] = pB.y + 0.1;
          arr[rIdx + 5] = pB.z;

          // Radial arc into Reactor Core (segments 10..19)
          const cIdx = (n + i) * 6;
          arr[cIdx] = pA.x;
          arr[cIdx + 1] = pA.y + 0.1;
          arr[cIdx + 2] = pA.z;
          arr[cIdx + 3] = Math.sin(t * 28 + i) * 0.08;
          arr[cIdx + 4] = Math.cos(t * 31 + i) * 0.08;
          arr[cIdx + 5] = Math.sin(t * 24 - i) * 0.08;

          // Diagonal plasma bridge (segments 20..29)
          const dIdx = (2 * n + i) * 6;
          arr[dIdx] = pA.x;
          arr[dIdx + 1] = pA.y + 0.1;
          arr[dIdx + 2] = pA.z;
          arr[dIdx + 3] = pOpp.x;
          arr[dIdx + 4] = pOpp.y + 0.1;
          arr[dIdx + 5] = pOpp.z;
        }
        (this.ignitionArcGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }

      if (this.ignitionCoreMesh && this.ignitionCoreMat) {
        const coreScale = t < 3.0 ? 0.55 + preP * 1.45 : Math.max(0.01, 2.0 - (t - 3.0) * 3.2);
        this.ignitionCoreMesh.scale.setScalar(coreScale);
        this.ignitionCoreMat.opacity = t < 3.0 ? 0.72 + 0.28 * Math.sin(t * 26) : Math.max(0, 1 - (t - 3.0) * 2.2);
      }

      if (t >= 3.65) {
        this.ignitionGroup.visible = false;
      }
    }

    // 2. At t >= 3.0s: Trigger Shockwave, Transform Base Lights, & Start Orbital Ascension
    if (t >= 3.0 && !this.shockwaveTriggered) {
      this.shockwaveTriggered = true;
      this.finalePhase = 'ascension';
      this.audio.playReactorShockwave();
      this.audio.playPowerRestoredChord();

      this.baseData.holoBannerMat.map = this.textures.holoRestored;
      this.baseData.holoBannerMat.emissiveMap = this.textures.holoRestored;
      this.baseData.holoBannerMat.needsUpdate = true;

      if (this.shockwaveSphere) {
        this.shockwaveSphere.visible = true;
        this.shockwaveSphere.scale.setScalar(0.8);
      }
      if (this.shockwaveRing) {
        this.shockwaveRing.visible = true;
        this.shockwaveRing.scale.setScalar(1.0);
      }
      if (this.godRaysGroup) {
        this.godRaysGroup.visible = true;
      }

      this.showBanner('REACTOR SHOCKWAVE RELEASED // ASAAR FULLY RESTORED');
    }

    if (t >= 7.2 && this.finalePhase !== 'transmission') {
      this.finalePhase = 'transmission';
    }

    // Expand shockwave across base & craters (3.0s -> 6.0s)
    if (this.shockwaveTriggered && this.shockwaveSphere && this.shockwaveSphere.visible) {
      const wt = t - 3.0;
      const waveFade = THREE.MathUtils.clamp(1 - wt / 2.8, 0, 1);
      this.shockwaveSphere.scale.setScalar(0.8 + wt * 32);
      this.shockwaveUniforms.uOpacity.value = waveFade * 0.95;

      if (this.shockwaveRing && this.shockwaveRingMat) {
        this.shockwaveRing.scale.setScalar(1.0 + wt * 36);
        this.shockwaveRingMat.opacity = waveFade * 0.85;
      }

      if (wt >= 2.85) {
        this.shockwaveSphere.visible = false;
        if (this.shockwaveRing) this.shockwaveRing.visible = false;
      }
    }

    // 3. Dramatic Lunar Sunrise & God-Rays over Horizon
    const sunriseP = THREE.MathUtils.smoothstep(t, 2.8, 16);
    const sunAz = 0.24;
    const sunElev = THREE.MathUtils.lerp(0.025, 0.34, sunriseP);
    _sunDir.set(Math.sin(sunAz), sunElev, -Math.cos(sunAz)).normalize();

    this.sunLight.position.copy(_sunDir).multiplyScalar(42);
    if (sunriseP < 0.5) {
      this.sunLight.color.lerpColors(_sunriseLowColor, _sunriseMidColor, sunriseP * 2);
    } else {
      this.sunLight.color.lerpColors(_sunriseMidColor, _sunriseDayColor, (sunriseP - 0.5) * 2);
    }
    this.sunLight.intensity = THREE.MathUtils.lerp(1.95, 3.35, sunriseP);

    if (this.godRaysGroup && this.godRaysGroup.visible) {
      const rayVis = THREE.MathUtils.smoothstep(t, 3.1, 5.2);
      this.godRayMats.forEach((m, idx) => {
        m.opacity = (0.18 + 0.08 * Math.sin(t * 0.9 + idx)) * rayVis;
      });
    }

    // 4. Camera Choreography:
    //    0.0s..3.0s: Inside Observation Hub framing spinning 10-relic ignition circle
    //    3.0s..4.4s: Fly smoothly out through clear Panoramic Glass Pane (1.75, 2.45, -7.75) into space
    //    4.4s+: Graceful orbital sweep around illuminated base framing sunrise craters & glowing Earth
    if (t < 3.0) {
      const preP = THREE.MathUtils.smoothstep(t, 0, 3.0);
      _camGoal.lerpVectors(_finaleCamStart, _finaleCamPreBlast, preP);
      _lookGoal.copy(_finaleLookCore);
      this.currentCamPos.lerp(_camGoal, 1 - Math.exp(-5.0 * dt));
      this.currentLookAt.lerp(_lookGoal, 1 - Math.exp(-6.0 * dt));
    } else {
      const outT = t - 3.0;
      if (outT < 1.45) {
        const u = outT / 1.45;
        if (u < 0.48) {
          const k = THREE.MathUtils.smoothstep(u / 0.48, 0, 1);
          _camGoal.lerpVectors(_finaleCamPreBlast, _finaleCamWindow, k);
        } else {
          const k = THREE.MathUtils.smoothstep((u - 0.48) / 0.52, 0, 1);
          _camGoal.lerpVectors(_finaleCamWindow, _finaleCamExit, k);
        }
        _lookGoal.lerpVectors(_finaleLookCore, _finaleLookOutside, THREE.MathUtils.smoothstep(u, 0, 1));
        this.currentCamPos.lerp(_camGoal, 1 - Math.exp(-7.5 * dt));
        this.currentLookAt.lerp(_lookGoal, 1 - Math.exp(-6.0 * dt));

        // Switch exterior visibility once camera clears the panoramic observation window
        if (this.currentCamPos.z < -7.95 && this.environmentZone !== 'surface') {
          this.environmentZone = 'surface';
        }
      } else {
        this.environmentZone = 'surface';
        const climbT = outT - 1.45;
        const blendOrbit = THREE.MathUtils.smoothstep(climbT, 0, 3.2);
        const sweepAngle = Math.PI + climbT * 0.145;
        const orbitRadius = THREE.MathUtils.lerp(18.5, 32.0, blendOrbit);
        const camHeight = THREE.MathUtils.lerp(4.2, 13.5, blendOrbit) + Math.sin(climbT * 0.25) * 1.4;

        const camX = Math.sin(sweepAngle) * orbitRadius;
        const camZ = -1.0 + Math.cos(sweepAngle) * orbitRadius;
        const minSurfaceY = getLunarSurfaceHeight(camX, camZ) + 2.4;

        _camGoal.set(camX, Math.max(minSurfaceY, camHeight), camZ);
        _lookGoal.set(
          Math.sin(climbT * 0.18) * 1.2,
          THREE.MathUtils.lerp(2.2, 3.8, blendOrbit),
          -5.0,
        );

        this.currentCamPos.lerp(_camGoal, 1 - Math.exp(-2.6 * dt));
        this.currentLookAt.lerp(_lookGoal, 1 - Math.exp(-3.0 * dt));
      }
    }

    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookAt);
  }

  private updatePlaying(dt: number, elapsed: number) {
    if (this.statusTimer > 0) {
      this.statusTimer -= dt;
      if (this.statusTimer <= 0) {
        this.statusBanner = null;
      }
    }

    if (this.finaleActive) {
      this.updateFinaleCinematic(dt);
      this.hudSyncTimer += dt;
      if (this.hudSyncTimer >= 0.1) {
        this.hudSyncTimer = 0;
        this.pushHudSnapshot();
      }
      return;
    }

    if (this.inspectedArtifact) {
      // Pause gameplay movement and frame the inspected 3D relic behind the holographic scanner
      const artPos = this.inspectedArtifact.position;
      const orbitAngle = elapsed * 0.32;
      const camX = artPos.x + Math.sin(orbitAngle) * 3.1;
      const camZ = artPos.z + Math.cos(orbitAngle) * 3.1;
      const minY = getLunarSurfaceHeight(camX, camZ) + 0.9;
      _camGoal.set(camX, Math.max(minY, artPos.y + 1.65), camZ);
      _lookGoal.set(artPos.x, artPos.y + 0.72, artPos.z);
      this.currentCamPos.lerp(_camGoal, 1 - Math.exp(-5 * dt));
      this.currentLookAt.lerp(_lookGoal, 1 - Math.exp(-6 * dt));
      this.camera.position.copy(this.currentCamPos);
      this.camera.lookAt(this.currentLookAt);

      this.hudSyncTimer += dt;
      if (this.hudSyncTimer >= 0.1) {
        this.hudSyncTimer = 0;
        this.pushHudSnapshot();
      }
      return;
    }

    if (this.transmissionOpen || this.studyTerminalOpen) {
      // Gently orbit camera around central holographic terminal while briefing is open
      _camGoal.set(
        Math.sin(elapsed * 0.3) * 2.1,
        2.15,
        -1.5 + Math.cos(elapsed * 0.3) * 0.5,
      );
      _lookGoal.set(0, 2.2, -4.1);
      this.currentCamPos.lerp(_camGoal, 1 - Math.exp(-4 * dt));
      this.currentLookAt.lerp(_lookGoal, 1 - Math.exp(-5 * dt));
      this.camera.position.copy(this.currentCamPos);
      this.camera.lookAt(this.currentLookAt);

      this.hudSyncTimer += dt;
      if (this.hudSyncTimer >= 0.1) {
        this.hudSyncTimer = 0;
        this.pushHudSnapshot();
      }
      return;
    }

    // Survival Telemetry: Freezing -150°C Shadowed Craters vs Solar Charging in Direct Sunlight
    if (this.thermalBannerCooldown > 0) {
      this.thermalBannerCooldown -= dt;
    }

    if (this.narrativeStage !== 'restored') {
      let o2Rate = 0.14;
      let powerDelta = -0.12;

      if (this.environmentZone === 'interior') {
        this.solarState = 'interior';
        this.surfaceTempC = 21;
        this.lastSurfaceShadowState = null;
        o2Rate = 0.14;
        powerDelta = -0.12;
      } else {
        const activePos = this.controlMode === 'rover' ? this.roverPos : this.playerPos;
        const thermal = getLunarThermalState(activePos.x, activePos.z);
        this.surfaceTempC = thermal.surfaceTempC;

        const isBoosting =
          this.controlMode === 'rover' &&
          Math.abs(this.roverSpeed) > 1.5 &&
          (this.heldKeys.has('ShiftLeft') || this.heldKeys.has('ShiftRight'));

        if (thermal.inShadow) {
          this.solarState = 'shadow';
          // Extreme -150°C freezing cold drains battery rapidly for suit/rover heaters
          powerDelta =
            this.controlMode === 'rover' ? (isBoosting ? -3.45 : -2.65) : -2.35;
          o2Rate = this.controlMode === 'rover' ? 0.34 : 0.4;

          if (this.lastSurfaceShadowState === false && this.thermalBannerCooldown <= 0) {
            this.showBanner(`CRATER SHADOW (${thermal.surfaceTempC}°C) // BATTERY DRAINING RAPIDLY`);
            this.thermalBannerCooldown = 5.5;
          }
          this.lastSurfaceShadowState = true;
        } else {
          this.solarState = 'sunlight';
          // Direct solar exposure charges suit & rover solar components
          const movingDrain =
            this.controlMode === 'rover'
              ? Math.abs(this.roverSpeed) > 1.2
                ? isBoosting
                  ? 1.55
                  : 0.95
                : 0
              : 0.15;
          powerDelta = (this.controlMode === 'rover' ? 2.85 : 2.35) - movingDrain;
          o2Rate = this.controlMode === 'rover' ? 0.2 : 0.27;

          if (this.lastSurfaceShadowState === true && this.energy < 95 && this.thermalBannerCooldown <= 0) {
            this.showBanner('DIRECT SUNLIGHT // SOLAR ARRAYS CHARGING BATTERY');
            this.thermalBannerCooldown = 5.5;
          }
          this.lastSurfaceShadowState = false;
        }
      }

      this.powerDeltaPerSec = powerDelta;
      this.oxygen = THREE.MathUtils.clamp(this.oxygen - dt * o2Rate, 0, 100);
      this.energy = THREE.MathUtils.clamp(this.energy + dt * powerDelta, 0, 100);

      if (this.energy <= 25 && !this.lowPowerWarned) {
        this.lowPowerWarned = true;
        this.showBanner('LOW BATTERY WARNING // SEEK DIRECT SUNLIGHT TO RECHARGE');
      } else if (this.energy > 38) {
        this.lowPowerWarned = false;
      }

      if (this.oxygen <= 0 || this.energy <= 0) {
        this.heldKeys.clear();
        this.exitPointerLockSafe();
        this.setMode('critical');
        return;
      }
    } else {
      this.solarState = this.environmentZone === 'interior' ? 'interior' : 'sunlight';
      this.surfaceTempC = this.environmentZone === 'interior' ? 21 : 94;
      this.powerDeltaPerSec = 0;
    }

    if (this.roverTransition.active) {
      this.updateRoverTransition(dt, elapsed);
    } else if (this.controlMode === 'rover') {
      this.updateRoverPlaying(dt, elapsed);
    } else {
      this.updateFootPlaying(dt, elapsed);
    }

    this.updateWaypointArrow(dt, elapsed);

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.08) {
      this.hudSyncTimer = 0;
      this.pushHudSnapshot();
    }
  }

  private updateWaypointArrow(dt: number, elapsed: number) {
    if (!this.waypointArrow) return;

    const activeArt = this.baseData.artifacts[this.activeTargetIndex];

    const trackingArtifact =
      this.mode === 'playing' &&
      this.narrativeStage === 'salvage' &&
      this.sortieBriefed &&
      !this.studyTerminalOpen &&
      !this.transmissionOpen &&
      !this.inspectedArtifact &&
      Boolean(activeArt && !activeArt.collected);

    const returningToBase =
      this.mode === 'playing' &&
      this.environmentZone === 'surface' &&
      !this.studyTerminalOpen &&
      !this.transmissionOpen &&
      !this.inspectedArtifact &&
      ((this.narrativeStage === 'salvage' && !this.sortieBriefed) ||
        this.narrativeStage === 'core_ready');

    const shouldShow = trackingArtifact || returningToBase;

    if (!shouldShow) {
      this.waypointArrow.root.visible = false;
      this.navPingTimer = 0;
      return;
    }

    const wasHidden = !this.waypointArrow.root.visible;
    this.waypointArrow.root.visible = true;

    // Periodic crisp sonar telemetry ping while following 3D guidance arrow
    if (this.environmentZone === 'surface') {
      this.navPingTimer -= dt;
      if (this.navPingTimer <= 0) {
        this.navPingTimer = 3.6;
        this.audio.playNavigationPing(returningToBase);
      }
    }

    let targetScale = 1.1;
    if (this.controlMode === 'rover') {
      if (this.viewMode === 'first') {
        _arrowGoalPos.set(
          this.roverPos.x - Math.sin(this.roverYaw) * 1.1,
          this.roverPos.y + 1.92 + this.roverSuspOffset,
          this.roverPos.z - Math.cos(this.roverYaw) * 1.1,
        );
        targetScale = 0.78;
      } else {
        _arrowGoalPos.set(
          this.roverPos.x,
          this.roverPos.y + 2.42 + this.roverSuspOffset,
          this.roverPos.z,
        );
        targetScale = 1.24;
      }
    } else if (this.viewMode === 'first') {
      _arrowGoalPos.set(
        this.camera.position.x - Math.sin(this.camYaw) * 0.95,
        this.camera.position.y + 0.28,
        this.camera.position.z - Math.cos(this.camYaw) * 0.95,
      );
      targetScale = 0.36;
    } else {
      _arrowGoalPos.set(this.playerPos.x, this.playerPos.y + 2.38, this.playerPos.z);
      targetScale = 1.05;
    }
    this.waypointArrow.root.scale.setScalar(targetScale);

    if (wasHidden) {
      this.waypointArrow.root.position.copy(_arrowGoalPos);
    } else {
      this.waypointArrow.root.position.lerp(_arrowGoalPos, 1 - Math.exp(-16 * dt));
    }

    const goalX = returningToBase ? 0 : activeArt!.position.x;
    const goalY = returningToBase ? getLunarSurfaceHeight(0, 13.3) + 1.4 : activeArt!.position.y + 1.0;
    const goalZ = returningToBase ? 13.3 : activeArt!.position.z;

    const dx = goalX - this.waypointArrow.root.position.x;
    const dy = goalY - this.waypointArrow.root.position.y;
    const dz = goalZ - this.waypointArrow.root.position.z;
    const horizDist = Math.hypot(dx, dz);

    const targetYaw = Math.atan2(-dx, -dz);
    const targetPitch = THREE.MathUtils.clamp(
      Math.atan2(dy, Math.max(2, horizDist)) * 0.45,
      -0.32,
      0.32,
    );
    _arrowEuler.set(targetPitch, targetYaw, 0);
    _arrowQuat.setFromEuler(_arrowEuler);

    if (wasHidden) {
      this.waypointArrow.root.quaternion.copy(_arrowQuat);
    } else {
      this.waypointArrow.root.quaternion.slerp(_arrowQuat, 1 - Math.exp(-12 * dt));
    }

    if (returningToBase) {
      this.waypointArrow.holoMat.color.setHex(0x34d399);
      this.waypointArrow.holoMat.emissive.setHex(0x10b981);
    } else {
      this.waypointArrow.holoMat.color.setHex(0x38bdf8);
      this.waypointArrow.holoMat.emissive.setHex(0x0ea5e9);
    }

    // Hover bob & proximity pulse
    this.waypointArrow.arrowBody.position.y = Math.sin(elapsed * 3.4) * 0.065;
    this.waypointArrow.ringMesh.rotation.z += dt * 1.4;
    const nearTarget = horizDist < 24;
    this.waypointArrow.holoMat.emissiveIntensity = nearTarget
      ? 2.8 + Math.sin(elapsed * 8) * 0.7
      : 2.1 + Math.sin(elapsed * 3) * 0.3;
    this.waypointArrow.tipMat.emissiveIntensity = nearTarget
      ? 3.2 + Math.sin(elapsed * 10) * 0.8
      : 2.3;
  }

  private pushHudSnapshot() {
    let nearbyTerminal = this.mode === 'playing' ? this.findNearbyTerminal() : null;
    if (this.mode === 'playing' && this.environmentZone === 'interior') {
      const coreDist = Math.hypot(this.playerPos.x - 0, this.playerPos.z - -4.1);
      if (coreDist <= 2.95) {
        const targetIdx = this.activeTargetIndex + 1;
        nearbyTerminal = {
          id: 'central-core-holo',
          label: 'Base Main Study Computer',
          actionLabel:
            this.narrativeStage === 'core_ready'
              ? 'Integrate 10 Salvaged Parts & Restore Power'
              : this.narrativeStage === 'salvage'
                ? this.sortieBriefed
                  ? `Review Target ${targetIdx}/10 Study Briefing`
                  : `Study Target ${targetIdx}/10 Briefing (Required)`
                : 'Receive Earth HQ Priority Transmission',
          effectText:
            this.narrativeStage === 'core_ready'
              ? 'Restores 100% Asaar Power Core'
              : this.narrativeStage === 'salvage'
                ? this.sortieBriefed
                  ? 'Waypoint active on Moon'
                  : 'Unlocks single surface target & 3D arrow'
                : 'Emergency Base Briefing',
        } as InteractiveTerminal;
      }
    }

    const pos = this.controlMode === 'rover' ? this.roverPos : this.playerPos;
    const canUseAirlock =
      this.mode === 'playing' &&
      ((this.environmentZone === 'interior' &&
        this.playerPos.z >= 8.4 &&
        Math.abs(this.playerPos.x) <= 2.6) ||
        (this.environmentZone === 'surface' && Math.hypot(pos.x, pos.z - 13.3) <= 4.0));

    const canBoardRover =
      this.mode === 'playing' &&
      this.environmentZone === 'surface' &&
      this.controlMode === 'foot' &&
      Math.hypot(this.playerPos.x - this.roverPos.x, this.playerPos.z - this.roverPos.z) <= 4.4;

    const nearbyArt = this.mode === 'playing' ? this.findNearbyArtifact() : null;

    const artifactsSnapshot = this.baseData.artifacts.map((a) => {
      const dx = a.position.x - pos.x;
      const dz = a.position.z - pos.z;
      const dist = Math.round(Math.hypot(dx, dz));
      const angle = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
      return {
        id: a.id,
        kind: a.kind,
        name: a.name,
        mission: a.mission,
        year: a.year,
        agency: a.agency,
        country: a.country,
        partCategory: a.partCategory,
        description: a.description,
        realHistory: a.realHistory,
        failureReason: a.failureReason,
        missionSignificance: a.missionSignificance,
        coordLabel: a.coordLabel,
        studyBullets: a.studyBullets,
        quizzes: a.quizzes,
        collected: a.collected,
        distanceMeters: dist,
        bearingDeg: Math.round(angle),
      };
    });

    const collectedCount = artifactsSnapshot.filter((a) => a.collected).length;
    const activeTarget =
      this.narrativeStage !== 'restored' &&
      this.narrativeStage !== 'core_ready' &&
      this.activeTargetIndex < artifactsSnapshot.length
        ? artifactsSnapshot[this.activeTargetIndex]
        : null;

    const baseDx = 0 - pos.x;
    const baseDz = 13.3 - pos.z;
    const baseReturnDistanceMeters = Math.round(Math.hypot(baseDx, baseDz));
    const baseReturnBearingDeg = Math.round(((Math.atan2(baseDx, -baseDz) * 180) / Math.PI + 360) % 360);

    this.callbacks.onHudUpdate({
      oxygen: Math.round(this.oxygen),
      energy: Math.round(this.energy),
      pressureKpa: this.environmentZone === 'interior' ? 101 : 0,
      cabinTempC: this.surfaceTempC,
      solarState: this.solarState,
      powerDeltaPerSec: Number(this.powerDeltaPerSec.toFixed(1)),
      frostLevel: Number(this.frostLevel.toFixed(2)),
      sectorName: this.currentSector,
      viewMode: this.viewMode,
      lightingPreset: this.lightingPreset,
      pointerLocked: this.pointerLocked,
      nearbyTerminal: nearbyTerminal
        ? {
            id: nearbyTerminal.id,
            label: nearbyTerminal.label,
            actionLabel: nearbyTerminal.actionLabel,
            effectText: nearbyTerminal.effectText,
          }
        : null,
      statusBanner: this.statusBanner,
      narrativeStage: this.narrativeStage,
      finaleActive: this.finaleActive,
      finalePhase: this.finalePhase,
      finaleElapsed: Number(this.finaleTimer.toFixed(1)),
      transmissionOpen: this.transmissionOpen,
      studyTerminalOpen: this.studyTerminalOpen,
      sortieBriefed: this.sortieBriefed,
      activeTargetIndex: this.activeTargetIndex,
      activeTarget,
      baseReturnDistanceMeters,
      baseReturnBearingDeg,
      environmentZone: this.environmentZone,
      controlMode: this.controlMode,
      artifactsCollected: collectedCount,
      artifactsTotal: artifactsSnapshot.length,
      artifacts: artifactsSnapshot,
      nearbyArtifact: nearbyArt
        ? artifactsSnapshot.find((item) => item.id === nearbyArt.id) ?? null
        : null,
      inspectedArtifact: this.inspectedArtifact
        ? artifactsSnapshot.find((item) => item.id === this.inspectedArtifact!.id) ?? null
        : null,
      canBoardRover,
      canUseAirlock,
      roverSpeedKmh: Math.round(Math.abs(this.roverSpeed) * 3.6),
    });
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateVisualPostProcessing(dt: number, elapsed: number) {
    // Keep 3D sky Sun centered around camera so it behaves as infinitely distant starlight
    if (this.sunSkyGroup) {
      this.sunSkyGroup.position.copy(this.camera.position).addScaledVector(_sunDir, 350);
      this.sunSkyGroup.lookAt(this.camera.position);
    }

    this.camera.updateMatrixWorld();

    // 1. Compute Sun Lens Flare visibility & optical projection
    this.camera.getWorldDirection(_camFwd);
    const sunDot = _camFwd.dot(_sunDir);
    let targetFlare = 0;

    if (sunDot > 0.15) {
      let occluded = false;
      if (this.environmentZone === 'interior') {
        // Inside Asaar, only allow lens flare if looking through the North Panoramic Window
        if (this.camera.position.z > -0.3 || _sunDir.z >= -0.05) {
          occluded = true;
        } else {
          const tWin = (-7.75 - this.camera.position.z) / _sunDir.z;
          if (tWin <= 0) {
            occluded = true;
          } else {
            const wx = this.camera.position.x + _sunDir.x * tWin;
            const wy = this.camera.position.y + _sunDir.y * tWin;
            if (Math.abs(wx) > 6.6 || wy < 0.9 || wy > 4.0) {
              occluded = true;
            }
          }
        }
      } else {
        // Exterior terrain line-of-sight occlusion check against crater rims
        const cx = this.camera.position.x;
        const cy = this.camera.position.y;
        const cz = this.camera.position.z;
        const checkSteps = [5, 12, 22, 36];
        for (let i = 0; i < checkSteps.length; i++) {
          const t = checkSteps[i];
          const sx = cx + _sunDir.x * t;
          const sy = cy + _sunDir.y * t;
          const sz = cz + _sunDir.z * t;
          if (getLunarSurfaceHeight(sx, sz) > sy) {
            occluded = true;
            break;
          }
        }
      }

      if (!occluded) {
        targetFlare = Math.pow(THREE.MathUtils.clamp((sunDot - 0.15) / 0.85, 0, 1), 2.1);
      }
    }

    this.currentFlareStrength = THREE.MathUtils.damp(this.currentFlareStrength, targetFlare, 10, dt);

    if (this.currentFlareStrength > 0.01 && this.flareElements.length > 0) {
      _sunWorldPos.copy(this.camera.position).addScaledVector(_sunDir, 350);
      _sunNdc.copy(_sunWorldPos).project(this.camera);

      // Camera basis vectors in world space for placing optical flare elements in camera plane
      _camRight.setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
      _camUp.setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();
      const flareDist = 1.25;
      const halfH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)) * flareDist;
      const halfW = halfH * this.camera.aspect;

      for (let i = 0; i < this.flareElements.length; i++) {
        const el = this.flareElements[i];
        // Interpolate from Sun NDC through screen center (0,0) and opposite side
        const ndcX = _sunNdc.x * (1 - el.axisFactor);
        const ndcY = _sunNdc.y * (1 - el.axisFactor);

        _flarePos
          .copy(this.camera.position)
          .addScaledVector(_camFwd, flareDist)
          .addScaledVector(_camRight, ndcX * halfW)
          .addScaledVector(_camUp, ndcY * halfH);

        el.mesh.visible = true;
        el.mesh.position.copy(_flarePos);
        el.mesh.quaternion.copy(this.camera.quaternion);
        const s = el.baseScale * flareDist * (0.85 + 0.3 * this.currentFlareStrength);
        el.mesh.scale.set(s, s, 1);
        el.mat.opacity = el.baseOpacity * this.currentFlareStrength;
      }
    } else {
      for (let i = 0; i < this.flareElements.length; i++) {
        this.flareElements[i].mesh.visible = false;
      }
    }

    // 2. Update WebGL Frost Vignette Shader when battery power is low or freezing in crater shadows
    const lowPowerFrost =
      this.narrativeStage === 'restored' || this.mode === 'title'
        ? 0
        : THREE.MathUtils.clamp((45 - this.energy) / 42, 0, 1);
    const coldShadowBoost =
      this.solarState === 'shadow' && this.energy < 65 && this.mode === 'playing'
        ? THREE.MathUtils.clamp((65 - this.energy) / 65, 0, 1) * 0.28
        : 0;
    const targetFrost = THREE.MathUtils.clamp(lowPowerFrost + coldShadowBoost, 0, 1);
    this.frostLevel = THREE.MathUtils.damp(this.frostLevel, targetFrost, 4.5, dt);

    if (this.frostMesh) {
      this.frostMesh.visible = this.frostLevel > 0.008;
      this.frostUniforms.uFrost.value = this.frostLevel;
      this.frostUniforms.uTime.value = elapsed;
      this.frostUniforms.uAspect.value = this.camera.aspect || 1.77;
    }
  }

  private tick = () => {
    if (this.disposed) return;
    if (this.renderingPaused) {
      this.clock.getDelta();
      if (this.isSoftwareGl) {
        this.frameId = window.setTimeout(this.tick, 120);
      } else {
        this.frameId = requestAnimationFrame(this.tick);
      }
      return;
    }
    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    const elapsed = this.clock.elapsedTime;

    this.updateLightingAndNarrative(dt, elapsed);
    this.updateParticlesAndWorld(dt, elapsed);

    if (this.mode === 'title') {
      this.updateTitleCamera(elapsed, dt);
    } else if (this.mode === 'playing') {
      this.updatePlaying(dt, elapsed);
    }

    this.updateVisualPostProcessing(dt, elapsed);
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindEvents();
    this.exitPointerLockSafe();
    this.audio.dispose();
    this.baseData.dispose();
    this.postDisposables.forEach((d) => d.dispose());
    this.textures.dispose();
    this.envRT.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
