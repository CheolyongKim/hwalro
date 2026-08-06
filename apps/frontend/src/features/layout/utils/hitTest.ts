import type { Exit, LayoutText, Vec2, Wall, WallHandle } from '../types';
import { distanceToSegment, estimateTextWidthPx, PX_PER_METER } from './geometry';

export const HIT_RADIUS_PX = 6;
export const HANDLE_RADIUS_PX = 8;
export const TEXT_FONT_PX = 11;

function pxToWorld(px: number, zoom: number): number {
  return px / (zoom * PX_PER_METER);
}

export interface WorldBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function textWorldBox(text: LayoutText, zoom: number): WorldBox {
  return {
    x: text.x,
    y: text.y,
    w: estimateTextWidthPx(text.text, TEXT_FONT_PX) / (zoom * PX_PER_METER),
    h: TEXT_FONT_PX / (zoom * PX_PER_METER),
  };
}

export function hitTestWall(point: Vec2, wall: Wall, zoom: number): boolean {
  const radius = pxToWorld(HIT_RADIUS_PX, zoom);
  const start = { x: wall.startX, y: wall.startY };
  const end = { x: wall.endX, y: wall.endY };
  return distanceToSegment(point, start, end) <= radius;
}

export function hitTestExit(point: Vec2, exit: Exit, zoom: number): boolean {
  const radius = pxToWorld(HIT_RADIUS_PX, zoom);
  const start = { x: exit.startX, y: exit.startY };
  const end = { x: exit.endX, y: exit.endY };
  return distanceToSegment(point, start, end) <= radius;
}

export function hitTestText(point: Vec2, text: LayoutText, zoom: number): boolean {
  const box = textWorldBox(text, zoom);
  const pad = pxToWorld(HIT_RADIUS_PX, zoom);
  return (
    point.x >= box.x - pad &&
    point.x <= box.x + box.w + pad &&
    point.y >= box.y - pad &&
    point.y <= box.y + box.h + pad
  );
}

export interface ElementHit {
  wallId: string | null;
  exitId: string | null;
  textId: string | null;
}

export function hitTestElements(
  point: Vec2,
  walls: Wall[],
  texts: LayoutText[],
  exits: Exit[],
  zoom: number,
): ElementHit {
  for (const text of texts) {
    if (hitTestText(point, text, zoom)) {
      return { wallId: null, exitId: null, textId: text.id };
    }
  }
  for (const exit of exits) {
    if (hitTestExit(point, exit, zoom)) {
      return { wallId: null, exitId: exit.id, textId: null };
    }
  }
  for (const wall of walls) {
    if (hitTestWall(point, wall, zoom)) {
      return { wallId: wall.id, exitId: null, textId: null };
    }
  }
  return { wallId: null, exitId: null, textId: null };
}

export interface HandleHit {
  wallId: string;
  handle: WallHandle;
}

export function hitTestHandle(point: Vec2, wall: Wall, zoom: number): HandleHit | null {
  const radius = pxToWorld(HANDLE_RADIUS_PX, zoom);
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

export interface ExitHandleHit {
  exitId: string;
  handle: WallHandle;
}

export function hitTestExitHandle(point: Vec2, exit: Exit, zoom: number): ExitHandleHit | null {
  const radius = pxToWorld(HANDLE_RADIUS_PX, zoom);
  const start = { x: exit.startX, y: exit.startY };
  const end = { x: exit.endX, y: exit.endY };
  if (Math.hypot(point.x - start.x, point.y - start.y) <= radius) {
    return { exitId: exit.id, handle: 'start' };
  }
  if (Math.hypot(point.x - end.x, point.y - end.y) <= radius) {
    return { exitId: exit.id, handle: 'end' };
  }
  return null;
}
