import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BUILDING_FLOORS, type FloorId } from '../config/buildingFloors';

const SLAB_WIDTH = 30;
const SLAB_DEPTH = 17;
const SLAB_HEIGHT = 1.5;
const FLOOR_GAP = 1.05;
const BASE_OFFSET = 0.9;

const COLOR_BACKGROUND = new THREE.Color('#050b09');
const COLOR_EDGE_BASE = new THREE.Color('#3fa08c');
const COLOR_EDGE_LINKED = new THREE.Color('#c2e84b');
const COLOR_EDGE_HOVER = new THREE.Color('#9fe8d0');
const COLOR_EDGE_SELECTED = new THREE.Color('#d8ff70');
const COLOR_SLAB = new THREE.Color('#9fd8cb');
const COLOR_GLOW = new THREE.Color('#c2e84b');

const DEFAULT_TARGET_Y = 9.5;

type FloorVisualState = 'base' | 'hover' | 'selected';

interface FloorEntry {
  id: FloorId;
  group: THREE.Group;
  slab: THREE.Mesh<THREE.BoxGeometry, THREE.MeshPhysicalMaterial>;
  edges: THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  glow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  label: CSS2DObject;
  labelElement: HTMLElement;
  centerY: number;
  linked: boolean;
  edgeOpacityTarget: number;
  slabOpacityTarget: number;
  glowOpacityTarget: number;
  edgeColorTarget: THREE.Color;
}

export interface BuildingSceneHandle {
  setSelected(floorId: FloorId | null): void;
  dispose(): void;
}

export interface BuildingSceneOptions {
  onSelect: (floorId: FloorId | null) => void;
}

function createRadialGlowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(194, 232, 75, 0.55)');
    gradient.addColorStop(0.45, 'rgba(194, 232, 75, 0.16)');
    gradient.addColorStop(1, 'rgba(194, 232, 75, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function stateTargets(entry: FloorEntry, state: FloorVisualState): {
  edgeOpacity: number;
  slabOpacity: number;
  glowOpacity: number;
  edgeColor: THREE.Color;
} {
  const baseOpacity = entry.linked ? 0.42 : 0.26;
  switch (state) {
    case 'selected':
      return { edgeOpacity: 0.95, slabOpacity: 0.22, glowOpacity: 0.16, edgeColor: COLOR_EDGE_SELECTED };
    case 'hover':
      return { edgeOpacity: 0.6, slabOpacity: 0.16, glowOpacity: 0.08, edgeColor: COLOR_EDGE_HOVER };
    default:
      return { edgeOpacity: baseOpacity, slabOpacity: 0.1, glowOpacity: entry.linked ? 0.05 : 0.02, edgeColor: entry.linked ? COLOR_EDGE_LINKED : COLOR_EDGE_BASE };
  }
}

export function createBuildingScene(container: HTMLElement, options: BuildingSceneOptions): BuildingSceneHandle {
  const { onSelect } = options;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scene = new THREE.Scene();
  scene.background = COLOR_BACKGROUND.clone();
  scene.fog = new THREE.Fog(COLOR_BACKGROUND, 60, 150);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  camera.position.set(30, 19, 34);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.inset = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(labelRenderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, DEFAULT_TARGET_Y, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 22;
  controls.maxDistance = 75;
  controls.minPolarAngle = 0.55;
  controls.maxPolarAngle = Math.PI / 2 - 0.1;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.5;

  scene.add(new THREE.HemisphereLight(0x2a4a42, 0x050b09, 1.1));
  scene.add(new THREE.AmbientLight(0x9fd8cb, 0.45));
  const directional = new THREE.DirectionalLight(0xbfe8dd, 1.4);
  directional.position.set(18, 32, 14);
  scene.add(directional);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(80, 64),
    new THREE.MeshStandardMaterial({ color: 0x07110e, roughness: 1, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const grid = new THREE.GridHelper(150, 50, 0x14352c, 0x0b1f19);
  grid.position.y = 0.02;
  const gridMaterial = grid.material as THREE.Material;
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0.4;
  scene.add(grid);

  const glowTexture = createRadialGlowTexture();
  const underGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(SLAB_WIDTH + 14, SLAB_DEPTH + 14),
    new THREE.MeshBasicMaterial({
      map: glowTexture,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  underGlow.rotation.x = -Math.PI / 2;
  underGlow.position.y = 0.04;
  scene.add(underGlow);

  const buildingGroup = new THREE.Group();
  scene.add(buildingGroup);

  const slabGeometry = new THREE.BoxGeometry(SLAB_WIDTH, SLAB_HEIGHT, SLAB_DEPTH);
  const edgeGeometry = new THREE.EdgesGeometry(slabGeometry);
  const glowGeometry = new THREE.PlaneGeometry(SLAB_WIDTH - 1.4, SLAB_DEPTH - 1.4);
  const stack = [...BUILDING_FLOORS].reverse();
  const floors: FloorEntry[] = [];

  stack.forEach((floor, index) => {
    const centerY = BASE_OFFSET + index * (SLAB_HEIGHT + FLOOR_GAP) + SLAB_HEIGHT / 2;
    const group = new THREE.Group();
    group.position.y = centerY;

    const slab = new THREE.Mesh(
      slabGeometry,
      new THREE.MeshPhysicalMaterial({
        color: COLOR_SLAB,
        metalness: 0.5,
        roughness: 0.22,
        transparent: true,
        opacity: 0,
        emissive: 0x113229,
        emissiveIntensity: 0.6,
        depthWrite: false,
      }),
    );
    slab.userData.floorId = floor.id;
    group.add(slab);

    const edges = new THREE.LineSegments(
      edgeGeometry,
      new THREE.LineBasicMaterial({ color: COLOR_EDGE_BASE, transparent: true, opacity: 0 }),
    );
    group.add(edges);

    const glow = new THREE.Mesh(
      glowGeometry,
      new THREE.MeshBasicMaterial({
        color: COLOR_GLOW,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = SLAB_HEIGHT / 2 + 0.02;
    group.add(glow);

    const labelElement = document.createElement('div');
    labelElement.className = 'floor-label';
    const idSpan = document.createElement('span');
    idSpan.className = 'floor-label__id';
    idSpan.textContent = floor.label;
    const lineSpan = document.createElement('span');
    lineSpan.className = 'floor-label__line';
    labelElement.append(idSpan, lineSpan);
    const label = new CSS2DObject(labelElement);
    label.position.set(-SLAB_WIDTH / 2 - 1.8, 0, 0);
    group.add(label);

    buildingGroup.add(group);
    floors.push({
      id: floor.id,
      group,
      slab,
      edges,
      glow,
      label,
      labelElement,
      centerY,
      linked: floor.linked,
      edgeOpacityTarget: 0,
      slabOpacityTarget: 0,
      glowOpacityTarget: 0,
      edgeColorTarget: COLOR_EDGE_BASE.clone(),
    });
  });

  const roofY = BASE_OFFSET + stack.length * (SLAB_HEIGHT + FLOOR_GAP);
  const penthouse = new THREE.Mesh(
    new THREE.BoxGeometry(9, 1.1, 6),
    new THREE.MeshPhysicalMaterial({
      color: COLOR_SLAB,
      metalness: 0.5,
      roughness: 0.22,
      transparent: true,
      opacity: 0.08,
      emissive: 0x113229,
      emissiveIntensity: 0.5,
      depthWrite: false,
    }),
  );
  penthouse.position.set(-3, roofY + 0.55, 0);
  buildingGroup.add(penthouse);
  const penthouseEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(penthouse.geometry),
    new THREE.LineBasicMaterial({ color: COLOR_EDGE_BASE, transparent: true, opacity: 0.2 }),
  );
  penthouseEdges.position.copy(penthouse.position);
  buildingGroup.add(penthouseEdges);

  const mastGeometry = new THREE.CylinderGeometry(0.07, 0.07, 3.6, 8);
  const mastMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a4f38,
    roughness: 0.55,
    metalness: 0.35,
    transparent: true,
    opacity: 0.85,
  });
  const mastPositions: Array<[number, number]> = [
    [-SLAB_WIDTH / 2 + 1.2, -SLAB_DEPTH / 2 + 1.2],
    [-SLAB_WIDTH / 2 + 1.2, SLAB_DEPTH / 2 - 1.2],
    [SLAB_WIDTH / 2 - 1.2, -SLAB_DEPTH / 2 + 1.2],
    [SLAB_WIDTH / 2 - 1.2, SLAB_DEPTH / 2 - 1.2],
    [0, -SLAB_DEPTH / 2 + 1.2],
    [0, SLAB_DEPTH / 2 - 1.2],
  ];
  for (const [x, z] of mastPositions) {
    const mast = new THREE.Mesh(mastGeometry, mastMaterial);
    mast.position.set(x, roofY + 1.8, z);
    buildingGroup.add(mast);
  }

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.7, 0.5);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(-10, -10);
  let hoveredId: FloorId | null = null;
  let selectedId: FloorId | null = null;
  let targetY = DEFAULT_TARGET_Y;
  let introProgress = reducedMotion ? 1 : 0;
  let disposed = false;
  let frameHandle = 0;
  let lastTime = performance.now();

  buildingGroup.position.y = reducedMotion ? 0 : -1.4;

  applyStateTargets();

  function applyStateTargets() {
    for (const entry of floors) {
      const state: FloorVisualState =
        entry.id === selectedId ? 'selected' : entry.id === hoveredId ? 'hover' : 'base';
      const targets = stateTargets(entry, state);
      entry.edgeOpacityTarget = targets.edgeOpacity;
      entry.slabOpacityTarget = targets.slabOpacity;
      entry.glowOpacityTarget = targets.glowOpacity;
      entry.edgeColorTarget.copy(targets.edgeColor);
      entry.labelElement.classList.toggle('floor-label--active', state !== 'base');
    }
  }

  function pickFloor(event: PointerEvent): FloorId | null {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(
      floors.map((entry) => entry.slab),
      false,
    );
    const first = hits[0];
    return first ? (first.object.userData.floorId as FloorId) : null;
  }

  const domElement = renderer.domElement;
  let pointerDownAt: { x: number; y: number } | null = null;

  const handlePointerMove = (event: PointerEvent) => {
    const id = pickFloor(event);
    if (id !== hoveredId) {
      hoveredId = id;
      domElement.style.cursor = id ? 'pointer' : 'grab';
      applyStateTargets();
    }
  };
  const handlePointerLeave = () => {
    if (hoveredId) {
      hoveredId = null;
      domElement.style.cursor = 'grab';
      applyStateTargets();
    }
  };
  const handlePointerDown = (event: PointerEvent) => {
    pointerDownAt = { x: event.clientX, y: event.clientY };
  };
  const handlePointerUp = (event: PointerEvent) => {
    if (!pointerDownAt) return;
    const moved = Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y);
    pointerDownAt = null;
    if (moved > 6) return;
    const id = pickFloor(event);
    if (id && id !== selectedId) {
      selectedId = id;
      setSelected(id);
      onSelect(id);
    } else if (!id && selectedId) {
      selectedId = null;
      setSelected(null);
      onSelect(null);
    }
  };

  domElement.style.cursor = 'grab';
  domElement.addEventListener('pointermove', handlePointerMove);
  domElement.addEventListener('pointerleave', handlePointerLeave);
  domElement.addEventListener('pointerdown', handlePointerDown);
  domElement.addEventListener('pointerup', handlePointerUp);

  function setSelected(floorId: FloorId | null) {
    selectedId = floorId;
    targetY = floorId ? (floors.find((entry) => entry.id === floorId)?.centerY ?? DEFAULT_TARGET_Y) : DEFAULT_TARGET_Y;
    applyStateTargets();
  }

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    composer.setSize(width, height);
    labelRenderer.setSize(width, height);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  function tick(now: number) {
    if (disposed) return;
    frameHandle = requestAnimationFrame(tick);
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (introProgress < 1) {
      introProgress = Math.min(introProgress + delta * 0.9, 1);
      const eased = 1 - Math.pow(1 - introProgress, 3);
      buildingGroup.position.y = -1.4 * (1 - eased);
    }

    const lerpFactor = 1 - Math.exp(-delta * 7);
    for (const entry of floors) {
      const introFactor = reducedMotion ? 1 : introProgress;
      entry.edges.material.opacity += (entry.edgeOpacityTarget * introFactor - entry.edges.material.opacity) * lerpFactor;
      entry.slab.material.opacity += (entry.slabOpacityTarget * introFactor - entry.slab.material.opacity) * lerpFactor;
      entry.glow.material.opacity += (entry.glowOpacityTarget * introFactor - entry.glow.material.opacity) * lerpFactor;
      entry.edges.material.color.lerp(entry.edgeColorTarget, lerpFactor);
    }

    controls.target.y += (targetY - controls.target.y) * lerpFactor;
    controls.update();
    composer.render();
    labelRenderer.render(scene, camera);
  }

  function handleVisibilityChange() {
    if (disposed) return;
    if (document.hidden) {
      cancelAnimationFrame(frameHandle);
    } else {
      lastTime = performance.now();
      frameHandle = requestAnimationFrame(tick);
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
  frameHandle = requestAnimationFrame(tick);

  return {
    setSelected,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameHandle);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resizeObserver.disconnect();
      domElement.removeEventListener('pointermove', handlePointerMove);
      domElement.removeEventListener('pointerleave', handlePointerLeave);
      domElement.removeEventListener('pointerdown', handlePointerDown);
      domElement.removeEventListener('pointerup', handlePointerUp);
      controls.dispose();
      composer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            material.dispose();
          }
        }
      });
      gridMaterial.dispose();
      glowTexture.dispose();
      labelRenderer.domElement.remove();
      renderer.dispose();
      domElement.remove();
    },
  };
}
