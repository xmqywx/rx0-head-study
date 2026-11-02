// Studio for the head: pale floor with rings, soft sun shadows, GTAO kept off the floor, bloom only above 1.5 so just
// the psycho-frame, eyes and camera glow. frame(state, cam) poses the head and draws. renderOrtho(sheet) draws the four
// orthographic views laid out exactly like a reference sheet (100 px = 1 unit) for overlay checks.
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {buildHead} from './head.js';

const V3 = THREE.Vector3;
export const COL = {bg: '#eef0f0', ground: '#e8ebea', mark: '#cfd6d6', shadow: '#3c4a52'};
export const FLOOR_Y = -1.74;

// where each view sits on the two reference sheets: origin pixel (x, y) of the visor centre line; px per unit
export const SHEETS = {
  unicorn: {front: [243, 590], side: [610, 590], back: [962, 590], top: [1308, 520], k: 100},
  destroy: {front: [277, 465], side: [620, 465], back: [955, 465], top: [1300, 540], k: 80},
};

const GROUND_VERT = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GROUND_FRAG = /* glsl */ `uniform vec3 uG; uniform vec3 uM; uniform vec3 uBg; varying vec3 vW;
  void main(){
    float r = length(vW.xz);
    float m = 0.0;
    float rr = abs(fract(r / 1.0 + 0.5) - 0.5) * 1.0;
    m = max(m, (1.0 - smoothstep(0.008, 0.018, rr)) * 0.5);
    vec2 g = abs(fract(vW.xz / 0.5 + 0.5) - 0.5) * 0.5;
    m = max(m, (1.0 - smoothstep(0.004, 0.01, min(g.x, g.y))) * 0.22);
    m = max(m, step(abs(vW.x), 0.02) * step(2.0, vW.z) * step(vW.z, 6.0) * 0.7);
    vec3 col = mix(uG, uM, m);
    gl_FragColor = vec4(mix(col, uBg, smoothstep(7.0, 22.0, r)), 1.0);
  }`;

export function createHeadStage({canvas}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene();
  const BG = new THREE.Color(COL.bg);
  scene.background = BG;
  scene.fog = new THREE.Fog(COL.bg, 18, 48);
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.1, 120);
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 8}));
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.7;
  gtao.updateGtaoMaterial({radius: 0.25, distanceExponent: 1.4, thickness: 1.0, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false});
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
    ground.visible = v && showGround;
    shade.visible = v && showGround;
  };
  composer.addPass(new Toggle(groundVis(false)));
  composer.addPass(gtao);
  composer.addPass(new Toggle(groundVis(true)));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.38, 0.22, 1.7);
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
  const SUN_DIR = new V3(-0.35, 0.82, 0.45).normalize();
  const sun = new THREE.DirectionalLight('#fffaf3', 2.0);
  sun.castShadow = true;
  const EXT = 5;
  Object.assign(sun.shadow.camera, {left: -EXT, right: EXT, top: EXT, bottom: -EXT, near: 1, far: 40});
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 10;
  sun.shadow.blurSamples = 20;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.01;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#dfe8ff', 0.6);
  fill.position.set(6, 2, -4);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight('#ffffff', '#cdd5d6', 0.7));

  const groundMat = new THREE.ShaderMaterial({
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    uniforms: {uG: {value: new THREE.Color(COL.ground)}, uM: {value: new THREE.Color(COL.mark)}, uBg: {value: new THREE.Color(COL.bg)}},
    toneMapped: false,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = FLOOR_Y;
  scene.add(ground);
  const shade = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.ShadowMaterial({color: COL.shadow, opacity: 0.22, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8}),
  );
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = FLOOR_Y + 0.001;
  shade.receiveShadow = true;
  scene.add(shade);
  let showGround = true;

  const head = buildHead();
  scene.add(head.root);

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

  // cam: {tx, ty, tz, az, el, d, sx, sy}: orbit about the target (radians, units), sx/sy shift the frame in px
  const frame = (st, cam) => {
    head.update(st);
    camera.position.set(cam.tx + cam.d * Math.cos(cam.el) * Math.sin(cam.az), cam.ty + cam.d * Math.sin(cam.el), cam.tz + cam.d * Math.cos(cam.el) * Math.cos(cam.az));
    camera.lookAt(cam.tx, cam.ty, cam.tz);
    camera.setViewOffset(size.w, size.h, -(cam.sx ?? 0), -(cam.sy ?? 0), size.w, size.h);
    camera.updateMatrixWorld();
    sun.target.position.set(0, 0.5, 0);
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 16);
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

  // the four sheet views on a W x H canvas, transparent background, no post (overlay checks)
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const VIEW_DIR = {front: [new V3(0, 0, 1), new V3(0, 1, 0)], side: [new V3(1, 0, 0), new V3(0, 1, 0)], back: [new V3(0, 0, -1), new V3(0, 1, 0)], top: [new V3(0, 1, 0), new V3(0, 0, 1)]};
  const COLS = {front: [0, 430], side: [430, 800], back: [800, 1135], top: [1135, 1536]};
  const renderOrtho = (sheetKey, st, W = 1536, H = 1024, over = {}) => {
    // over: {k, dx, dy} to fit a sheet whose drawing scale or placement differs (found by the ref-match loop)
    const sh = {...SHEETS[sheetKey], ...(over.k ? {k: over.k} : {})};
    const DX = over.dx || 0;
    const DY = over.dy || 0;
    head.update(st);
    scene.background = null;
    scene.fog = null;
    showGround = false;
    ground.visible = shade.visible = false;
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.setScissorTest(true);
    renderer.setClearColor(0x000000, 0);
    renderer.setViewport(0, 0, W, H);
    renderer.setScissor(0, 0, W, H);
    renderer.clear();
    for (const v of ['front', 'side', 'back', 'top']) {
      const cx = sh[v][0] + DX;
      const cy = sh[v][1] + DY;
      const k = sh.k;
      const [dir, up] = VIEW_DIR[v];
      ortho.left = -cx / k;
      ortho.right = (W - cx) / k;
      ortho.top = cy / k;
      ortho.bottom = -(H - cy) / k;
      ortho.position.copy(dir).multiplyScalar(30);
      ortho.up.copy(up);
      ortho.lookAt(0, 0, 0);
      ortho.updateProjectionMatrix();
      ortho.updateMatrixWorld();
      sun.target.position.set(0, 0, 0);
      sun.position.copy(dir).multiplyScalar(10).add(new V3(-3, 6, 3));
      sun.target.updateMatrixWorld();
      const [x0, x1] = COLS[v];
      renderer.setViewport(0, 0, W, H);
      renderer.setScissor(x0, 0, x1 - x0, H);
      renderer.render(scene, ortho);
    }
    renderer.setScissorTest(false);
  };
  return {renderer, scene, camera, head, composer, gtao, sun, resize, frame, project, size, setQuality, renderOrtho, bloom};
}
