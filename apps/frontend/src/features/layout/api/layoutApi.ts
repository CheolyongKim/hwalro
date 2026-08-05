import { AxiosError } from 'axios';
import type { DrawingDocument } from '../types';
import { fromSerialized, toSerialized } from '../utils/serialization';
import { drawingApi } from '../../drawings/api/drawingApi';

export interface DrawingSession {
  doc: DrawingDocument;
  description: string | null;
}

export async function fetchDrawing(id: string): Promise<DrawingSession | null> {
  try {
    const drawing = await drawingApi.get(Number(id));
    const doc = fromSerialized({
      name: drawing.title,
      width: drawing.width,
      height: drawing.height,
      walls: drawing.walls,
      layoutTexts: drawing.layoutTexts,
    });
    return { doc, description: drawing.description };
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function saveDrawing(
  id: string,
  session: { doc: DrawingDocument; description: string | null },
): Promise<void> {
  const serialized = toSerialized(session.doc);
  await drawingApi.update(Number(id), {
    title: serialized.name,
    description: session.description,
    walls: serialized.walls,
    layoutTexts: serialized.layoutTexts,
  });
}
