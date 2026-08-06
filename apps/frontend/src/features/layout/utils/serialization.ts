import type { BackgroundImage, DrawingDocument, Exit, SerializedDocument, Wall } from '../types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown, key: string): number {
  const num =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(num)) {
    throw new Error(`잘못된 숫자 값: ${key}`);
  }
  return num;
}

function wallNameIndex(name: string): number | null {
  const match = /^벽 (\d+)$/.exec(name);
  return match ? Number(match[1]) : null;
}

function exitNameIndex(name: string): number | null {
  const match = /^비상구 (\d+)$/.exec(name);
  return match ? Number(match[1]) : null;
}

export function toSerialized(doc: DrawingDocument): SerializedDocument {
  return {
    name: doc.name,
    width: doc.width,
    height: doc.height,
    walls: doc.walls.map((wall) => ({
      name: wall.name,
      startX: wall.startX,
      startY: wall.startY,
      endX: wall.endX,
      endY: wall.endY,
    })),
    exits: doc.exits.map((exit) => ({
      name: exit.name,
      startX: exit.startX,
      startY: exit.startY,
      endX: exit.endX,
      endY: exit.endY,
    })),
    layoutTexts: doc.layoutTexts.map((text) => ({ text: text.text, x: text.x, y: text.y })),
    background: doc.background
      ? {
          image: doc.background.image,
          x: doc.background.x,
          y: doc.background.y,
          width: doc.background.width,
          height: doc.background.height,
          opacity: doc.background.opacity,
          aspect: doc.background.aspect,
        }
      : null,
  };
}

export function toJson(doc: DrawingDocument): string {
  return JSON.stringify(toSerialized(doc), null, 2);
}

export function parseWallName(name: unknown): string | null {
  return typeof name === 'string' && name.trim() !== '' ? name.trim() : null;
}

export function fromSerialized(data: unknown): DrawingDocument {
  if (!isRecord(data)) {
    throw new Error('최상위 구조가 객체가 아닙니다');
  }
  const name = typeof data.name === 'string' && data.name.trim() !== '' ? data.name.trim() : '도면';
  const width = toFiniteNumber(data.width ?? 1000, 'width');
  const height = toFiniteNumber(data.height ?? 500, 'height');
  if (width <= 0 || height <= 0) {
    throw new Error('width/height는 0보다 커야 합니다');
  }

  if (data.walls !== undefined && !Array.isArray(data.walls)) {
    throw new Error('walls는 배열이어야 합니다');
  }
  if (data.exits !== undefined && !Array.isArray(data.exits)) {
    throw new Error('exits는 배열이어야 합니다');
  }
  if (data.layoutTexts !== undefined && !Array.isArray(data.layoutTexts)) {
    throw new Error('layoutTexts는 배열이어야 합니다');
  }

  const walls: Wall[] = [];
  const rawWalls = (data.walls ?? []) as unknown[];
  let maxIndex = 0;
  const unnamed: Array<{ wall: Wall; order: number }> = [];
  for (let i = 0; i < rawWalls.length; i++) {
    const entry = rawWalls[i];
    if (!isRecord(entry)) {
      throw new Error(`walls[${i}]가 객체가 아닙니다`);
    }
    const parsedName = parseWallName(entry.name);
    if (parsedName) {
      const idx = wallNameIndex(parsedName);
      if (idx !== null) {
        maxIndex = Math.max(maxIndex, idx);
      }
    }
    const wall: Wall = {
      id: `loaded-wall-${i}`,
      name: parsedName ?? '',
      startX: toFiniteNumber(entry.startX ?? entry.start_x, `walls[${i}].startX`),
      startY: toFiniteNumber(entry.startY ?? entry.start_y, `walls[${i}].startY`),
      endX: toFiniteNumber(entry.endX ?? entry.end_x, `walls[${i}].endX`),
      endY: toFiniteNumber(entry.endY ?? entry.end_y, `walls[${i}].endY`),
    };
    if (parsedName) {
      walls.push(wall);
    } else {
      unnamed.push({ wall, order: i });
    }
  }

  for (const { wall, order } of unnamed) {
    maxIndex += 1;
    walls.splice(order, 0, { ...wall, name: `벽 ${maxIndex}` });
  }

  const rawExits = (data.exits ?? []) as unknown[];
  const exits: Exit[] = [];
  let maxExitIndex = 0;
  const unnamedExits: Array<{ exit: Exit; order: number }> = [];
  for (let i = 0; i < rawExits.length; i++) {
    const entry = rawExits[i];
    if (!isRecord(entry)) {
      throw new Error(`exits[${i}]가 객체가 아닙니다`);
    }
    const parsedName = parseWallName(entry.name);
    if (parsedName) {
      const idx = exitNameIndex(parsedName);
      if (idx !== null) {
        maxExitIndex = Math.max(maxExitIndex, idx);
      }
    }
    const exit: Exit = {
      id: `loaded-exit-${i}`,
      name: parsedName ?? '',
      startX: toFiniteNumber(entry.startX ?? entry.start_x, `exits[${i}].startX`),
      startY: toFiniteNumber(entry.startY ?? entry.start_y, `exits[${i}].startY`),
      endX: toFiniteNumber(entry.endX ?? entry.end_x, `exits[${i}].endX`),
      endY: toFiniteNumber(entry.endY ?? entry.end_y, `exits[${i}].endY`),
    };
    if (parsedName) {
      exits.push(exit);
    } else {
      unnamedExits.push({ exit, order: i });
    }
  }

  for (const { exit, order } of unnamedExits) {
    maxExitIndex += 1;
    exits.splice(order, 0, { ...exit, name: `비상구 ${maxExitIndex}` });
  }

  const rawTexts = (data.layoutTexts ?? []) as unknown[];
  const layoutTexts = rawTexts.map((entry, i) => {
    if (!isRecord(entry)) {
      throw new Error(`layoutTexts[${i}]가 객체가 아닙니다`);
    }
    return {
      id: `loaded-text-${i}`,
      text: typeof entry.text === 'string' ? entry.text : String(entry.text ?? ''),
      x: toFiniteNumber(entry.x, `layoutTexts[${i}].x`),
      y: toFiniteNumber(entry.y, `layoutTexts[${i}].y`),
    };
  });

  let background: BackgroundImage | null = null;
  if (data.background !== undefined && data.background !== null) {
    if (!isRecord(data.background)) {
      throw new Error('background는 객체이거나 null이어야 합니다');
    }
    const bg = data.background;
    const image = typeof bg.image === 'string' ? bg.image : '';
    if (image === '') {
      throw new Error('background.image가 빈 값입니다');
    }
    const width = toFiniteNumber(bg.width, 'background.width');
    const height = toFiniteNumber(bg.height, 'background.height');
    if (width <= 0 || height <= 0) {
      throw new Error('background.width/height는 0보다 커야 합니다');
    }
    const rawAspect = toFiniteNumber(bg.aspect ?? width / height, 'background.aspect');
    background = {
      id: 'loaded-background',
      image,
      x: toFiniteNumber(bg.x, 'background.x'),
      y: toFiniteNumber(bg.y, 'background.y'),
      width,
      height,
      opacity: Math.min(1, Math.max(0.1, toFiniteNumber(bg.opacity, 'background.opacity'))),
      aspect: rawAspect > 0 ? rawAspect : width / height,
    };
  }

  return { name, width, height, walls, exits, layoutTexts, background };
}

export function parseJson(text: string): DrawingDocument {
  const data: unknown = JSON.parse(text);
  return fromSerialized(data);
}
