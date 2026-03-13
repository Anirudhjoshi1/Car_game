import * as THREE from 'three';

// ── Shared Texture Generator ──────────────────────────────────────────────
let particleTexture = null;
function getParticleTexture() {
    if (particleTexture) return particleTexture;

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');

    // Create radial gradient for soft particle edges
    const gradient = context.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    particleTexture = new THREE.CanvasTexture(canvas);
    return particleTexture;
}

/**
 * CarEffects — unified visual and audio effects tied to car physics.
 *
 * Effects:
 *  1. Dynamic brake lights (emissive boost)
 *  2. Tire smoke particles (acceleration, drift, handbrake)
 *  3. Dust particles (high-speed driving)
 *  4. Skid marks (trail on road during sharp turns)
 *  5. Engine sound (Web Audio oscillators)
 */

// ── Particle pool helper ──────────────────────────────────────────────────
class ParticlePool {
    /**
     * @param {THREE.Scene} scene
     * @param {number} maxCount
     * @param {THREE.Color} color
     * @param {number} particleSize
     * @param {number} [opacity=0.6]W
     */
    constructor(scene, maxCount, color, particleSize, opacity = 0.6) {
        this.maxCount = maxCount;
        this.particles = [];

        const positions = new Float32Array(maxCount * 3);
        const alphas = new Float32Array(maxCount);

        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

        this.material = new THREE.PointsMaterial({
            color,
            size: particleSize,
            map: getParticleTexture(),
            alphaMap: getParticleTexture(),
            transparent: true,
            opacity,
            depthWrite: false,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending,
        });

        this.mesh = new THREE.Points(this.geometry, this.material);
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);

        // Initialize particle pool
        for (let i = 0; i < maxCount; i++) {
            this.particles.push({
                alive: false,
                life: 0,
                maxLife: 1,
                x: 0, y: 0, z: 0,
                vx: 0, vy: 0, vz: 0,
            });
        }
    }

    /**
     * Spawn a particle at position with velocity.
     */
    emit(x, y, z, vx, vy, vz, maxLife = 1.0) {
        for (let i = 0; i < this.maxCount; i++) {
            const p = this.particles[i];
            if (!p.alive) {
                p.alive = true;
                p.life = maxLife;
                p.maxLife = maxLife;
                p.x = x; p.y = y; p.z = z;
                p.vx = vx; p.vy = vy; p.vz = vz;
                return;
            }
        }
    }

    /**
     * Update all particles.
     */
    update(delta) {
        const posArr = this.geometry.attributes.position.array;
        const alphaArr = this.geometry.attributes.alpha.array;

        for (let i = 0; i < this.maxCount; i++) {
            const p = this.particles[i];
            if (p.alive) {
                p.life -= delta;
                if (p.life <= 0) {
                    p.alive = false;
                    posArr[i * 3] = 0;
                    posArr[i * 3 + 1] = -1000; // Hide below ground
                    posArr[i * 3 + 2] = 0;
                    alphaArr[i] = 0;
                } else {
                    p.x += p.vx * delta;
                    p.y += p.vy * delta;
                    p.z += p.vz * delta;
                    // Slow down
                    p.vx *= 0.96;
                    p.vy *= 0.96;
                    p.vz *= 0.96;

                    posArr[i * 3] = p.x;
                    posArr[i * 3 + 1] = p.y;
                    posArr[i * 3 + 2] = p.z;
                    alphaArr[i] = p.life / p.maxLife;
                }
            } else {
                posArr[i * 3 + 1] = -1000;
                alphaArr[i] = 0;
            }
        }

        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.alpha.needsUpdate = true;
    }
}

// ── Skid mark trail ───────────────────────────────────────────────────────
class SkidTrail {
    constructor(scene, maxPoints = 200) {
        this.maxPoints = maxPoints;
        this.points = [];
        this.scene = scene;

        const mat = new THREE.MeshBasicMaterial({
            color: 0x111111,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
            side: THREE.DoubleSide,
        });

        this.geometry = new THREE.BufferGeometry();
        // Pre-allocate max vertices (2 per point for width)
        const positions = new Float32Array(maxPoints * 2 * 3);
        const indices = [];
        // Build triangle strip indices
        for (let i = 0; i < maxPoints - 1; i++) {
            const a = i * 2;
            indices.push(a, a + 1, a + 2);
            indices.push(a + 1, a + 3, a + 2);
        }
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setIndex(indices);
        this.geometry.setDrawRange(0, 0);

        this.mesh = new THREE.Mesh(this.geometry, mat);
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);

        this._pointCount = 0;
        this._fadeTimer = 0;
    }

    /**
     * Add a skid mark point at given position with the car's right vector for width.
     */
    addPoint(pos, right, width = 0.3) {
        if (this._pointCount >= this.maxPoints) {
            // Shift everything down by removing oldest
            this.points.shift();
            this._pointCount = this.maxPoints - 1;
        }

        this.points.push({
            left: pos.clone().addScaledVector(right, -width),
            right: pos.clone().addScaledVector(right, width),
        });
        this._pointCount++;

        // Rebuild position attribute
        const posArr = this.geometry.attributes.position.array;
        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i];
            posArr[i * 6] = p.left.x;
            posArr[i * 6 + 1] = p.left.y;
            posArr[i * 6 + 2] = p.left.z;
            posArr[i * 6 + 3] = p.right.x;
            posArr[i * 6 + 4] = p.right.y;
            posArr[i * 6 + 5] = p.right.z;
        }
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.setDrawRange(0, Math.max(0, (this.points.length - 1) * 6));
    }

    /**
     * Gradually fade and clear old marks.
     */
    update(delta) {
        this._fadeTimer += delta;
        // Every 10 seconds, remove some old points
        if (this._fadeTimer > 10 && this.points.length > 20) {
            this.points.splice(0, 10);
            this._pointCount = this.points.length;
            this._fadeTimer = 0;

            const posArr = this.geometry.attributes.position.array;
            for (let i = 0; i < this.points.length; i++) {
                const p = this.points[i];
                posArr[i * 6] = p.left.x;
                posArr[i * 6 + 1] = p.left.y;
                posArr[i * 6 + 2] = p.left.z;
                posArr[i * 6 + 3] = p.right.x;
                posArr[i * 6 + 4] = p.right.y;
                posArr[i * 6 + 5] = p.right.z;
            }
            this.geometry.attributes.position.needsUpdate = true;
            this.geometry.setDrawRange(0, Math.max(0, (this.points.length - 1) * 6));
        }
    }
}

// ── Engine Sound ──────────────────────────────────────────────────────────
class EngineSound {
    constructor() {
        this.ctx = null;
        this.started = false;
        this.lowOsc = null;
        this.highOsc = null;
        this.lowGain = null;
        this.highGain = null;
        this.masterGain = null;
    }

    start() {
        if (this.started) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.08; // Overall volume (subtle)
            this.masterGain.connect(this.ctx.destination);

            // Low rumble oscillator (sawtooth for engine character)
            this.lowOsc = this.ctx.createOscillator();
            this.lowOsc.type = 'sawtooth';
            this.lowOsc.frequency.value = 55; // Base idle frequency
            this.lowGain = this.ctx.createGain();
            this.lowGain.gain.value = 0.6;
            this.lowOsc.connect(this.lowGain);
            this.lowGain.connect(this.masterGain);
            this.lowOsc.start();

            // High whine oscillator (triangle for turbine whine)
            this.highOsc = this.ctx.createOscillator();
            this.highOsc.type = 'triangle';
            this.highOsc.frequency.value = 110;
            this.highGain = this.ctx.createGain();
            this.highGain.gain.value = 0.15;
            this.highOsc.connect(this.highGain);
            this.highGain.connect(this.masterGain);
            this.highOsc.start();

            this.started = true;
        } catch (e) {
            console.warn('[EngineSound] Web Audio not available:', e);
        }
    }

    /**
     * Modulate engine sound based on car speed.
     * @param {number} speedRatio — 0 to 1 (fraction of max speed)
     * @param {number} velocity — raw velocity m/s
     * @param {boolean} isBoosting — nitro active
     */
    update(speedRatio, velocity, isBoosting) {
        if (!this.started || !this.ctx) return;

        const absSpeed = Math.abs(velocity);
        const sr = Math.min(speedRatio, 1);

        // Low oscillator: idle at 55Hz, peaks at ~200Hz
        const lowFreq = 55 + sr * 145;
        this.lowOsc.frequency.setTargetAtTime(lowFreq, this.ctx.currentTime, 0.1);
        this.lowGain.gain.setTargetAtTime(0.4 + sr * 0.4, this.ctx.currentTime, 0.1);

        // High oscillator: kicks in at higher speeds
        const highFreq = 110 + sr * 400 + (isBoosting ? 150 : 0);
        this.highOsc.frequency.setTargetAtTime(highFreq, this.ctx.currentTime, 0.1);
        this.highGain.gain.setTargetAtTime(sr * 0.3, this.ctx.currentTime, 0.1);

        // Master volume ramp based on speed (very quiet at idle)
        const vol = 0.04 + absSpeed * 0.003 + (isBoosting ? 0.03 : 0);
        this.masterGain.gain.setTargetAtTime(Math.min(vol, 0.15), this.ctx.currentTime, 0.1);
    }

    stop() {
        if (!this.started) return;
        try {
            this.lowOsc.stop();
            this.highOsc.stop();
            this.ctx.close();
        } catch (e) { /* ignore */ }
        this.started = false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  CarEffects — Public API
// ═══════════════════════════════════════════════════════════════════════════

export class CarEffects {
    /**
     * @param {THREE.Scene} scene
     * @param {THREE.Object3D} car — car group with userData.headlights, exhaustFlames, etc.
     */
    constructor(scene, car) {
        this.scene = scene;
        this.car = car;

        // Tire smoke particle pool (white-grey)
        this.tireSmoke = new ParticlePool(scene, 60, new THREE.Color(0xcccccc), 1.2, 0.5);

        // Dust particle pool (brownish)
        this.dust = new ParticlePool(scene, 40, new THREE.Color(0x8b7355), 0.8, 0.4);

        // Skid marks (two trails, one per rear wheel)
        this.skidLeft = new SkidTrail(scene, 300);
        this.skidRight = new SkidTrail(scene, 300);

        // Engine sound
        this.engineSound = new EngineSound();

        // Cache vectors
        this._right = new THREE.Vector3();
        this._forward = new THREE.Vector3();
        this._rearLeft = new THREE.Vector3();
        this._rearRight = new THREE.Vector3();

        // Track brake light material refs
        this._brakeLightMats = [];
        this._collectBrakeLightMats();

        // Smoke emit timer
        this._smokeTimer = 0;
        this._dustTimer = 0;
        this._skidTimer = 0;
    }

    /**
     * Find taillight materials on the car for dynamic emissive control.
     */
    _collectBrakeLightMats() {
        this.car.traverse(child => {
            if (child.isMesh && child.material) {
                const c = child.material.color;
                if (c && Math.abs(c.r - 1) < 0.1 && c.g < 0.15 && c.b < 0.15) {
                    // Red-ish emissive material = taillight
                    if (child.material.emissive) {
                        this._brakeLightMats.push(child.material);
                    }
                }
            }
        });
    }

    /**
     * Call once when game starts to begin engine sound.
     */
    startEngine() {
        this.engineSound.start();
    }

    /**
     * Main update — call each frame.
     * @param {number} delta
     * @param {object} state — from CarControls.getState()
     */
    update(delta, state) {
        if (!state) return;

        const { velocity, angularVelocity, speedRatio, isBraking, isDrifting, isBoosting, forward } = state;
        const absVel = Math.abs(velocity);
        const absAng = Math.abs(angularVelocity);

        // ── 1. Dynamic brake lights ───────────────────────────────────────
        const brakeIntensity = isBraking ? 5.0 : (absVel < 0.5 ? 1.5 : 2.0);
        this._brakeLightMats.forEach(mat => {
            mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, brakeIntensity, delta * 10);
        });

        // ── 2. Compute rear wheel world positions ─────────────────────────
        this._forward.set(0, 0, 1).applyQuaternion(this.car.quaternion);
        this._right.set(1, 0, 0).applyQuaternion(this.car.quaternion);

        // Rear wheel positions (relative to car center, scaled by car scale 0.7)
        this._rearLeft.copy(this.car.position)
            .addScaledVector(this._right, -0.8)
            .addScaledVector(this._forward, -1.0);
        this._rearLeft.y = 0.15;

        this._rearRight.copy(this.car.position)
            .addScaledVector(this._right, 0.8)
            .addScaledVector(this._forward, -1.0);
        this._rearRight.y = 0.15;

        // ── 3. Tire smoke ─────────────────────────────────────────────────
        this._smokeTimer += delta;
        const shouldSmoke = (isBoosting && absVel > 5) || isDrifting || (absAng > 0.02 && absVel > 15);

        // Emit less frequently when smoking to save performance
        const smokeInterval = shouldSmoke && isBoosting && !isDrifting ? 0.08 : 0.03;

        if (shouldSmoke && this._smokeTimer > smokeInterval) {
            this._smokeTimer = 0;
            // Emit from both rear wheels
            for (const wheelPos of [this._rearLeft, this._rearRight]) {
                const spread = 0.5;
                this.tireSmoke.emit(
                    wheelPos.x + (Math.random() - 0.5) * spread,
                    wheelPos.y,
                    wheelPos.z + (Math.random() - 0.5) * spread,
                    (Math.random() - 0.5) * 2,  // vx
                    1.5 + Math.random() * 2,     // vy (rise)
                    (Math.random() - 0.5) * 2,   // vz
                    0.8 + Math.random() * 0.4     // life
                );
            }
        }

        // ── 4. Dust particles ─────────────────────────────────────────────
        this._dustTimer += delta;
        if (absVel > 10 && this._dustTimer > 0.05) {
            this._dustTimer = 0;
            const dustPos = this.car.position.clone()
                .addScaledVector(this._forward, -1.5);
            dustPos.y = 0.1;

            for (let i = 0; i < 2; i++) {
                this.dust.emit(
                    dustPos.x + (Math.random() - 0.5) * 1.5,
                    dustPos.y,
                    dustPos.z + (Math.random() - 0.5) * 1.5,
                    -this._forward.x * absVel * 0.1 + (Math.random() - 0.5) * 2, // Less forward momentum for dust to hang around
                    1.0 + Math.random() * 2.0, // More vertical rise for dusty look
                    -this._forward.z * absVel * 0.1 + (Math.random() - 0.5) * 2,
                    1.2 + Math.random() * 0.8 // Longer life for dust
                );
            }
        }

        // ── 5. Skid marks ─────────────────────────────────────────────────
        this._skidTimer += delta;
        const shouldSkid = (absAng > 0.015 && absVel > 12) || isDrifting;

        if (shouldSkid && this._skidTimer > 0.04) {
            this._skidTimer = 0;
            this.skidLeft.addPoint(this._rearLeft, this._right, 0.15);
            this.skidRight.addPoint(this._rearRight, this._right, 0.15);
        }

        // ── 6. Update particle pools ──────────────────────────────────────
        this.tireSmoke.update(delta);
        this.dust.update(delta);
        this.skidLeft.update(delta);
        this.skidRight.update(delta);

        // ── 7. Engine sound ───────────────────────────────────────────────
        this.engineSound.update(speedRatio, velocity, isBoosting);
    }

    dispose() {
        this.engineSound.stop();
    }
}
