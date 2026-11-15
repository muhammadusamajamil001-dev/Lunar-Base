import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  ChevronLeft,
  ChevronRight,
  Landmark,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { createArtifactMeshGroup } from '../engine/lunarSurfaceObjects';
import { SalvageArtifactInfo } from '../types/game';

interface ArtifactArchiveModalProps {
  open: boolean;
  artifacts: SalvageArtifactInfo[];
  onClose: () => void;
}

function detectSoftwareWebGL(): boolean {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
}

export const ArtifactArchiveModal: React.FC<ArtifactArchiveModalProps> = ({
  open,
  artifacts,
  onClose,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const autoRotateRef = useRef(true);
  const orbitStateRef = useRef({ yaw: 0.55, pitch: 0.34, dist: 3.35 });
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const artifactRootRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const modelDisposablesRef = useRef<Array<{ dispose: () => void }>>([]);

  autoRotateRef.current = autoRotate;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.code === 'ArrowRight') {
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, artifacts.length));
      } else if (e.code === 'ArrowLeft') {
        setSelectedIndex(
          (prev) => (prev - 1 + Math.max(1, artifacts.length)) % Math.max(1, artifacts.length),
        );
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, artifacts.length, onClose]);

  // Dedicated 3D Turntable Renderer Lifecycle
  useEffect(() => {
    if (!open) return;
    const mount = canvasMountRef.current;
    if (!mount) return;

    const isSoft = detectSoftwareWebGL();
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoft,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(isSoft ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth || 420, mount.clientHeight || 380);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      42,
      (mount.clientWidth || 420) / (mount.clientHeight || 380),
      0.1,
      50,
    );

    const studioDisposables: Array<{ dispose: () => void }> = [];
    const trackStudio = <T extends { dispose: () => void }>(item: T): T => {
      studioDisposables.push(item);
      return item;
    };

    // Crisp Museum 3-Point Studio Lighting
    scene.add(new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.95));

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.35);
    keyLight.position.set(3.5, 5.2, 4.2);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.45);
    rimLight.position.set(-4.2, 2.6, -3.5);
    scene.add(rimLight);

    const warmFill = new THREE.PointLight(0xfbbf24, 1.35, 10);
    warmFill.position.set(2.4, 0.8, -2.5);
    scene.add(warmFill);

    // Holographic Exhibition Pedestal & Orbital Compass Rings
    const pedestalGroup = new THREE.Group();
    scene.add(pedestalGroup);

    const baseDisk = new THREE.Mesh(
      trackStudio(new THREE.CylinderGeometry(1.42, 1.56, 0.14, 32)),
      trackStudio(
        new THREE.MeshStandardMaterial({
          color: 0x0b1628,
          roughness: 0.35,
          metalness: 0.78,
        }),
      ),
    );
    baseDisk.position.y = -0.07;
    pedestalGroup.add(baseDisk);

    const glowRingMat = trackStudio(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 2.0,
        roughness: 0.2,
      }),
    );
    const innerRing = new THREE.Mesh(
      trackStudio(new THREE.TorusGeometry(1.36, 0.02, 8, 48)),
      glowRingMat,
    );
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.01;
    pedestalGroup.add(innerRing);

    const outerRing = new THREE.Mesh(
      trackStudio(new THREE.TorusGeometry(1.75, 0.014, 8, 56)),
      trackStudio(
        new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          emissive: 0xf59e0b,
          emissiveIntensity: 1.5,
          transparent: true,
          opacity: 0.75,
        }),
      ),
    );
    outerRing.rotation.x = Math.PI / 2;
    outerRing.position.y = -0.02;
    pedestalGroup.add(outerRing);

    const artifactRoot = new THREE.Group();
    artifactRoot.position.y = 0.02;
    scene.add(artifactRoot);
    artifactRootRef.current = artifactRoot;

    const handleResize = () => {
      const w = mount.clientWidth || 420;
      const h = mount.clientHeight || 380;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObs = new ResizeObserver(handleResize);
    resizeObs.observe(mount);

    let frameId = 0;
    let prevTime = performance.now();
    let disposed = false;

    const renderLoop = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - prevTime) / 1000, 0.05);
      prevTime = now;

      if (autoRotateRef.current && !dragRef.current.active) {
        orbitStateRef.current.yaw += dt * 0.55;
      }

      outerRing.rotation.z += dt * 0.25;

      const { yaw, pitch, dist } = orbitStateRef.current;
      const cosP = Math.cos(pitch);
      camera.position.set(
        Math.sin(yaw) * cosP * dist,
        0.65 + Math.sin(pitch) * dist,
        Math.cos(yaw) * cosP * dist,
      );
      camera.lookAt(0, 0.65, 0);

      renderer.render(scene, camera);
      if (isSoft) {
        frameId = window.setTimeout(renderLoop, 48);
      } else {
        frameId = requestAnimationFrame(renderLoop);
      }
    };

    frameId = requestAnimationFrame(renderLoop);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObs.disconnect();
      modelDisposablesRef.current.forEach((d) => d.dispose());
      modelDisposablesRef.current = [];
      studioDisposables.forEach((d) => d.dispose());
      artifactRootRef.current = null;
      sceneRef.current = null;
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [open]);

  // Swap 3D Artifact Mesh whenever selectedIndex changes
  useEffect(() => {
    if (!open) return;
    const root = artifactRootRef.current;
    const selected = artifacts[selectedIndex];
    if (!root || !selected) return;

    while (root.children.length > 0) {
      root.remove(root.children[0]);
    }
    modelDisposablesRef.current.forEach((d) => d.dispose());
    modelDisposablesRef.current = [];

    const meshGroup = createArtifactMeshGroup(selected.kind, modelDisposablesRef.current);
    // Center bounding box cleanly on the museum turntable
    const box = new THREE.Box3().setFromObject(meshGroup);
    const center = new THREE.Vector3();
    box.getCenter(center);
    meshGroup.position.set(-center.x, -box.min.y + 0.04, -center.z);
    root.add(meshGroup);
  }, [open, selectedIndex, artifacts]);

  if (!open || artifacts.length === 0) return null;
  const selected = artifacts[selectedIndex] ?? artifacts[0];

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[#020612]/90 p-3 sm:p-5 text-slate-100 select-none">
      <div className="relative flex h-full max-h-[90vh] w-full max-w-6xl flex-col rounded-lg border border-sky-400/50 bg-[#040d1d] shadow-2xl overflow-hidden">
        {/* Corner Reticles */}
        <span className="pointer-events-none absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-sky-400" />
        <span className="pointer-events-none absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-sky-400" />
        <span className="pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-amber-400" />
        <span className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-amber-400" />

        {/* Archive Header */}
        <div className="flex items-center justify-between gap-4 border-b border-sky-400/25 bg-[#061227] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded border border-amber-400/45 bg-amber-500/15">
              <Landmark className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <div className="text-[10px] font-mono font-bold tracking-widest text-amber-300">
                LUNAR HISTORY ARCHIVE // MUSEUM MODE
              </div>
              <h2 className="text-base sm:text-lg font-mono font-bold text-slate-50">
                ASAAR COMPLETED MISSION REPOSITORY (10 HISTORIC ARTIFACTS)
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Completed Mission Archive"
            className="inline-flex items-center gap-1.5 rounded border border-slate-600/80 bg-slate-900/80 px-3 py-1.5 text-xs font-mono text-slate-200 hover:border-sky-400 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
            CLOSE (ESC)
          </button>
        </div>

        {/* 3-Column Archive Body */}
        <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-12">
          {/* Left Rail: 10 Historic Artifacts Selector */}
          <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-sky-400/20 bg-[#050f20] p-3 overflow-y-auto">
            <div className="mb-2 px-1 text-[10px] font-mono font-bold tracking-widest text-sky-400">
              SELECT ARTIFACT ({String(selectedIndex + 1).padStart(2, '0')}/10)
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
              {artifacts.map((art, idx) => {
                const active = idx === selectedIndex;
                return (
                  <button
                    key={art.id}
                    type="button"
                    onClick={() => setSelectedIndex(idx)}
                    className={`flex items-start gap-2.5 rounded border px-2.5 py-2 text-left font-mono transition-colors cursor-pointer ${
                      active
                        ? 'border-sky-400/80 bg-sky-500/18 text-white'
                        : 'border-slate-800/80 bg-[#071326] text-slate-300 hover:border-sky-400/40'
                    }`}
                  >
                    <span
                      className={`mt-0.5 text-[10px] font-bold tabular-nums ${
                        active ? 'text-amber-300' : 'text-sky-400/75'
                      }`}
                    >
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-bold leading-tight">
                        {art.mission}
                      </div>
                      <div className="truncate text-[10px] text-slate-400">
                        {art.year} · {art.country}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Center Stage: Interactive 3D Turntable Viewer */}
          <div className="lg:col-span-5 relative flex flex-col border-b lg:border-b-0 lg:border-r border-sky-400/20 bg-[#030916]">
            <div className="flex items-center justify-between px-4 pt-3 text-[10px] font-mono tracking-widest text-sky-300">
              <span>3D HOLOGRAPHIC TURNTABLE // DRAG TO ROTATE · SCROLL TO ZOOM</span>
              <span className="text-amber-300">{selected.coordLabel}</span>
            </div>

            <div
              ref={canvasMountRef}
              onMouseDown={(e) => {
                dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
              }}
              onMouseMove={(e) => {
                if (!dragRef.current.active) return;
                const dx = e.clientX - dragRef.current.lastX;
                const dy = e.clientY - dragRef.current.lastY;
                dragRef.current.lastX = e.clientX;
                dragRef.current.lastY = e.clientY;
                orbitStateRef.current.yaw += dx * 0.01;
                orbitStateRef.current.pitch = THREE.MathUtils.clamp(
                  orbitStateRef.current.pitch + dy * 0.008,
                  0.05,
                  1.15,
                );
              }}
              onMouseUp={() => {
                dragRef.current.active = false;
              }}
              onMouseLeave={() => {
                dragRef.current.active = false;
              }}
              onWheel={(e) => {
                orbitStateRef.current.dist = THREE.MathUtils.clamp(
                  orbitStateRef.current.dist + e.deltaY * 0.0025,
                  2.1,
                  5.2,
                );
              }}
              className="relative flex-1 min-h-[260px] sm:min-h-[320px] cursor-grab active:cursor-grabbing"
            />

            {/* Turntable Controls */}
            <div className="flex items-center justify-between gap-2 border-t border-sky-400/20 bg-[#050e1e] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutoRotate((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded border border-sky-400/40 bg-sky-500/15 px-2.5 py-1 text-[11px] font-mono text-sky-200 hover:bg-sky-500/25 cursor-pointer"
                >
                  {autoRotate ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  {autoRotate ? 'Pause Spin' : 'Auto Spin'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    orbitStateRef.current = { yaw: 0.55, pitch: 0.34, dist: 3.35 };
                  }}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-600/70 bg-slate-800/80 px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:border-sky-400/50 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset View
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedIndex((prev) => (prev - 1 + artifacts.length) % artifacts.length)
                  }
                  className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800 px-2.5 py-1 text-[11px] font-mono text-slate-200 hover:border-sky-400 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIndex((prev) => (prev + 1) % artifacts.length)}
                  className="inline-flex items-center gap-1 rounded border border-slate-600 bg-slate-800 px-2.5 py-1 text-[11px] font-mono text-slate-200 hover:border-sky-400 cursor-pointer"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: Bullet-Point Historical Facts & Dossier */}
          <div className="lg:col-span-4 flex flex-col overflow-y-auto bg-[#061124] p-4 sm:p-5 space-y-4">
            <div className="border-b border-sky-400/25 pb-3">
              <div className="text-[10px] font-mono font-bold tracking-widest text-amber-300">
                {selected.partCategory}
              </div>
              <h3 className="mt-1 text-base sm:text-lg font-mono font-bold text-white leading-snug">
                {selected.name}
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-mono">
                <span className="rounded border border-sky-400/40 bg-sky-500/15 px-2 py-0.5 text-sky-200">
                  {selected.mission}
                </span>
                <span className="rounded border border-slate-600/70 bg-slate-800/80 px-2 py-0.5 text-slate-200">
                  {selected.year}
                </span>
                <span className="rounded border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-200">
                  {selected.agency}
                </span>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-widest text-sky-300">
                <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                HISTORICAL BULLET SUMMARY
              </div>
              <ul className="space-y-1.5">
                {selected.studyBullets.map((b) => (
                  <li
                    key={b.label}
                    className="rounded border border-sky-400/20 bg-[#081730] px-3 py-2 font-mono"
                  >
                    <div
                      className={`text-[9px] font-bold tracking-widest ${
                        b.label === 'FAILURE CAUSE'
                          ? 'text-rose-300'
                          : b.label === 'SALVAGE USE'
                            ? 'text-emerald-300'
                            : 'text-sky-300'
                      }`}
                    >
                      {b.label}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-100 leading-snug">{b.value}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2 text-xs leading-relaxed text-slate-300">
              <div className="rounded border border-slate-700/70 bg-[#050d1d] p-3">
                <div className="mb-1 text-[10px] font-mono font-bold tracking-widest text-sky-300">
                  ARCHIVAL CONTEXT
                </div>
                <p>{selected.realHistory}</p>
              </div>
              <div className="rounded border border-rose-500/30 bg-[#170914] p-3">
                <div className="mb-1 text-[10px] font-mono font-bold tracking-widest text-rose-300">
                  MISSION END / FAILURE MODE
                </div>
                <p>{selected.failureReason}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
