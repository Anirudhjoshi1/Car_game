import * as THREE from 'three';

const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1b, roughness: 1.0 });
const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2e5c1e, roughness: 0.8 });
const grassMat = new THREE.MeshStandardMaterial({ color: 0x3a7c2a, roughness: 1.0 });
const bushMat = new THREE.MeshStandardMaterial({ color: 0x2d6b1e, roughness: 0.9 });
const mountainMat = new THREE.MeshStandardMaterial({ color: 0x6b7b5a, roughness: 1.0 });
const snowMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.6 });
const gardenGrassMat = new THREE.MeshStandardMaterial({ color: 0x4a9e36, roughness: 1.0 });
const flowerRedMat = new THREE.MeshStandardMaterial({ color: 0xff4466, emissive: 0xff2244, emissiveIntensity: 0.2 });
const flowerYellowMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffaa00, emissiveIntensity: 0.2 });
const flowerBlueMat = new THREE.MeshStandardMaterial({ color: 0x4488ff, emissive: 0x2266ff, emissiveIntensity: 0.2 });

export class NatureManager {
    constructor(scene) {
        this.scene = scene;
        this.maxTrees = 1000;
        this.treeCount = 0;
        this.trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.7, 4, 6), trunkMat, this.maxTrees);
        this.leaves = new THREE.InstancedMesh(new THREE.ConeGeometry(2.5, 5, 6), leavesMat, this.maxTrees);
        this.trunks.castShadow = true;
        this.leaves.castShadow = true;
        this.scene.add(this.trunks);
        this.scene.add(this.leaves);
        this.collisionBoxes = [];

        // Instanced bushes
        this.maxBushes = 500;
        this.bushCount = 0;
        this.bushes = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), bushMat, this.maxBushes);
        this.bushes.castShadow = true;
        this.scene.add(this.bushes);
    }

    addTree(x, z, scale = 1) {
        if (this.treeCount >= this.maxTrees) return null;
        const dummy = new THREE.Object3D();
        dummy.position.set(x, 2 * scale, z);
        dummy.scale.set(scale, scale, scale);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        dummy.updateMatrix();
        this.trunks.setMatrixAt(this.treeCount, dummy.matrix);

        dummy.position.set(x, 5 * scale, z);
        dummy.updateMatrix();
        this.leaves.setMatrixAt(this.treeCount, dummy.matrix);

        this.treeCount++;

        if (scale > 0.8) {
            const collider = new THREE.Mesh(new THREE.BoxGeometry(1 * scale, 10 * scale, 1 * scale));
            collider.position.set(x, 5 * scale, z);
            collider.visible = false;
            this.scene.add(collider);
            this.collisionBoxes.push(collider);
            return collider;
        }
        return null;
    }

    /**
     * Adds an instanced bush at the given position.
     */
    addBush(x, z, scale = 1) {
        if (this.bushCount >= this.maxBushes) return;
        const dummy = new THREE.Object3D();
        dummy.position.set(x, 0.5 * scale, z);
        dummy.scale.set(scale * 1.4, scale * 0.8, scale * 1.4);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        dummy.updateMatrix();
        this.bushes.setMatrixAt(this.bushCount, dummy.matrix);
        this.bushCount++;
    }

    updateInstanceMatrix() {
        this.trunks.instanceMatrix.needsUpdate = true;
        this.leaves.instanceMatrix.needsUpdate = true;
        this.trunks.count = this.treeCount;
        this.leaves.count = this.treeCount;

        this.bushes.instanceMatrix.needsUpdate = true;
        this.bushes.count = this.bushCount;
    }

    createParkArea(cx, cz, w, d) {
        const grass = new THREE.Mesh(new THREE.PlaneGeometry(w, d), grassMat);
        grass.rotation.x = -Math.PI / 2;
        grass.position.set(cx, 0.02, cz);
        grass.receiveShadow = true;
        this.scene.add(grass);
    }

    /**
     * Creates a garden area with grass, flower beds, and bushes.
     */
    createGardenArea(cx, cz, w, d) {
        const garden = new THREE.Mesh(new THREE.PlaneGeometry(w, d), gardenGrassMat);
        garden.rotation.x = -Math.PI / 2;
        garden.position.set(cx, 0.025, cz);
        garden.receiveShadow = true;
        this.scene.add(garden);

        // Flower beds along the edges
        const flowerMats = [flowerRedMat, flowerYellowMat, flowerBlueMat];
        const bedCount = Math.floor(w / 6);
        for (let i = 0; i < bedCount; i++) {
            const fx = cx - w / 2 + 3 + i * 6;
            for (const fzOff of [-d / 2 + 1.5, d / 2 - 1.5]) {
                const fz = cz + fzOff;
                const mat = flowerMats[Math.floor(Math.random() * flowerMats.length)];
                const flower = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 1.5), mat);
                flower.position.set(fx, 0.15, fz);
                flower.receiveShadow = true;
                this.scene.add(flower);
            }
        }

        // Scatter bushes inside
        const bushCount = Math.floor((w * d) / 100);
        for (let i = 0; i < bushCount; i++) {
            const bx = cx - w / 2 + 2 + Math.random() * (w - 4);
            const bz = cz - d / 2 + 3 + Math.random() * (d - 6);
            this.addBush(bx, bz, 0.4 + Math.random() * 0.5);
        }
    }

    /**
     * Creates a distant mountain range around the world edges.
     */
    createMountainRange() {
        const mountains = new THREE.Group();

        const positions = [
            // North chain
            { x: -180, z: -260, h: 60, r: 40 },
            { x: -100, z: -280, h: 90, r: 50 },
            { x: -20, z: -270, h: 75, r: 45 },
            { x: 60, z: -285, h: 100, r: 55 },
            { x: 140, z: -265, h: 70, r: 42 },
            // East chain
            { x: 270, z: -150, h: 85, r: 48 },
            { x: 280, z: -50, h: 110, r: 55 },
            { x: 275, z: 50, h: 80, r: 45 },
            { x: 265, z: 140, h: 95, r: 50 },
            // South chain
            { x: 160, z: 270, h: 75, r: 44 },
            { x: 60, z: 280, h: 100, r: 55 },
            { x: -40, z: 270, h: 65, r: 40 },
            { x: -140, z: 275, h: 90, r: 50 },
            // West chain
            { x: -270, z: 140, h: 80, r: 46 },
            { x: -280, z: 40, h: 105, r: 55 },
            { x: -275, z: -60, h: 70, r: 42 },
            { x: -265, z: -160, h: 95, r: 52 },
        ];

        positions.forEach(({ x, z, h, r }) => {
            const mtn = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), mountainMat);
            mtn.position.set(x, h / 2, z);
            mtn.castShadow = true;
            mountains.add(mtn);

            // Snow cap on taller peaks
            if (h > 70) {
                const capH = h * 0.25;
                const capR = r * 0.35;
                const cap = new THREE.Mesh(new THREE.ConeGeometry(capR, capH, 7), snowMat);
                cap.position.set(x, h - capH / 2, z);
                mountains.add(cap);
            }

            // Secondary smaller peak nearby
            const sx = x + (Math.random() - 0.5) * r;
            const sz = z + (Math.random() - 0.5) * r;
            const sh = h * (0.4 + Math.random() * 0.3);
            const sr = r * 0.6;
            const sub = new THREE.Mesh(new THREE.ConeGeometry(sr, sh, 6), mountainMat);
            sub.position.set(sx, sh / 2, sz);
            mountains.add(sub);
        });

        this.scene.add(mountains);
    }
}
