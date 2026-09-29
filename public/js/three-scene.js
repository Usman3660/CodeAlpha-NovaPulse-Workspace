// ==========================================================================
// Three.js Interactive 3D WebGL Background Scene (Light & Radiant Mode)
// ==========================================================================

class ThreeBackgroundScene {
  constructor() {
    this.canvas = document.getElementById('three-bg-canvas');
    if (!this.canvas || typeof THREE === 'undefined') return;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.z = 30;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    this.floatingObjects = [];

    this.initLights();
    this.initParticles();
    this.initGeometricMeshes();
    this.initEventListeners();
    this.animate();
  }

  initLights() {
    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    // Colored Dynamic Point Lights
    this.light1 = new THREE.PointLight(0x0891b2, 2.0, 60);
    this.light1.position.set(15, 10, 15);
    this.scene.add(this.light1);

    this.light2 = new THREE.PointLight(0xe11d48, 1.8, 60);
    this.light2.position.set(-15, -10, 10);
    this.scene.add(this.light2);

    this.light3 = new THREE.PointLight(0x059669, 1.8, 50);
    this.light3.position.set(0, 15, -5);
    this.scene.add(this.light3);
  }

  initParticles() {
    const particleCount = 650;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const colorPalette = [
      new THREE.Color(0x0891b2), // Cyan
      new THREE.Color(0x7c3aed), // Violet
      new THREE.Color(0x059669), // Emerald
      new THREE.Color(0xe11d48)  // Coral
    ];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;

      const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.32,
      vertexColors: true,
      transparent: true,
      opacity: 0.75
    });

    this.particleSystem = new THREE.Points(geometry, material);
    this.scene.add(this.particleSystem);
  }

  initGeometricMeshes() {
    // 1. Central Floating Icosahedron
    const icoGeo = new THREE.IcosahedronGeometry(4.5, 1);
    const icoMat = new THREE.MeshStandardMaterial({
      color: 0x0891b2,
      roughness: 0.1,
      metalness: 0.5,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    const icosahedron = new THREE.Mesh(icoGeo, icoMat);
    icosahedron.position.set(16, 2, -10);
    this.scene.add(icosahedron);
    this.floatingObjects.push({ mesh: icosahedron, rotSpeedX: 0.003, rotSpeedY: 0.005, baseY: 2, floatSpeed: 0.0015 });

    // 2. Torus Knot wireframe
    const torusGeo = new THREE.TorusKnotGeometry(3, 0.6, 64, 16);
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0x7c3aed,
      roughness: 0.2,
      metalness: 0.6,
      wireframe: true,
      transparent: true,
      opacity: 0.45
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.position.set(-18, -4, -12);
    this.scene.add(torus);
    this.floatingObjects.push({ mesh: torus, rotSpeedX: -0.004, rotSpeedY: 0.003, baseY: -4, floatSpeed: 0.0012 });

    // 3. Octahedron
    const octGeo = new THREE.OctahedronGeometry(3.5, 0);
    const octMat = new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      roughness: 0.1,
      metalness: 0.7,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    const octahedron = new THREE.Mesh(octGeo, octMat);
    octahedron.position.set(-6, 12, -18);
    this.scene.add(octahedron);
    this.floatingObjects.push({ mesh: octahedron, rotSpeedX: 0.005, rotSpeedY: -0.004, baseY: 12, floatSpeed: 0.0018 });
  }

  initEventListeners() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    // Smooth mouse parallax lerp
    this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05;

    this.camera.position.x = this.mouse.x * 3.5;
    this.camera.position.y = this.mouse.y * 3.5;
    this.camera.lookAt(0, 0, 0);

    const time = Date.now();

    // Rotate and bob floating meshes
    this.floatingObjects.forEach((obj, idx) => {
      obj.mesh.rotation.x += obj.rotSpeedX;
      obj.mesh.rotation.y += obj.rotSpeedY;
      obj.mesh.position.y = obj.baseY + Math.sin(time * obj.floatSpeed + idx) * 1.5;
    });

    // Rotate particles
    if (this.particleSystem) {
      this.particleSystem.rotation.y += 0.0006;
      this.particleSystem.rotation.x = Math.sin(time * 0.0003) * 0.08;
    }

    // Light movements
    if (this.light1) {
      this.light1.position.x = Math.sin(time * 0.001) * 20;
      this.light1.position.y = Math.cos(time * 0.0015) * 15;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.threeBg = new ThreeBackgroundScene();
});
