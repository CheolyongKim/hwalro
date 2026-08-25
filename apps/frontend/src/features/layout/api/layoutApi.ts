import { AxiosError } from 'axios';
import type { DrawingDocument } from '../types';
import { fromSerialized, toSerialized } from '../utils/serialization';
import { drawingApi } from '../../drawings/api/drawingApi';
import type {
  Drawing,
  DrawingLayoutVersionStatus,
  DrawingVersionSummary,
} from '../../drawings/types/drawing';

export interface DrawingSession {
  doc: DrawingDocument;
  description: string | null;
  version: number;
  layoutVersionId: number;
  layoutVersionNumber: number;
  layoutVersionStatus: DrawingLayoutVersionStatus;
}

function toSession(drawing: Drawing): DrawingSession {
  return {
    doc: fromSerialized({
      name: drawing.title,
      width: drawing.width,
      height: drawing.height,
      walls: drawing.walls,
      outsideWalls: drawing.outsideWalls,
      exits: drawing.exits,
      pillars: drawing.pillars,
      fabrics: drawing.fabrics,
      layoutTexts: drawing.layoutTexts,
    }),
    description: drawing.description,
    version: drawing.version,
    layoutVersionId: drawing.layoutVersionId,
    layoutVersionNumber: drawing.layoutVersionNumber,
    layoutVersionStatus: drawing.layoutVersionStatus,
  };
}

export async function fetchDrawing(id: string, signal?: AbortSignal): Promise<DrawingSession | null> {
  try {
    const drawing = await drawingApi.get(Number(id), signal);
    return toSession(drawing);
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function saveDrawing(id: string, session: DrawingSession): Promise<Drawing> {
  const serialized = toSerialized(session.doc);
  return drawingApi.update(Number(id), {
    title: serialized.name,
    description: session.description,
    walls: serialized.walls,
    outsideWalls: serialized.outsideWalls,
    exits: serialized.exits,
    pillars: serialized.pillars,
    fabrics: serialized.fabrics,
    layoutTexts: serialized.layoutTexts,
    expectedVersion: session.version,
  });
}

export async function fetchDrawingVersions(id: string): Promise<DrawingVersionSummary[]> {
  return drawingApi.versions(Number(id));
}

export async function restoreDrawingVersion(
  id: string,
  versionId: number,
): Promise<DrawingSession> {
  const drawing = await drawingApi.restoreVersion(Number(id), versionId);
  return toSession(drawing);
}
