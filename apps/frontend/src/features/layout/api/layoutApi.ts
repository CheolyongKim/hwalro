import { AxiosError } from 'axios';
import type { DrawingDocument } from '../types';
import { fromSerialized, toSerialized } from '../utils/serialization';
import { drawingApi } from '../../drawings/api/drawingApi';
import type { DrawingLayoutVersionStatus } from '../../drawings/types/drawing';

export interface DrawingSession {
  doc: DrawingDocument;
  description: string | null;
  version: number;
  layoutVersionId: number;
  layoutVersionNumber: number;
  layoutVersionStatus: DrawingLayoutVersionStatus;
}

export async function fetchDrawing(id: string): Promise<DrawingSession | null> {
  try {
    const drawing = await drawingApi.get(Number(id));
    const doc = fromSerialized({
      name: drawing.title,
      width: drawing.width,
      height: drawing.height,
      walls: drawing.walls,
      outsideWalls: drawing.outsideWalls,
      exits: drawing.exits,
      pillars: drawing.pillars,
      fabrics: drawing.fabrics,
      layoutTexts: drawing.layoutTexts,
    });
    return {
      doc,
      description: drawing.description,
      version: drawing.version,
      layoutVersionId: drawing.layoutVersionId,
      layoutVersionNumber: drawing.layoutVersionNumber,
      layoutVersionStatus: drawing.layoutVersionStatus,
    };
  } catch (error) {
    if (error instanceof AxiosError && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/** 저장 응답이 돌려준 서버 ID. 새로 그린 요소가 저장 즉시 구역·제약 대상이 되려면 이 값이 필요하다. */
export interface SavedIds {
  walls: Array<number | null>;
  pillars: Array<number | null>;
  fabrics: Array<number | null>;
}

export interface SaveResult {
  version: number;
  savedIds: SavedIds;
}

export async function saveDrawing(id: string, session: DrawingSession): Promise<SaveResult> {
  const serialized = toSerialized(session.doc);
  const drawing = await drawingApi.update(Number(id), {
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
  return {
    version: drawing.version,
    savedIds: {
      walls: drawing.walls.map((wall) => wall.id ?? null),
      pillars: drawing.pillars.map((pillar) => pillar.id ?? null),
      fabrics: drawing.fabrics.map((fabric) => fabric.id ?? null),
    },
  };
}
