// Model conversion: shared geometry keeps the 3,900-piece model practical in a browser.
import fs from 'node:fs';
import { Matrix4, Vector3 } from 'three';
const parseMpdFiles = (text) =>
  new Map(
    text
      .replace(/^\uFEFF/, '')
      .split(/^0 FILE /m)
      .slice(1)
      .map((c) => {
        const n = c.indexOf('\n');
        return [c.slice(0, n).trim().toLowerCase().replaceAll('\\', '/'), c.slice(n + 1)];
      }),
  );
const files = parseMpdFiles(fs.readFileSync('.cache/mclaren-p1-42172/packed/model.mpd', 'utf8'));
const studioFiles = parseMpdFiles(
  fs.readFileSync('.cache/mclaren-p1-42172/studio/model2.ldr', 'utf8'),
);
for (const [n, t] of studioFiles) files.set(n, t);
const referenceFiles = parseMpdFiles(
  fs.readFileSync('.cache/mclaren-p1-42172/studio/model.ldr', 'utf8'),
);
const parseReferences = (t) =>
  t
    .split('\n')
    .filter((l) => l.startsWith('1 '))
    .map((l) => l.trim().split(/\s+/));
const colorMap = {};
for (const [n, t] of referenceFiles) {
  const a = parseReferences(t),
    b = parseReferences(studioFiles.get(n) || '');
  if (a.length === b.length) for (let i = 0; i < a.length; i++) colorMap[b[i][1]] = a[i][1];
}
colorMap['-1'] = '16';
const colors = {};
for (const l of fs
  .readFileSync('.cache/mclaren-p1-42172/packed/LDConfig.ldr', 'utf8')
  .split('\n')) {
  const m = l.match(/^0 !COLOUR (.+?) CODE\s+(\d+)\s+VALUE\s+(#[\da-f]+).*?(?:ALPHA (\d+))?$/i);
  if (m) colors[m[2]] = { name: m[1].trim().replaceAll('_', ' '), hex: m[3] };
}
const referenceMatrix = (b) =>
  new Matrix4().set(
    +b[5],
    +b[6],
    +b[7],
    +b[2],
    +b[8],
    +b[9],
    +b[10],
    +b[3],
    +b[11],
    +b[12],
    +b[13],
    +b[4],
    0,
    0,
    0,
    1,
  );
const partCommands = new Map(
  [...files].map(([n, t]) => [
    n,
    t
      .split('\n')
      .filter((l) => /^[134] /.test(l))
      .map((l) => l.trim().split(/\s+/)),
  ]),
);
const geometries = [],
  instances = [],
  meta = {},
  geometryCache = new Map();
let positionValues = [];
function getPartGeometry(name) {
  if (geometryCache.has(name)) return geometryCache.get(name);
  const byColor = new Map();
  function visit(n, mat, color, path) {
    if (path.includes(n)) throw Error('Cyclic part ' + n);
    const lines = partCommands.get(n);
    if (!lines) throw Error('Missing ' + n);
    for (const b of lines) {
      let c = b[1] === '-1' || b[1] === '16' ? color : colorMap[b[1]] || b[1];
      if (b[0] === '1') {
        visit(
          b.slice(14).join(' ').toLowerCase().replaceAll('\\', '/'),
          mat.clone().multiply(referenceMatrix(b)),
          c,
          [...path, n],
        );
      } else {
        const indices = b[0] === '3' ? [0, 1, 2] : [0, 1, 2, 0, 2, 3];
        let out = byColor.get(c);
        if (!out) byColor.set(c, (out = []));
        for (const i of indices) {
          const v = new Vector3(+b[2 + i * 3], +b[3 + i * 3], +b[4 + i * 3]).applyMatrix4(mat);
          out.push(v.x, v.y, v.z);
        }
      }
    }
  }
  visit(name, new Matrix4(), '16', []);
  const result = [];
  for (const [color, positions] of byColor) {
    const id = geometries.length;
    geometries.push({ offset: positionValues.length, count: positions.length, color });
    for (const f of positions) positionValues.push(f);
    result.push(id);
  }
  geometryCache.set(name, result);
  return result;
}
function collectInstances(n, mat, color, group = '') {
  const text = files.get(n);
  if (!text) throw Error('Missing ' + n);
  if (text.includes('0 IsSubModel True')) {
    if (n.includes('targhetta')) return;
    for (const b of parseReferences(text)) {
      const next = b.slice(14).join(' ').toLowerCase().replaceAll('\\', '/');
      collectInstances(
        next,
        mat.clone().multiply(referenceMatrix(b)),
        b[1] === '-1' ? color : colorMap[b[1]] || b[1],
        n.includes('cofano') ? n : group,
      );
    }
  } else {
    meta[n] =
      text
        .split('\n')
        .find((l) => l.startsWith('0 ') && !/^0 (!|FILE|Name|Author)/.test(l))
        ?.slice(2) || n;
    instances.push({ name: n, color, group, matrix: mat.toArray(), geometry: getPartGeometry(n) });
  }
}
collectInstances(studioFiles.keys().next().value, new Matrix4(), '0');
fs.mkdirSync('public/models/mclaren-p1-42172', { recursive: true });
if (!colors['191'] || colors['191'].hex !== '#FCAC00') throw Error('Missing source colors');
if (!positionValues.every(Number.isFinite)) throw Error('Non-finite geometry');
fs.writeFileSync(
  'public/models/mclaren-p1-42172/geometry.bin',
  Buffer.from(new Float32Array(positionValues).buffer),
);
fs.writeFileSync(
  'public/models/mclaren-p1-42172/model.json',
  JSON.stringify({ geometries, instances, meta, colors }),
);
console.log({
  instances: instances.length,
  unique: geometryCache.size,
  triangles: positionValues.length / 9,
  MB: (positionValues.length * 4) / 1e6,
  colorMap,
});
