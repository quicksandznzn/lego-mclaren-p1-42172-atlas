export type ScreenTarget = {
  index: number;
  x: number;
  y: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/** Use the whole projected part, including thin edges and tiny pins. */
export function findScreenTarget(targets: ScreenTarget[], x: number, y: number, radius: number) {
  let best: number | undefined,
    score = Infinity;
  for (const target of targets) {
    const distance = Math.hypot(
      Math.max(target.left - x, 0, x - target.right),
      Math.max(target.top - y, 0, y - target.bottom),
    );
    if (distance > radius) continue;
    const candidate = distance + Math.hypot(target.x - x, target.y - y) * 0.025;
    if (candidate < score) {
      score = candidate;
      best = target.index;
    }
  }
  return best;
}
