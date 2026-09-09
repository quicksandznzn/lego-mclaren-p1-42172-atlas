import assert from 'node:assert/strict';
import test from 'node:test';
import { bindPointerSelection } from '../src/viewer/pointer-selection.ts';

test('selection persists on empty taps; drags and multi-touch never select', () => {
  const canvas = new EventTarget();
  let selected = 'wheel',
    hit: string | undefined = 'panel',
    calls = 0;
  const dispose = bindPointerSelection(
    canvas,
    () => hit,
    (value) => {
      selected = value;
      calls++;
    },
    () => {},
  );
  const send = (type: string, x = 10, pointerId = 1, pointerType = 'mouse') => {
    canvas.dispatchEvent(
      Object.assign(new Event(type), {
        pointerId,
        pointerType,
        clientX: x,
        clientY: 10,
        button: 0,
        buttons: type === 'pointerup' ? 0 : 1,
      }),
    );
  };
  send('pointerdown');
  send('pointerup');
  assert.equal(selected, 'panel');
  assert.equal(calls, 1);
  hit = undefined;
  send('pointerdown');
  send('pointerup');
  assert.equal(selected, 'panel', 'An empty tap must preserve the open inspector');
  hit = 'pin';
  send('pointerdown');
  send('pointermove', 70);
  send('pointermove', 10);
  send('pointerup');
  assert.equal(calls, 1, 'A drag that returns to its starting point is not a tap');
  send('pointerdown', 10, 1, 'touch');
  send('pointerdown', 10, 2, 'touch');
  send('pointerup', 10, 2, 'touch');
  send('pointerup', 10, 1, 'touch');
  assert.equal(calls, 1, 'Pinch gestures must not select');
  send('pointerdown');
  send('pointercancel');
  send('pointerup');
  send('pointerup');
  assert.equal(calls, 1, 'Cancelled and unmatched releases must not select');
  send('pointerdown');
  send('pointerup');
  assert.equal(selected, 'pin', 'A new valid tap replaces the detail content');
  dispose();
  send('pointerdown');
  send('pointerup');
  assert.equal(calls, 2, 'Disposal removes the listeners');
});

test('rapid hover moves identify each part and leaving clears the tooltip', () => {
  const canvas = new EventTarget();
  const hovered: (number | undefined)[] = [];
  const dispose = bindPointerSelection(
    canvas,
    (event) => event.clientX,
    () => {},
    (item) => hovered.push(item),
  );
  for (const x of [10, 20, 30]) {
    canvas.dispatchEvent(
      Object.assign(new Event('pointermove'), {
        pointerId: 1,
        pointerType: 'mouse',
        buttons: 0,
        clientX: x,
        clientY: 0,
      }),
    );
  }
  canvas.dispatchEvent(new Event('pointerleave'));
  assert.deepEqual(hovered, [10, 20, 30, undefined]);
  dispose();
});
