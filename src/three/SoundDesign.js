import { Howl, Howler } from 'howler';

/**
 * SoundDesign — immersive audio layer for the 3D city.
 *
 * All sounds are synthesized via Web Audio API (no external files needed).
 * Howler.js provides the audio context management and global volume control.
 *
 * Sound layers:
 *  1. Supercar engine   — multi-harmonic sawtooth + square oscillators
 *  2. Traffic noise      — filtered noise loop
 *  3. Bird chirps        — randomized sine sweeps in park areas
 *  4. City ambience      — low-frequency noise hum
 */

export class SoundDesign {
    constructor() {
        this.ctx = null;
        this.started = false;

        // Engine nodes
        this.engine = null;

        // Ambient nodes
        this.trafficNoise = null;
        this.cityAmbience = null;
        this.birdChirps = null;

        // Master gain
        this.masterGain = null;

        // Bird chirp interval
        this._birdInterval = null;
        this._birdTimeout = null;
    }

    /**
     * Initialize and start all sound layers.
     * Must be called from a user gesture (click/keydown).
     */
    start() {
        if (this.started) return;
        try {
            // Use Howler's shared audio context
            this.ctx = Howler.ctx;
            if (!this.ctx) {
                // Force Howler to create context
                Howler.volume(1.0);
                this.ctx = Howler.ctx;
            }
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Resume if suspended (browser autoplay policy)
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }

            // Master gain
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 1.0;
            this.masterGain.connect(this.ctx.destination);

            // Initialize all layers
            this._initEngine();
            this._initTrafficNoise();
            this._initCityAmbience();
            this._initBirdChirps();

            this.started = true;
        } catch (e) {
            console.warn('[SoundDesign] Audio initialization failed:', e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  1. SUPERCAR ENGINE — rich, multi-harmonic growl
    // ═══════════════════════════════════════════════════════════════════════

    _initEngine() {
        const e = {};

        // Engine output gain
        e.gain = this.ctx.createGain();
        e.gain.gain.value = 0.0; // Starts silent, ramps with speed
        e.gain.connect(this.masterGain);

        // Compressor to prevent clipping during hard acceleration
        e.compressor = this.ctx.createDynamicsCompressor();
        e.compressor.threshold.value = -20;
        e.compressor.ratio.value = 8;
        e.compressor.connect(e.gain);

        // Layer 1: Low-end rumble (sawtooth)
        e.lowOsc = this.ctx.createOscillator();
        e.lowOsc.type = 'sawtooth';
        e.lowOsc.frequency.value = 45;
        e.lowGain = this.ctx.createGain();
        e.lowGain.gain.value = 0.35;
        e.lowOsc.connect(e.lowGain);
        e.lowGain.connect(e.compressor);
        e.lowOsc.start();

        // Layer 2: Mid growl (square wave for punch)
        e.midOsc = this.ctx.createOscillator();
        e.midOsc.type = 'square';
        e.midOsc.frequency.value = 90;
        e.midGain = this.ctx.createGain();
        e.midGain.gain.value = 0.15;
        e.midOsc.connect(e.midGain);
        e.midGain.connect(e.compressor);
        e.midOsc.start();

        // Layer 3: High whine (triangle for turbo/supercharger character)
        e.highOsc = this.ctx.createOscillator();
        e.highOsc.type = 'triangle';
        e.highOsc.frequency.value = 180;
        e.highGain = this.ctx.createGain();
        e.highGain.gain.value = 0.08;
        e.highOsc.connect(e.highGain);
        e.highGain.connect(e.compressor);
        e.highOsc.start();

        // Layer 4: Sub-bass throb (sine for deep V8/V12 feel)
        e.subOsc = this.ctx.createOscillator();
        e.subOsc.type = 'sine';
        e.subOsc.frequency.value = 30;
        e.subGain = this.ctx.createGain();
        e.subGain.gain.value = 0.25;
        e.subOsc.connect(e.subGain);
        e.subGain.connect(e.compressor);
        e.subOsc.start();

        // Layer 5: Exhaust crackle (noise-based, filtered)
        e.exhaustNoise = this._createNoiseSource();
        e.exhaustFilter = this.ctx.createBiquadFilter();
        e.exhaustFilter.type = 'bandpass';
        e.exhaustFilter.frequency.value = 800;
        e.exhaustFilter.Q.value = 2;
        e.exhaustGain = this.ctx.createGain();
        e.exhaustGain.gain.value = 0.0; // Only audible on deceleration
        e.exhaustNoise.connect(e.exhaustFilter);
        e.exhaustFilter.connect(e.exhaustGain);
        e.exhaustGain.connect(e.compressor);

        this.engine = e;
    }

    /**
     * Update engine sound based on car state.
     */
    updateEngine(speedRatio, velocity, isBoosting, isBraking) {
        if (!this.started || !this.engine) return;

        const e = this.engine;
        const t = this.ctx.currentTime;
        const sr = Math.min(Math.abs(speedRatio), 1);
        const absVel = Math.abs(velocity);

        // RPM simulation: idle at low freq, rev up with speed
        // Gear shifts create a sawtooth RPM pattern
        const gearRatio = sr < 0.15 ? sr / 0.15 : ((sr * 5) % 1); // Simulated gear drops
        const rpm = 0.2 + sr * 0.8; // 0.2 at idle, 1.0 at redline

        // Low rumble: 45Hz idle → 180Hz at top speed
        e.lowOsc.frequency.setTargetAtTime(45 + rpm * 135, t, 0.08);
        e.lowGain.gain.setTargetAtTime(0.3 + sr * 0.2, t, 0.08);

        // Mid growl: 90Hz idle → 350Hz
        e.midOsc.frequency.setTargetAtTime(90 + rpm * 260, t, 0.08);
        e.midGain.gain.setTargetAtTime(0.1 + sr * 0.2, t, 0.08);

        // High whine: 180Hz → 800Hz (turbo whistle effect)
        e.highOsc.frequency.setTargetAtTime(180 + rpm * 620 + (isBoosting ? 200 : 0), t, 0.06);
        e.highGain.gain.setTargetAtTime(sr * 0.15 + (isBoosting ? 0.1 : 0), t, 0.06);

        // Sub bass: 30Hz → 80Hz
        e.subOsc.frequency.setTargetAtTime(30 + rpm * 50, t, 0.1);
        e.subGain.gain.setTargetAtTime(0.2 + sr * 0.15, t, 0.1);

        // Exhaust crackle: louder on deceleration (engine braking pops)
        const isDecelerating = !isBoosting && sr > 0.2 && absVel > 5;
        e.exhaustGain.gain.setTargetAtTime(isDecelerating ? 0.06 : 0.0, t, 0.05);
        e.exhaustFilter.frequency.setTargetAtTime(600 + sr * 600, t, 0.1);

        // Master engine volume: very quiet at idle, loud under load
        const vol = 0.03 + absVel * 0.004 + (isBoosting ? 0.04 : 0);
        e.gain.gain.setTargetAtTime(Math.min(vol, 0.18), t, 0.08);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  2. TRAFFIC NOISE — distant vehicle hum
    // ═══════════════════════════════════════════════════════════════════════

    _initTrafficNoise() {
        const noise = this._createNoiseSource();

        // Bandpass filter to sound like distant traffic
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 300;
        filter.Q.value = 0.5;

        const gain = this.ctx.createGain();
        gain.gain.value = 0.015; // Very subtle

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        this.trafficNoise = { noise, filter, gain };
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  3. CITY AMBIENCE — low urban hum
    // ═══════════════════════════════════════════════════════════════════════

    _initCityAmbience() {
        const noise = this._createNoiseSource();

        // Very low frequency rumble
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 150;
        filter.Q.value = 0.3;

        // Subtle LFO to make it breathe
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1; // Very slow modulation
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.005;
        lfo.connect(lfoGain);

        const gain = this.ctx.createGain();
        gain.gain.value = 0.012;
        lfoGain.connect(gain.gain); // Modulate volume

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        lfo.start();

        this.cityAmbience = { noise, filter, gain, lfo };
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  4. BIRD CHIRPS — random sine sweeps (park areas)
    // ═══════════════════════════════════════════════════════════════════════

    _initBirdChirps() {
        this.birdChirps = {
            gain: this.ctx.createGain(),
        };
        this.birdChirps.gain.gain.value = 0.0; // Off by default, enabled near park
        this.birdChirps.gain.connect(this.masterGain);

        // Schedule random chirps
        this._scheduleBirdChirp();
    }

    _scheduleBirdChirp() {
        if (!this.started) return;

        const delay = 800 + Math.random() * 3000; // 0.8–3.8 seconds between chirps
        this._birdTimeout = setTimeout(() => {
            if (!this.started || !this.ctx) return;
            this._playChirp();
            this._scheduleBirdChirp();
        }, delay);
    }

    _playChirp() {
        if (!this.ctx || !this.birdChirps) return;
        try {
            const t = this.ctx.currentTime;

            // Create a short sine sweep (chirp sound)
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';

            // Random bird pitch
            const baseFreq = 2000 + Math.random() * 3000; // 2kHz – 5kHz
            osc.frequency.setValueAtTime(baseFreq, t);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.05);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, t + 0.1);

            // Quick tweet pattern (2-3 notes)
            const noteCount = Math.floor(Math.random() * 2) + 2;
            for (let i = 1; i <= noteCount; i++) {
                const nt = t + i * 0.12;
                osc.frequency.setValueAtTime(baseFreq * (1 + Math.random() * 0.3), nt);
                osc.frequency.exponentialRampToValueAtTime(baseFreq * (0.8 + Math.random() * 0.5), nt + 0.06);
            }

            const chirpGain = this.ctx.createGain();
            const duration = 0.1 + noteCount * 0.12;
            chirpGain.gain.setValueAtTime(0, t);
            chirpGain.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.03, t + 0.02);
            chirpGain.gain.setValueAtTime(0.04, t + duration - 0.03);
            chirpGain.gain.linearRampToValueAtTime(0, t + duration);

            osc.connect(chirpGain);
            chirpGain.connect(this.birdChirps.gain);

            osc.start(t);
            osc.stop(t + duration + 0.01);
        } catch (e) {
            // Ignore if audio context is closed
        }
    }

    /**
     * Update ambient sound levels based on car position in the world.
     * @param {THREE.Vector3} carPosition
     */
    updateAmbience(carPosition) {
        if (!this.started) return;

        const x = carPosition.x;
        const z = carPosition.z;
        const t = this.ctx.currentTime;

        // Park area: x=20→180 (bird chirps louder)
        const inPark = x > 15 && x < 185;
        const parkProximity = inPark ? Math.min(1, (x - 15) / 30) : 0;
        if (this.birdChirps) {
            this.birdChirps.gain.gain.setTargetAtTime(parkProximity * 0.06, t, 0.5);
        }

        // Downtown area: x < 0, z < 0 (more traffic noise)
        const inDowntown = x < 10 && z < 10;
        const urbanDensity = inDowntown ? 1.0 : 0.4;
        if (this.trafficNoise) {
            this.trafficNoise.gain.gain.setTargetAtTime(urbanDensity * 0.018, t, 0.5);
        }

        // City ambience everywhere within bounds, quieter in countryside
        const dist = Math.sqrt(x * x + z * z);
        const cityFactor = dist < 200 ? 1.0 : Math.max(0, 1 - (dist - 200) / 100);
        if (this.cityAmbience) {
            this.cityAmbience.gain.gain.setTargetAtTime(cityFactor * 0.015, t, 0.5);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  Utilities
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Creates a continuous noise source using a large AudioBuffer.
     */
    _createNoiseSource() {
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.5;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.start();
        return source;
    }

    /**
     * Set global volume (0–1).
     */
    setVolume(vol) {
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.05);
        }
        Howler.volume(vol);
    }

    /**
     * Clean up all audio nodes.
     */
    dispose() {
        this.started = false;
        if (this._birdTimeout) clearTimeout(this._birdTimeout);

        try {
            if (this.engine) {
                this.engine.lowOsc.stop();
                this.engine.midOsc.stop();
                this.engine.highOsc.stop();
                this.engine.subOsc.stop();
            }
            if (this.cityAmbience) {
                this.cityAmbience.lfo.stop();
            }
            if (this.ctx && this.ctx.state !== 'closed') {
                this.ctx.close();
            }
        } catch (e) { /* ignore cleanup errors */ }
    }
}
