import * as THREE from 'three';
import { createRoadStretch, createIntersection } from './RoadSystem';
import { createStreetLight, createTrafficLight, createBollard, createPetrolPump, createRoadBarrier, createTrafficSign, createFence } from './TrafficProps';
import { createSkyscraper, createHouse, createRestaurant, createHospital, createSchool, createShop } from './Buildings';
import { NatureManager } from './Nature';

/**
 * Creates the massive open-world city game environment.
 * Returns an array of meshes that the car can collide with.
 *
 * Zone Layout (480x480 bounded by highway loop at ±200):
 *   NW (-100→0, -100→0) = Downtown (Skyscrapers, Shops)
 *   NE (0→100, -100→0)  = Commercial (Restaurants, Petrol Pump, Shops)
 *   SW (-100→0, 0→100)  = Residential (Houses, School, Gardens)
 *   SE (0→100, 0→100)   = Medical (Hospital, Park)
 *   East (20→180)        = Central Park (Trees, Gardens)
 *   ±200 Ring            = Highway (Barriers, Speed Signs)
 *   Beyond Highway       = Countryside (Mountains, Grass, Scattered Trees)
 */
export function createEnvironment(scene) {
    const collidables = [];
    const streetLightGroups = [];

    // === Ground Plane ===
    const groundSize = 600;
    const groundGeom = new THREE.PlaneGeometry(groundSize, groundSize);
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x9fa19f,
        roughness: 0.9,
        metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid for scale
    const gridHelper = new THREE.GridHelper(groundSize, 200, 0xaaaaaa, 0x888888);
    gridHelper.position.y = 0.01;
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Initialize Nature manager
    const nature = new NatureManager(scene);

    // ═══════════════════════════════════════════════════════════════════════
    //  ROAD NETWORK
    // ═══════════════════════════════════════════════════════════════════════
    const R_WIDTH = 12;

    // Main intersections (Z axis)
    createIntersection(scene, 0, 0, -100, R_WIDTH);
    createIntersection(scene, 0, 0, 0, R_WIDTH);
    createIntersection(scene, 0, 0, 100, R_WIDTH);

    // Cross intersections (X axis lines)
    createIntersection(scene, -100, 0, 0, R_WIDTH);
    createIntersection(scene, 100, 0, 0, R_WIDTH);

    // Highway perimeter intersections
    createIntersection(scene, -200, 0, -200, R_WIDTH);
    createIntersection(scene, 200, 0, -200, R_WIDTH);
    createIntersection(scene, -200, 0, 200, R_WIDTH);
    createIntersection(scene, 200, 0, 200, R_WIDTH);

    // Central North-South Street
    createRoadStretch(scene, 0, 0, -50, R_WIDTH, 100 - R_WIDTH, 0, true);
    createRoadStretch(scene, 0, 0, 50, R_WIDTH, 100 - R_WIDTH, 0, true);

    // Central East-West Street
    createRoadStretch(scene, -50, 0, 0, R_WIDTH, 100 - R_WIDTH, Math.PI / 2, true);
    createRoadStretch(scene, 50, 0, 0, R_WIDTH, 100 - R_WIDTH, Math.PI / 2, true);

    // Connect to highway perimeter
    createRoadStretch(scene, 0, 0, -150, R_WIDTH, 100 - R_WIDTH, 0, false);
    createRoadStretch(scene, 0, 0, 150, R_WIDTH, 100 - R_WIDTH, 0, false);
    createRoadStretch(scene, -150, 0, 0, R_WIDTH, 100 - R_WIDTH, Math.PI / 2, false);
    createRoadStretch(scene, 150, 0, 0, R_WIDTH, 100 - R_WIDTH, Math.PI / 2, false);

    // Highway loop (outer ring)
    createRoadStretch(scene, 0, 0, -200, R_WIDTH, 400 - R_WIDTH, Math.PI / 2, false);
    createRoadStretch(scene, 0, 0, 200, R_WIDTH, 400 - R_WIDTH, Math.PI / 2, false);
    createRoadStretch(scene, -200, 0, 0, R_WIDTH, 400 - R_WIDTH, 0, false);
    createRoadStretch(scene, 200, 0, 0, R_WIDTH, 400 - R_WIDTH, 0, false);

    // ═══════════════════════════════════════════════════════════════════════
    //  TRAFFIC INFRASTRUCTURE
    // ═══════════════════════════════════════════════════════════════════════

    // Street lights along main central cross
    for (let i = -80; i <= 80; i += 40) {
        if (Math.abs(i) > 10) {
            collidables.push(createStreetLight(scene, 7, i, Math.PI));
            collidables.push(createStreetLight(scene, -7, i, 0));
            collidables.push(createStreetLight(scene, i, 7, -Math.PI / 2));
            collidables.push(createStreetLight(scene, i, -7, Math.PI / 2));
        }
    }

    // Collect street light groups (they are the last added groups in the scene)
    // Each createStreetLight call adds a group to scene — collect all THREE.Group children
    // that have the characteristic bulb mesh
    scene.children.forEach(child => {
        if (child.isGroup) {
            child.traverse(c => {
                if (c.isMesh && c.material && c.material.emissive) {
                    const hex = c.material.color ? c.material.color.getHex() : 0;
                    if (hex === 0xffffee) {
                        streetLightGroups.push(child);
                    }
                }
            });
        }
    });

    // Traffic Lights at Central Intersection
    collidables.push(createTrafficLight(scene, 7, 7, Math.PI));
    collidables.push(createTrafficLight(scene, -7, -7, 0));
    collidables.push(createTrafficLight(scene, -7, 7, -Math.PI / 2));
    collidables.push(createTrafficLight(scene, 7, -7, Math.PI / 2));

    // Traffic Signs at secondary intersections
    createTrafficSign(scene, 8, -93, 'stop', 0);
    createTrafficSign(scene, -8, -107, 'stop', Math.PI);
    createTrafficSign(scene, 8, 93, 'stop', 0);
    createTrafficSign(scene, -8, 107, 'stop', Math.PI);
    createTrafficSign(scene, -93, 8, 'stop', -Math.PI / 2);
    createTrafficSign(scene, 93, -8, 'stop', Math.PI / 2);

    // Speed signs along highway
    createTrafficSign(scene, 208, -100, 'speed', 0);
    createTrafficSign(scene, -208, 100, 'speed', Math.PI);
    createTrafficSign(scene, 100, -208, 'speed', -Math.PI / 2);
    createTrafficSign(scene, -100, 208, 'speed', Math.PI / 2);

    // Yield signs at highway on-ramps
    createTrafficSign(scene, 8, -193, 'yield', 0);
    createTrafficSign(scene, -8, 193, 'yield', Math.PI);
    createTrafficSign(scene, -193, -8, 'yield', Math.PI / 2);
    createTrafficSign(scene, 193, 8, 'yield', -Math.PI / 2);

    // ═══════════════════════════════════════════════════════════════════════
    //  HIGHWAY BARRIERS
    // ═══════════════════════════════════════════════════════════════════════

    // North highway edge barriers
    for (let x = -190; x <= 190; x += 30) {
        createRoadBarrier(scene, x, -207, 25, Math.PI / 2);
    }
    // South highway edge barriers
    for (let x = -190; x <= 190; x += 30) {
        createRoadBarrier(scene, x, 207, 25, Math.PI / 2);
    }
    // West highway edge barriers
    for (let z = -190; z <= 190; z += 30) {
        createRoadBarrier(scene, -207, z, 25, 0);
    }
    // East highway edge barriers
    for (let z = -190; z <= 190; z += 30) {
        createRoadBarrier(scene, 207, z, 25, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ZONE 1 — DOWNTOWN (NW: x=-100→0, z=-100→0) — Skyscrapers + Shops
    // ═══════════════════════════════════════════════════════════════════════

    for (let x = -80; x <= -20; x += 30) {
        for (let z = -80; z <= -20; z += 30) {
            const w = 15 + Math.random() * 10;
            const d = 15 + Math.random() * 10;
            const h = 40 + Math.random() * 80;
            const mesh = createSkyscraper(scene, x, z, w, h, d);
            collidables.push(mesh);
        }
    }

    // Shops along the downtown streets
    collidables.push(createShop(scene, -15, -30, 0));
    collidables.push(createShop(scene, -15, -60, 0));
    collidables.push(createShop(scene, -30, -15, Math.PI / 2));

    // ═══════════════════════════════════════════════════════════════════════
    //  ZONE 2 — COMMERCIAL (NE: x=0→100, z=-100→0) — Restaurants, Shops, Gas
    // ═══════════════════════════════════════════════════════════════════════

    // Restaurants
    collidables.push(createRestaurant(scene, 35, -35, 0));
    collidables.push(createRestaurant(scene, 75, -70, Math.PI / 2));

    // Shops row
    collidables.push(createShop(scene, 25, -65, 0));
    collidables.push(createShop(scene, 40, -65, 0));
    collidables.push(createShop(scene, 55, -65, 0));
    collidables.push(createShop(scene, 70, -35, Math.PI));

    // Petrol pump station
    collidables.push(createPetrolPump(scene, 70, -90, Math.PI / 2));

    // Commercial area skyscrapers (smaller / mid-rise)
    for (let x = 25; x <= 85; x += 30) {
        const w = 12 + Math.random() * 6;
        const d = 12 + Math.random() * 6;
        const h = 20 + Math.random() * 30;
        collidables.push(createSkyscraper(scene, x, -90, w, h, d));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ZONE 3 — RESIDENTIAL (SW: x=-100→0, z=0→100) — Houses, School, Gardens
    // ═══════════════════════════════════════════════════════════════════════

    for (let x = -80; x <= -20; x += 25) {
        for (let z = 20; z <= 80; z += 25) {
            const rot = Math.random() > 0.5 ? 0 : Math.PI / 2;
            const mesh = createHouse(scene, x, z, 12, 10, 16, rot);
            collidables.push(mesh);
            // Small tree in each yard
            const t = nature.addTree(x + 8, z - 8, 0.4 + Math.random() * 0.4);
            if (t) collidables.push(t);
        }
    }

    // School in the residential area
    collidables.push(createSchool(scene, -50, 55, Math.PI));

    // Gardens scattered in residential zone
    nature.createGardenArea(-85, 35, 20, 15);
    nature.createGardenArea(-25, 85, 18, 14);

    // Residential petrol pump
    collidables.push(createPetrolPump(scene, -90, 50, Math.PI / 2));

    // ═══════════════════════════════════════════════════════════════════════
    //  ZONE 4 — MEDICAL (SE: x=0→100, z=0→100) — Hospital + Park
    // ═══════════════════════════════════════════════════════════════════════

    // Hospital complex
    collidables.push(createHospital(scene, 55, 55, 0));

    // Hospital parking lot (flat concrete area)
    const parkingMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.95 });
    const parking = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), parkingMat);
    parking.rotation.x = -Math.PI / 2;
    parking.position.set(55, 0.015, 80);
    parking.receiveShadow = true;
    scene.add(parking);

    // Parking lot lines
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    for (let px = 42; px <= 68; px += 4) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 5), lineMat);
        line.position.set(px, 0.02, 80);
        scene.add(line);
    }

    // Medical park area
    nature.createParkArea(30, 85, 30, 20);
    for (let i = 0; i < 8; i++) {
        const tx = 20 + Math.random() * 20;
        const tz = 78 + Math.random() * 14;
        nature.addTree(tx, tz, 0.6 + Math.random() * 0.6);
    }
    nature.createGardenArea(30, 90, 25, 12);

    // Fencing around hospital
    collidables.push(createFence(scene, 40, 44, 30, Math.PI / 2));
    collidables.push(createFence(scene, 70, 44, 30, Math.PI / 2));

    // ═══════════════════════════════════════════════════════════════════════
    //  CENTRAL PARK (East: x=20→180, z=-180→180)
    // ═══════════════════════════════════════════════════════════════════════

    nature.createParkArea(100, 0, 160, 360);

    for (let i = 0; i < 200; i++) {
        const tx = 30 + Math.random() * 140;
        const tz = -170 + Math.random() * 340;
        if (Math.abs(tz) < 15) continue; // Avoid road crossing
        const scale = 0.5 + Math.random() * 1.5;
        const t = nature.addTree(tx, tz, scale);
        if (t) collidables.push(t);
    }

    // Bushes throughout the park
    for (let i = 0; i < 80; i++) {
        const bx = 30 + Math.random() * 140;
        const bz = -170 + Math.random() * 340;
        if (Math.abs(bz) < 15) continue;
        nature.addBush(bx, bz, 0.5 + Math.random() * 0.8);
    }

    // Garden areas inside the park
    nature.createGardenArea(80, -80, 30, 20);
    nature.createGardenArea(120, 60, 25, 18);
    nature.createGardenArea(90, 130, 28, 16);

    // Bollards lining the park edges
    for (let tz = -180; tz <= 180; tz += 10) {
        if (Math.abs(tz) > 10) {
            collidables.push(createBollard(scene, 18, tz));
        }
    }

    // Park fences along south and north edges
    collidables.push(createFence(scene, 100, -185, 160, Math.PI / 2));
    collidables.push(createFence(scene, 100, 185, 160, Math.PI / 2));

    // ═══════════════════════════════════════════════════════════════════════
    //  COUNTRYSIDE (Beyond highway loop) — Mountains, Grass, Scattered Trees
    // ═══════════════════════════════════════════════════════════════════════

    // Mountain range
    nature.createMountainRange();

    // Countryside grass patches
    const countrysideGrass = new THREE.MeshStandardMaterial({ color: 0x5a8a3a, roughness: 1.0 });
    const grassPatches = [
        { x: -250, z: -250, w: 80, d: 80 },
        { x: 250, z: -250, w: 80, d: 80 },
        { x: -250, z: 250, w: 80, d: 80 },
        { x: 250, z: 250, w: 80, d: 80 },
        { x: 0, z: -250, w: 120, d: 60 },
        { x: 0, z: 250, w: 120, d: 60 },
        { x: -250, z: 0, w: 60, d: 120 },
        { x: 250, z: 0, w: 60, d: 120 },
    ];
    grassPatches.forEach(({ x, z, w, d }) => {
        const patch = new THREE.Mesh(new THREE.PlaneGeometry(w, d), countrysideGrass);
        patch.rotation.x = -Math.PI / 2;
        patch.position.set(x, 0.015, z);
        patch.receiveShadow = true;
        scene.add(patch);
    });

    // Scattered countryside trees
    for (let i = 0; i < 100; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 220 + Math.random() * 60;
        const tx = Math.cos(angle) * dist;
        const tz = Math.sin(angle) * dist;
        const scale = 0.6 + Math.random() * 1.2;
        nature.addTree(tx, tz, scale);
    }

    // Countryside bushes
    for (let i = 0; i < 60; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 215 + Math.random() * 70;
        const bx = Math.cos(angle) * dist;
        const bz = Math.sin(angle) * dist;
        nature.addBush(bx, bz, 0.5 + Math.random() * 1.0);
    }

    // Bake all instanced nature
    nature.updateInstanceMatrix();

    // ═══════════════════════════════════════════════════════════════════════
    //  RAMPS (fun driving elements)
    // ═══════════════════════════════════════════════════════════════════════

    const rampMat = new THREE.MeshStandardMaterial({ color: 0x2a2a4a, roughness: 0.5, metalness: 0.2 });
    const rampGeom = new THREE.BoxGeometry(10, 0.5, 12);

    const ramp1 = new THREE.Mesh(rampGeom, rampMat);
    ramp1.position.set(-150, 0.25, -190);
    ramp1.rotation.x = -0.15;
    scene.add(ramp1);
    collidables.push(ramp1);

    const ramp2 = new THREE.Mesh(rampGeom, rampMat);
    ramp2.position.set(0, 0.25, 180);
    ramp2.rotation.x = 0.15;
    scene.add(ramp2);
    collidables.push(ramp2);

    // ═══════════════════════════════════════════════════════════════════════
    //  SKYBOX
    // ═══════════════════════════════════════════════════════════════════════

    const skyGeom = new THREE.SphereGeometry(300, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
            topColor: { value: new THREE.Color(0x3399ff) },
            bottomColor: { value: new THREE.Color(0xcccccc) },
            horizonColor: { value: new THREE.Color(0x88bbff) },
        },
        vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
        fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform vec3 horizonColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        vec3 color;
        if (h > 0.0) {
          color = mix(horizonColor, topColor, smoothstep(0.0, 0.5, h));
        } else {
          color = mix(horizonColor, bottomColor, smoothstep(0.0, -0.3, h));
        }
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    });
    const sky = new THREE.Mesh(skyGeom, skyMat);
    sky.name = "Skybox";
    scene.add(sky);

    // === The Sun ===
    const sunGeom = new THREE.SphereGeometry(15, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sun = new THREE.Mesh(sunGeom, sunMat);
    sun.position.set(200, 240, -100);
    scene.add(sun);

    // Filter out null collidables and return all refs
    return {
        collidables: collidables.filter(c => c !== null),
        skyMesh: sky,
        sunMesh: sun,
        streetLightGroups,
    };
}
