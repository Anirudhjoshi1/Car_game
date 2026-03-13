import * as THREE from 'three';

/**
 * DayNightCycle — drives a smooth, continuous day-night cycle.
 *
 * timeOfDay (0—1):  0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
 *
 * One full cycle ≈ 120 seconds (configurable via cycleDuration).
 */

// ── Color presets for 4 key times ─────────────────────────────────────────
const SKY_PRESETS = {
    // timeOfDay ~0.0  (midnight)
    night: {
        top: new THREE.Color(0x0a0a2e),
        horizon: new THREE.Color(0x111133),
        bottom: new THREE.Color(0x060612),
        fog: new THREE.Color(0x060612),
        sunColor: new THREE.Color(0x334477),
        ambientColor: new THREE.Color(0x111133),
        ambientIntensity: 0.12,
        hemiSky: new THREE.Color(0x111133),
        hemiGround: new THREE.Color(0x060612),
        hemiIntensity: 0.1,
        dirIntensity: 0.05,
        dirColor: new THREE.Color(0x334477),
        fillIntensity: 0.05,
        fogDensity: 0.012,
    },
    // timeOfDay ~0.25  (sunrise / dawn)
    dawn: {
        top: new THREE.Color(0x1a1a4e),
        horizon: new THREE.Color(0xff7744),
        bottom: new THREE.Color(0xffaa66),
        fog: new THREE.Color(0xffaa88),
        sunColor: new THREE.Color(0xff8844),
        ambientColor: new THREE.Color(0xff9966),
        ambientIntensity: 0.35,
        hemiSky: new THREE.Color(0xff8855),
        hemiGround: new THREE.Color(0x886644),
        hemiIntensity: 0.4,
        dirIntensity: 1.2,
        dirColor: new THREE.Color(0xffaa66),
        fillIntensity: 0.2,
        fogDensity: 0.009,
    },
    // timeOfDay ~0.5  (noon)
    day: {
        top: new THREE.Color(0x3399ff),
        horizon: new THREE.Color(0x88bbff),
        bottom: new THREE.Color(0xcccccc),
        fog: new THREE.Color(0xcccccc),
        sunColor: new THREE.Color(0xffffee),
        ambientColor: new THREE.Color(0xffffff),
        ambientIntensity: 0.6,
        hemiSky: new THREE.Color(0x88ccff),
        hemiGround: new THREE.Color(0x888866),
        hemiIntensity: 0.8,
        dirIntensity: 2.5,
        dirColor: new THREE.Color(0xffffee),
        fillIntensity: 0.5,
        fogDensity: 0.008,
    },
    // timeOfDay ~0.75  (sunset / dusk)
    dusk: {
        top: new THREE.Color(0x1a1a4e),
        horizon: new THREE.Color(0xff5533),
        bottom: new THREE.Color(0xff7744),
        fog: new THREE.Color(0xff8866),
        sunColor: new THREE.Color(0xff6633),
        ambientColor: new THREE.Color(0xff7744),
        ambientIntensity: 0.3,
        hemiSky: new THREE.Color(0xff6644),
        hemiGround: new THREE.Color(0x664433),
        hemiIntensity: 0.35,
        dirIntensity: 1.0,
        dirColor: new THREE.Color(0xff7744),
        fillIntensity: 0.15,
        fogDensity: 0.01,
    },
};

// Helper: lerp a THREE.Color in place
function lerpColor(target, a, b, t) {
    target.r = a.r + (b.r - a.r) * t;
    target.g = a.g + (b.g - a.g) * t;
    target.b = a.b + (b.b - a.b) * t;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

export class DayNightCycle {
    /**
     * @param {object} opts
     * @param {object} opts.lights       — { dirLight, ambient, hemi, fillLight } from Lighting.js
     * @param {THREE.Mesh} opts.skyMesh  — the skybox sphere with ShaderMaterial
     * @param {THREE.Mesh} opts.sunMesh  — the sun sphere
     * @param {THREE.Group[]} opts.streetLightGroups — groups created by createStreetLight
     * @param {THREE.Object3D} opts.car  — car group with userData.headlights
     * @param {THREE.Scene} opts.scene
     * @param {number} [opts.cycleDuration=120] — seconds for one full day
     */
    constructor(opts) {
        this.lights = opts.lights;
        this.skyMesh = opts.skyMesh;
        this.sunMesh = opts.sunMesh;
        this.streetLightGroups = opts.streetLightGroups || [];
        this.car = opts.car;
        this.scene = opts.scene;
        this.cycleDuration = opts.cycleDuration || 120;

        // Start at early morning (0.3 = just after sunrise for a nice intro)
        this.timeOfDay = 0.3;

        // Cache reusable colors to avoid GC
        this._tmpTop = new THREE.Color();
        this._tmpHorizon = new THREE.Color();
        this._tmpBottom = new THREE.Color();
        this._tmpFog = new THREE.Color();
        this._tmpSunColor = new THREE.Color();
        this._tmpAmbient = new THREE.Color();
        this._tmpHemiSky = new THREE.Color();
        this._tmpHemiGround = new THREE.Color();
        this._tmpDirColor = new THREE.Color();

        this._nightActive = false;
    }

    /**
     * Advances the cycle. Call once per frame.
     * @param {number} delta — seconds since last frame
     */
    update(delta) {
        // Advance time
        this.timeOfDay = (this.timeOfDay + delta / this.cycleDuration) % 1.0;

        // Determine which two presets we are between and the blend factor
        const { presetA, presetB, t } = this._getBlendPresets(this.timeOfDay);

        // ── 1. Sky shader uniforms ────────────────────────────────────────
        if (this.skyMesh && this.skyMesh.material.uniforms) {
            const u = this.skyMesh.material.uniforms;
            lerpColor(this._tmpTop, presetA.top, presetB.top, t);
            lerpColor(this._tmpHorizon, presetA.horizon, presetB.horizon, t);
            lerpColor(this._tmpBottom, presetA.bottom, presetB.bottom, t);
            u.topColor.value.copy(this._tmpTop);
            u.horizonColor.value.copy(this._tmpHorizon);
            u.bottomColor.value.copy(this._tmpBottom);
        }

        // ── 2. Sun position (orbital path) ────────────────────────────────
        // Sun angle: 0 at midnight (below horizon), π at noon (highest point)
        const sunAngle = this.timeOfDay * Math.PI * 2;
        const sunRadius = 250;
        const sunY = Math.sin(sunAngle) * sunRadius;
        const sunX = Math.cos(sunAngle) * sunRadius * 0.8;
        const sunZ = -100; // Keep constant Z for simplicity

        if (this.sunMesh) {
            this.sunMesh.position.set(sunX, sunY, sunZ);
            // Hide sun below horizon
            this.sunMesh.visible = sunY > -10;
        }

        // ── 3. Directional light follows sun ──────────────────────────────
        if (this.lights.dirLight) {
            this.lights.dirLight.position.set(sunX, Math.max(sunY, 10), sunZ);
            lerpColor(this._tmpDirColor, presetA.dirColor, presetB.dirColor, t);
            this.lights.dirLight.color.copy(this._tmpDirColor);
            this.lights.dirLight.intensity = lerp(presetA.dirIntensity, presetB.dirIntensity, t);
        }

        // ── 4. Ambient light ──────────────────────────────────────────────
        if (this.lights.ambient) {
            lerpColor(this._tmpAmbient, presetA.ambientColor, presetB.ambientColor, t);
            this.lights.ambient.color.copy(this._tmpAmbient);
            this.lights.ambient.intensity = lerp(presetA.ambientIntensity, presetB.ambientIntensity, t);
        }

        // ── 5. Hemisphere light ───────────────────────────────────────────
        if (this.lights.hemi) {
            lerpColor(this._tmpHemiSky, presetA.hemiSky, presetB.hemiSky, t);
            lerpColor(this._tmpHemiGround, presetA.hemiGround, presetB.hemiGround, t);
            this.lights.hemi.color.copy(this._tmpHemiSky);
            this.lights.hemi.groundColor.copy(this._tmpHemiGround);
            this.lights.hemi.intensity = lerp(presetA.hemiIntensity, presetB.hemiIntensity, t);
        }

        // ── 6. Fill light ─────────────────────────────────────────────────
        if (this.lights.fillLight) {
            this.lights.fillLight.intensity = lerp(presetA.fillIntensity, presetB.fillIntensity, t);
        }

        // ── 7. Fog ────────────────────────────────────────────────────────
        if (this.scene.fog) {
            lerpColor(this._tmpFog, presetA.fog, presetB.fog, t);
            // FogExp2 doesn't have a color setter, but we can set it
            this.scene.fog.color.copy(this._tmpFog);
            this.scene.fog.density = lerp(presetA.fogDensity, presetB.fogDensity, t);
        }

        // ── 8. Night effects (street lights + headlights) ─────────────────
        const isNight = sunY < 30; // Activate when sun is low
        if (isNight !== this._nightActive) {
            this._nightActive = isNight;
            this._toggleNightEffects(isNight);
        }
    }

    /**
     * Returns the current timeOfDay (0–1).
     */
    getTimeOfDay() {
        return this.timeOfDay;
    }

    /**
     * Returns true if it is currently "night" (street lights on).
     */
    isNight() {
        return this._nightActive;
    }

    // ── Private ────────────────────────────────────────────────────────────

    /**
     * Determines which two presets to blend and the interpolation factor.
     */
    _getBlendPresets(t) {
        // Segments: night(0→0.2), dawn(0.2→0.35), day(0.35→0.65), dusk(0.65→0.8), night(0.8→1.0)
        const P = SKY_PRESETS;

        if (t < 0.2) {
            // Night
            return { presetA: P.night, presetB: P.night, t: 0 };
        } else if (t < 0.35) {
            // Night → Dawn
            return { presetA: P.night, presetB: P.dawn, t: (t - 0.2) / 0.15 };
        } else if (t < 0.45) {
            // Dawn → Day
            return { presetA: P.dawn, presetB: P.day, t: (t - 0.35) / 0.1 };
        } else if (t < 0.65) {
            // Day
            return { presetA: P.day, presetB: P.day, t: 0 };
        } else if (t < 0.75) {
            // Day → Dusk
            return { presetA: P.day, presetB: P.dusk, t: (t - 0.65) / 0.1 };
        } else if (t < 0.85) {
            // Dusk → Night
            return { presetA: P.dusk, presetB: P.night, t: (t - 0.75) / 0.1 };
        } else {
            // Night
            return { presetA: P.night, presetB: P.night, t: 0 };
        }
    }

    /**
     * Toggle street light emissive glow and car headlights.
     */
    _toggleNightEffects(on) {
        const emissiveIntensity = on ? 1.5 : 0.0;

        // Street light bulbs — traverse all street light groups
        this.streetLightGroups.forEach(group => {
            group.traverse(child => {
                if (child.isMesh && child.material && child.material.emissive) {
                    // Only toggle emissive on light-colored materials (the bulb meshes)
                    const hex = child.material.color.getHex();
                    if (hex === 0xffffee || hex === 0x00d4ff) {
                        child.material.emissiveIntensity = on ? 1.5 : 0.3;
                    }
                }
            });
        });

        // Car headlights
        if (this.car && this.car.userData.headlights) {
            this.car.userData.headlights.forEach(light => {
                light.visible = on;
            });
        }

        // Car headlight emissive meshes brightness
        if (this.car && this.car.userData.headlightMeshes) {
            this.car.userData.headlightMeshes.forEach(mesh => {
                mesh.material.emissiveIntensity = on ? 4.0 : 1.5;
            });
        }
    }
}
