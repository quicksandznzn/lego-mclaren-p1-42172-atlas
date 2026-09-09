import assert from 'node:assert/strict';
import test from 'node:test';
import { findScreenTarget } from '../src/viewer/screen-picking.ts';

test('inventory picking covers long edges, tiny neighbours and empty space', () => {
  const targets = [
    { index: 0, x: 50, y: 10, left: 0, right: 100, top: 9, bottom: 11 },
    { index: 1, x: 110, y: 10, left: 109, right: 111, top: 9, bottom: 11 },
  ];
  assert.equal(findScreenTarget(targets, 1, 12, 12), 0);
  assert.equal(findScreenTarget(targets, 110, 10, 12), 1);
  assert.equal(findScreenTarget(targets, 112, 12, 12), 1);
  assert.equal(findScreenTarget(targets, 140, 10, 12), undefined);
  assert.equal(findScreenTarget([], 50, 10, 12), undefined);
});
