import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { families } from './model/part-families.ts';
import { inventoryLayout, explosionOffset } from './model/inventory-layout.ts';
import { loadModel, type ModelData, type Part } from './viewer/model-loader.ts';
import { findScreenTarget, type ScreenTarget } from './viewer/screen-picking.ts';
import { bindPointerSelection } from './viewer/pointer-selection.ts';
import { setInspectorOpen } from './ui/inspector.ts';
const element = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let lang: 'en' | 'zh' = localStorage.getItem('p1-language') === 'zh' ? 'zh' : 'en';
const tr = (en: string, zh: string) => (lang === 'en' ? en : zh);
const stage = element('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setClearColor(0xefeee9, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
stage.append(renderer.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0xa5a08b, 2));
for (const [x, y, z, intensity] of [
  [-4, 8, 5, 2],
  [4, 3, -6, 1],
]) {
  const light = new THREE.DirectionalLight(0xffffff, intensity);
  light.position.set(x, y, z);
  scene.add(light);
}
const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 300);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.3;
controls.maxDistance = 70;
controls.autoRotateSpeed = 0.5;
const model = new THREE.Group();
scene.add(model);
let baseDistance = 15,
  cameraView = 'perspective';
function fitCamera(name = cameraView) {
  if (isolated) {
    focusIsolatedPart();
    return;
  }
  camera.clearViewOffset();
  cameraView = name;
  const blend = isolated ? 0 : THREE.MathUtils.smoothstep(amount, 0.4, 1);
  const direction = (
    {
      perspective: [1, 0.65, 1.2],
      front: [0, 0.02, 1],
      side: [1, 0.15, 0],
      top: [0, 1, 0.001],
    } as Record<string, number[]>
  )[name];
  const normal =
    baseDistance * Math.max(1, 0.8 / camera.aspect) * (1 + 0.4 * Math.min(amount / 0.4, 1));
  const flat =
    (Math.max(layout.width / camera.aspect, layout.height, 1) /
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) *
      1.12 +
    1;
  const distance = THREE.MathUtils.lerp(normal, flat, blend);
  controls.maxDistance = Math.max(70, flat * 3);
  camera.far = Math.max(300, flat * 5);
  camera.updateProjectionMatrix();
  camera.position.copy(
    new THREE.Vector3(...direction)
      .normalize()
      .lerp(new THREE.Vector3(0, 0, 1), blend)
      .normalize()
      .multiplyScalar(distance),
  );
  controls.target.set(0, 0, 0);
  controls.update();
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.view === (amount > 0.85 ? 'front' : name)));
    b.disabled = amount > 0.85 && b.dataset.view !== 'front';
  });
}
new ResizeObserver(() => {
  const { width, height } = stage.getBoundingClientRect();
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  layoutKey = '';
  updateModel();
  if (isolated) focusIsolatedPart();
  else fitCamera();
}).observe(stage);
let data: ModelData,
  parts: Part[] = [],
  selected: Part | undefined,
  isolated: Part | undefined;
let inspectionCamera: { position: THREE.Vector3; target: THREE.Vector3 } | undefined;
let spread = 0,
  amount = 0,
  frontLift = false,
  engineLift = false;
let layout = inventoryLayout([], 1),
  layoutKey = '';
fitCamera();
const enabled = families.map(() => true);
const meshes: THREE.InstancedMesh[] = [];
const raycaster = new THREE.Raycaster(),
  pointer = new THREE.Vector2();
let screenTargets: ScreenTarget[] = [];
const projected = new THREE.Vector3();
let needsRender = true;
controls.addEventListener('change', () => {
  needsRender = true;
});
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let lastFrame = performance.now();
function animate(now: number) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  if (Math.abs(amount - spread) > 0.0001) {
    amount = reducedMotion.matches ? spread : THREE.MathUtils.damp(amount, spread, 7, dt);
    if (Math.abs(amount - spread) < 0.0001) amount = spread;
    applyTransforms();
    if (!isolated) fitCamera();
  }
  controls.update();
  if (needsRender) {
    renderer.render(scene, camera);
    updateScreenTargets();
    needsRender = false;
  }
}
requestAnimationFrame(animate);
function visible(p: Part) {
  return !p.hidden && enabled[p.family] && (!isolated || isolated === p);
}
function applyTransforms() {
  const matrix = new THREE.Matrix4(),
    color = new THREE.Color(),
    scaleVector = new THREE.Vector3();
  const flat = amount > 0.85 && !isolated;
  controls.enableRotate = !flat;
  controls.mouseButtons.LEFT = flat ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
  controls.touches.ONE = flat ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
  element('rotate').toggleAttribute('disabled', flat);
  document
    .querySelectorAll<HTMLButtonElement>('[data-view]')
    .forEach((b) => (b.disabled = flat && b.dataset.view !== 'front'));
  if (flat) {
    controls.autoRotate = false;
    element('rotate').setAttribute('aria-pressed', 'false');
  }
  for (const p of parts) {
    matrix.copy(p.base);
    const cell = layout.cells.get(p.index);
    const d = explosionOffset(
      p.center.toArray(),
      p.family,
      cell ? [cell.x, cell.y, 0] : p.center.toArray(),
      isolated ? 0 : amount,
    );
    if (
      !isolated &&
      ((frontLift && p.group.includes('bagagli')) || (engineLift && p.group.includes('motore')))
    )
      d[1] += 2 * (1 - amount);
    const scale = visible(p) ? 1 : 0;
    p.displayed = scale > 0.001;
    p.offset.set(...(d as [number, number, number]));
    matrix.scale(scaleVector.setScalar(scale));
    matrix.elements[12] += d[0] + (p.center.x - p.base.elements[12]) * (1 - scale);
    matrix.elements[13] += d[1] + (p.center.y - p.base.elements[13]) * (1 - scale);
    matrix.elements[14] += d[2] + (p.center.z - p.base.elements[14]) * (1 - scale);
    color.set(p === selected ? '#ffcc85' : '#ffffff');
    for (const { mesh, slot } of p.slots) {
      mesh.setMatrixAt(slot, matrix);
      mesh.setColorAt(slot, color);
    }
  }
  for (const mesh of meshes) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  element('gesture-hint').textContent = flat
    ? tr('Drag to pan · Scroll to zoom · Click to inspect', '拖动平移 · 滚轮缩放 · 点击查看')
    : tr('Drag to orbit · Scroll to zoom · Hover to identify', '拖动旋转 · 滚轮缩放 · 悬浮识别');
  needsRender = true;
}
function updateModel() {
  if (!isolated) camera.clearViewOffset();
  const shown = parts.filter(visible);
  const key = shown.map((p) => p.index).join(',') + ':' + camera.aspect.toFixed(3);
  if (key !== layoutKey) {
    layout = inventoryLayout(
      shown.map((p) => ({
        id: p.index,
        width: p.size.x,
        height: p.size.y,
      })),
      camera.aspect,
    );
    layoutKey = key;
    if (amount > 0.4 && !isolated) fitCamera();
  }
  element('visible-count').textContent = tr(
    `${shown.length.toLocaleString()} ${shown.length === 1 ? 'piece' : 'pieces'}`,
    `${shown.length.toLocaleString()} 件积木`,
  );
  element('inventory-count').textContent = tr(
    `${layout.count.toLocaleString()} individual ${layout.count === 1 ? 'piece' : 'pieces'}`,
    `逐件展示 ${layout.count.toLocaleString()} 件积木`,
  );
  element('spread-value').textContent = `${Math.round(spread * 100)}%`;
  element('spread').setAttribute('aria-valuetext', `${Math.round(spread * 100)}%`);
  element('hood').setAttribute('aria-pressed', String(frontLift));
  element('engine').setAttribute('aria-pressed', String(engineLift));
  applyTransforms();
}
function selectPart(p?: Part) {
  const previous = selected;
  selected = p;
  setInspectorOpen(element('detail'), !!p);
  if (p) {
    element('part-family').textContent = families[p.family][lang];
    element('part-name').textContent = p.label;
    element('part-id').textContent = p.name.replace(/\.dat$/, '');
    element('part-color').textContent = data.colors[p.color]?.name || p.color;
    element('part-total').textContent = String(
      parts.filter((other) => other.name === p.name && other.color === p.color).length,
    );
    element('part-note').textContent = tr(
      'Select a piece on the model or search the library. Drag to inspect it from any angle.',
      '点击模型或搜索零件，拖动模型可从不同角度查看。',
    );
  }
  const color = new THREE.Color();
  for (const part of [previous, selected]) {
    if (!part) continue;
    color.set(part === selected ? '#ffcc85' : '#ffffff');
    for (const { mesh, slot } of part.slots) {
      mesh.setColorAt(slot, color);
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
  needsRender = true;
}
function renderPartLibrary() {
  element('families').replaceChildren();
  families.forEach((f, index) => {
    const row = document.createElement('div');
    row.className = 'family';
    const b = document.createElement('button');
    b.type = 'button';
    const dot = document.createElement('i');
    dot.style.background = f.color;
    const label = document.createElement('span');
    label.textContent = f[lang];
    const count = document.createElement('small');
    count.textContent = String(parts.filter((p) => p.family === index).length);
    b.append(dot, label, count);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = enabled[index];
    input.setAttribute('aria-label', tr(`Show ${f.en}`, `显示${f.zh}`));
    input.onchange = () => {
      enabled[index] = input.checked;
      isolated = undefined;
      updateModel();
    };
    b.title = tr(`Show only ${f.en}`, `只显示${f.zh}`);
    b.onclick = () => {
      isolated = undefined;
      enabled.fill(false);
      enabled[index] = true;
      selected = undefined;
      setInspectorOpen(element('detail'), false);
      renderPartLibrary();
      updateModel();
    };
    row.append(b, input);
    element('families').append(row);
  });
  element('part-count').textContent = parts.length.toLocaleString();
}
function updateLanguage() {
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  document.querySelectorAll<HTMLElement>('[data-en]').forEach((el) => {
    el.textContent = el.dataset[lang]!;
  });
  element('subtitle').textContent = tr(
    'The anatomy of a hypercar.',
    '拆开一台超级跑车，探索每一块积木。',
  );
  element<HTMLInputElement>('search').placeholder = tr(
    'Find a part or number…',
    '搜索英文名称或编号…',
  );
  element('en').setAttribute('aria-pressed', String(lang === 'en'));
  element('zh').setAttribute('aria-pressed', String(lang === 'zh'));
  if (parts.length) {
    renderPartLibrary();
    selectPart(selected);
    search();
  }
}
for (const l of ['en', 'zh'] as const)
  element(l).onclick = () => {
    lang = l;
    localStorage.setItem('p1-language', l);
    updateLanguage();
  };
function restoreModel() {
  inspectionCamera = undefined;
  isolated = undefined;
  enabled.fill(true);
  parts.forEach((p) => (p.hidden = false));
  frontLift = engineLift = false;
  spread = 0;
  element<HTMLInputElement>('spread').value = '0';
  renderPartLibrary();
  selectPart();
  updateModel();
  fitCamera('perspective');
}
element('restore').onclick = restoreModel;
element('all').onclick = () => {
  isolated = undefined;
  enabled.fill(true);
  parts.forEach((p) => (p.hidden = false));
  renderPartLibrary();
  selectPart();
  updateModel();
};
element('internal').onclick = () => {
  if (isolated) fitCamera();
  isolated = undefined;
  enabled.fill(true);
  enabled[0] = false;
  renderPartLibrary();
  updateModel();
};
function clearSelection() {
  const wasIsolated = !!isolated;
  isolated = undefined;
  selectPart();
  if (wasIsolated) {
    updateModel();
    if (inspectionCamera) {
      camera.position.copy(inspectionCamera.position);
      controls.target.copy(inspectionCamera.target);
      controls.update();
      inspectionCamera = undefined;
    } else fitCamera();
  }
}
element('close').onclick = clearSelection;
element('clear').onclick = clearSelection;
element('isolate').onclick = () => {
  if (!selected) return;
  controls.autoRotate = false;
  element('rotate').setAttribute('aria-pressed', 'false');
  if (!isolated)
    inspectionCamera = { position: camera.position.clone(), target: controls.target.clone() };
  isolated = selected;
  selected.hidden = false;
  updateModel();
  renderPartLibrary();
  focusIsolatedPart();
};
function focusIsolatedPart() {
  if (!isolated) return;
  const viewport = stage.getBoundingClientRect();
  const panel = element('detail').getBoundingClientRect();
  const availableWidth =
    innerWidth > 700
      ? Math.max(100, Math.min(viewport.width, panel.left - viewport.left - 16))
      : viewport.width;
  const availableHeight =
    innerWidth <= 700
      ? Math.max(80, Math.min(viewport.height, panel.top - viewport.top - 16))
      : viewport.height;
  camera.setViewOffset(
    viewport.width,
    viewport.height,
    (viewport.width - availableWidth) / 2,
    (viewport.height - availableHeight) / 2,
    viewport.width,
    viewport.height,
  );
  const screenFraction = Math.min(
    availableHeight / viewport.height,
    (availableWidth / viewport.width) * camera.aspect,
  );
  const distance = Math.max(
    0.4,
    (isolated.size.length() * 1.15) /
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * screenFraction),
  );
  camera.position
    .copy(isolated.center)
    .add(new THREE.Vector3(1, 0.6, 1).normalize().multiplyScalar(distance));
  controls.target.copy(isolated.center);
  controls.update();
  needsRender = true;
}
element('hide-part').onclick = () => {
  if (isolated) fitCamera();
  if (selected) selected.hidden = true;
  isolated = undefined;
  selectPart();
  updateModel();
};
element('reset').onclick = () => {
  restoreModel();
  controls.autoRotate = false;
  element('rotate').setAttribute('aria-pressed', 'false');
  fitCamera();
};
element('rotate').onclick = () => {
  controls.autoRotate = !controls.autoRotate;
  element('rotate').setAttribute('aria-pressed', String(controls.autoRotate));
};
element('plus').onclick = () => {
  camera.position.sub(controls.target).multiplyScalar(0.8).add(controls.target);
  controls.update();
};
element('minus').onclick = () => {
  camera.position.sub(controls.target).multiplyScalar(1.25).add(controls.target);
  controls.update();
};
document
  .querySelectorAll<HTMLButtonElement>('[data-view]')
  .forEach((b) => (b.onclick = () => fitCamera(b.dataset.view)));
element('assemble-reset').onclick = () => element('reset').click();
element<HTMLInputElement>('spread').oninput = (e) => {
  spread = Number((e.target as HTMLInputElement).value) / 100;
  if (isolated) {
    isolated = undefined;
    selected = undefined;
    setInspectorOpen(element('detail'), false);
  }
  frontLift = engineLift = false;
  element('tooltip').hidden = true;
  updateModel();
};
element('hood').onclick = () => {
  frontLift = !frontLift;
  updateModel();
};
element('engine').onclick = () => {
  engineLift = !engineLift;
  updateModel();
};
element('about').onclick = () => element<HTMLDialogElement>('credits').showModal();
element('close-credits').onclick = () => element<HTMLDialogElement>('credits').close();
function search() {
  const term = element<HTMLInputElement>('search').value.trim().toLowerCase();
  element('results').hidden = !term;
  element('families').hidden = !!term;
  element('results').replaceChildren();
  if (!term) return;
  const found = parts.filter((p) => `${p.label} ${p.name}`.toLowerCase().includes(term));
  const unique = [...new Map(found.map((p) => [p.name, p])).values()].slice(0, 25);
  for (const p of unique) {
    const b = document.createElement('button');
    b.textContent = `${p.label} · ${p.name.replace('.dat', '')}`;
    b.onclick = () => {
      if (isolated) fitCamera();
      isolated = undefined;
      enabled[p.family] = true;
      p.hidden = false;
      updateModel();
      selectPart(p);
    };
    element('results').append(b);
  }
  if (!unique.length) element('results').textContent = tr('No matching parts.', '未找到零件。');
}
element('search').oninput = search;
function updateScreenTargets() {
  screenTargets = [];
  if (amount <= 0.85 || isolated) return;
  const { width, height } = renderer.domElement.getBoundingClientRect();
  for (const p of parts) {
    if (!p.displayed) continue;
    projected.copy(p.center).add(p.offset).project(camera);
    if (projected.z < -1 || projected.z > 1) continue;
    const target: ScreenTarget = {
      index: p.index,
      x: ((projected.x + 1) * width) / 2,
      y: ((1 - projected.y) * height) / 2,
      left: Infinity,
      right: -Infinity,
      top: Infinity,
      bottom: -Infinity,
    };
    for (let corner = 0; corner < 8; corner++) {
      projected
        .set(
          p.center.x + p.offset.x + p.size.x * (corner & 1 ? 0.5 : -0.5),
          p.center.y + p.offset.y + p.size.y * (corner & 2 ? 0.5 : -0.5),
          p.center.z + p.offset.z + p.size.z * (corner & 4 ? 0.5 : -0.5),
        )
        .project(camera);
      const x = ((projected.x + 1) * width) / 2,
        y = ((1 - projected.y) * height) / 2;
      target.left = Math.min(target.left, x);
      target.right = Math.max(target.right, x);
      target.top = Math.min(target.top, y);
      target.bottom = Math.max(target.bottom, y);
    }
    screenTargets.push(target);
  }
}
function pickPart(e: PointerEvent): Part | undefined {
  const rect = renderer.domElement.getBoundingClientRect();
  if (amount > 0.85 && !isolated) {
    const index = findScreenTarget(
      screenTargets,
      e.clientX - rect.left,
      e.clientY - rect.top,
      e.pointerType === 'touch' ? 24 : 12,
    );
    return index === undefined ? undefined : parts[index];
  }
  pointer.set(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    (-(e.clientY - rect.top) / rect.height) * 2 + 1,
  );
  scene.updateMatrixWorld(true);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster
    .intersectObjects(meshes, false)
    .find(
      (hit) =>
        hit.instanceId !== undefined && parts[hit.object.userData.parts[hit.instanceId]].displayed,
    );
  return hit?.instanceId === undefined
    ? undefined
    : parts[hit.object.userData.parts[hit.instanceId]];
}
bindPointerSelection(renderer.domElement, pickPart, selectPart, (part, event) => {
  element('tooltip').hidden = !part;
  renderer.domElement.style.cursor = part ? 'pointer' : 'default';
  if (!part) return;
  element('tooltip').textContent = part.label;
  element('tooltip').style.left =
    `${Math.max(8, Math.min(event.clientX + 16, innerWidth - 275))}px`;
  element('tooltip').style.top = `${Math.min(event.clientY + 18, innerHeight - 50)}px`;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    clearSelection();
  }
});
updateLanguage();
async function load() {
  const loaded = await loadModel(model, () => {
    element('load-copy').textContent = tr('Building the shared part library…', '正在准备零件几何…');
  });
  data = loaded.data;
  parts = loaded.parts;
  meshes.push(...loaded.meshes);
  baseDistance = innerWidth < 700 ? 16 : 14;
  fitCamera();
  renderPartLibrary();
  updateModel();
  element('loading').hidden = true;
}
load().catch((error) => {
  element('load-title').textContent = tr('Unable to load the model', '模型加载失败');
  element('load-copy').textContent = String(error.message);
  console.error(error);
});
