import * as THREE from 'three';

function setAnisotropy(tex: THREE.Texture, maxAniso: number) {
  tex.anisotropy = Math.max(1, Math.min(8, maxAniso));
}

export interface ProceduralTextureSet {
  deckColor: THREE.CanvasTexture;
  deckRoughness: THREE.CanvasTexture;
  hullColor: THREE.CanvasTexture;
  hullRoughness: THREE.CanvasTexture;
  regolithColor: THREE.CanvasTexture;
  earthColor: THREE.CanvasTexture;
  earthClouds: THREE.CanvasTexture;
  dustParticle: THREE.CanvasTexture;
  holoTransmission: THREE.CanvasTexture;
  holoRestored: THREE.CanvasTexture;
  flareMain: THREE.CanvasTexture;
  flareGhost: THREE.CanvasTexture;
  consoleScreens: Record<'lifeSupport' | 'powerGrid' | 'lunarSurvey' | 'airlock', THREE.CanvasTexture>;
  dispose: () => void;
}

function createDeckFloorTextures(maxAniso: number) {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  // Base slate titanium deck
  cCtx.fillStyle = '#252d3a';
  cCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#9a9a9a';
  rCtx.fillRect(0, 0, size, size);

  // Subtle tile grid (2x2 panels per tile)
  const half = size / 2;
  for (let gx = 0; gx < 2; gx++) {
    for (let gy = 0; gy < 2; gy++) {
      const ox = gx * half;
      const oy = gy * half;

      cCtx.fillStyle = (gx + gy) % 2 === 0 ? '#2b3443' : '#27303e';
      cCtx.fillRect(ox + 6, oy + 6, half - 12, half - 12);

      rCtx.fillStyle = (gx + gy) % 2 === 0 ? '#787878' : '#858585';
      rCtx.fillRect(ox + 6, oy + 6, half - 12, half - 12);

      // Chamfered inner frame
      cCtx.strokeStyle = '#181e28';
      cCtx.lineWidth = 4;
      cCtx.strokeRect(ox + 4, oy + 4, half - 8, half - 8);

      // Subtle micro-traction dots
      cCtx.fillStyle = '#364154';
      rCtx.fillStyle = '#555555';
      for (let ix = 28; ix < half - 20; ix += 24) {
        for (let iy = 28; iy < half - 20; iy += 24) {
          cCtx.fillRect(ox + ix, oy + iy, 4, 4);
          rCtx.fillRect(ox + ix, oy + iy, 4, 4);
        }
      }

      // Corner rivets
      cCtx.fillStyle = '#4e5d73';
      const inset = 16;
      const corners = [
        [ox + inset, oy + inset],
        [ox + half - inset, oy + inset],
        [ox + inset, oy + half - inset],
        [ox + half - inset, oy + half - inset],
      ];
      for (const [rx, ry] of corners) {
        cCtx.beginPath();
        cCtx.arc(rx, ry, 3, 0, Math.PI * 2);
        cCtx.fill();
      }
    }
  }

  // Subtle cyan guide line accent along tile seam
  cCtx.fillStyle = 'rgba(56, 189, 248, 0.25)';
  cCtx.fillRect(0, half - 2, size, 4);

  const deckColor = new THREE.CanvasTexture(colorCanvas);
  deckColor.colorSpace = THREE.SRGBColorSpace;
  deckColor.wrapS = THREE.RepeatWrapping;
  deckColor.wrapT = THREE.RepeatWrapping;
  deckColor.repeat.set(5, 5);
  setAnisotropy(deckColor, maxAniso);

  const deckRoughness = new THREE.CanvasTexture(roughCanvas);
  deckRoughness.wrapS = THREE.RepeatWrapping;
  deckRoughness.wrapT = THREE.RepeatWrapping;
  deckRoughness.repeat.set(5, 5);
  setAnisotropy(deckRoughness, maxAniso);

  return { deckColor, deckRoughness };
}

function createHullPanelTextures(maxAniso: number) {
  const size = 512;
  const cCanvas = document.createElement('canvas');
  cCanvas.width = size;
  cCanvas.height = size;
  const cCtx = cCanvas.getContext('2d')!;

  const rCanvas = document.createElement('canvas');
  rCanvas.width = size;
  rCanvas.height = size;
  const rCtx = rCanvas.getContext('2d')!;

  cCtx.fillStyle = '#d8e0eb';
  cCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#707070';
  rCtx.fillRect(0, 0, size, size);

  // Clean sci-fi bulkhead seams
  cCtx.strokeStyle = '#9aa8bc';
  cCtx.lineWidth = 4;
  cCtx.strokeRect(8, 8, size - 16, size - 16);

  cCtx.fillStyle = '#c4cfde';
  cCtx.fillRect(16, 16, size - 32, 64);
  cCtx.fillRect(16, size - 80, size - 32, 64);

  rCtx.fillStyle = '#9e9e9e';
  rCtx.fillRect(16, 16, size - 32, 64);
  rCtx.fillRect(16, size - 80, size - 32, 64);

  // Subtle technical stencil lines
  cCtx.fillStyle = '#6f829c';
  cCtx.fillRect(36, 42, 72, 6);
  cCtx.fillRect(120, 42, 24, 6);
  cCtx.fillStyle = '#38bdf8';
  cCtx.fillRect(size - 96, 42, 48, 6);

  // Louver vent slits
  cCtx.fillStyle = '#536278';
  for (let y = size - 68; y < size - 28; y += 10) {
    cCtx.fillRect(size - 160, y, 110, 4);
  }

  const hullColor = new THREE.CanvasTexture(cCanvas);
  hullColor.colorSpace = THREE.SRGBColorSpace;
  hullColor.wrapS = THREE.RepeatWrapping;
  hullColor.wrapT = THREE.RepeatWrapping;
  setAnisotropy(hullColor, maxAniso);

  const hullRoughness = new THREE.CanvasTexture(rCanvas);
  hullRoughness.wrapS = THREE.RepeatWrapping;
  hullRoughness.wrapT = THREE.RepeatWrapping;
  setAnisotropy(hullRoughness, maxAniso);

  return { hullColor, hullRoughness };
}

function createConsoleScreen(
  variant: 'lifeSupport' | 'powerGrid' | 'lunarSurvey' | 'airlock',
  maxAniso: number,
) {
  const w = 512;
  const h = 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Deep blueprint cyan screen backdrop
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#041427');
  grad.addColorStop(1, '#072442');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle scanlines
  ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
  for (let y = 0; y < h; y += 6) {
    ctx.fillRect(0, y, w, 2);
  }

  // Outer telemetry frame
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, w - 24, h - 24);

  // Header bar
  ctx.fillStyle = 'rgba(14, 165, 233, 0.25)';
  ctx.fillRect(16, 16, w - 32, 34);
  ctx.fillStyle = '#bae6fd';
  ctx.font = 'bold 18px monospace';

  const titles: Record<typeof variant, string> = {
    lifeSupport: 'ATMOS // O2 SCRUBBER ARRAY',
    powerGrid: 'SOLAR // CAPACITOR BUS 04',
    lunarSurvey: 'SELENOGRAPHY // MARE TRANQ',
    airlock: 'AIRLOCK // PRESSURE SEAL',
  };
  ctx.fillText(titles[variant], 26, 39);

  // Right status tag
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(w - 118, 22, 86, 22);
  ctx.fillStyle = '#041427';
  ctx.font = 'bold 13px monospace';
  ctx.fillText('ONLINE', w - 101, 38);

  if (variant === 'lifeSupport') {
    // O2 Sine wave + scrubber bars
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 28; x < 290; x += 6) {
      const y = 145 + Math.sin(x * 0.05) * 34 + Math.cos(x * 0.11) * 12;
      if (x === 28) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Vertical tank bars
    const levels = [0.85, 0.72, 0.91, 0.64];
    levels.forEach((lvl, idx) => {
      const bx = 320 + idx * 42;
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, 74, 26, 160);
      ctx.fillStyle = '#38bdf8';
      const fillH = Math.round(154 * lvl);
      ctx.fillRect(bx + 3, 74 + (157 - fillH), 20, fillH);
    });

    ctx.fillStyle = '#93c5fd';
    ctx.font = '14px monospace';
    ctx.fillText('CABIN O2: 20.9%  |  101.3 kPa', 28, 272);
  } else if (variant === 'powerGrid') {
    // Concentric capacitor arc
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(140, 168, 72, Math.PI * 0.8, Math.PI * 2.1);
    ctx.stroke();

    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(140, 168, 52, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('94 kW', 102, 176);

    // Bus bars
    for (let i = 0; i < 5; i++) {
      const by = 82 + i * 36;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.fillRect(250, by, 224, 20);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(250, by, 130 + ((i * 37) % 85), 20);
    }
  } else if (variant === 'lunarSurvey') {
    // Crater contour rings + Earth telemetry vector
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2;
    for (let r = 24; r <= 96; r += 24) {
      ctx.beginPath();
      ctx.arc(150, 172, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(40, 172);
    ctx.lineTo(260, 172);
    ctx.moveTo(150, 66);
    ctx.lineTo(150, 278);
    ctx.stroke();

    ctx.fillStyle = '#7dd3fc';
    ctx.font = '14px monospace';
    ctx.fillText('LAT: 0.674 N', 290, 108);
    ctx.fillText('LON: 23.473 E', 290, 136);
    ctx.fillText('RAD: 0.14 mSv/d', 290, 164);
    ctx.fillText('EARTH LINK: NOMINAL', 290, 204);
  } else {
    // Airlock seal schematic
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(42, 82, 176, 176);
    ctx.strokeRect(72, 112, 116, 116);
    ctx.beginPath();
    ctx.moveTo(42, 82);
    ctx.lineTo(72, 112);
    ctx.moveTo(218, 82);
    ctx.lineTo(188, 112);
    ctx.moveTo(42, 258);
    ctx.lineTo(72, 228);
    ctx.moveTo(218, 258);
    ctx.lineTo(188, 228);
    ctx.stroke();

    ctx.fillStyle = '#bae6fd';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('SEAL LOCKED', 260, 128);
    ctx.font = '14px monospace';
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText('EXT: 0.00 kPa', 260, 164);
    ctx.fillText('INT: 101.3 kPa', 260, 192);
    ctx.fillText('PRESS [E] SYNC', 260, 232);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  setAnisotropy(tex, maxAniso);
  return tex;
}

function createLunarRegolithTexture(maxAniso: number) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#727883';
  ctx.fillRect(0, 0, size, size);

  // Deterministic pseudo-random regolith speckles & micro-craters
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 2400; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1 + rand() * 3.5;
    const v = Math.floor(85 + rand() * 65);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 28; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 8 + rand() * 24;
    ctx.fillStyle = 'rgba(42, 46, 54, 0.35)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(175, 182, 195, 0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  setAnisotropy(tex, maxAniso);
  return tex;
}

function createEarthTextures(maxAniso: number) {
  const w = 1024;
  const h = 512;

  // Color map
  const cCanvas = document.createElement('canvas');
  cCanvas.width = w;
  cCanvas.height = h;
  const cCtx = cCanvas.getContext('2d')!;

  const oceanGrad = cCtx.createLinearGradient(0, 0, 0, h);
  oceanGrad.addColorStop(0, '#c8e4fa');
  oceanGrad.addColorStop(0.1, '#1d5da8');
  oceanGrad.addColorStop(0.5, '#0b3c7d');
  oceanGrad.addColorStop(0.9, '#1a549c');
  oceanGrad.addColorStop(1, '#dceefe');
  cCtx.fillStyle = oceanGrad;
  cCtx.fillRect(0, 0, w, h);

  // Stylized low-poly friendly continental landmasses
  const drawContinent = (points: [number, number][], fill: string) => {
    cCtx.fillStyle = fill;
    cCtx.beginPath();
    points.forEach(([px, py], idx) => {
      if (idx === 0) cCtx.moveTo(px * w, py * h);
      else cCtx.lineTo(px * w, py * h);
    });
    cCtx.closePath();
    cCtx.fill();
  };

  // Americas
  drawContinent(
    [
      [0.18, 0.2], [0.28, 0.18], [0.32, 0.28], [0.25, 0.39], [0.22, 0.45],
      [0.18, 0.35],
    ],
    '#2f7d4f',
  );
  drawContinent(
    [
      [0.24, 0.46], [0.33, 0.52], [0.36, 0.65], [0.3, 0.81], [0.26, 0.72],
      [0.24, 0.56],
    ],
    '#3a8c5a',
  );
  // Eurasia + Africa
  drawContinent(
    [
      [0.48, 0.22], [0.68, 0.17], [0.81, 0.25], [0.78, 0.43], [0.66, 0.46],
      [0.54, 0.38], [0.47, 0.33],
    ],
    '#357e52',
  );
  drawContinent(
    [
      [0.49, 0.39], [0.61, 0.42], [0.63, 0.58], [0.56, 0.74], [0.5, 0.62],
      [0.47, 0.48],
    ],
    '#9a8453',
  );
  // Australia
  drawContinent(
    [
      [0.75, 0.58], [0.84, 0.59], [0.85, 0.69], [0.77, 0.71],
    ],
    '#a37548',
  );

  // Cloud layer texture
  const clCanvas = document.createElement('canvas');
  clCanvas.width = w;
  clCanvas.height = h;
  const clCtx = clCanvas.getContext('2d')!;
  clCtx.clearRect(0, 0, w, h);

  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 110; i++) {
    const cx = rand() * w;
    const cy = 40 + rand() * (h - 80);
    const rx = 24 + rand() * 75;
    const ry = 8 + rand() * 20;
    clCtx.fillStyle = `rgba(255, 255, 255, ${0.22 + rand() * 0.38})`;
    clCtx.beginPath();
    clCtx.ellipse(cx, cy, rx, ry, (rand() - 0.5) * 0.4, 0, Math.PI * 2);
    clCtx.fill();
  }

  const earthColor = new THREE.CanvasTexture(cCanvas);
  earthColor.colorSpace = THREE.SRGBColorSpace;
  setAnisotropy(earthColor, maxAniso);

  const earthClouds = new THREE.CanvasTexture(clCanvas);
  earthClouds.colorSpace = THREE.SRGBColorSpace;
  setAnisotropy(earthClouds, maxAniso);

  return { earthColor, earthClouds };
}

function createDustParticleTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(225, 242, 255, 1)');
  grad.addColorStop(0.35, 'rgba(180, 224, 255, 0.65)');
  grad.addColorStop(1, 'rgba(120, 190, 255, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHoloBannerTexture(mode: 'transmission' | 'restored', maxAniso: number) {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const isAlert = mode === 'transmission';
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, isAlert ? 'rgba(69, 10, 10, 0.92)' : 'rgba(6, 28, 52, 0.92)');
  grad.addColorStop(1, isAlert ? 'rgba(15, 23, 42, 0.92)' : 'rgba(12, 74, 110, 0.92)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Scanlines
  ctx.fillStyle = isAlert ? 'rgba(248, 113, 113, 0.08)' : 'rgba(56, 189, 248, 0.08)';
  for (let y = 0; y < h; y += 6) {
    ctx.fillRect(0, y, w, 2);
  }

  ctx.strokeStyle = isAlert ? '#ef4444' : '#38bdf8';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  ctx.fillStyle = isAlert ? '#ef4444' : '#38bdf8';
  ctx.fillRect(18, 18, w - 36, 40);

  ctx.fillStyle = '#090d16';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(
    isAlert ? 'INCOMING // EARTH HQ PRIORITY' : 'ASAAR // POWER CORE ONLINE',
    30,
    45,
  );

  ctx.fillStyle = isAlert ? '#fecaca' : '#bae6fd';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(
    isAlert ? 'CORE FAILURE: SALVAGE PROTOCOL' : 'FUSION BUS NOMINAL: 100%',
    30,
    102,
  );

  ctx.fillStyle = isAlert ? '#fca5a5' : '#7dd3fc';
  ctx.font = '16px monospace';
  ctx.fillText(
    isAlert ? 'DEPLOY ROVER VIA SOUTH AIRLOCK' : '10/10 HISTORICAL PARTS INTEGRATED',
    30,
    144,
  );
  ctx.fillText(
    isAlert ? 'RECOVER 10 HISTORICAL PARTS [E]' : 'LIFE SUPPORT & GRID STABILIZED',
    30,
    174,
  );

  // Signal waveform bars
  for (let i = 0; i < 18; i++) {
    const bh = 10 + Math.abs(Math.sin(i * 0.7)) * 28;
    ctx.fillStyle = isAlert ? '#f87171' : '#38bdf8';
    ctx.fillRect(32 + i * 25, 228 - bh, 14, bh);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  setAnisotropy(tex, maxAniso);
  return tex;
}

function createFlareMainTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;

  // Soft solar corona bloom
  const radial = ctx.createRadialGradient(c, c, 2, c, c, c);
  radial.addColorStop(0, 'rgba(255, 255, 245, 1.0)');
  radial.addColorStop(0.14, 'rgba(255, 244, 200, 0.88)');
  radial.addColorStop(0.4, 'rgba(253, 186, 116, 0.28)');
  radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, size, size);

  // Horizontal anamorphic streak
  const streak = ctx.createLinearGradient(0, c, size, c);
  streak.addColorStop(0, 'rgba(125, 211, 252, 0)');
  streak.addColorStop(0.32, 'rgba(186, 230, 253, 0.25)');
  streak.addColorStop(0.5, 'rgba(255, 252, 235, 0.72)');
  streak.addColorStop(0.68, 'rgba(186, 230, 253, 0.25)');
  streak.addColorStop(1, 'rgba(125, 211, 252, 0)');
  ctx.fillStyle = streak;
  ctx.fillRect(0, c - 3, size, 6);

  // Crisp 6-point optical diffraction rays
  ctx.save();
  ctx.translate(c, c);
  for (let i = 0; i < 3; i++) {
    ctx.rotate(Math.PI / 3);
    const ray = ctx.createLinearGradient(-c, 0, c, 0);
    ray.addColorStop(0, 'rgba(255, 248, 225, 0)');
    ray.addColorStop(0.5, 'rgba(255, 250, 235, 0.45)');
    ray.addColorStop(1, 'rgba(255, 248, 225, 0)');
    ctx.fillStyle = ray;
    ctx.fillRect(-c * 0.9, -1.5, c * 1.8, 3);
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createFlareGhostTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;

  const grad = ctx.createRadialGradient(c, c, c * 0.25, c, c, c * 0.95);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
  grad.addColorStop(0.62, 'rgba(125, 211, 252, 0.16)');
  grad.addColorStop(0.84, 'rgba(251, 191, 36, 0.34)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const px = c + Math.cos(ang) * (c * 0.92);
    const py = c + Math.sin(ang) * (c * 0.92);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createProceduralTextures(renderer: THREE.WebGLRenderer): ProceduralTextureSet {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const { deckColor, deckRoughness } = createDeckFloorTextures(maxAniso);
  const { hullColor, hullRoughness } = createHullPanelTextures(maxAniso);
  const regolithColor = createLunarRegolithTexture(maxAniso);
  const { earthColor, earthClouds } = createEarthTextures(maxAniso);
  const dustParticle = createDustParticleTexture();
  const holoTransmission = createHoloBannerTexture('transmission', maxAniso);
  const holoRestored = createHoloBannerTexture('restored', maxAniso);
  const flareMain = createFlareMainTexture();
  const flareGhost = createFlareGhostTexture();

  const consoleScreens = {
    lifeSupport: createConsoleScreen('lifeSupport', maxAniso),
    powerGrid: createConsoleScreen('powerGrid', maxAniso),
    lunarSurvey: createConsoleScreen('lunarSurvey', maxAniso),
    airlock: createConsoleScreen('airlock', maxAniso),
  };

  return {
    deckColor,
    deckRoughness,
    hullColor,
    hullRoughness,
    regolithColor,
    earthColor,
    earthClouds,
    dustParticle,
    holoTransmission,
    holoRestored,
    flareMain,
    flareGhost,
    consoleScreens,
    dispose: () => {
      deckColor.dispose();
      deckRoughness.dispose();
      hullColor.dispose();
      hullRoughness.dispose();
      regolithColor.dispose();
      earthColor.dispose();
      earthClouds.dispose();
      dustParticle.dispose();
      holoTransmission.dispose();
      holoRestored.dispose();
      flareMain.dispose();
      flareGhost.dispose();
      Object.values(consoleScreens).forEach((t) => t.dispose());
    },
  };
}
