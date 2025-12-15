import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000); // Pure black
        this.scene.fog = new THREE.FogExp2(0x000000, 0.020);

        // Camera
        this.camera = new THREE.PerspectiveCamera(70, this.width / this.height, 0.1, 100);
        this.camera.position.z = 8;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        this.setupLights();
        this.setupEnvironment();

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Mouse tracking
        this.mouse = new THREE.Vector2(0, 0);
        this.raycaster = new THREE.Raycaster();
        
        // Use window for events to ensure we catch them even if off-canvas momentarily
        window.addEventListener('mousemove', (event) => {
            // Calculate mouse position in normalized device coordinates
            // (-1 to +1) for both components
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        });

        // Resize handler
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    setupLights() {
        this.scene.add(this.camera); // Add camera to scene

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
        this.scene.add(ambientLight);

        // Stark white point lights for high contrast silver look
        const light1 = new THREE.PointLight(0xffffff, 300, 50);
        light1.position.set(15, 15, 15);
        this.scene.add(light1);

        const light2 = new THREE.PointLight(0xffffff, 300, 50); // Pure white, no blue
        light2.position.set(-15, -15, 10);
        this.scene.add(light2);
        
        const light3 = new THREE.PointLight(0xffffff, 150, 50);
        light3.position.set(0, 5, -10);
        this.scene.add(light3);
    }

    setupEnvironment() {
        // Generate a procedural environment map for realistic chrome reflections
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        const envScene = new THREE.Scene();
        envScene.background = new THREE.Color(0x000000);

        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff });

        // Create random bright strips to simulate studio lights reflecting on chrome
        for (let i = 0; i < 15; i++) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20
            );
            // Long thin strips
            mesh.scale.set(
                Math.random() * 10 + 2,
                Math.random() * 0.5 + 0.1,
                Math.random() * 0.5 + 0.1
            );
            mesh.lookAt(0, 0, 0);
            envScene.add(mesh);
        }

        const envMap = pmremGenerator.fromScene(envScene).texture;
        this.scene.environment = envMap;
        
        // Clean up
        pmremGenerator.dispose();
    }

    onWindowResize() {
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
}