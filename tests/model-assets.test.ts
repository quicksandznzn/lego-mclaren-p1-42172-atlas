import assert from 'node:assert/strict';

// Runtime assets are part of the repository and required for a working checkout.
const { readFileSync } = await import('node:fs');
const model = JSON.parse(readFileSync('public/models/mclaren-p1-42172/model.json', 'utf8'));
const bytes = readFileSync('public/models/mclaren-p1-42172/geometry.bin');
assert.equal(model.colors['191'].hex, '#FCAC00');
assert.equal(model.instances.length, 3905);
assert.ok(
  model.instances.every(
    (p: any) =>
      p.matrix.length === 16 &&
      p.matrix.every(Number.isFinite) &&
      p.geometry.every((g: number) => model.geometries[g]),
  ),
);
assert.ok(
  model.geometries.every((g: any) => g.count % 9 === 0 && (g.offset + g.count) * 4 <= bytes.length),
);
assert.equal(model.instances[0].matrix[12], -229.0018);
console.log('Bundled model colors, transforms and geometry ranges passed.');
assert.equal(
  readFileSync('assets/source/mclaren-p1-42172/model.io').subarray(0, 2).toString(),
  'PK',
);
