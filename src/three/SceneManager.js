import * as THREE from 'three';
import { createCar } from './CarBuilder';
import { CarControls } from './CarControls';
import { createEnvironment } from './Environment';
import { setupLighting } from './Lighting';
import { CameraController } from './CameraController';
import { createParticles } from './Particles';
import { Minimap } from './Minimap';
import { DayNightCycle } from './DayNightCycle';
import { CarEffects } from './CarEffects';
import { SoundDesign } from './SoundDesign';

export class SceneManager {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        this.car = null;
        this.carControls = null;
        this.cameraController = null;
        this.minimap = null;
        this.particles = null;
        this.dayNightCycle = null;
        this.carEffects = null;
        this.soundDesign = null;
        this.isPlaying = false;
        this.animationId = null;

        // Callbacks
        this.onSpeedUpdate = null;
        this.onKeysUpdate = null;
    }

    async init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x0a0a1a, 0.008);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            60,
            window.innerWidth / window.innerHeight,
            0.1,
            500
        );
        this.camera.position.set(8, 4, 8);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.2)); // Lower pixel ratio for performance
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.BasicShadowMap; // Cheapest shadow type
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);

        // Frame counter for throttling expensive updates
        this._frameCount = 0;

        // Build scene environment and lighting first
        const envResult = createEnvironment(this.scene);
        const collidables = envResult.collidables;
        const lights = setupLighting(this.scene);

        // Generate environment map for proper reflections on buildings and car
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();
        // The skybox sphere is at radius 140, so we need a far plane > 140
        this.scene.environment = pmremGenerator.fromScene(this.scene, 0, 0.1, 500).texture;
        pmremGenerator.dispose();

        // Add car after generating static environment map
        this.car = await createCar();
        this.car.position.set(0, 0, 0);
        this.scene.add(this.car);

        this.particles = createParticles(this.scene);

        // Camera controller (starts in cinematic mode)
        this.cameraController = new CameraController(this.camera, this.car, this.renderer.domElement);

        // Car controls (disabled until game starts)
        this.carControls = new CarControls(this.car, 'ROAD', collidables);

        // Car visual/audio effects
        this.carEffects = new CarEffects(this.scene, this.car);

        // Minimap
        this.minimap = new Minimap(this.car);

        // Events
        window.addEventListener('resize', this._onResize.bind(this));

        // Day-Night Cycle
        this.dayNightCycle = new DayNightCycle({
            lights,
            skyMesh: envResult.skyMesh,
            sunMesh: envResult.sunMesh,
            streetLightGroups: envResult.streetLightGroups,
            car: this.car,
            scene: this.scene,
            cycleDuration: 120, // 2 minutes per full day
        });

        // Start loop
        this._animate();
    }

    startGame(onComplete) {
        this.cameraController.transitionToChase(() => {
            this.isPlaying = true;
            this.carControls.enable();
            // Start car effects + full sound design
            if (this.carEffects) this.carEffects.startEngine();
            // Initialize sound system (must be from user gesture)
            this.soundDesign = new SoundDesign();
            this.soundDesign.start();
            if (onComplete) onComplete();
        });
    }

    _animate() {
        this.animationId = requestAnimationFrame(this._animate.bind(this));

        const delta = Math.min(this.clock.getDelta(), 0.05);
        const elapsed = this.clock.getElapsedTime();
        this._frameCount++; // Increment frame count for throttled updates

        // Update car controls
        if (this.isPlaying) {
            this.carControls.update(delta);

            if (this.onSpeedUpdate) {
                this.onSpeedUpdate(this.carControls.getSpeedKph());
            }
            if (this.onKeysUpdate) {
                this.onKeysUpdate(this.carControls.getKeys());
            }

            // Update car effects (smoke, skids, sound, brake lights)
            if (this.carEffects) {
                this.carEffects.update(delta, this.carControls.getState());
            }

            // Update sound design (engine + ambience)
            if (this.soundDesign) {
                const state = this.carControls.getState();
                this.soundDesign.updateEngine(state.speedRatio, state.velocity, state.isBoosting, state.isBraking);
                this.soundDesign.updateAmbience(this.car.position);
            }
        }

        // Update camera
        this.cameraController.update(delta, elapsed);

        // Update day-night cycle
        if (this.dayNightCycle) {
            this.dayNightCycle.update(delta);
        }
        // Update minimap
        if (this.minimap && this.isPlaying) {
            this.minimap.update();
        }

        // Update particles (every 3rd frame to save CPU)
        if (this.particles && this._frameCount % 3 === 0) {
            this.particles.update(elapsed);
        }

        // Render main scene
        this.renderer.render(this.scene, this.camera);

        // Render minimap every 2nd frame (it's a full extra scene render)
        if (this.minimap && this.isPlaying) {
            if (this._frameCount % 2 === 0) {
                this.minimap.render(this.renderer, this.scene);
            }
            // Always draw the overlay to the screen every frame to prevent blinking
            this.minimap.drawOverlay(this.renderer);
        }
    }

    _onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        window.removeEventListener('resize', this._onResize.bind(this));
        if (this.carControls) this.carControls.dispose();
        if (this.carEffects) this.carEffects.dispose();
        if (this.soundDesign) this.soundDesign.dispose();
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
    }
}
