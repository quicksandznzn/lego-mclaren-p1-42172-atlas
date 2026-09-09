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

const { familyFor } = await import('../src/model/part-families.ts');
const wheels = model.instances.filter((part: any) => familyFor(model.meta[part.name] || '') === 1);
assert.equal(wheels.length, 8, 'Wheel filter must contain exactly four rims and four tyres');
assert.deepEqual([...new Set(wheels.map((part: any) => part.name))].sort(), [
  '5428.dat',
  '80279.dat',
]);
for (const [name, family] of [
  ['2741.dat', 6], // Steering wheel
  ['65766.dat', 6], // Steering hub holder
  ['32072.dat', 4], // Knob gear, despite "Wheel" in its name
  ['m5b8699b8_2022731_072959.dat', 6], // Shock piston, not engine piston
  ['2851.dat', 4], // Engine piston
  ['18947.dat', 4], // Transmission driving ring
  ['4159.dat', 4], // Transmission changeover fork
  ['3894.dat', 2], // Structural Technic brick
  ['18677.dat', 5], // Decorative plate with a pin hole
] as const)
  assert.equal(familyFor(model.meta[name]), family, name);
