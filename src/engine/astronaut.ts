import * as THREE from 'three';

export interface AstronautRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  visorMesh: THREE.Mesh;
  backpackLight: THREE.Mesh;
  setFirstPersonHidden: (hidden: boolean) => void;
  updateAnimation: (
    speedNorm: number,
    isGrounded: boolean,
    elapsed: number,
    dt: number,
    onFootstep: () => void,
  ) => void;
}

export function createAstronaut(): AstronautRig {
  const root = new THREE.Group();
  root.name = 'AstronautRoot';

  const bodyPivot = new THREE.Group();
  bodyPivot.position.y = 0;
  root.add(bodyPivot);

  // Materials with varied roughness/metalness (> 0.25 roughness spread)
  const suitWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xe6ecf5,
    roughness: 0.58,
    metalness: 0.12,
    flatShading: true,
  });

  const suitSlateMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.72,
    metalness: 0.25,
    flatShading: true,
  });

  const trimBlueMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.4,
    metalness: 0.35,
    flatShading: true,
  });

  const metalJointMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.28,
    metalness: 0.85,
    flatShading: true,
  });

  const visorMat = new THREE.MeshPhysicalMaterial({
    color: 0xf59e0b,
    emissive: 0x2b1400,
    emissiveIntensity: 0.25,
    roughness: 0.08,
    metalness: 0.9,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });

  const glowCyanMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 2.2,
    roughness: 0.2,
    metalness: 0.1,
  });

  // 1. Pelvis / Belt (bottom-center grounded via leg height = 0.86)
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.28), suitSlateMat);
  pelvis.position.set(0, 0.88, 0);
  pelvis.castShadow = true;
  pelvis.receiveShadow = true;
  bodyPivot.add(pelvis);

  const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.3), trimBlueMat);
  beltBuckle.position.set(0, 0.89, 0);
  bodyPivot.add(beltBuckle);

  // 2. Torso (Chamfered upper chest)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.23, 0.56, 8), suitWhiteMat);
  torso.scale.set(1.05, 1, 0.78);
  torso.position.set(0, 1.24, 0);
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyPivot.add(torso);

  // Chest Telemetry Pack
  const chestPack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.12), suitSlateMat);
  chestPack.position.set(0, 1.28, -0.2);
  chestPack.castShadow = true;
  bodyPivot.add(chestPack);

  const chestStrip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.02), glowCyanMat);
  chestStrip.position.set(0, 1.32, -0.265);
  bodyPivot.add(chestStrip);

  // 3. PLSS Life-Support Backpack
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.52, 0.22), suitWhiteMat);
  backpack.position.set(0, 1.27, 0.24);
  backpack.castShadow = true;
  backpack.receiveShadow = true;
  bodyPivot.add(backpack);

  // Dual O2 Canisters on backpack
  const tankGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.42, 8);
  const leftTank = new THREE.Mesh(tankGeo, metalJointMat);
  leftTank.position.set(-0.1, 1.26, 0.35);
  leftTank.castShadow = true;
  bodyPivot.add(leftTank);

  const rightTank = new THREE.Mesh(tankGeo, metalJointMat);
  rightTank.position.set(0.1, 1.26, 0.35);
  rightTank.castShadow = true;
  bodyPivot.add(rightTank);

  const backpackLight = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.04), glowCyanMat);
  backpackLight.position.set(0, 1.46, 0.35);
  bodyPivot.add(backpackLight);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.32, 6), metalJointMat);
  antenna.position.set(0.14, 1.66, 0.28);
  bodyPivot.add(antenna);

  // 4. Head / Helmet Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.56, 0);
  bodyPivot.add(headGroup);

  const collarRing = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.09, 10), metalJointMat);
  collarRing.position.set(0, 0.03, 0);
  headGroup.add(collarRing);

  const helmetShell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.23, 1), suitWhiteMat);
  helmetShell.position.set(0, 0.21, 0.01);
  helmetShell.castShadow = true;
  headGroup.add(helmetShell);

  // Forward-facing golden optical visor (-Z is forward!)
  const visorMesh = new THREE.Mesh(new THREE.SphereGeometry(0.185, 14, 12), visorMat);
  visorMesh.scale.set(1.05, 0.88, 0.92);
  visorMesh.position.set(0, 0.21, -0.095);
  headGroup.add(visorMesh);

  // 5. Arms (Left & Right)
  const buildArm = (side: -1 | 1) => {
    const armGroup = new THREE.Group();
    armGroup.position.set(side * 0.32, 1.44, 0);

    const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.18), trimBlueMat);
    pauldron.position.set(side * 0.02, -0.02, 0);
    pauldron.castShadow = true;
    armGroup.add(pauldron);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.28, 8), suitWhiteMat);
    upperArm.position.set(side * 0.03, -0.18, 0);
    upperArm.castShadow = true;
    armGroup.add(upperArm);

    const foreArm = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.06, 0.26, 8), suitSlateMat);
    foreArm.position.set(side * 0.03, -0.43, -0.02);
    foreArm.castShadow = true;
    armGroup.add(foreArm);

    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.12), metalJointMat);
    glove.position.set(side * 0.03, -0.58, -0.03);
    glove.castShadow = true;
    armGroup.add(glove);

    bodyPivot.add(armGroup);
    return armGroup;
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // 6. Legs (Left & Right) grounded at y = 0
  const buildLeg = (side: -1 | 1) => {
    const legGroup = new THREE.Group();
    legGroup.position.set(side * 0.13, 0.84, 0);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.36, 8), suitWhiteMat);
    thigh.position.set(0, -0.2, 0);
    thigh.castShadow = true;
    thigh.receiveShadow = true;
    legGroup.add(thigh);

    const kneePad = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.15), trimBlueMat);
    kneePad.position.set(0, -0.39, -0.02);
    legGroup.add(kneePad);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.34, 8), suitWhiteMat);
    shin.position.set(0, -0.56, 0);
    shin.castShadow = true;
    shin.receiveShadow = true;
    legGroup.add(shin);

    // Boot sole touches y = 0 when legGroup is at y = 0.84 -> boot center at -0.78, height 0.12 -> bottom at -0.84 -> world y = 0!
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.24), suitSlateMat);
    boot.position.set(0, -0.78, -0.035);
    boot.castShadow = true;
    boot.receiveShadow = true;
    legGroup.add(boot);

    bodyPivot.add(legGroup);
    return legGroup;
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  let walkPhase = 0;
  let prevSin = 0;

  const setFirstPersonHidden = (hidden: boolean) => {
    headGroup.visible = !hidden;
    torso.visible = !hidden;
    chestPack.visible = !hidden;
    chestStrip.visible = !hidden;
    backpack.visible = !hidden;
    leftTank.visible = !hidden;
    rightTank.visible = !hidden;
    backpackLight.visible = !hidden;
    antenna.visible = !hidden;
    leftArm.visible = !hidden;
    rightArm.visible = !hidden;
    pelvis.visible = !hidden;
    beltBuckle.visible = !hidden;
    leftLeg.visible = !hidden;
    rightLeg.visible = !hidden;
  };

  const updateAnimation = (
    speedNorm: number,
    isGrounded: boolean,
    elapsed: number,
    dt: number,
    onFootstep: () => void,
  ) => {
    if (speedNorm > 0.08 && isGrounded) {
      walkPhase += dt * (4.2 + speedNorm * 4.5);
      const swing = Math.sin(walkPhase) * 0.55 * Math.min(1, speedNorm);

      // Detect zero-crossing for magnetic boot footstep sound
      if ((prevSin < 0 && Math.sin(walkPhase) >= 0) || (prevSin > 0 && Math.sin(walkPhase) <= 0)) {
        onFootstep();
      }
      prevSin = Math.sin(walkPhase);

      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      leftArm.rotation.x = -swing * 0.7;
      rightArm.rotation.x = swing * 0.7;
      bodyPivot.position.y = Math.abs(Math.cos(walkPhase)) * 0.045 * Math.min(1, speedNorm);
      headGroup.rotation.y = Math.sin(walkPhase * 0.5) * 0.04;
    } else if (!isGrounded) {
      // Low-gravity lunar float pose
      leftLeg.rotation.x = THREE.MathUtils.damp(leftLeg.rotation.x, 0.22, 8, dt);
      rightLeg.rotation.x = THREE.MathUtils.damp(rightLeg.rotation.x, -0.18, 8, dt);
      leftArm.rotation.x = THREE.MathUtils.damp(leftArm.rotation.x, -0.32, 8, dt);
      rightArm.rotation.x = THREE.MathUtils.damp(rightArm.rotation.x, -0.25, 8, dt);
      bodyPivot.position.y = THREE.MathUtils.damp(bodyPivot.position.y, 0, 8, dt);
    } else {
      // Subtle idle breathing
      leftLeg.rotation.x = THREE.MathUtils.damp(leftLeg.rotation.x, 0, 10, dt);
      rightLeg.rotation.x = THREE.MathUtils.damp(rightLeg.rotation.x, 0, 10, dt);
      leftArm.rotation.x = THREE.MathUtils.damp(leftArm.rotation.x, Math.sin(elapsed * 1.4) * 0.03, 8, dt);
      rightArm.rotation.x = THREE.MathUtils.damp(rightArm.rotation.x, -Math.sin(elapsed * 1.4) * 0.03, 8, dt);
      bodyPivot.position.y = Math.sin(elapsed * 1.8) * 0.012;
      headGroup.rotation.y = Math.sin(elapsed * 0.7) * 0.05;
    }
  };

  return {
    root,
    bodyPivot,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    visorMesh,
    backpackLight,
    setFirstPersonHidden,
    updateAnimation,
  };
}
