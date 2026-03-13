import * as THREE from 'three';

/**
 * CarControls — Forza Horizon-inspired physics controller.
 *
 * Driving feel goals:
 *  • Responsive off-the-line with smooth torque ramp-up
 *  • Speed-sensitive steering (wide at low speed, tighter at high speed)
 *  • Simulated understeer and weight transfer
 *  • Progressive engine braking + brake fade at high speed
 *  • Stability control dampens spin-out
 */

// ---------------------------------------------------------------------------
// Tuning Presets — swap `PRESET` to change car feel instantly
// ---------------------------------------------------------------------------
const PRESETS = {
    /** Balanced all-rounder (e.g. Subaru WRX STI) */
    ROAD: {
        maxSpeed: 55,      // m/s  (~198 km/h top speed)
        accelerationCurve: [22, 18, 12],   // [low, mid, high] torque bands
        brakingForce: 38,
        engineBraking: 6,
        friction: 9,
        maxTurnAngle: 0.085,  // Drastically increased for very sharp, fast turns
        steeringSensitivity: 8.0,  // Drastically increased for snappy response
        underSteerFactor: 0.20,   // Reduced from 0.55 so the car doesn't resist turning at high speeds
        stabilityControl: 0.82,   // 0 = off, 1 = max traction control
        bodyRollFactor: 0.28,
        wheelSpinRate: 3.8,
    },

    /** Grippy sports car (e.g. Ferrari 488) */
    SPORT: {
        maxSpeed: 72,
        accelerationCurve: [30, 24, 14],
        brakingForce: 50,
        engineBraking: 5,
        friction: 7,
        maxTurnAngle: 0.038,
        steeringSensitivity: 3.4,
        underSteerFactor: 0.40,
        stabilityControl: 0.70,
        bodyRollFactor: 0.18,
        wheelSpinRate: 4.5,
    },

    /** Off-road truck (e.g. Ford Bronco) */
    OFFROAD: {
        maxSpeed: 38,
        accelerationCurve: [28, 20, 14],
        brakingForce: 32,
        engineBraking: 10,
        friction: 14,
        maxTurnAngle: 0.050,
        steeringSensitivity: 2.0,
        underSteerFactor: 0.65,
        stabilityControl: 0.60,
        bodyRollFactor: 0.45,
        wheelSpinRate: 3.0,
    },

    /** Drift build (e.g. Nissan 370Z) */
    DRIFT: {
        maxSpeed: 60,
        accelerationCurve: [26, 22, 20],
        brakingForce: 28,
        engineBraking: 3,
        friction: 4,
        maxTurnAngle: 0.060,
        steeringSensitivity: 4.5,
        underSteerFactor: 0.10,  // low = oversteer happy
        stabilityControl: 0.20,
        bodyRollFactor: 0.55,
        wheelSpinRate: 6.0,
    },
};

const ACTIVE_PRESET = 'ROAD'; // ← change this to switch car feel

// ---------------------------------------------------------------------------

export class CarControls {
    /**
     * @param {THREE.Object3D} car - The root car mesh / group.
     * @param {string}         [preset] - Optional preset key from PRESETS.
     * @param {THREE.Object3D[]} [collidables] - Array of meshes to check collisions against.
     */
    constructor(car, preset = ACTIVE_PRESET, collidables = []) {
        this.car = car;
        this.enabled = false;
        this.tuning = { ...PRESETS[preset] };
        this.collidables = collidables;

        // ── Physics tools ─────────────────────────────────────────────────
        this.raycaster = new THREE.Raycaster();
        this.downVector = new THREE.Vector3(0, -1, 0);

        // ── Input state ───────────────────────────────────────────────────
        this.keys = { w: false, a: false, s: false, d: false, shift: false, ' ': false };

        // ── Physics state ─────────────────────────────────────────────────
        this.velocity = 0;   // m/s, forward positive
        this.angularVelocity = 0;   // rad/s
        this.wheelSpin = 0;   // cumulative rotation for mesh anim
        this.steerAngle = 0;   // current front-wheel steer angle (visual)
        this.speedRatio = 0;   // 0-1 normalized speed (cached each frame)

        // ── Helpers ───────────────────────────────────────────────────────
        this._forward = new THREE.Vector3();

        // ── Event listeners ───────────────────────────────────────────────
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onKeyUp = this._onKeyUp.bind(this);
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
    }

    // ── Public API ────────────────────────────────────────────────────────

    enable() { this.enabled = true; }
    disable() { this.enabled = false; }

    /**
     * Swap physics preset at runtime (e.g. after a car change).
     * @param {string} presetName
     */
    setPreset(presetName) {
        if (!PRESETS[presetName]) {
            console.warn(`[CarControls] Unknown preset "${presetName}"`);
            return;
        }
        this.tuning = { ...PRESETS[presetName] };
    }

    /**
     * Main update — call once per frame with delta time in seconds.
     * @param {number} delta
     */
    update(delta) {
        if (!this.enabled) return;

        const t = this.tuning;

        // ── 0. Smooth Boost Multiplier ────────────────────────────────────
        // Target is 1.35x max speed/torque when boosting, 1.0x normally
        const targetBoost = this.keys.shift ? 1.35 : 1.0;
        // Fast ramp down (brake), slightly slower ramp up (turbo spool)
        const boostRampRate = this.keys.shift ? 2.0 : 4.0;
        this._currentBoostMultiplier = THREE.MathUtils.lerp(
            this._currentBoostMultiplier || 1.0,
            targetBoost,
            boostRampRate * delta
        );

        // ── 1. Clamp delta to avoid spiral-of-death on slow frames ────────
        const dt = Math.min(delta, 0.05);

        // ── 2. Cache normalized speed ratio ──────────────────────────────
        const actualMaxSpeed = t.maxSpeed * this._currentBoostMultiplier;
        this.speedRatio = Math.abs(this.velocity) / actualMaxSpeed;

        // ── 3. Longitudinal physics (throttle / brake / coast) ────────────
        this._updateLongitudinal(dt, t);

        // ── 4. Lateral physics (steering with speed-sensitive understeer) ─
        this._updateLateral(dt, t);

        // ── 5. Collision Detection & Integration ──────────────────────────
        this._forward.set(0, 0, 1).applyQuaternion(this.car.quaternion);

        // Raycast forward/backward to check for walls
        if (this.collidables.length > 0) {
            this.raycaster.set(this.car.position, this._forward.clone().multiplyScalar(Math.sign(this.velocity) || 1));
            // Check 2 units ahead
            const intersections = this.raycaster.intersectObjects(this.collidables, true);

            if (intersections.length > 0 && intersections[0].distance < 2.0 && Math.abs(this.velocity) > 0.1) {
                // Hit a wall! Stop the car abruptly.
                this.velocity = 0;
            } else {
                // Safe to move horizontally
                this.car.position.addScaledVector(this._forward, this.velocity * dt);
            }
        } else {
            // No collidables, just move
            this.car.position.addScaledVector(this._forward, this.velocity * dt);
        }

        // Raycast downwards to find the ground/ramp height
        if (this.collidables.length > 0) {
            // Start the ray slightly above the car to catch ramps it is currently on
            const rayOrigin = this.car.position.clone();
            rayOrigin.y += 2.0;
            this.raycaster.set(rayOrigin, this.downVector);

            const downIntersects = this.raycaster.intersectObjects(this.collidables, true);
            if (downIntersects.length > 0) {
                // Set the car's Y to exactly rest on the surface
                const surfacePoint = downIntersects[0].point;
                this.car.position.y = surfacePoint.y;

                // Adjust car pitch (x rotation) based on the surface normal
                const surfaceNormal = downIntersects[0].face.normal.clone();
                // We assume up is Y axis. If the normal isn't pointing straight up, we are on a slope.
                // A very simplified approach to making the car tilt up the ramp:
                const pitch = Math.asin(surfaceNormal.z);
                this.car.rotation.x = THREE.MathUtils.lerp(this.car.rotation.x, -pitch, 10 * dt);
            } else {
                this.car.position.y = 0; // Fallback to ground plane
                this.car.rotation.x = THREE.MathUtils.lerp(this.car.rotation.x, 0, 10 * dt);
            }
        } else {
            this.car.position.y = 0; // Keep on ground plane
        }

        // ── 6. World bounds ───────────────────────────────────────────────
        const bounds = 240;
        this.car.position.x = THREE.MathUtils.clamp(this.car.position.x, -bounds, bounds);
        this.car.position.z = THREE.MathUtils.clamp(this.car.position.z, -bounds, bounds);

        // ── 7. Wheel animations ───────────────────────────────────────────
        this._updateWheels(dt, t);

        // ── 8. Exhaust animations ─────────────────────────────────────────
        this._updateExhaust(dt);

        // ── 9. Body roll ──────────────────────────────────────────────────
        const targetRoll = -this.angularVelocity * t.bodyRollFactor * (1 + this.speedRatio);
        this.car.rotation.z = THREE.MathUtils.lerp(this.car.rotation.z, targetRoll, 8 * dt);
    }

    /**
     * Returns current speed in km/h for HUD display.
     * @returns {number}
     */
    getSpeedKph() {
        return Math.abs(this.velocity) * 3.6;
    }

    /**
     * Returns current gear estimate (1-6) based on speed.
     * @returns {number}
     */
    getGear() {
        if (this.velocity < -0.5) return 'R';

        const kph = this.getSpeedKph();
        if (kph < 20) return 1;
        if (kph < 50) return 2;
        if (kph < 90) return 3;
        if (kph < 130) return 4;
        if (kph < 170) return 5;
        return 6;
    }

    /**
     * @returns {{ w: boolean, a: boolean, s: boolean, d: boolean, shift: boolean, space: boolean }}
     */
    getKeys() {
        return { ...this.keys, space: this.keys[' '] };
    }

    /**
     * Returns a snapshot of car physics state for CarEffects.
     */
    getState() {
        this._forward.set(0, 0, 1).applyQuaternion(this.car.quaternion);
        return {
            velocity: this.velocity,
            angularVelocity: this.angularVelocity,
            speedRatio: this.speedRatio,
            isBraking: this.keys.s && this.velocity > 0.5,
            isDrifting: this.keys[' '] && Math.abs(this.velocity) > 5,
            isBoosting: this.keys.w && this.keys.shift && this.velocity > 0,
            forward: this._forward.clone(),
        };
    }

    dispose() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
    }

    // ── Private helpers ───────────────────────────────────────────────────

    /**
     * Longitudinal (forward/back) physics with torque curve simulation.
     */
    _updateLongitudinal(dt, t) {
        const actualMaxSpeed = t.maxSpeed * this._currentBoostMultiplier;

        const isHandbraking = this.keys[' '];

        if (this.keys.w && !isHandbraking) {
            // Torque curve: strong off-the-line, tapers at high speed
            const torque = this._torqueAtSpeed(t) * this._currentBoostMultiplier;
            this.velocity += torque * dt;

        } else if (this.keys.s && !isHandbraking) {
            if (this.velocity > 0.5) {
                // Braking while moving forward
                this.velocity -= t.brakingForce * dt;
            } else {
                // Engage reverse with same torque curve as forward
                const torque = this._torqueAtSpeed(t);
                this.velocity -= torque * dt;
            }
        } else {
            // Coasting or Handbraking
            let resistanceForce = t.engineBraking + t.friction * (0.4 + 0.6 * this.speedRatio);

            if (isHandbraking) {
                // Handbrake no longer bleeds massive forward speed (so you can slide).
                // It just adds a tiny bit more friction from the rear tires sliding sideways.
                resistanceForce += t.friction * 1.5;
            }

            if (Math.abs(this.velocity) > 0.15) {
                this.velocity -= Math.sign(this.velocity) * resistanceForce * dt;
            } else {
                this.velocity = 0;
            }
        }

        // Clamp to max speed (reverse is 100% of fwd)
        this.velocity = THREE.MathUtils.clamp(
            this.velocity,
            -actualMaxSpeed,
            actualMaxSpeed
        );
    }

    /**
     * Piecewise torque curve across low/mid/high RPM bands.
     */
    _torqueAtSpeed(t) {
        const [low, mid, high] = t.accelerationCurve;
        const s = this.speedRatio;
        if (s < 0.33) return THREE.MathUtils.lerp(low, mid, s / 0.33);
        if (s < 0.66) return THREE.MathUtils.lerp(mid, high, (s - 0.33) / 0.33);
        return THREE.MathUtils.lerp(high, high * 0.5, (s - 0.66) / 0.34);
    }

    /**
     * Lateral (steering) physics with understeer and stability control.
     */
    _updateLateral(dt, t) {
        const movingForward = this.velocity > 0;
        const reverseSign = movingForward ? 1 : -1;
        const isHandbraking = this.keys[' '];

        // Speed-sensitive steering: wide at low speed, narrower at high speed
        // Handbrake overrides this and allows sharper steering, but less extreme now
        const steerReduction = isHandbraking ? 0.70 : 1 - (this.speedRatio * t.underSteerFactor);
        const effectiveTurn = t.maxTurnAngle * Math.max(steerReduction, 0.15);

        // Grip factor: less grip = harder to steer precisely (= understeer)
        // Handbrake induces oversteer. Reduced from 2.5 to 1.4 for smoother drifts
        const gripFactor = isHandbraking ? 1.4 : THREE.MathUtils.clamp(1 - this.speedRatio * 0.5, 0.2, 1.0);

        let targetAngVel = 0;
        if (this.keys.a) {
            targetAngVel = effectiveTurn * gripFactor * reverseSign;
        } else if (this.keys.d) {
            targetAngVel = -effectiveTurn * gripFactor * reverseSign;
        }

        // Stability control: resist spin-out by dampening angular velocity
        // Handbrake weakens stability control, but retains a bit more than before (0.15 instead of 0.05)
        if (!this.keys.a && !this.keys.d) {
            targetAngVel = 0;
            // Let the angular velocity drop slowly when handbraking, normally snap back fast
            const scBlend = isHandbraking ? 0.15 : t.stabilityControl * Math.pow(this.speedRatio, 0.6);
            this.angularVelocity = THREE.MathUtils.lerp(
                this.angularVelocity, 0, scBlend * 12 * dt
            );
        }

        // Interpolate to target with steering responsiveness
        const lerpRate = t.steeringSensitivity * (1 + this.speedRatio * 0.4);
        this.angularVelocity = THREE.MathUtils.lerp(
            this.angularVelocity, targetAngVel, lerpRate * dt
        );

        // Only turn when car has meaningful speed
        const speedInfluence = THREE.MathUtils.clamp(Math.abs(this.velocity) / 3, 0, 1);
        this.car.rotation.y += this.angularVelocity * speedInfluence;

        // Visual front-wheel steer angle (for mesh animation if needed)
        const maxVisualSteer = 0.45; // ~25 degrees
        this.steerAngle = THREE.MathUtils.lerp(
            this.steerAngle,
            (this.keys.a ? maxVisualSteer : this.keys.d ? -maxVisualSteer : 0),
            8 * dt
        );
    }

    /**
     * Animates all wheel meshes — spin + front-wheel steering rotation.
     */
    _updateWheels(dt, t) {
        this.wheelSpin += this.velocity * dt * t.wheelSpinRate;

        if (!this.car.userData.wheels) return;

        this.car.userData.wheels.forEach((wheel, index) => {
            const tire = wheel.children[0];
            if (!tire) return;

            // Roll all wheels
            tire.rotation.x = this.wheelSpin;

            // Steer only front wheels (index 0, 1 by convention)
            if (index < 2) {
                wheel.rotation.y = this.steerAngle;
            }
        });
    }

    /**
     * Toggles and animates the nitro exhaust flames when accelerating with Shift.
     */
    _updateExhaust(dt) {
        if (!this.car.userData.exhaustFlames) return;

        // Nitro is only active if holding both forward (W) and boost (Shift)
        const isBoosting = this.keys.w && this.keys.shift && this.velocity > 0;

        this.car.userData.exhaustFlames.forEach(flame => {
            flame.visible = isBoosting;

            if (isBoosting) {
                // Random flicker for the fire cone scale
                const randomScale = 1.0 + Math.random() * 0.3; // Scale between 1.0 and 1.3
                flame.scale.set(1, randomScale, 1);

                // Random flicker for the attached point light
                if (flame.children.length > 0) {
                    const light = flame.children[0];
                    light.intensity = 1.5 + Math.random() * 1.5; // Flicker between 1.5 and 3.0 intensity
                }
            }
        });
    }

    // ── Input handlers ────────────────────────────────────────────────────

    _onKeyDown(e) {
        const key = e.key.toLowerCase();
        if (key in this.keys) {
            this.keys[key] = true;
            e.preventDefault();
        }
    }

    _onKeyUp(e) {
        const key = e.key.toLowerCase();
        if (key in this.keys) {
            this.keys[key] = false;
            e.preventDefault();
        }
    }

    dispose() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
    }
}