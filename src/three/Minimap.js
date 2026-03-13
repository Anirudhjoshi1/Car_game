import * as THREE from 'three';

export class Minimap {
    constructor(target) {
        this.target = target; // The car object to follow

        const frustumSize = 250; // How much of the world to show (zoom out a bit to see city)
        this.camera = new THREE.OrthographicCamera(
            frustumSize / -2, frustumSize / 2,
            frustumSize / 2, frustumSize / -2,
            1, 2000
        );

        // Position camera high above the target looking down
        this.camera.position.set(0, 500, 0);

        // Minimap UI size settings (matched with CSS)
        this.sizeOffsets = {
            size: 200, // Circular map is perfectly square layout
            rightMargin: 40,
            topMargin: 40
        };

        // Render target for capturing the minimap view (square resolution)
        this.renderTarget = new THREE.WebGLRenderTarget(512, 512, {
            format: THREE.RGBAFormat,
            generateMipmaps: false
        });

        // Overlay scene to render the texture as a circle on screen
        this.overlayScene = new THREE.Scene();
        this.overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        this.overlayCamera.position.z = 5;
        this.overlayCamera.lookAt(0, 0, 0);

        const material = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: this.renderTarget.texture }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                varying vec2 vUv;
                void main() {
                    vec2 center = vec2(0.5, 0.5);
                    float dist = distance(vUv, center);
                    if (dist > 0.5) discard; // Clip into a perfect circle
                    
                    // Add a tiny, subtle dark ring around the edge of the circle map
                    float alpha = smoothstep(0.48, 0.5, dist);
                    vec4 texColor = texture2D(tDiffuse, vUv);
                    gl_FragColor = mix(texColor, vec4(0.0, 0.0, 0.0, 1.0), alpha * 0.5);
                }
            `,
            transparent: true,
            depthTest: false, // Ensures UI overlays cleanly on the main scene without clearing depths
            depthWrite: false
        });

        const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        plane.position.z = 0;
        this.overlayScene.add(plane);

        // Setup Car Marker in the Overlay Scene
        this.carMarker = new THREE.Group();
        this.carMarker.position.z = 1;

        // Car Outline/Shadow
        const outlineGeom = new THREE.PlaneGeometry(0.12, 0.22);
        const outlineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false }); // White border for high visibility
        const outline = new THREE.Mesh(outlineGeom, outlineMat);
        outline.renderOrder = 1;

        // Car body (red)
        const bodyGeom = new THREE.PlaneGeometry(0.1, 0.2);
        const bodyMat = new THREE.MeshBasicMaterial({ color: 0xe62e2e, depthTest: false, depthWrite: false });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.renderOrder = 2;

        // Windshield (dark glass)
        const glassGeom = new THREE.PlaneGeometry(0.08, 0.05);
        const glassMat = new THREE.MeshBasicMaterial({ color: 0x111111, depthTest: false, depthWrite: false });
        const glass = new THREE.Mesh(glassGeom, glassMat);
        glass.position.y = 0.03;
        glass.renderOrder = 3;

        // Spoiler
        const spoilerGeom = new THREE.PlaneGeometry(0.1, 0.03);
        const spoilerMat = new THREE.MeshBasicMaterial({ color: 0x111111, depthTest: false, depthWrite: false });
        const spoiler = new THREE.Mesh(spoilerGeom, spoilerMat);
        spoiler.position.y = -0.07;
        spoiler.renderOrder = 3;

        // Headlights
        const lightGeom = new THREE.PlaneGeometry(0.02, 0.02);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xffddaa, depthTest: false, depthWrite: false });

        const lightL = new THREE.Mesh(lightGeom, lightMat);
        lightL.position.set(-0.03, 0.09, 0);
        lightL.renderOrder = 4;

        const lightR = new THREE.Mesh(lightGeom, lightMat);
        lightR.position.set(0.03, 0.09, 0);
        lightR.renderOrder = 4;

        this.carMarker.add(outline);
        this.carMarker.add(body);
        this.carMarker.add(glass);
        this.carMarker.add(spoiler);
        this.carMarker.add(lightL);
        this.carMarker.add(lightR);

        this.overlayScene.add(this.carMarker);
    }

    update() {
        if (!this.target) return;

        // Follow the target's X,Z position
        this.camera.position.x = this.target.position.x;
        this.camera.position.z = this.target.position.z;
        this.camera.position.y = 200; // Force height above buildings

        // Set camera 'up' vector so it rotates with the car
        const carDir = new THREE.Vector3(0, 0, -1);
        carDir.applyQuaternion(this.target.quaternion);

        // Match the minimap rotation to the car's rotation (GTA style)
        // Must be called BEFORE lookAt so the lookAt rotation matrix computes correctly
        this.camera.up.set(-carDir.x, 0, -carDir.z).normalize();

        // The orthographic camera looks down at the target
        this.camera.lookAt(this.target.position.x, 0, this.target.position.z);

        // Critically important when changing properties derived from matrices
        this.camera.updateProjectionMatrix();
    }

    render(renderer, scene) {
        // --- 1. Render Map to Texture ---
        const oldBackground = scene.background;
        const oldFog = scene.fog;
        scene.background = new THREE.Color(0x2b3340); // Darker blue/grey for the circular map background
        scene.fog = null;

        // Hide the giant sky sphere so it doesn't block the top-down view
        const skybox = scene.getObjectByName('Skybox');
        if (skybox) skybox.visible = false;

        // Hide the 3D car so we don't see it as a black dot in the map
        const carVisible = this.target.visible;
        this.target.visible = false;

        renderer.setRenderTarget(this.renderTarget);
        renderer.clear();
        renderer.render(scene, this.camera);

        // Restore Scene state
        scene.background = oldBackground;
        scene.fog = oldFog;
        if (skybox) skybox.visible = true;
        this.target.visible = carVisible;

        renderer.setRenderTarget(null);
    }

    drawOverlay(renderer) {
        // --- 2. Render Texture to Screen using Overlay Mask ---
        const w = window.innerWidth;
        const h = window.innerHeight;
        const mapSize = this.sizeOffsets.size;
        const right = this.sizeOffsets.rightMargin;
        const top = this.sizeOffsets.topMargin;

        const vx = w - mapSize - right;
        const vy = h - mapSize - top; // WebGL y=0 is at the bottom

        const currentAutoClear = renderer.autoClear;
        renderer.autoClear = false;

        // Draw the circular overlay plane in the top-right viewport
        renderer.setViewport(vx, vy, mapSize, mapSize);
        renderer.render(this.overlayScene, this.overlayCamera);

        // Restore viewport to the whole screen
        renderer.setViewport(0, 0, w, h);
        renderer.autoClear = currentAutoClear;
    }
}
