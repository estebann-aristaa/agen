import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { Water } from 'three/addons/objects/Water.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// 1. Escena
const canvas = document.querySelector('#webgl');
const scene = new THREE.Scene();
const textureLoader = new THREE.TextureLoader();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 20000);
camera.position.set(0, 3, 20);
camera.lookAt(0, 3, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

// 2. Cielo gradiente
const skyGeo = new THREE.SphereGeometry(8000, 64, 32);
const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
        topColor: { value: new THREE.Color(0xb8a8d4) },
        midColor: { value: new THREE.Color(0xe5c8d4) },
        bottomColor: { value: new THREE.Color(0xf0d8b8) },
    },
    vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPosition = wp.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 topColor; uniform vec3 midColor; uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
            float h = normalize(vWorldPosition).y;
            vec3 color = h > 0.0 ? mix(midColor, topColor, h) : mix(midColor, bottomColor, -h);
            gl_FragColor = vec4(color, 1.0);
        }
    `,
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

// 3. Luces
scene.add(new THREE.AmbientLight(0xffd1b3, 1.8));
const sunLight = new THREE.DirectionalLight(0xffd1b3, 2.5);
sunLight.position.set(-8, 12, 6);
scene.add(sunLight);
const fillLight = new THREE.DirectionalLight(0xaaccff, 0.8);
fillLight.position.set(8, 4, 5);
scene.add(fillLight);

// 4. OrbitControls
const orbitControls = new OrbitControls(camera, renderer.domElement);
orbitControls.enableDamping = true;
orbitControls.target.set(0, 3, 0);

// 5. TransformControls (gizmo)
const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.setSize(1.5);
scene.add(transformControls);

transformControls.addEventListener('dragging-changed', (event) => {
    orbitControls.enabled = !event.value;
});

transformControls.addEventListener('change', () => {
    syncSlidersFromModel();
});

// 6. Cargar GLBs (edificio.glb y fondo.glb)
let edificioModel = null;
let dunasModel = null;
let edificioBaseSize = 1;
let dunasBaseSize = 1;
let currentTarget = 'edificio';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

loader.load('./fondo.glb', (gltf) => {
    dunasModel = gltf.scene;
    const box = new THREE.Box3().setFromObject(dunasModel);
    dunasBaseSize = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    dunasModel.position.x -= center.x;
    dunasModel.position.z -= center.z;
    scene.add(dunasModel);
    console.log('Fondo base size:', dunasBaseSize.toFixed(2));
    updateAll();
});

loader.load('./edificio.glb', (gltf) => {
    edificioModel = gltf.scene;
    const box = new THREE.Box3().setFromObject(edificioModel);
    edificioBaseSize = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    edificioModel.position.x -= center.x;
    edificioModel.position.z -= center.z;
    scene.add(edificioModel);
    console.log('Edificio base size:', edificioBaseSize.toFixed(2));
    
    transformControls.attach(edificioModel);
    updateAll();
});

// 7. Agua
const waterGeometry = new THREE.PlaneGeometry(20000, 20000);
const water = new Water(waterGeometry, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: textureLoader.load(
        'https://threejs.org/examples/textures/waternormals.jpg',
        (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    ),
    sunDirection: new THREE.Vector3(-0.5, 1, 0.5).normalize(),
    sunColor: 0xffd1b3,
    waterColor: 0xc4a8b8,
    distortionScale: 3.5,
    fog: false,
    alpha: 0.85,
});
water.rotation.x = -Math.PI / 2;
water.position.y = -3;
water.material.uniforms.size.value = 4.0;
scene.add(water);

// 8. Referencias
const $ = id => document.getElementById(id);

// 9. UpdateAll
function updateAll() {
    if (edificioModel) {
        const tam = parseFloat($('s-ed-tam').value);
        const y = parseFloat($('s-ed-y').value);
        const z = parseFloat($('s-ed-z').value);
        const x = parseFloat($('s-ed-x').value);
        const rot = parseFloat($('s-ed-rot').value);
        const escala = tam / edificioBaseSize;
        edificioModel.scale.set(escala, escala, escala);
        edificioModel.position.set(x, y, z);
        edificioModel.rotation.y = rot;
        $('v-ed-tam').textContent = tam;
        $('v-ed-y').textContent = y.toFixed(1);
        $('v-ed-z').textContent = z.toFixed(1);
        $('v-ed-x').textContent = x.toFixed(1);
        $('v-ed-rot').textContent = rot.toFixed(2);
    }
    if (dunasModel) {
        const tam = parseFloat($('s-du-tam').value);
        const y = parseFloat($('s-du-y').value);
        const z = parseFloat($('s-du-z').value);
        const rot = parseFloat($('s-du-rot').value);
        const escala = tam / dunasBaseSize;
        dunasModel.scale.set(escala, escala, escala);
        dunasModel.position.set(0, y, z);
        dunasModel.rotation.y = rot;
        $('v-du-tam').textContent = tam;
        $('v-du-y').textContent = y.toFixed(0);
        $('v-du-z').textContent = z.toFixed(0);
        $('v-du-rot').textContent = rot.toFixed(2);
    }
    const agua = parseFloat($('s-agua').value);
    water.position.y = agua;
    $('v-agua').textContent = agua.toFixed(1);
}

// 10. Sync sliders cuando mueves con gizmo
function syncSlidersFromModel() {
    if (!edificioModel) return;
    
    if (currentTarget === 'edificio') {
        const pos = edificioModel.position;
        const rot = edificioModel.rotation.y;
        $('s-ed-x').value = pos.x.toFixed(1);
        $('s-ed-y').value = pos.y.toFixed(1);
        $('s-ed-z').value = pos.z.toFixed(1);
        $('s-ed-rot').value = rot.toFixed(2);
        $('v-ed-x').textContent = pos.x.toFixed(1);
        $('v-ed-y').textContent = pos.y.toFixed(1);
        $('v-ed-z').textContent = pos.z.toFixed(1);
        $('v-ed-rot').textContent = rot.toFixed(2);
    } else if (currentTarget === 'dunas' && dunasModel) {
        const pos = dunasModel.position;
        const rot = dunasModel.rotation.y;
        $('s-du-y').value = pos.y.toFixed(0);
        $('s-du-z').value = pos.z.toFixed(0);
        $('s-du-rot').value = rot.toFixed(2);
        $('v-du-y').textContent = pos.y.toFixed(0);
        $('v-du-z').textContent = pos.z.toFixed(0);
        $('v-du-rot').textContent = rot.toFixed(2);
    }
}

// Conectar sliders
['s-ed-tam','s-ed-y','s-ed-z','s-ed-x','s-ed-rot','s-du-tam','s-du-y','s-du-z','s-du-rot','s-agua'].forEach(id => {
    $(id).addEventListener('input', updateAll);
});

// 11. Cambiar objetivo
window.selectTarget = function(target) {
    currentTarget = target;
    if (target === 'edificio' && edificioModel) {
        transformControls.attach(edificioModel);
    } else if (target === 'dunas' && dunasModel) {
        transformControls.attach(dunasModel);
    }
    $('btn-sel-ed').classList.toggle('active', target === 'edificio');
    $('btn-sel-du').classList.toggle('active', target === 'dunas');
};

// 12. Cambiar modo
window.setMode = function(mode) {
    transformControls.setMode(mode);
    $('btn-mode-translate').classList.toggle('active', mode === 'translate');
    $('btn-mode-rotate').classList.toggle('active', mode === 'rotate');
    $('btn-mode-scale').classList.toggle('active', mode === 'scale');
};

// 13. Atajos teclado
window.addEventListener('keydown', (e) => {
    if (e.key === '1') selectTarget('edificio');
    if (e.key === '2') selectTarget('dunas');
    if (e.key === 'w' || e.key === 'W') setMode('translate');
    if (e.key === 'e' || e.key === 'E') setMode('rotate');
    if (e.key === 'r' || e.key === 'R') setMode('scale');
    if (e.key === 'h' || e.key === 'H') togglePanel();
});

// 14. Copiar valores
window.printValues = function() {
    console.log('=== EDIFICIO ===');
    console.log(`tam: ${$('s-ed-tam').value}, x: ${$('s-ed-x').value}, y: ${$('s-ed-y').value}, z: ${$('s-ed-z').value}, rot: ${$('s-ed-rot').value}`);
    console.log('=== FONDO ===');
    console.log(`tam: ${$('s-du-tam').value}, y: ${$('s-du-y').value}, z: ${$('s-du-z').value}, rot: ${$('s-du-rot').value}`);
    console.log('=== AGUA ===');
    console.log(`nivel: ${$('s-agua').value}`);
    alert('¡Valores en la consola! Abre F12.');
};

// 15. Ocultar/Mostrar panel
window.togglePanel = function() {
    const panel = document.getElementById('panel');
    panel.classList.toggle('hidden');
};

// 16. Post-procesado
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.2, 0.4, 0.9));
composer.addPass(new FilmPass(0.22, 0.5, 2048, false));
composer.addPass(new OutputPass());

// 17. Loop
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    water.material.uniforms['time'].value += delta * 0.5;
    orbitControls.update();
    composer.render();
}
animate();

// 18. Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});
