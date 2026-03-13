import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * Loads the Lamborghini Veneno GLTF model and returns a THREE.Group
 * with the same userData API (wheels, headlights, headlightMeshes, exhaustFlames)
 * expected by CarControls, CarEffects, and DayNightCycle.
 *
 * @returns {Promise<THREE.Group>}
 */
export async function createCar() {
    const car = new THREE.Group();
    const loader = new GLTFLoader();

    const gltf = await loader.loadAsync('/assets/lamborghini_venevo/scene.gltf');
    const model = gltf.scene;

    // ── Normalize the model ────────────────────────────────────────────────
    // Compute bounding box to center and scale
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Scale based on the longest axis to get the car to the target length
    const targetLength = 6.5; // Increased from 4.8 to make the car look larger
    const longestAxis = Math.max(size.x, size.y, size.z);
    const scaleFactor = targetLength / longestAxis;
    model.scale.setScalar(scaleFactor);

    // Re-center after scaling
    box.setFromObject(model);
    box.getCenter(center);
    model.position.sub(center);

    // Place the car on the ground (bottom of bounding box at y=0)
    box.setFromObject(model);
    model.position.y -= box.min.y;

    car.add(model);

    // ── Disable shadows on the high-poly model and fix materials ─────────────
    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = false; // Disabled for performance
            child.receiveShadow = true; // Keep receiving shadows from buildings

            if (child.material) {
                // If this is the main car body paint (material_20), force it to a vibrant orange!
                if (child.material.name === 'material_20' || (child.material.name && child.material.name.toLowerCase().includes('body'))) {
                    child.material.color = new THREE.Color(0xff5500); // Pure bright orange
                    child.material.metalness = 0.1; // Less metallic so it doesn't reflect the blue sky (which turns it pink)
                    child.material.roughness = 0.4; // Slightly matte base
                    child.material.envMapIntensity = 0.05; // Almost no environment map influence
                } else {
                    // For other materials, reduce the environment map intensity slightly
                    // so reflections don't completely wash them out.
                    child.material.envMapIntensity = 0.2;
                }

                child.material.needsUpdate = true;
            }
        }
    });

    // ── Get the final bounding box for positioning attachments ──────────────
    const finalBox = new THREE.Box3().setFromObject(car);
    const frontZ = finalBox.max.z;
    const rearZ = finalBox.min.z;
    const carWidth = finalBox.max.x - finalBox.min.x;
    const halfWidth = carWidth / 2;
    const carHeight = finalBox.max.y - finalBox.min.y;
    const carLength = frontZ - rearZ;

    // ── Create a shadow proxy box ───────────────────────────────────────────
    const shadowGeo = new THREE.BoxGeometry(carWidth * 0.95, carHeight * 0.6, carLength * 0.95);
    // An invisible material that still casts a shadow
    const shadowMat = new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: false
    });
    const shadowProxy = new THREE.Mesh(shadowGeo, shadowMat);
    // Center the proxy correctly relative to the bottom of the bounding box
    shadowProxy.position.y = finalBox.min.y + (carHeight * 0.3);
    shadowProxy.castShadow = true;
    shadowProxy.receiveShadow = false;
    car.add(shadowProxy);

    // ── Headlights (SpotLights only — no visible box meshes) ───────────────
    // The GLTF model already has its own lamp meshes, so we only add invisible
    // SpotLights for the night-time beam effect.
    car.userData.headlights = [];
    car.userData.headlightMeshes = [];

    for (const side of [-1, 1]) {
        // SpotLight beam — cone pointing forward (invisible during day)
        const spot = new THREE.SpotLight(0xffeedd, 5, 40, Math.PI / 6, 0.5, 1.5);
        spot.position.set(side * halfWidth * 0.75, 0.4, frontZ);
        const target = new THREE.Object3D();
        target.position.set(side * halfWidth * 0.2, -0.2, frontZ + 20);
        car.add(target);
        spot.target = target;
        spot.castShadow = false;
        spot.visible = false; // Off during day
        car.add(spot);
        car.userData.headlights.push(spot);
    }

    // Find the lamp meshes from the GLTF model for the headlightMeshes array
    model.traverse((child) => {
        if (child.isMesh && child.material) {
            const matName = (child.material.name || '').toLowerCase();
            if (matName.includes('lamp')) {
                car.userData.headlightMeshes.push(child);
            }
        }
    });

    // ── Wheels (userData.wheels) ────────────────────────────────────────────
    car.userData.wheels = [];
    model.traverse((child) => {
        if (child.isMesh && child.material) {
            const matName = (child.material.name || '').toLowerCase();
            const meshName = (child.name || '').toLowerCase();
            if (matName.includes('wheel') || meshName.includes('wheel') || meshName.includes('tire')) {
                car.userData.wheels.push(child);
            }
        }
    });

    // If no wheel meshes found by name, create dummy wheel groups
    if (car.userData.wheels.length === 0) {
        const carLength = finalBox.max.z - finalBox.min.z;
        const positions = [
            { x: -halfWidth * 0.8, y: 0.2, z: carLength * 0.3 },
            { x: halfWidth * 0.8, y: 0.2, z: carLength * 0.3 },
            { x: -halfWidth * 0.8, y: 0.2, z: -carLength * 0.3 },
            { x: halfWidth * 0.8, y: 0.2, z: -carLength * 0.3 },
        ];
        for (const pos of positions) {
            const dummyWheel = new THREE.Group();
            dummyWheel.position.set(pos.x, pos.y, pos.z);
            car.add(dummyWheel);
            car.userData.wheels.push(dummyWheel);
        }
    }

    // ── Nitro Exhaust Flames (no extra pipe meshes — just invisible flames) ─
    // Place flames just behind the rear bumper, hovering near ground level
    car.userData.exhaustFlames = [];
    const flameMat = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
    });
    const flameGeom = new THREE.ConeGeometry(0.07, 0.5, 16);

    for (const side of [-1, 1]) {
        const flame = new THREE.Mesh(flameGeom, flameMat);
        flame.position.set(side * halfWidth * 0.35, 0.18, rearZ - 0.3);
        flame.rotation.x = Math.PI / 2; // Point backwards
        flame.visible = false; // Hidden by default until shift is pressed

        const flameLight = new THREE.PointLight(0x00aaff, 2, 4);
        flameLight.position.z = -0.15;
        flame.add(flameLight);

        car.add(flame);
        car.userData.exhaustFlames.push(flame);
    }

    return car;
}
