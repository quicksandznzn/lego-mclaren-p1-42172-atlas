import { families } from './part-families.ts';

export interface InventoryItem {
  id: number;
  key: string;
  width: number;
  height: number;
}
export interface InventoryCell {
  x: number;
  y: number;
  width: number;
  height: number;
  count: number;
  representative: number;
}
// Shelf-packing approach adapted from Human Atlas (MIT); see public/THIRD_PARTY.txt.
/** One shelf cell per visible piece, or per reference + color. Bounds include a pickable gap. */
export function inventoryLayout(items: InventoryItem[], aspect: number, unique: boolean) {
  const groups = new Map<string, InventoryItem[]>();
  for (const item of items) {
    const key = unique ? item.key : String(item.id);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  const cards = [...groups.values()].map((group) => ({
    group,
    width: Math.max(0.08, ...group.map((p) => p.width)) + 0.12,
    height: Math.max(0.08, ...group.map((p) => p.height)) + 0.12,
  }));
  const area = cards.reduce((sum, c) => sum + c.width * c.height, 0);
  const target = Math.max(
    0.3,
    ...cards.map((c) => c.width),
    Math.sqrt(area * Math.max(0.25, Math.min(2.5, aspect))) * 1.1,
  );
  cards.sort((a, b) => b.height - a.height || a.group[0].id - b.group[0].id);
  const cells = new Map<number, InventoryCell>();
  let x = 0,
    y = 0,
    row = 0,
    width = 0;
  for (const card of cards) {
    if (x && x + card.width > target) {
      x = 0;
      y += row;
      row = 0;
    }
    const cell = {
      x: x + card.width / 2,
      y: -y - card.height / 2,
      width: card.width,
      height: card.height,
      count: card.group.length,
      representative: card.group[0].id,
    };
    for (const p of card.group) cells.set(p.id, cell);
    x += card.width;
    width = Math.max(width, x);
    row = Math.max(row, card.height);
  }
  const height = y + row;
  for (const cell of new Set(cells.values())) {
    cell.x -= width / 2;
    cell.y += height / 2;
  }
  return { cells, width, height, count: cards.length };
}
export function explosionOffset(
  center: number[],
  family: number,
  destination: number[],
  amount: number,
) {
  const angle = (family / families.length) * Math.PI * 2;
  const loose = [
    Math.sin(angle) * 1.1,
    center[1] * 0.4 + (family === 0 ? 0.7 : 0),
    Math.cos(angle) * 1.1,
  ];
  if (amount <= 0.4) return loose.map((v) => (v * amount) / 0.4);
  const t = Math.min(1, (amount - 0.4) / 0.6);
  const eased = t * t * (3 - 2 * t);
  return loose.map((v, i) => v + (destination[i] - center[i] - v) * eased);
}
