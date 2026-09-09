/** Distinguish intentional taps from orbiting, panning and multi-touch gestures. */
export function bindPointerSelection<T>(
  target: EventTarget,
  pick: (event: PointerEvent) => T | undefined,
  select: (item: T) => void,
  hover: (item: T | undefined, event: PointerEvent) => void,
) {
  const pointers = new Map<number, { x: number; y: number; moved: boolean }>();
  const down = (event: Event) => {
    const e = event as PointerEvent;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: e.button !== 0 });
    if (pointers.size > 1)
      pointers.forEach((pointer) => {
        pointer.moved = true;
      });
    hover(undefined, e);
  };
  const move = (event: Event) => {
    const e = event as PointerEvent,
      pointer = pointers.get(e.pointerId);
    if (
      pointer &&
      Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) >
        (e.pointerType === 'touch' ? 12 : 5)
    )
      pointer.moved = true;
    if (pointers.size || e.buttons || e.pointerType === 'touch') return;
    hover(pick(e), e);
  };
  const up = (event: Event) => {
    const e = event as PointerEvent,
      pointer = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    hover(undefined, e);
    if (
      !pointer ||
      pointer.moved ||
      Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) >
        (e.pointerType === 'touch' ? 12 : 5)
    )
      return;
    const item = pick(e);
    // Missing a tiny part must not dismiss the current inspector.
    if (item !== undefined) select(item);
  };
  const cancel = (event: Event) => {
    const e = event as PointerEvent;
    pointers.delete(e.pointerId);
    hover(undefined, e);
  };
  const leave = (event: Event) => {
    hover(undefined, event as PointerEvent);
  };
  const listeners = {
    pointerdown: down,
    pointermove: move,
    pointerup: up,
    pointercancel: cancel,
    lostpointercapture: cancel,
    pointerleave: leave,
  };
  for (const [event, listener] of Object.entries(listeners))
    target.addEventListener(event, listener);
  return () => {
    for (const [event, listener] of Object.entries(listeners))
      target.removeEventListener(event, listener);
  };
}
