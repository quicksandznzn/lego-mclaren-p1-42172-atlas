import assert from 'node:assert/strict';
import { familyFor } from '../src/model/part-families.ts';
assert.equal(familyFor('Technic Gear 14 Tooth'), 4);
assert.equal(familyFor('Technic Panel Fairing'), 0);
assert.equal(familyFor('Tyre 81 x 35'), 1);
assert.equal(familyFor('Technic Axle Pin'), 3);
console.log('Model classification and explode checks passed.');

const { inventoryLayout, explosionOffset } = await import('../src/model/inventory-layout.ts');
const items = Array.from({ length: 100 }, (_, id) => ({
  id,
  width: 0.1 + (id % 7) * 0.14,
  height: 0.08 + (id % 11) * 0.09,
}));
for (const aspect of [0.3, 1, 2.3]) {
  const layout = inventoryLayout(items, aspect);
  assert.equal(layout.cells.size, items.length);
  assert.equal(layout.count, 100);
  const cells = [...layout.cells.values()];
  for (let i = 0; i < cells.length; i++)
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i],
        b = cells[j];
      assert.ok(
        Math.abs(a.x - b.x) >= (a.width + b.width) / 2 - 1e-9 ||
          Math.abs(a.y - b.y) >= (a.height + b.height) / 2 - 1e-9,
        'Inventory cells overlap',
      );
    }
}
const identical = Array.from({ length: 4 }, (_, id) => ({ id, width: 1, height: 1 }));
const copies = inventoryLayout(identical, 1);
assert.equal(
  new Set([...copies.cells.values()].map((cell) => `${cell.x}:${cell.y}`)).size,
  4,
  'Identical copies must keep separate positions',
);
assert.equal(inventoryLayout([], 1).count, 0);
const c = [1, 2, 3],
  destination = [7, 8, 0];
assert.ok(explosionOffset(c, 1, destination, 0).every((n) => n === 0));
assert.deepEqual(explosionOffset(c, 1, destination, 1), [6, 6, -3]);
const before = explosionOffset(c, 1, destination, 0.4 - 1e-8),
  after = explosionOffset(c, 1, destination, 0.4 + 1e-8);
assert.ok(before.every((n, i) => Math.abs(n - after[i]) < 1e-6));
console.log('Per-piece inventory packing and continuous explosion passed.');
