// The RX-0's stage: a pale cool hangar floor (rings and a fine grid drawn in a shader), soft shadows, GTAO kept off the
// floor, and a bloom pass with a high threshold so only the psycho-frame and the eyes glow. frame(state, cam) poses
// the machine standing on the floor and draws one frame.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {buildMech} from './mech.js';

const V3 = THREE.Vector3;
export const COL = {bg: '#eef0f0', ground: '#e8ebea', mark: '#cfd6d6', shadow: '#3c4a52'};

const GROUND_VERT = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GROUND_FRAG = /* glsl */ `uniform vec3 uG; uniform vec3 uM; uniform vec3 uBg; uniform vec3 uC; varying vec3 vW;
  void main(){
    float r = length(vW.xz);
    float m = 0.0;
    // range rings every 0.5 m, a heavier one every 2 m
    float rr = abs(fract(r / 0.5 + 0.5) - 0.5) * 0.5;
    m = max(m, (1.0 - smoothstep(0.004, 0.009, rr)) * 0.55);
    float r2 = abs(fract(r / 2.0 + 0.5) - 0.5) * 2.0;
    m = max(m, 1.0 - smoothstep(0.008, 0.016, r2));
    // a fine grid, faded with distance
    vec2 g = abs(fract(vW.xz / 0.25 + 0.5) - 0.5) * 0.25;
    m = max(m, (1.0 - smoothstep(0.002, 0.005, min(g.x, g.y))) * 0.25);
    // the heading tick, forward
    m = max(m, step(abs(vW.x), 0.012) * step(0.4, vW.z) * step(vW.z, 2.0) * 0.8);
    float n = fract(sin(dot(floor(vW.xz * 50.0), vec2(12.9898, 78.233))) * 43758.5453);
    vec3 col = mix(uG, uM, m) * (0.99 + 0.02 * n);
    float d = length(vW.xz - uC.xz);
    gl_FragColor = vec4(mix(col, uBg, smoothstep(3.5, 11.0, d)), 1.0);
  }`;

export function createRx0Stage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.fog = new THREE.Fog(COL.bg, 9, 24);
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.03, 80);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.75;
  gtao.updateGtaoMaterial({radius: 0.05, distanceExponent: 1.4, thickness: 0.6, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16});
  class Toggle extends Pass {
    constructor(fn) {
      super();
      this.needsSwap = false;
      this.fn = fn;
    }
    render() {
      this.fn();
    }
  }
  const groundVis = (v) => () => {
    ground.visible = v;
    shade.visible = v;
  };
  composer.addPass(new Toggle(groundVis(false)));
  composer.addPass(gtao);
  composer.addPass(new Toggle(groundVis(true)));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.25, 1.5);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#e4e8e9');
    const box = (w, h, pos, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: new THREE.Color(0.97, 0.99, 1).multiplyScalar(k), side: THREE.DoubleSide}));
      m.position.copy(pos);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    box(12, 12, new V3(0, 14, 2), 2.3);
    box(3, 14, new V3(-12, 4, 6), 2.8);
    box(3, 14, new V3(12, 4, -4), 1.8);
    box(18, 2, new V3(0, 2, 14), 1.4);
    const g = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({color: '#c8d0d2', side: THREE.DoubleSide}));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -2;
    env.add(g);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
    scene.environmentIntensity = 0.9;
    pm.dispose();
  }
  const SUN_DIR = new V3(-0.3, 0.86, 0.4).normalize();
  const sun = new THREE.DirectionalLight('#fffaf3', 2.2);
  sun.castShadow = true;
  const EXT = 1.5;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 0.5, far: 24});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 12;
  sun.shadow.blurSamples = 20;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.003;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight('#ffffff', '#cdd5d6', 0.7));

  const groundMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    uniforms: {uG: {value: new THREE.Color(COL.ground)}, uM: {value: new THREE.Color(COL.mark)}, uBg: {value: new THREE.Color(COL.bg)}, uC: {value: new V3()}},
    toneMapped: false,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.ShadowMaterial({color: COL.shadow, opacity: 0.22, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.receiveShadow = true;
  scene.add(shade);

  const mech = buildMech();
  scene.add(mech.root);

  const size = {w: 1600, h: 900};
  const resize = (w, h, pr) => {
    size.w = w;
    size.h = h;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  // st: mech state (d, time, focus, explode, xray); cam: {tx, ty, tz, az, el, d (radians, metres), sx, sy}, target relative
  // to the hover point
  const frame = (st, cam) => {
    mech.update(st);
    const tx = cam.tx;
    const ty = cam.ty;
    const tz = cam.tz;
    camera.position.set(tx + cam.d * Math.cos(cam.el) * Math.sin(cam.az), ty + cam.d * Math.sin(cam.el), tz + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(tx, ty, tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    groundMat.uniforms.uC.value.set(tx, 0, tz);
    sun.target.position.set(0, 0.9, 0);
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 10);
    sun.target.updateMatrixWorld();
    composer.render();
  };
  const pv = new V3();
  const project = (v) => {
    pv.copy(v).project(camera);
    if (pv.z > 1) return null;
    return [(pv.x * 0.5 + 0.5) * size.w, (-pv.y * 0.5 + 0.5) * size.h];
  };
  const setQuality = ({samples, ao, shadow, glow}) => {
    if (glow !== undefined) bloom.enabled = glow;
    if (samples !== undefined)
      for (const t of [composer.renderTarget1, composer.renderTarget2]) {
        t.samples = samples;
        t.dispose();
      }
    if (ao !== undefined) gtao.enabled = ao;
    if (shadow !== undefined) {
      sun.shadow.mapSize.set(shadow, shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  };
  return {renderer, scene, camera, mech, composer, gtao, sun, resize, frame, project, size, setQuality};
}
