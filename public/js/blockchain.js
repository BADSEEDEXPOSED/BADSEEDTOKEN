import * as THREE from 'three';

export class BlockchainNetwork {
    constructor(scene, options = {}) {
        this.scene = scene;
        
        // Configurable options with defaults
        this.particleCount = options.particleCount || 60;
        this.connectionDistance = options.connectionDistance || 7;
        this.range = options.range || { x: 30, y: 30, z: 20 };
        this.cubeSize = options.cubeSize || 0.5;
        this.speedFactor = options.speed || 0.02;
        this.color = options.color || 0xeeeeee;
        
        // Rotation dynamics
        this.rotationVelocity = new THREE.Vector3(0, 0.0005, 0);
        this.targetRotationVelocity = new THREE.Vector3(0, 0.0005, 0);
        this.nextRotationChangeTime = 0;

        this.particlesData = [];
        this.interactionPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        this.raycaster = new THREE.Raycaster();
        
        this.isEnlarged = false;

        // Groups
        this.meshGroup = new THREE.Group();
        if (options.position) {
            this.meshGroup.position.copy(options.position);
        }
        this.scene.add(this.meshGroup);

        this.initCubes();
        this.initLines();
    }

    initCubes() {
        // Geometry for the nodes (cubes)
        const geometry = new THREE.BoxGeometry(this.cubeSize, this.cubeSize, this.cubeSize);
        
        // Load and process texture to ensure it's Grayscale
        const textureLoader = new THREE.TextureLoader();
        const map = textureLoader.load('/badseed.gif', (tex) => {
            // Once loaded, we could potentially process it, but standard loader is async.
            // For simplicity in this setup, we rely on the material settings and scene lighting
            // to enforce the "Silver/Black" look. 
            // If the GIF has color, the metallic reflection will overpower it mostly, 
            // but let's try to desaturate via color setting.
            tex.colorSpace = THREE.SRGBColorSpace;
        });

        // Chrome Material
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff, 
            map: map,
            metalness: 1.0,   // Full metal for chrome look
            roughness: 0.15,  // Very smooth
            envMapIntensity: 1.5 // Emphasize reflections
        });

        // InstancedMesh for performance
        this.cubesMesh = new THREE.InstancedMesh(geometry, material, this.particleCount);
        this.meshGroup.add(this.cubesMesh);

        const dummy = new THREE.Object3D();

        // Initialize particle positions, velocities, and rotation speeds
        for (let i = 0; i < this.particleCount; i++) {
            const x = (Math.random() - 0.5) * this.range.x;
            const y = (Math.random() - 0.5) * this.range.y;
            const z = (Math.random() - 0.5) * this.range.z;

            this.particlesData.push({
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * this.speedFactor,
                    (Math.random() - 0.5) * this.speedFactor,
                    (Math.random() - 0.5) * this.speedFactor
                ),
                position: new THREE.Vector3(x, y, z),
                // Individual rotation properties
                rotation: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, 0),
                rotSpeed: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.02
                )
            });

            dummy.position.set(x, y, z);
            dummy.rotation.copy(this.particlesData[i].rotation);
            dummy.updateMatrix();
            this.cubesMesh.setMatrixAt(i, dummy.matrix);
        }
        this.cubesMesh.instanceMatrix.needsUpdate = true;
    }

    toggleSize() {
        this.isEnlarged = !this.isEnlarged;
    }

    initLines() {
        // Line material - Brighter silver
        const material = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.15,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        // Max possible segments 
        const maxConnections = (this.particleCount * (this.particleCount - 1)) / 2;
        // Each connection might have up to 3 segments for Manhattan distance (x-move, y-move, z-move)
        const positions = new Float32Array(maxConnections * 3 * 2 * 3); // 3 segments * 2 points per segment * 3 coords

        this.linesGeometry = new THREE.BufferGeometry();
        this.linesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.linesGeometry.setDrawRange(0, 0);

        this.linesMesh = new THREE.LineSegments(this.linesGeometry, material);
        this.meshGroup.add(this.linesMesh);
    }

    update(time, mouse, camera) {
        const dummy = new THREE.Object3D();
        let vertexIndex = 0;
        const positions = this.linesGeometry.attributes.position.array;

        const rX = this.range.x / 2;
        const rY = this.range.y / 2;
        const rZ = this.range.z / 2;

        // Calculate Interaction Target
        let targetPos = null;
        if (mouse && camera) {
            this.raycaster.setFromCamera(mouse, camera);
            
            // Create a target point in local space to attract/repel particles
            // We'll project the ray onto the z=0 plane of the group
            
            // Transform ray into local space of the meshGroup
            const inverseMatrix = new THREE.Matrix4().copy(this.meshGroup.matrixWorld).invert();
            this.raycaster.ray.applyMatrix4(inverseMatrix);
            
            const target = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.interactionPlane, target)) {
                targetPos = target;
            }
        }

        // Update particles
        for (let i = 0; i < this.particleCount; i++) {
            const data = this.particlesData[i];

            // Interactive Force (Repulsion)
            if (targetPos) {
                const dist = data.position.distanceTo(targetPos);
                const repulsionRadius = 8.0;
                if (dist < repulsionRadius) {
                    const force = new THREE.Vector3().subVectors(data.position, targetPos);
                    force.normalize();
                    // Push away stronger when closer
                    const strength = (1 - dist / repulsionRadius) * 0.1; 
                    data.velocity.addScaledVector(force, strength);
                }
            }

            // Move
            data.position.add(data.velocity);

            // Dampen velocity slightly to prevent explosion from interaction
            data.velocity.multiplyScalar(0.98);
            
            // Ensure minimum movement speed so they don't stop completely
            if (data.velocity.lengthSq() < (this.speedFactor * this.speedFactor)) {
                 data.velocity.normalize().multiplyScalar(this.speedFactor);
            }

            // Boundary check - bounce back softly
            if (data.position.x < -rX || data.position.x > rX) data.velocity.x *= -1;
            if (data.position.y < -rY || data.position.y > rY) data.velocity.y *= -1;
            if (data.position.z < -rZ || data.position.z > rZ) data.velocity.z *= -1;

            // Update individual cube rotation
            data.rotation.x += data.rotSpeed.x;
            data.rotation.y += data.rotSpeed.y;
            
            // Update cubes
            dummy.position.copy(data.position);
            dummy.rotation.copy(data.rotation);
            
            // Apply scale based on toggle state
            const currentScale = this.isEnlarged ? 4.0 : 1.0;
            dummy.scale.setScalar(currentScale);

            dummy.updateMatrix();
            this.cubesMesh.setMatrixAt(i, dummy.matrix);

            // Check connections
            for (let j = i + 1; j < this.particleCount; j++) {
                const dataB = this.particlesData[j];
                const distSq = data.position.distanceToSquared(dataB.position);

                if (distSq < this.connectionDistance * this.connectionDistance) {
                    // Manhattan (Orthogonal) Connection
                    
                    const x1 = data.position.x;
                    const y1 = data.position.y;
                    const z1 = data.position.z;

                    const x2 = dataB.position.x;
                    const y2 = dataB.position.y;
                    const z2 = dataB.position.z;

                    // Segment 1: X-axis move
                    positions[vertexIndex++] = x1;
                    positions[vertexIndex++] = y1;
                    positions[vertexIndex++] = z1;

                    positions[vertexIndex++] = x2;
                    positions[vertexIndex++] = y1;
                    positions[vertexIndex++] = z1;

                    // Segment 2: Y-axis move
                    positions[vertexIndex++] = x2;
                    positions[vertexIndex++] = y1;
                    positions[vertexIndex++] = z1;

                    positions[vertexIndex++] = x2;
                    positions[vertexIndex++] = y2;
                    positions[vertexIndex++] = z1;

                    // Segment 3: Z-axis move
                    positions[vertexIndex++] = x2;
                    positions[vertexIndex++] = y2;
                    positions[vertexIndex++] = z1;

                    positions[vertexIndex++] = x2;
                    positions[vertexIndex++] = y2;
                    positions[vertexIndex++] = z2;
                }
            }
        }

        this.cubesMesh.instanceMatrix.needsUpdate = true;
        this.linesGeometry.setDrawRange(0, vertexIndex / 3);
        this.linesGeometry.attributes.position.needsUpdate = true;
        
        // Update rotation direction periodically to change scene orientation
        if (time > this.nextRotationChangeTime) {
            // Pick a new random rotation axis and speed
            this.targetRotationVelocity.set(
                (Math.random() - 0.5) * 0.002, 
                (Math.random() - 0.5) * 0.002, 
                (Math.random() - 0.5) * 0.002
            );
            // Change again in 5 to 13 seconds
            this.nextRotationChangeTime = time + 5 + Math.random() * 8;
        }

        // Smoothly interpolate current velocity to target
        this.rotationVelocity.lerp(this.targetRotationVelocity, 0.015);

        // Apply rotation
        this.meshGroup.rotation.x += this.rotationVelocity.x;
        this.meshGroup.rotation.y += this.rotationVelocity.y;
        this.meshGroup.rotation.z += this.rotationVelocity.z;
    }
}