import * as THREE from 'three';

const poleMat = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.6,
    metalness: 0.8
});

const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffffee,
    emissive: 0xffffee,
    emissiveIntensity: 1.0
});

const redMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.8 });
const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.8 });
const greenMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.8 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
const bollardMat = new THREE.MeshStandardMaterial({ color: 0x00d4ff, emissive: 0x00d4ff, emissiveIntensity: 0.8 });

export function createStreetLight(scene, x, z, rotationY = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    // Pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 8, 8), poleMat);
    pole.position.y = 4;
    group.add(pole);

    // Arm
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2, 8), poleMat);
    arm.position.set(1, 7.8, 0);
    arm.rotation.z = Math.PI / 2;
    group.add(arm);

    // Light fixture
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.5), poleMat);
    fixture.position.set(2, 7.8, 0);
    group.add(fixture);

    // Bulb glow (visual only, actual lighting is globally handled for perf or baked via PMREM)
    const bulb = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), lightMat);
    bulb.rotation.x = Math.PI / 2;
    bulb.position.set(2, 7.69, 0);
    group.add(bulb);

    scene.add(group);
    return pole; // return for collision
}

export function createTrafficLight(scene, x, z, rotationY = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    // Pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 6, 8), poleMat);
    pole.position.y = 3;
    group.add(pole);

    // Arm
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4, 8), poleMat);
    arm.position.set(2, 5.8, 0);
    arm.rotation.z = Math.PI / 2;
    group.add(arm);

    // Box
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), frameMat);
    box.position.set(3.5, 5.8, 0);
    group.add(box);

    const lR = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), redMat);
    lR.position.set(3.5, 6.3, 0.26);
    group.add(lR);

    const lY = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), yellowMat);
    lY.position.set(3.5, 5.8, 0.26);
    group.add(lY);

    const lG = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), greenMat);
    lG.position.set(3.5, 5.3, 0.26);
    group.add(lG);

    scene.add(group);
    return pole;
}

export function createBollard(scene, x, z) {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.2, 8), bollardMat);
    bollard.position.set(x, 0.6, z);
    scene.add(bollard);
    return bollard;
}

// ── Petrol Pump Materials ─────────────────────────────────────────────────
const pumpBodyMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, metalness: 0.3 });
const pumpAccentMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.3, metalness: 0.2 });
const pumpDarkMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.5 });
const screenMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 0.6 });
const canopyMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.3, metalness: 0.4 });
const signMat = new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff2200, emissiveIntensity: 0.9 });
const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.7 });
const concreteMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.95, metalness: 0.0 });

/**
 * Creates a detailed petrol/gas pump station with canopy and signage.
 * @param {THREE.Scene} scene
 * @param {number} x - World X
 * @param {number} z - World Z
 * @param {number} [rotationY=0] - Rotation around Y axis
 * @returns {THREE.Mesh} - The base slab for collision
 */
export function createPetrolPump(scene, x, z, rotationY = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    // ── Concrete base slab ────────────────────────────────────────────────
    const base = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 8), concreteMat);
    base.position.y = 0.15;
    base.receiveShadow = true;
    group.add(base);

    // ── Island (raised platform for pumps) ────────────────────────────────
    const island = new THREE.Mesh(new THREE.BoxGeometry(8, 0.25, 2), concreteMat);
    island.position.set(0, 0.42, 0);
    island.receiveShadow = true;
    group.add(island);

    // ── Dispenser units (2 pumps side by side) ────────────────────────────
    for (let dx = -2; dx <= 2; dx += 4) {
        const dispenserGroup = new THREE.Group();
        dispenserGroup.position.set(dx, 0.55, 0);

        // Main body
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 0.8), pumpBodyMat);
        body.position.y = 1.2;
        dispenserGroup.add(body);

        // Red accent strip (brand stripe)
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.2, 0.82), pumpAccentMat);
        stripe.position.y = 2.2;
        dispenserGroup.add(stripe);

        // Digital screen
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), screenMat);
        screen.position.set(0, 1.8, 0.41);
        dispenserGroup.add(screen);

        // Screen on back side
        const screenBack = screen.clone();
        screenBack.position.set(0, 1.8, -0.41);
        screenBack.rotation.y = Math.PI;
        dispenserGroup.add(screenBack);

        // Nozzle holder (side bump)
        const holderBase = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.3), pumpDarkMat);
        holderBase.position.set(0.68, 1.4, 0);
        dispenserGroup.add(holderBase);

        // Nozzle (hanging hose representation)
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.5, 8), nozzleMat);
        nozzle.position.set(0.68, 0.9, 0);
        nozzle.rotation.z = 0.3;
        dispenserGroup.add(nozzle);

        // Hose (curved cylinder)
        const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8), nozzleMat);
        hose.position.set(0.72, 1.1, 0);
        hose.rotation.z = -0.2;
        dispenserGroup.add(hose);

        group.add(dispenserGroup);
    }

    // ── Canopy (overhead shelter) ─────────────────────────────────────────
    // Four pillars
    const pillarPositions = [
        [-6, 0, -3], [6, 0, -3],
        [-6, 0, 3], [6, 0, 3]
    ];
    pillarPositions.forEach(([px, , pz]) => {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 7, 8), poleMat);
        pillar.position.set(px, 3.5, pz);
        group.add(pillar);
    });

    // Canopy roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 8), canopyMat);
    roof.position.y = 7.1;
    roof.castShadow = true;
    roof.receiveShadow = true;
    group.add(roof);

    // Roof edge trim (red accent)
    const trimFront = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.3, 0.15), pumpAccentMat);
    trimFront.position.set(0, 7.0, 4.0);
    group.add(trimFront);
    const trimBack = trimFront.clone();
    trimBack.position.set(0, 7.0, -4.0);
    group.add(trimBack);

    // ── Brand sign on canopy front ────────────────────────────────────────
    const sign = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 0.2), signMat);
    sign.position.set(0, 8.0, 4.1);
    group.add(sign);

    // Sign on back
    const signBack = sign.clone();
    signBack.position.set(0, 8.0, -4.1);
    group.add(signBack);

    // ── Undercanopy lights (subtle glow strips) ───────────────────────────
    const stripLight = new THREE.Mesh(new THREE.BoxGeometry(12, 0.08, 0.08), lightMat);
    stripLight.position.set(0, 6.88, 0);
    group.add(stripLight);

    scene.add(group);
    return base; // return for collision
}

// ── Road Infrastructure Materials ─────────────────────────────────────────
const barrierMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.85 });
const barrierStripeMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 0.3 });
const signWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
const signRedMat = new THREE.MeshStandardMaterial({ color: 0xdd0000, emissive: 0xdd0000, emissiveIntensity: 0.3 });
const fenceMetalMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6, metalness: 0.4 });
const fenceWireMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.7, metalness: 0.3, wireframe: true });

/**
 * Creates a jersey-style concrete road barrier.
 * @param {number} length - Total length of the barrier segment
 */
export function createRoadBarrier(scene, x, z, length = 10, rotationY = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    // Main barrier body (tapered profile approximated with a box)
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, length), barrierMat);
    barrier.position.y = 0.45;
    group.add(barrier);

    // Top bevel
    const topBevel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, length), barrierMat);
    topBevel.position.y = 0.97;
    group.add(topBevel);

    // Reflective orange stripes
    const stripeCount = Math.floor(length / 3);
    for (let i = 0; i < stripeCount; i++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.15, 0.6), barrierStripeMat);
        stripe.position.set(0, 0.7, -length / 2 + 1.5 + i * 3);
        group.add(stripe);
    }

    scene.add(group);
    return barrier;
}

/**
 * Creates a traffic sign (stop, yield, speed) on a pole.
 * @param {'stop'|'yield'|'speed'} type - Type of sign
 */
export function createTrafficSign(scene, x, z, type = 'stop', rotationY = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    // Pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), poleMat);
    pole.position.y = 2;
    group.add(pole);

    // Sign face
    let signMesh;
    if (type === 'stop') {
        // Octagonal stop sign (approximated with cylinder)
        signMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 8), signRedMat);
        signMesh.rotation.x = Math.PI / 2;
        signMesh.position.set(0, 3.8, 0);
    } else if (type === 'yield') {
        // Triangle yield sign
        signMesh = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.6, 3), signWhiteMat);
        signMesh.rotation.x = Math.PI / 2;
        signMesh.position.set(0, 3.8, 0);
    } else {
        // Speed limit sign (rectangle)
        signMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.05), signWhiteMat);
        signMesh.position.set(0, 3.8, 0);
        // Red border ring
        const border = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 16), signRedMat);
        border.rotation.x = Math.PI / 2;
        border.position.set(0, 3.8, 0);
        group.add(border);
    }
    group.add(signMesh);

    scene.add(group);
    return pole;
}

/**
 * Creates a chain-link fence segment.
 * @param {number} length - Length of the fence segment
 */
export function createFence(scene, x, z, length = 10, rotationY = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    const fenceHeight = 2;

    // Posts at each end and middle
    const postCount = Math.max(2, Math.floor(length / 4) + 1);
    const spacing = length / (postCount - 1);

    for (let i = 0; i < postCount; i++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, fenceHeight, 6), fenceMetalMat);
        post.position.set(0, fenceHeight / 2, -length / 2 + i * spacing);
        group.add(post);
    }

    // Top rail
    const topRail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, length, 6), fenceMetalMat);
    topRail.position.set(0, fenceHeight, 0);
    topRail.rotation.x = Math.PI / 2;
    group.add(topRail);

    // Bottom rail
    const bottomRail = topRail.clone();
    bottomRail.position.y = 0.15;
    group.add(bottomRail);

    // Wire mesh panel (using wireframe material for chain-link look)
    const wire = new THREE.Mesh(new THREE.PlaneGeometry(length, fenceHeight, Math.floor(length), 8), fenceWireMat);
    wire.position.y = fenceHeight / 2;
    wire.rotation.y = Math.PI / 2;
    group.add(wire);

    scene.add(group);

    // Return a simple collider
    const collider = new THREE.Mesh(new THREE.BoxGeometry(0.3, fenceHeight, length));
    collider.position.set(x, fenceHeight / 2, z);
    collider.rotation.y = rotationY;
    collider.visible = false;
    scene.add(collider);
    return collider;
}
