import type { LayoutText, Vec2, Wall, WallHandle } from '../types';
import { distanceToSegment, estimateTextWidthPx } from './geometry';

export const HIT_RADIUS_PX = 6;
export const HANDLE_RADIUS_PX = 8;

export function textFontPx(zoom: number): number {
  return Math.min(28, Math.max(7, 11 / zoom));
}

export interface WorldBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function textWorldBox(text: LayoutText, zoom: number): WorldBox {
  const fontPx = textFontPx(zoom);
  return {
    x: text.x,
    y: text.y,
    w: estimateTextWidthPx(text.text, fontPx) / zoom,
    h: fontPx / zoom,
  };
}

export function hitTestWall(point: Vec2, wall: Wall, zoom: number): boolean {
  const radius = HIT_RADIUS_PX / zoom;
  const start = { x: wall.startX, y: wall.startY };
  const end = { x: wall.endX, y: wall.endY };
  return distanceToSegment(point, start, end) <= radius;
}

export function hitTestText(point: Vec2, text: LayoutText, zoom: number): boolean {
  const box = textWorldBox(text, zoom);
  const pad = HIT_RADIUS_PX / zoom;
  return (
    point.x >= box.x - pad &&
    point.x <= box.x + box.w + pad &&
    point.y >= box.y - pad &&
    point.y <= box.y + box.h + pad
  );
}

export interface ElementHit {
  wallId: string | null;
  textId: string | null;
}

export function hitTestElements(
  point: Vec2,
  walls: Wall[],
  texts: LayoutText[],
  zoom: number,
): ElementHit {
  for (const text of texts) {
    if (hitTestText(point, text, zoom)) {
      return { wallId: null, textId: text.id };
    }
  }
  for (const wall of walls) {
    if (hitTestWall(point, wall, zoom)) {
      return { wallId: wall.id, textId: null };
    }
  }
  return { wallId: null, textId: null };
}

export interface HandleHit {
  wallId: string;
  handle: WallHandle;
}

export function hitTestHandle(point: Vec2, wall: Wall, zoom: number): HandleHit | null {
  const radius = HANDLE_RADIUS_PX / zoom;
  const start = { x: wall.startX, y: wall.startY };
  const end = { x: wall.endX, y: wall.endY };
  if (Math.hypot(point.x - start.x, point.y - start.y) <= radius) {
    return { wallId: wall.id, handle: 'start' };
  }
  if (Math.hypot(point.x - end.x, point.y - end.y) <= radius) {
    return { wallId: wall.id, handle: 'end' };
  }
  return null;
}
