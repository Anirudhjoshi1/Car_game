import * as THREE from 'three';

function createBuildingTextures() {
    const colorCanvas = document.createElement('canvas');
    const roughCanvas = document.createElement('canvas');
    const metalCanvas = document.createElement('canvas');
    const size = 512;
    colorCanvas.width = roughCanvas.width = metalCanvas.width = size;
    colorCanvas.height = roughCanvas.height = metalCanvas.height = size;
    const colorCtx = colorCanvas.getContext('2d');
    const roughCtx = roughCanvas.getContext('2d');
    const metalCtx = metalCanvas.getContext('2d');

    colorCtx.fillStyle = '#222222'; colorCtx.fillRect(0, 0, size, size);
    roughCtx.fillStyle = '#ffffff'; roughCtx.fillRect(0, 0, size, size);
    metalCtx.fillStyle = '#000000'; metalCtx.fillRect(0, 0, size, size);

    const cols = 8;
    const rows = 12;
    const padX = 6;
    const padY = 6;
    const winW = (size / cols) - padX * 2;
    const winH = (size / rows) - padY * 2;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = c * (size / cols) + padX;
            const y = r * (size / rows) + padY;
            const isLit = Math.random() > 0.8;
            colorCtx.fillStyle = isLit ? '#455060' : '#0c1218';
            colorCtx.fillRect(x, y, winW, winH);
            roughCtx.fillStyle = '#050505';
            roughCtx.fillRect(x, y, winW, winH);
            metalCtx.fillStyle = '#eeeeee';
            metalCtx.fillRect(x, y, winW, winH);
        }
    }

    const createTex = (canvas, isColor = false) => {
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = 4;
        if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    };

    return {
        colorMap: createTex(colorCanvas, true),
        roughMap: createTex(roughCanvas),
        metalMap: createTex(metalCanvas)
    };
}

const { colorMap, roughMap, metalMap } = createBuildingTextures();

const matTopBottom = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 1.0,
    metalness: 0.0
});

const baseBuildingMat = new THREE.MeshStandardMaterial({
    map: colorMap,
    roughnessMap: roughMap,
    metalnessMap: metalMap,
    envMapIntensity: 2.0
});

export function createSkyscraper(scene, x, z, w, h, d) {
    const rx = w / 6;
    const ry = h / 6;
    const rz = d / 6;

    const matLeftRight = baseBuildingMat.clone();
    matLeftRight.map = matLeftRight.map.clone();
    matLeftRight.roughnessMap = matLeftRight.roughnessMap.clone();
    matLeftRight.metalnessMap = matLeftRight.metalnessMap.clone();
    [matLeftRight.map, matLeftRight.roughnessMap, matLeftRight.metalnessMap].forEach(m => m.repeat.set(rz, ry));

    const matFrontBack = baseBuildingMat.clone();
    matFrontBack.map = matFrontBack.map.clone();
    matFrontBack.roughnessMap = matFrontBack.roughnessMap.clone();
    matFrontBack.metalnessMap = matFrontBack.metalnessMap.clone();
    [matFrontBack.map, matFrontBack.roughnessMap, matFrontBack.metalnessMap].forEach(m => m.repeat.set(rx, ry));

    const materials = [matLeftRight, matLeftRight, matTopBottom, matTopBottom, matFrontBack, matFrontBack];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
}

const houseMats = [
    new THREE.MeshStandardMaterial({ color: 0xddddcc, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0xc4a484, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0xa9c4bd, roughness: 0.9 }),
];
const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 });

export function createHouse(scene, x, z, w, h, d, rotationY = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    // Garden/Yard Base
    const yardW = w * 1.6;
    const yardD = d * 1.6;
    const yardMat = new THREE.MeshStandardMaterial({ color: 0x3d5a32, roughness: 1.0 }); // Grass color
    const yard = new THREE.Mesh(new THREE.BoxGeometry(yardW, 0.1, yardD), yardMat);
    yard.position.y = 0.05;
    yard.receiveShadow = true;
    group.add(yard);

    // House Base
    const baseMat = houseMats[Math.floor(Math.random() * houseMats.length)];
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), baseMat);
    base.position.y = h / 2 + 0.1;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Premium Sloped Roof with Overhang
    // Using a cylinder with 4 radial segments looks like a pyramid/sloped roof
    const roofH = h * 0.7;
    const roofGeom = new THREE.CylinderGeometry(0, Math.max(w, d) * 0.8, roofH, 4);
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.y = h + roofH / 2 + 0.1;
    roof.rotation.y = Math.PI / 4; // Align the 4 corners to the house edges
    roof.castShadow = true;
    roof.receiveShadow = true;
    group.add(roof);

    // Chimney
    const chimneyGeom = new THREE.BoxGeometry(w * 0.2, roofH * 0.8, d * 0.2);
    const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x8b3a3a, roughness: 0.9 }); // Brick red
    const chimney = new THREE.Mesh(chimneyGeom, chimneyMat);
    chimney.position.set(w * 0.25, h + roofH * 0.6, -d * 0.1);
    chimney.castShadow = true;
    group.add(chimney);

    // Front Door (Wooden)
    const doorW = w * 0.25;
    const doorH = h * 0.5;
    const doorGeom = new THREE.BoxGeometry(doorW, doorH, 0.05);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8 }); // Dark wood
    const door = new THREE.Mesh(doorGeom, doorMat);
    door.position.set(0, doorH / 2 + 0.1, d / 2 + 0.01);
    group.add(door);

    // Windows
    const windowGeom = new THREE.BoxGeometry(w * 0.2, h * 0.3, 0.05);
    const litWindowMat = new THREE.MeshStandardMaterial({ color: 0xffeebb, emissive: 0xffcc77, emissiveIntensity: 0.6, roughness: 0.1 });
    const darkWindowMat = new THREE.MeshStandardMaterial({ color: 0x112233, roughness: 0.1 });

    // Front windows (left and right of door)
    for (const side of [-1, 1]) {
        if (Math.random() > 0.2) { // 80% chance to have a window
            const winMat = Math.random() > 0.5 ? litWindowMat : darkWindowMat;
            const window = new THREE.Mesh(windowGeom, winMat);
            window.position.set(side * w * 0.3, h * 0.5 + 0.1, d / 2 + 0.01);
            group.add(window);
        }
    }

    // Garden Railing / Fence (Picket fence style)
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0xdcdcdc, roughness: 0.8 }); // White wood
    const postGeom = new THREE.BoxGeometry(0.1, 0.6, 0.1);
    const railGeomZ = new THREE.BoxGeometry(0.05, 0.1, yardD);
    const railGeomX = new THREE.BoxGeometry(yardW, 0.1, 0.05);

    // Corner Posts
    const corners = [
        [yardW / 2 - 0.05, yardD / 2 - 0.05],
        [-yardW / 2 + 0.05, yardD / 2 - 0.05],
        [yardW / 2 - 0.05, -yardD / 2 + 0.05],
        [-yardW / 2 + 0.05, -yardD / 2 + 0.05]
    ];
    corners.forEach(([cz, cx]) => {
        const post = new THREE.Mesh(postGeom, fenceMat);
        post.position.set(cz, 0.3, cx);
        group.add(post);
    });

    // Side Railings (Horizontal bars)
    for (const side of [-1, 1]) {
        const hRail = new THREE.Mesh(railGeomZ, fenceMat);
        hRail.position.set(side * (yardW / 2 - 0.05), 0.4, 0);
        group.add(hRail);

        const hRail2 = new THREE.Mesh(railGeomZ, fenceMat);
        hRail2.position.set(side * (yardW / 2 - 0.05), 0.2, 0);
        group.add(hRail2);

        // Back railing
        const bRail = new THREE.Mesh(railGeomX, fenceMat);
        bRail.position.set(0, 0.4, -yardD / 2 + 0.05);
        group.add(bRail);

        const bRail2 = new THREE.Mesh(railGeomX, fenceMat);
        bRail2.position.set(0, 0.2, -yardD / 2 + 0.05);
        group.add(bRail2);

        // Front railing (leaving a gap for the driveway/path)
        const fRailGeom = new THREE.BoxGeometry(yardW * 0.3, 0.1, 0.05);
        const fRail = new THREE.Mesh(fRailGeom, fenceMat);
        fRail.position.set(side * (yardW * 0.35), 0.4, yardD / 2 - 0.05);
        group.add(fRail);

        const fRail2 = new THREE.Mesh(fRailGeom, fenceMat);
        fRail2.position.set(side * (yardW * 0.35), 0.2, yardD / 2 - 0.05);
        group.add(fRail2);
    }

    scene.add(group);

    // Create a bounding box for simple collision covering the whole yard
    const collider = new THREE.Mesh(new THREE.BoxGeometry(yardW, h + roofH, yardD));
    collider.position.set(x, (h + roofH) / 2, z);
    collider.rotation.y = rotationY;
    collider.visible = false;
    scene.add(collider);

    return collider;
}

// ── Shared Materials for City Buildings ────────────────────────────────────
const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 0.7 });
const brickMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.1, metalness: 0.5, opacity: 0.6, transparent: true });
const accentRedMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0xcc2222, emissiveIntensity: 0.5 });
const accentGreenMat = new THREE.MeshStandardMaterial({ color: 0x22aa44, roughness: 0.8 });
const awningMat = new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.6, side: THREE.DoubleSide });
const concreteMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.95 });
const signGlowMat = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 0.8 });
const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8 });
const blueMat = new THREE.MeshStandardMaterial({ color: 0x2266cc, roughness: 0.6 });
const yellowMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.6 });

/**
 * Creates a small restaurant/cafe with awning, outdoor seating, and a glowing sign.
 */
export function createRestaurant(scene, x, z, rotationY = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    const w = 14, h = 6, d = 10;

    // Main building body
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), brickMat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Flat roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.3, d + 0.5), concreteMat);
    roof.position.y = h + 0.15;
    group.add(roof);

    // Front awning
    const awning = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.15, 3), awningMat);
    awning.position.set(0, h * 0.65, d / 2 + 1.5);
    awning.rotation.x = -0.15;
    group.add(awning);

    // Front glass windows
    const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, h * 0.4), glassMat);
    frontGlass.position.set(0, h * 0.45, d / 2 + 0.01);
    group.add(frontGlass);

    // Front door
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3, 0.1), darkWoodMat);
    door.position.set(0, 1.5, d / 2 + 0.01);
    group.add(door);

    // Outdoor tables (2 tables with chairs)
    for (let tx = -3; tx <= 3; tx += 6) {
        const table = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.5), darkWoodMat);
        table.position.set(tx, 1.0, d / 2 + 4);
        group.add(table);

        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), concreteMat);
        leg.position.set(tx, 0.5, d / 2 + 4);
        group.add(leg);

        // Two chairs per table
        for (const cz of [-1.2, 1.2]) {
            const chair = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.1), darkWoodMat);
            chair.position.set(tx, 0.6, d / 2 + 4 + cz);
            group.add(chair);
        }
    }

    // Glowing "OPEN" sign
    const sign = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 0.1), signGlowMat);
    sign.position.set(0, h * 0.85, d / 2 + 0.02);
    group.add(sign);

    scene.add(group);

    // Collision box
    const collider = new THREE.Mesh(new THREE.BoxGeometry(w + 2, h, d + 6));
    collider.position.set(x, h / 2, z);
    collider.rotation.y = rotationY;
    collider.visible = false;
    scene.add(collider);
    return collider;
}

/**
 * Creates a hospital building with red cross sign, entrance canopy, and ambulance bay.
 */
export function createHospital(scene, x, z, rotationY = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    const w = 24, h = 14, d = 18;

    // Main building
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), whiteMat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Blue accent band
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 1, d + 0.1), blueMat);
    band.position.y = h - 0.5;
    group.add(band);

    // Flat roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.4, d + 0.5), concreteMat);
    roof.position.y = h + 0.2;
    group.add(roof);

    // Rooftop helipad marker (flat H)
    const helipad = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.1, 16), concreteMat);
    helipad.position.y = h + 0.35;
    group.add(helipad);
    const hMark = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.3), yellowMat);
    hMark.position.y = h + 0.42;
    group.add(hMark);
    const hLeft = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 2), yellowMat);
    hLeft.position.set(-0.6, h + 0.42, 0);
    group.add(hLeft);
    const hRight = hLeft.clone();
    hRight.position.set(0.6, h + 0.42, 0);
    group.add(hRight);

    // Red cross on front
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 0.15), accentRedMat);
    crossH.position.set(0, h * 0.75, d / 2 + 0.01);
    group.add(crossH);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3, 0.15), accentRedMat);
    crossV.position.set(0, h * 0.75, d / 2 + 0.01);
    group.add(crossV);

    // Windows grid (front face)
    const winMat = new THREE.MeshStandardMaterial({ color: 0x88bbdd, roughness: 0.1 });
    for (let row = 0; row < 3; row++) {
        for (let col = -3; col <= 3; col++) {
            if (col === 0 && row === 0) continue; // door space
            const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), winMat);
            win.position.set(col * 3, 2.5 + row * 4, d / 2 + 0.02);
            group.add(win);
        }
    }

    // Entrance canopy
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 4), concreteMat);
    canopy.position.set(0, 4, d / 2 + 2);
    group.add(canopy);

    // Canopy pillars
    for (const px of [-3.5, 3.5]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4, 8), concreteMat);
        pillar.position.set(px, 2, d / 2 + 3.5);
        group.add(pillar);
    }

    // Front doors (glass)
    const glDoor = new THREE.Mesh(new THREE.BoxGeometry(3, 3.5, 0.1), glassMat);
    glDoor.position.set(0, 1.75, d / 2 + 0.01);
    group.add(glDoor);

    // Ambulance bay (side)
    const bayRoof = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 5), concreteMat);
    bayRoof.position.set(-w / 2 - 3, 4, -d / 4);
    group.add(bayRoof);

    scene.add(group);

    const collider = new THREE.Mesh(new THREE.BoxGeometry(w + 2, h, d + 4));
    collider.position.set(x, h / 2, z);
    collider.rotation.y = rotationY;
    collider.visible = false;
    scene.add(collider);
    return collider;
}

/**
 * Creates a school building with flag, playground fence, and colored accents.
 */
export function createSchool(scene, x, z, rotationY = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    const w = 20, h = 8, d = 14;

    // Main building
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf5e6cc, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Roof
    const schoolRoof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.4, d + 1), accentGreenMat);
    schoolRoof.position.y = h + 0.2;
    group.add(schoolRoof);

    // Colorful accent stripe under roof
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.5, d + 0.1), yellowMat);
    stripe.position.y = h - 0.25;
    group.add(stripe);

    // Windows - 2 rows
    const schoolWinMat = new THREE.MeshStandardMaterial({ color: 0x99ccee, roughness: 0.1 });
    for (let row = 0; row < 2; row++) {
        for (let col = -3; col <= 3; col++) {
            if (col === 0 && row === 0) continue;
            const win = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.5), schoolWinMat);
            win.position.set(col * 2.5, 2.5 + row * 3.5, d / 2 + 0.01);
            group.add(win);
        }
    }

    // Front entrance
    const entrance = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.5), accentGreenMat);
    entrance.position.set(0, 2, d / 2 + 0.25);
    group.add(entrance);

    const eDoor = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.1), darkWoodMat);
    eDoor.position.set(0, 1.5, d / 2 + 0.51);
    group.add(eDoor);

    // Flag pole
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.3 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 10, 6), poleMat);
    pole.position.set(w / 2 + 2, 5, d / 2);
    group.add(pole);

    // Flag (plane)
    const flagMat = new THREE.MeshStandardMaterial({ color: 0xff6633, side: THREE.DoubleSide, roughness: 0.6 });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.2), flagMat);
    flag.position.set(w / 2 + 3, 9.5, d / 2);
    group.add(flag);

    // Playground fence (front yard)
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.7 });
    const playW = w + 4;
    const playD = 8;
    // Surrounding low fence
    for (const [fx, fz, fw, fd] of [
        [0, d / 2 + playD, playW, 0.1],
        [-playW / 2, d / 2 + playD / 2, 0.1, playD],
        [playW / 2, d / 2 + playD / 2, 0.1, playD]
    ]) {
        const fencePost = new THREE.Mesh(new THREE.BoxGeometry(fw, 1.2, fd), fenceMat);
        fencePost.position.set(fx, 0.6, fz);
        group.add(fencePost);
    }

    // Playground colored equipment (simple shapes)
    const slide = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3), yellowMat);
    slide.position.set(-4, 1, d / 2 + 5);
    slide.rotation.x = -0.3;
    group.add(slide);

    const swing = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 0.1), fenceMat);
    swing.position.set(4, 1.25, d / 2 + 5);
    group.add(swing);

    scene.add(group);

    const collider = new THREE.Mesh(new THREE.BoxGeometry(playW, h, d + playD));
    collider.position.set(x, h / 2, z);
    collider.rotation.y = rotationY;
    collider.visible = false;
    scene.add(collider);
    return collider;
}

/**
 * Creates a small commercial shop with display window and signage.
 */
export function createShop(scene, x, z, rotationY = 0) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = rotationY;

    const w = 8, h = 5, d = 8;

    // Randomly pick wall color
    const wallColors = [0xd4a574, 0xb8c9d4, 0xc9b8d4, 0xd4b8b8];
    const wallMat = new THREE.MeshStandardMaterial({
        color: wallColors[Math.floor(Math.random() * wallColors.length)],
        roughness: 0.8
    });

    // Main body
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Flat roof with slight overhang
    const shopRoof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.3, d + 0.8), concreteMat);
    shopRoof.position.y = h + 0.15;
    group.add(shopRoof);

    // Large display window
    const displayWin = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, h * 0.5), glassMat);
    displayWin.position.set(w * 0.15, h * 0.45, d / 2 + 0.01);
    group.add(displayWin);

    // Door
    const shopDoor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.8, 0.1), darkWoodMat);
    shopDoor.position.set(-w * 0.25, 1.4, d / 2 + 0.01);
    group.add(shopDoor);

    // Sign board above
    const signColors = [0xff4444, 0x44aaff, 0xff8844, 0x44ff88];
    const shopSignMat = new THREE.MeshStandardMaterial({
        color: signColors[Math.floor(Math.random() * signColors.length)],
        emissive: signColors[Math.floor(Math.random() * signColors.length)],
        emissiveIntensity: 0.5
    });
    const shopSign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1, 0.1), shopSignMat);
    shopSign.position.set(0, h - 0.2, d / 2 + 0.15);
    group.add(shopSign);

    // Small awning
    const shopAwning = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 0.1, 1.5), awningMat);
    shopAwning.position.set(0, h * 0.58, d / 2 + 0.75);
    shopAwning.rotation.x = -0.1;
    group.add(shopAwning);

    scene.add(group);

    const collider = new THREE.Mesh(new THREE.BoxGeometry(w, h, d));
    collider.position.set(x, h / 2, z);
    collider.rotation.y = rotationY;
    collider.visible = false;
    scene.add(collider);
    return collider;
}
