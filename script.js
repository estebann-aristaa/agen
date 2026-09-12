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

// 5. TransformControls
const transformControls = new TransformControls(camera, renderer.domElement);
transformControls.setSize(1.5);
scene.add(transformControls);

transformControls.addEventListener('dragging-changed', (event) => {
    orbitControls.enabled = !event.value;
});

transformControls.addEventListener('change', () => {
    syncSlidersFromModel();
});

// 6. GLBs
let edificioModel = null;
let fondoModel = null;
let edificioBaseSize = 1;
let fondoBaseSize = 1;
let currentTarget = 'edificio';

// 🔑 Referencia al objeto seleccionado
function getTarget() {
    return currentTarget === 'edificio' ? edificioModel : fondoModel;
}
function getTargetBaseSize() {
    return currentTarget === 'edificio' ? edificioBaseSize : fondoBaseSize;
}

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

loader.load('./fondo.glb', (gltf) => {
    fondoModel = gltf.scene;
    const box = new THREE.Box3().setFromObject(fondoModel);
    fondoBaseSize = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    fondoModel.position.x -= center.x;
    fondoModel.position.z -= center.z;
    scene.add(fondoModel);
    console.log('Fondo base size:', fondoBaseSize.toFixed(2));
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

// 8. Sliders
const $ = id => document.getElementById(id);

// 🔑 Los sliders SIEMPRE afectan al objeto seleccionado
function updateAll() {
    const target = getTarget();
    const baseSize = getTargetBaseSize();
    
    if (!target) return;
    
    const tam = parseFloat($('s-tam').value);
    const x = parseFloat($('s-x').value);
    const y = parseFloat($('s-y').value);
    const z = parseFloat($('s-z').value);
    const rot = parseFloat($('s-rot').value);
    
    // Aplicar al objeto seleccionado
    const escala = tam / baseSize;
    target.scale.set(escala, escala, escala);
    target.position.set(x, y, z);
    target.rotation.y = rot;
    
    // Actualizar etiquetas
    $('v-tam').textContent = tam;
    $('v-x').textContent = x.toFixed(1);
    $('v-y').textContent = y.toFixed(1);
    $('v-z').textContent = z.toFixed(1);
    $('v-rot').textContent = rot.toFixed(2);
    
    // Actualizar el nombre del objeto
    $('target-name').textContent = currentTarget === 'edificio' ? '🏛️ EDIFICIO' : '🏜️ FONDO';
    
    // Actualizar el agua aparte
    const agua = parseFloat($('s-agua').value);
    water.position.y = agua;
    $('v-agua').textContent = agua.toFixed(1);
}

// 🔑 Cuando mueves con el gizmo, sincroniza los sliders
function syncSlidersFromModel() {
    const target = getTarget();
    if (!target) return;
    
    const pos = target.position;
    const rot = target.rotation.y;
    const escala = target.scale.x;
    const baseSize = getTargetBaseSize();
    const tam = escala * baseSize;
    
    $('s-tam').value = tam.toFixed(1);
    $('s-x').value = pos.x.toFixed(1);
    $('s-y').value = pos.y.toFixed(1);
    $('s-z').value = pos.z.toFixed(1);
    $('s-rot').value = rot.toFixed(2);
    
    $('v-tam').textContent = tam.toFixed(1);
    $('v-x').textContent = pos.x.toFixed(1);
    $('v-y').textContent = pos.y.toFixed(1);
    $('v-z').textContent = pos.z.toFixed(1);
    $('v-rot').textContent = rot.toFixed(2);
}

// Conectar sliders
['s-tam','s-x','s-y','s-z','s-rot','s-agua'].forEach(id => {
    $(id).addEventListener('input', updateAll);
});

// 🔑 Cambiar objetivo - AHORA carga los valores actuales del objeto
window.selectTarget = function(target) {
    currentTarget = target;
    const model = getTarget();
    const baseSize = getTargetBaseSize();
    
    if (model) {
        // Cargar valores actuales en los sliders
        const escala = model.scale.x;
        const tam = escala * baseSize;
        
        $('s-tam').value = tam.toFixed(1);
        $('s-x').value = model.position.x.toFixed(1);
        $('s-y').value = model.position.y.toFixed(1);
        $('s-z').value = model.position.z.toFixed(1);
        $('s-rot').value = model.rotation.y.toFixed(2);
        
        // Actualizar etiquetas
        $('v-tam').textContent = tam.toFixed(1);
        $('v-x').textContent = model.position.x.toFixed(1);
        $('v-y').textContent = model.position.y.toFixed(1);
        $('v-z').textContent = model.position.z.toFixed(1);
        $('v-rot').textContent = model.rotation.y.toFixed(2);
        $('target-name').textContent = target === 'edificio' ? '🏛️ EDIFICIO' : '🏜️ FONDO';
        
        // Anclar el gizmo al nuevo objetivo
        transformControls.attach(model);
    }
    
    // Actualizar botones
    $('btn-sel-ed').classList.toggle('active', target === 'edificio');
    $('btn-sel-fo').classList.toggle('active', target === 'fondo');
};

// 12. Cambiar modo del gizmo
window.setMode = function(mode) {
    transformControls.setMode(mode);
    $('btn-mode-translate').classList.toggle('active', mode === 'translate');
    $('btn-mode-rotate').classList.toggle('active', mode === 'rotate');
    $('btn-mode-scale').classList.toggle('active', mode === 'scale');
};

// 13. Atajos teclado
window.addEventListener('keydown', (e) => {
    if (e.key === '1') selectTarget('edificio');
    if (e.key === '2') selectTarget('fondo');
    if (e.key === 'w' || e.key === 'W') setMode('translate');
    if (e.key === 'e' || e.key === 'E') setMode('rotate');
    if (e.key === 'r' || e.key === 'R') setMode('scale');
    if (e.key === 'h' || e.key === 'H') togglePanel();
});

// 14. Copiar valores
window.printValues = function() {
    console.log('=== EDIFICIO ===');
    if (edificioModel) {
        const baseSize = edificioBaseSize;
        const tam = edificioModel.scale.x * baseSize;
        console.log(`tam: ${tam.toFixed(1)}, x: ${edificioModel.position.x.toFixed(1)}, y: ${edificioModel.position.y.toFixed(1)}, z: ${edificioModel.position.z.toFixed(1)}, rot: ${edificioModel.rotation.y.toFixed(2)}`);
    }
    console.log('=== FONDO ===');
    if (fondoModel) {
        const baseSize = fondoBaseSize;
        const tam = fondoModel.scale.x * baseSize;
        console.log(`tam: ${tam.toFixed(1)}, x: ${fondoModel.position.x.toFixed(1)}, y: ${fondoModel.position.y.toFixed(1)}, z: ${fondoModel.position.z.toFixed(1)}, rot: ${fondoModel.rotation.y.toFixed(2)}`);
    }
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
