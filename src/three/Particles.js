import * as THREE from 'three';

/**
 * Creates floating particle system for atmospheric effect.
 */
export function createParticles(scene) {
    const count = 500;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const color1 = new THREE.Color(0x6c63ff);
    const color2 = new THREE.Color(0x00d4ff);

    for (let i = 0; i < count; i++) {
        const i3 = i * 3;

        // Spread particles in a large volume
        positions[i3] = (Math.random() - 0.5) * 150;
        positions[i3 + 1] = Math.random() * 40 + 1;
        positions[i3 + 2] = (Math.random() - 0.5) * 150;

        // Random color between accent colors
        const t = Math.random();
        const color = new THREE.Color().lerpColors(color1, color2, t);
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;

        sizes[i] = Math.random() * 2 + 0.5;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
        size: 0.3,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Animation data
    const originalPositions = new Float32Array(positions);

    return {
        update(elapsed) {
            const posAttr = geometry.attributes.position;
            for (let i = 0; i < count; i++) {
                const i3 = i * 3;
                posAttr.array[i3] = originalPositions[i3] + Math.sin(elapsed * 0.3 + i * 0.1) * 0.5;
                posAttr.array[i3 + 1] = originalPositions[i3 + 1] + Math.sin(elapsed * 0.5 + i * 0.2) * 1.0;
                posAttr.array[i3 + 2] = originalPositions[i3 + 2] + Math.cos(elapsed * 0.3 + i * 0.15) * 0.5;
            }
            posAttr.needsUpdate = true;
        },
    };
}
