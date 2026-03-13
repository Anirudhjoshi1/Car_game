import * as THREE from 'three';

const roadMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2e,
    roughness: 0.8,
    metalness: 0.1,
});

const markingMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x333333,
    emissiveIntensity: 0.5,
});

const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0x888888,
    roughness: 0.9,
    metalness: 0.05,
});

/**
 * Creates standard road pieces with dashed center lines and side lines.
 * Width is typically 12.
 */
export function createRoadStretch(scene, x, y, z, width, length, rotation, addCrosswalk = false) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotation;

    // Main asphalt - slightly raised from ground to prevent Z-fighting
    const road = new THREE.Mesh(new THREE.PlaneGeometry(width, length), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.02; // Raise above ground plane
    road.receiveShadow = true;
    group.add(road);

    // Center dashed lines (raised above road)
    for (let l = -length / 2 + 5; l < length / 2 - 5; l += 6) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 2.5), markingMat);
        dash.position.set(0, 0.04, l);
        group.add(dash);
    }

    // Solid edge lines (raised above road)
    const leftEdge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, length), markingMat);
    leftEdge.position.set(-width / 2 + 0.5, 0.04, 0);
    group.add(leftEdge);

    const rightEdge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, length), markingMat);
    rightEdge.position.set(width / 2 - 0.5, 0.04, 0);
    group.add(rightEdge);

    // Sidewalks
    const sidewalkWidth = 4;
    const walkL = new THREE.Mesh(new THREE.BoxGeometry(sidewalkWidth, 0.2, length), sidewalkMat);
    walkL.position.set(-width / 2 - sidewalkWidth / 2, 0.1, 0);
    walkL.receiveShadow = true;
    group.add(walkL);

    const walkR = new THREE.Mesh(new THREE.BoxGeometry(sidewalkWidth, 0.2, length), sidewalkMat);
    walkR.position.set(width / 2 + sidewalkWidth / 2, 0.1, 0);
    walkR.receiveShadow = true;
    group.add(walkR);

    // Raised curbs between road and sidewalk
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.9 });
    const curbL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, length), curbMat);
    curbL.position.set(-width / 2 - 0.15, 0.125, 0);
    group.add(curbL);

    const curbR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, length), curbMat);
    curbR.position.set(width / 2 + 0.15, 0.125, 0);
    group.add(curbR);

    // Optional crosswalk at the ends
    if (addCrosswalk) {
        createCrosswalk(group, 0, length / 2 - 2, width);
    }

    scene.add(group);
}

/**
 * Creates an intersection square.
 */
export function createIntersection(scene, x, y, z, size) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Asphalt square - also raised to match roads, maybe slightly higher
    const intersection = new THREE.Mesh(new THREE.PlaneGeometry(size, size), roadMat);
    intersection.rotation.x = -Math.PI / 2;
    intersection.position.y = 0.025; // Slightly above road pieces if they overlap
    intersection.receiveShadow = true;
    group.add(intersection);

    // Crosswalks on all 4 sides
    const offset = size / 2 - 2;
    createCrosswalk(group, 0, offset, size, 0);
    createCrosswalk(group, 0, -offset, size, 0);
    createCrosswalk(group, offset, 0, size, Math.PI / 2);
    createCrosswalk(group, -offset, 0, size, Math.PI / 2);

    scene.add(group);
}

function createCrosswalk(parent, x, z, width, rotationY = 0) {
    const numStripes = Math.floor(width / 1.5);
    const startX = -width / 2 + 0.75;

    for (let i = 0; i < numStripes; i++) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 3), markingMat);
        stripe.position.set(x + startX + i * 1.5, 0.04, z); // Match road line height
        stripe.rotation.y = rotationY;
        parent.add(stripe);
    }
}
