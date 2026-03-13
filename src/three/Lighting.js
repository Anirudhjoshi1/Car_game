import * as THREE from 'three';

/**
 * Sets up bright, daytime lighting for the scene.
 * Returns references to all lights so DayNightCycle can modify them at runtime.
 */
export function setupLighting(scene) {
    // Ambient light — bright daylight fill
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    // Hemisphere light — blue sky / warm ground gradient
    const hemi = new THREE.HemisphereLight(0x88ccff, 0x888866, 0.8);
    hemi.position.set(0, 50, 0);
    scene.add(hemi);

    // Main directional light — Key sunlight with crisp shadows
    const dirLight = new THREE.DirectionalLight(0xffffee, 2.5);
    dirLight.position.set(200, 240, -100);
    dirLight.castShadow = true;

    // Optimized shadows — 1024 is enough for the visible area
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 600;

    // Tighter shadow camera bounds = better shadow resolution per pixel
    const shadowBounds = 120;
    dirLight.shadow.camera.left = -shadowBounds;
    dirLight.shadow.camera.right = shadowBounds;
    dirLight.shadow.camera.top = shadowBounds;
    dirLight.shadow.camera.bottom = -shadowBounds;

    dirLight.shadow.bias = -0.002;
    dirLight.shadow.normalBias = 0.05;
    scene.add(dirLight);

    // A softer, secondary light to fill in hard black shadows
    const fillLight = new THREE.DirectionalLight(0xaaccff, 0.5);
    fillLight.position.set(-50, 20, 50);
    scene.add(fillLight);

    // Return refs for DayNightCycle
    return { dirLight, ambient, hemi, fillLight };
}
