import type { DrawingDocument, PointSelection, Vec2 } from '../types';

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export function createEmptyDocument(): DrawingDocument {
  return {
    name: '더현대 지하 2층',
    width: 1000,
    height: 500,
    walls: [],
    exits: [],
    layoutTexts: [],
    background: null,
  };
}

export function emptySelection(): PointSelection {
  return { wallIds: [], exitIds: [], textIds: [] };
}

export function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function nextWallName(doc: DrawingDocument): string {
  let max = 0;
  for (const wall of doc.walls) {
    const match = /^벽 (\d+)$/.exec(wall.name);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `벽 ${max + 1}`;
}

export function nextExitName(doc: DrawingDocument): string {
  let max = 0;
  for (const exit of doc.exits) {
    const match = /^비상구 (\d+)$/.exec(exit.name);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `비상구 ${max + 1}`;
}

export function translateDoc(
  doc: DrawingDocument,
  selection: PointSelection,
  delta: Vec2,
): DrawingDocument {
  if (delta.x === 0 && delta.y === 0) {
    return doc;
  }
  const walls = doc.walls.map((wall) =>
    selection.wallIds.includes(wall.id)
      ? {
          ...wall,
          startX: wall.startX + delta.x,
          startY: wall.startY + delta.y,
          endX: wall.endX + delta.x,
          endY: wall.endY + delta.y,
        }
      : wall,
  );
  const exits = doc.exits.map((exit) =>
    selection.exitIds.includes(exit.id)
      ? {
          ...exit,
          startX: exit.startX + delta.x,
          startY: exit.startY + delta.y,
          endX: exit.endX + delta.x,
          endY: exit.endY + delta.y,
        }
      : exit,
  );
  const layoutTexts = doc.layoutTexts.map((text) =>
    selection.textIds.includes(text.id)
      ? { ...text, x: text.x + delta.x, y: text.y + delta.y }
      : text,
  );
  return { ...doc, walls, exits, layoutTexts };
}
