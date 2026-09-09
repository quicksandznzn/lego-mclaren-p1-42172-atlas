import * as THREE from 'three';
import { familyFor } from '../model/part-families.ts';

export interface SourcePart {
  name: string;
  color: string;
  group: string;
  matrix: number[];
  geometry: number[];
}
export interface ModelData {
  geometries: { offset: number; count: number; color: string }[];
  instances: SourcePart[];
  meta: Record<string, string>;
  colors: Record<string, { name: string; hex: string }>;
}
export interface Part extends SourcePart {
  index: number;
  label: string;
  family: number;
  center: THREE.Vector3;
  base: THREE.Matrix4;
  slots: { mesh: THREE.InstancedMesh; slot: number }[];
  hidden: boolean;
  size: THREE.Vector3;
  offset: THREE.Vector3;
  displayed: boolean;
}

export async function loadModel(group: THREE.Group, onProgress: () => void) {
  const meshes: THREE.InstancedMesh[] = [];
  const [json, binary] = await Promise.all([
    fetch('/models/mclaren-p1-42172/model.json'),
    fetch('/models/mclaren-p1-42172/geometry.bin'),
  ]);
  if (!json.ok || !binary.ok)
    throw Error('Model assets missing. See docs/model-assets.md for setup.');
  const data: ModelData = await json.json();
  const floats = new Float32Array(await binary.arrayBuffer());
  onProgress();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const geometries = data.geometries.map((g) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(floats.subarray(g.offset, g.offset + g.count), 3),
    );
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    return geometry;
  });
  const rotate = new THREE.Matrix4().makeRotationX(Math.PI);
  const bounds = new THREE.Box3();
  for (const p of data.instances) {
    const m = rotate.clone().multiply(new THREE.Matrix4().fromArray(p.matrix));
    for (const g of p.geometry) bounds.union(geometries[g].boundingBox!.clone().applyMatrix4(m));
  }
  const center = bounds.getCenter(new THREE.Vector3()),
    size = bounds.getSize(new THREE.Vector3());
  const scale = 8 / Math.max(size.x, size.y, size.z);
  const normalize = new THREE.Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z))
    .multiply(rotate);
  const batches = new Map<string, { geometry: number; color: string; parts: Part[] }>();
  const parts = data.instances.map((p, index) => {
    const base = normalize.clone().multiply(new THREE.Matrix4().fromArray(p.matrix));
    const box = new THREE.Box3();
    for (const g of p.geometry) box.union(geometries[g].boundingBox!);
    const part: Part = {
      ...p,
      index,
      label: data.meta[p.name] || p.name,
      family: familyFor(data.meta[p.name] || ''),
      base,
      center: box.getCenter(new THREE.Vector3()).applyMatrix4(base),
      slots: [],
      hidden: false,
      size: box.clone().applyMatrix4(base).getSize(new THREE.Vector3()),
      offset: new THREE.Vector3(),
      displayed: true,
    };
    for (const g of p.geometry) {
      const c = data.geometries[g].color === '16' ? p.color : data.geometries[g].color;
      const key = `${g}:${c}`;
      if (!batches.has(key)) batches.set(key, { geometry: g, color: c, parts: [] });
      batches.get(key)!.parts.push(part);
    }
    return part;
  });
  for (const batch of batches.values()) {
    const material = new THREE.MeshStandardMaterial({
      color: data.colors[batch.color]?.hex || '#9a9c96',
      roughness: 0.48,
      metalness: ['82', '148', '383'].includes(batch.color) ? 0.5 : 0.02,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.InstancedMesh(geometries[batch.geometry], material, batch.parts.length);
    mesh.userData.parts = batch.parts.map((p) => p.index);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    batch.parts.forEach((p, slot) => {
      p.slots.push({ mesh, slot });
    });
    meshes.push(mesh);
    group.add(mesh);
  }
  return { data, parts, meshes };
}
