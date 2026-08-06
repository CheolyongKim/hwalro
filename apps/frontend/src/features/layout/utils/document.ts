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
    pillars: [],
    fabrics: [],
    layoutTexts: [],
    background: null,
  };
}

export function emptySelection(): PointSelection {
  return { wallIds: [], textIds: [], pillarIds: [], fabricIds: [] };
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

export function nextPillarName(doc: DrawingDocument): string {
  let max = 0;
  for (const pillar of doc.pillars) {
    const match = /^기둥 (\d+)$/.exec(pillar.name);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `기둥 ${max + 1}`;
}

export function nextFabricName(doc: DrawingDocument): string {
  let max = 0;
  for (const fabric of doc.fabrics) {
    const match = /^구조물 (\d+)$/.exec(fabric.name);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `구조물 ${max + 1}`;
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
  const pillars = doc.pillars.map((pillar) =>
    selection.pillarIds.includes(pillar.id)
      ? {
          ...pillar,
          startX: pillar.startX + delta.x,
          startY: pillar.startY + delta.y,
          endX: pillar.endX + delta.x,
          endY: pillar.endY + delta.y,
        }
      : pillar,
  );
  const fabrics = doc.fabrics.map((fabric) =>
    selection.fabricIds.includes(fabric.id)
      ? {
          ...fabric,
          startX: fabric.startX + delta.x,
          startY: fabric.startY + delta.y,
          endX: fabric.endX + delta.x,
          endY: fabric.endY + delta.y,
        }
      : fabric,
  );
  const layoutTexts = doc.layoutTexts.map((text) =>
    selection.textIds.includes(text.id)
      ? { ...text, x: text.x + delta.x, y: text.y + delta.y }
      : text,
  );
  return { ...doc, walls, pillars, fabrics, layoutTexts };
}
