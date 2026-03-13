import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Camera controller with two modes:
 * 1. Cinematic orbit (landing screen)
 * 2. Third-person chase (gameplay)
 *
 * Smooth lerp transitions between modes.
 */
export class CameraController {
    constructor(camera, target, domElement) {
        this.camera = camera;
        this.target = target; // The car
        this.domElement = domElement;

        // Mode: 'cinematic' or 'chase'
        this.mode = 'cinematic';
        this.transitioning = false;
        this.transitionProgress = 0;
        this.transitionDuration = 2.5; // seconds
        this.onTransitionComplete = null;

        // Cinematic orbit settings
        this.orbitRadius = 8;
        this.orbitHeight = 3.5;
        this.orbitSpeed = 0.3;

        // Chase camera settings
        this.chaseDistance = 6.5; // Reduced from 8 to keep car closer
        this.chaseHeight = 3.0; // Reduced from 3.5 to match the closer angle
        this.chaseLookAhead = 2;
        this.chaseSmoothness = 0.15; // Increased from 0.05 to reduce extreme lag at high speeds

        // Current smooth position
        this.currentPos = new THREE.Vector3();
        this.currentLookAt = new THREE.Vector3();
        this.initialized = false;

        // Setup OrbitControls for the landing screen
        if (this.domElement) {
            this.orbit = new OrbitControls(this.camera, this.domElement);
            this.orbit.autoRotate = true;
            this.orbit.autoRotateSpeed = 1.5;
            this.orbit.enableDamping = true;
            this.orbit.dampingFactor = 0.05;
            this.orbit.maxPolarAngle = Math.PI / 2 - 0.05; // Don't allow camera to go below ground
            this.orbit.minDistance = 4;
            this.orbit.maxDistance = 15;

            // Set initial position
            this.camera.position.set(this.orbitRadius, this.orbitHeight, this.orbitRadius);
        }
    }

    transitionToChase(onComplete) {
        this.transitioning = true;
        this.transitionProgress = 0;
        this.onTransitionComplete = onComplete;
    }

    update(delta, elapsed) {
        if (this.transitioning) {
            this._updateTransition(delta, elapsed);
        } else if (this.mode === 'cinematic') {
            this._updateCinematic(elapsed);
        } else {
            this._updateChase(delta);
        }
    }

    _updateCinematic(elapsed) {
        if (this.orbit) {
            // Target slightly above the car's center
            this.orbit.target.copy(this.target.position);
            this.orbit.target.y += 0.8;
            this.orbit.update();
        } else {
            // Fallback if no domElement was provided
            const angle = elapsed * this.orbitSpeed;
            const x = Math.cos(angle) * this.orbitRadius;
            const z = Math.sin(angle) * this.orbitRadius;
            const y = this.orbitHeight + Math.sin(elapsed * 0.5) * 0.5;

            this.camera.position.set(x, y, z);
            this.camera.lookAt(this.target.position.x, 0.8, this.target.position.z);
        }
    }

    _updateChase(delta) {
        // Calculate desired position behind the car
        const carDir = new THREE.Vector3(0, 0, -1);
        carDir.applyQuaternion(this.target.quaternion);

        const desiredPos = new THREE.Vector3();
        desiredPos.copy(this.target.position);
        desiredPos.add(carDir.clone().multiplyScalar(this.chaseDistance));
        desiredPos.y += this.chaseHeight;

        // Look-ahead point
        const lookAtDir = new THREE.Vector3(0, 0, 1);
        lookAtDir.applyQuaternion(this.target.quaternion);
        const lookAtPos = new THREE.Vector3();
        lookAtPos.copy(this.target.position);
        lookAtPos.add(lookAtDir.clone().multiplyScalar(this.chaseLookAhead));
        lookAtPos.y += 0.8;

        // Initialize on first frame
        if (!this.initialized) {
            this.currentPos.copy(desiredPos);
            this.currentLookAt.copy(lookAtPos);
            this.initialized = true;
        }

        // Frame-rate independent smooth follow using exponential decay mapping
        // A high stiffness value (e.g., 10-20) locks on quickly but smoothly.
        const stiffness = 15.0;
        const lerpFactor = 1.0 - Math.exp(-stiffness * delta);

        this.currentPos.lerp(desiredPos, lerpFactor);
        this.currentLookAt.lerp(lookAtPos, lerpFactor);

        this.camera.position.copy(this.currentPos);
        this.camera.lookAt(this.currentLookAt);
    }

    _updateTransition(delta, elapsed) {
        this.transitionProgress += delta / this.transitionDuration;

        if (this.transitionProgress >= 1) {
            this.transitionProgress = 1;
            this.transitioning = false;
            this.mode = 'chase';
            this.initialized = false;

            if (this.orbit) {
                this.orbit.enabled = false; // Disable orbit controls during gameplay
            }

            if (this.onTransitionComplete) {
                this.onTransitionComplete();
                this.onTransitionComplete = null;
            }
            return;
        }

        // Smooth easing (ease-in-out cubic)
        const t = this.transitionProgress;
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        // Cinematic position
        const angle = elapsed * this.orbitSpeed;
        const cinematicPos = new THREE.Vector3(
            Math.cos(angle) * this.orbitRadius,
            this.orbitHeight + Math.sin(elapsed * 0.5) * 0.5,
            Math.sin(angle) * this.orbitRadius
        );

        // Chase position
        const carDir = new THREE.Vector3(0, 0, -1);
        carDir.applyQuaternion(this.target.quaternion);
        const chasePos = new THREE.Vector3();
        chasePos.copy(this.target.position);
        chasePos.add(carDir.clone().multiplyScalar(this.chaseDistance));
        chasePos.y += this.chaseHeight;

        // Interpolate
        const pos = new THREE.Vector3().lerpVectors(cinematicPos, chasePos, ease);
        this.camera.position.copy(pos);

        // Look at target
        const lookAt = new THREE.Vector3().lerpVectors(
            this.orbit ? this.orbit.target : new THREE.Vector3(this.target.position.x, 0.8, this.target.position.z),
            new THREE.Vector3(this.target.position.x, 0.8, this.target.position.z),
            ease
        );
        this.camera.lookAt(lookAt);
    }
}
