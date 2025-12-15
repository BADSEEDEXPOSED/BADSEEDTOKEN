import { SceneManager } from './scene.js';
import { BlockchainNetwork } from './blockchain.js';
import { FractalOverlay } from './overlay.js';
import * as THREE from 'three';

class App {
    constructor() {
        this.sceneManager = new SceneManager('canvas-container');
        
        // Post-processing setup for Overlay
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.renderTarget = new THREE.WebGLRenderTarget(width, height);
        
        // Overlay Scene
        this.overlay = new FractalOverlay();
        this.overlayScene = new THREE.Scene();
        this.overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.overlayScene.add(this.overlay.mesh);
        
        // Main Foreground Layer
        this.blockchain = new BlockchainNetwork(this.sceneManager.scene, {
            particleCount: 80,
            connectionDistance: 9,
            speed: 0.005,
            range: { x: 35, y: 35, z: 20 },
            cubeSize: 0.5
        });

        // Background Layer
        this.bgBlockchain = new BlockchainNetwork(this.sceneManager.scene, {
            particleCount: 150,
            connectionDistance: 12,
            speed: 0.003,
            range: { x: 60, y: 50, z: 40 },
            cubeSize: 0.25,
            position: new THREE.Vector3(0, 0, -15)
        });

        // Bind context
        this.animate = this.animate.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);

        window.addEventListener('resize', this.onWindowResize);
        
        // Toggle cube size on double click/tap
        window.addEventListener('dblclick', () => {
            this.blockchain.toggleSize();
            this.bgBlockchain.toggleSize();
        });

        this.animate();
    }

    onWindowResize() {
        this.sceneManager.onWindowResize();
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.renderTarget.setSize(width, height);
        this.overlay.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(this.animate);

        const time = performance.now() * 0.001;

        // Update Animations
        // Pass mouse and camera to blockchain for interaction
        this.blockchain.update(time, this.sceneManager.mouse, this.sceneManager.camera);
        this.bgBlockchain.update(time); // Background doesn't need interaction
        this.overlay.update(time);

        // Update controls
        if (this.sceneManager.controls) {
            this.sceneManager.controls.update();
        }

        // Render Step 1: Draw Scene to RenderTarget
        this.sceneManager.renderer.setRenderTarget(this.renderTarget);
        this.sceneManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);

        // Render Step 2: Draw Overlay (which samples RenderTarget) to Screen
        this.sceneManager.renderer.setRenderTarget(null);
        this.overlay.material.uniforms.tDiffuse.value = this.renderTarget.texture;
        this.sceneManager.renderer.render(this.overlayScene, this.overlayCamera);
    }
}

new App();