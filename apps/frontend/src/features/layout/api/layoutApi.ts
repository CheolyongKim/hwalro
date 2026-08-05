import type { BackgroundImage, DrawingDocument, SerializedDocument } from '../types';
import { fromSerialized, parseJson, toSerialized } from '../utils/serialization';
import seedDrawing from '../mock/seed-drawing.json';

export const SEED_DRAWING_ID = 'hyundai-basement-2';

type DrawingPayload = Omit<SerializedDocument, 'background'>;

const documentKey = (id: string) => `hwalro:layout:doc:${id}`;
const backgroundKey = (id: string) => `hwalro:layout:bg:${id}`;

function toPayload(doc: DrawingDocument): DrawingPayload {
  const serialized = toSerialized(doc);
  return {
    name: serialized.name,
    width: serialized.width,
    height: serialized.height,
    walls: serialized.walls,
    layoutTexts: serialized.layoutTexts,
  };
}

async function readDocument(id: string): Promise<DrawingDocument | null> {
  const stored = localStorage.getItem(documentKey(id));
  if (stored === null) {
    return null;
  }
  return parseJson(stored);
}

async function writeDocument(id: string, doc: DrawingDocument): Promise<void> {
  localStorage.setItem(documentKey(id), JSON.stringify(toPayload(doc)));
}

async function readBackground(id: string): Promise<BackgroundImage | null> {
  const stored = localStorage.getItem(backgroundKey(id));
  if (stored === null) {
    return null;
  }
  return JSON.parse(stored) as BackgroundImage;
}

async function writeBackground(id: string, background: BackgroundImage | null): Promise<void> {
  if (background === null) {
    localStorage.removeItem(backgroundKey(id));
    return;
  }
  localStorage.setItem(backgroundKey(id), JSON.stringify(background));
}

export async function fetchDrawing(id: string): Promise<DrawingDocument | null> {
  const stored = await readDocument(id);
  if (stored !== null) {
    return stored;
  }
  if (id !== SEED_DRAWING_ID) {
    return null;
  }
  const doc = fromSerialized(seedDrawing);
  await writeDocument(id, doc);
  return doc;
}

export async function saveDrawing(id: string, doc: DrawingDocument): Promise<void> {
  await writeDocument(id, doc);
}

export async function fetchBackground(id: string): Promise<BackgroundImage | null> {
  return readBackground(id);
}

export async function saveBackground(
  id: string,
  background: BackgroundImage | null,
): Promise<void> {
  await writeBackground(id, background);
}
