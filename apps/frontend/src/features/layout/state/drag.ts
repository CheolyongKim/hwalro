import type { DragState, DrawingDocument, EditorState, Exit, Fabric, Pillar, RectHandle, Vec2, Wall } from '../types';
import { rectCenter, rotatePoint, round1 } from '../utils/geometry';
import { docSnapSources, snapPoint } from '../utils/snapping';
import { isRectInsideBounds, translateDoc } from '../utils/document';
import { clampLineDraft, clampMoveDelta, clampRectDraft, clampRotate } from '../utils/collision';

type ReshapeDrag = Extract<DragState, { kind: 'reshape' }>;
type RotateDrag = Extract<DragState, { kind: 'rotate' }>;

function clampToDocBounds(doc: { width: number; height: number }, point: Vec2): Vec2 {
  return {
    x: Math.max(0, Math.min(doc.width, point.x)),
    y: Math.max(0, Math.min(doc.height, point.y)),
  };
}

export function applyDragUpdate(state: EditorState, point: Vec2): EditorState {
  const drag = state.drag;
  if (!drag) {
    return state;
  }
  if (drag.kind === 'move') {
    const delta = { x: point.x - drag.origin.x, y: point.y - drag.origin.y };
    const clampedDelta = clampMoveDelta(drag.originDoc, state.selection, delta);
    return { ...state, doc: translateDoc(drag.originDoc, state.selection, clampedDelta) };
  }
  if (drag.kind === 'erase') {
    return state;
  }
  if (drag.kind === 'backgroundMove') {
    if (!state.doc.background) {
      return state;
    }
    const dx = point.x - drag.origin.x;
    const dy = point.y - drag.origin.y;
    const moved = { ...drag.originBg, x: drag.originBg.x + dx, y: drag.originBg.y + dy };
    return { ...state, doc: { ...state.doc, background: moved } };
  }
  if (drag.kind === 'rotate') {
    return applyRotateUpdate(state, drag, point);
  }
  if (drag.kind === 'reshapeExit') {
    return applyReshapeExit(state, drag, point);
  }
  if (drag.elementKind === 'wall' || drag.elementKind === 'outsideWall') {
    return applyLineReshapeUpdate(state, drag, point);
  }
  return applyRectReshapeUpdate(state, drag, point);
}

function applyLineReshapeUpdate(state: EditorState, drag: ReshapeDrag, point: Vec2): EditorState {
  const wall =
    drag.elementKind === 'wall'
      ? state.doc.walls.find((w) => w.id === drag.elementId)
      : state.doc.outsideWalls.find((w) => w.id === drag.elementId);
  if (!wall) {
    return state;
  }
  const other =
    drag.handle === 'start' ? { x: wall.endX, y: wall.endY } : { x: wall.startX, y: wall.startY };
  const exclude = [
    { x: wall.startX, y: wall.startY },
    { x: wall.endX, y: wall.endY },
  ];
  const snapped = snapPoint(point, other, docSnapSources(state.doc), exclude, state.camera.zoom);
  const clamped = clampToDocBounds(state.doc, snapped.point);
  const elementExcluded =
    drag.elementKind === 'wall'
      ? { ...state.doc, walls: state.doc.walls.filter((w) => w.id !== wall.id) }
      : { ...state.doc, outsideWalls: state.doc.outsideWalls.filter((w) => w.id !== wall.id) };
  const collisionClamped = clampLineDraft(other, clamped, elementExcluded);
  const nextWall =
    drag.handle === 'start'
      ? { ...wall, startX: round1(collisionClamped.x), startY: round1(collisionClamped.y) }
      : { ...wall, endX: round1(collisionClamped.x), endY: round1(collisionClamped.y) };
  const doc =
    drag.elementKind === 'wall'
      ? {
          ...state.doc,
          walls: state.doc.walls.map((w) => (w.id === wall.id ? nextWall : w)),
        }
      : {
          ...state.doc,
          outsideWalls: state.doc.outsideWalls.map((w) => (w.id === wall.id ? nextWall : w)),
        };
  return {
    ...state,
    doc,
    snapHint: snapped.snappedToEndpoint,
  };
}

function applyReshapeExit(
  state: EditorState,
  drag: Extract<DragState, { kind: 'reshapeExit' }>,
  point: Vec2,
): EditorState {
  const exit = state.doc.exits.find((e) => e.id === drag.exitId);
  if (!exit) {
    return state;
  }
  const other =
    drag.handle === 'start' ? { x: exit.endX, y: exit.endY } : { x: exit.startX, y: exit.startY };
  const exclude = [
    { x: exit.startX, y: exit.startY },
    { x: exit.endX, y: exit.endY },
  ];
  const snapped = snapPoint(point, other, docSnapSources(state.doc), exclude, state.camera.zoom);
  const clamped = clampToDocBounds(state.doc, snapped.point);
  const nextExit: Exit =
    drag.handle === 'start'
      ? { ...exit, startX: round1(clamped.x), startY: round1(clamped.y) }
      : { ...exit, endX: round1(clamped.x), endY: round1(clamped.y) };
  const exits = state.doc.exits.map((e) => (e.id === exit.id ? nextExit : e));
  return {
    ...state,
    doc: { ...state.doc, exits },
    snapHint: snapped.snappedToEndpoint,
  };
}

function reshapeRectElement<
  T extends { startX: number; startY: number; endX: number; endY: number; rotation: number; id: string },
>(element: T, point: Vec2, handle: RectHandle, doc: DrawingDocument): T {
  const center = rectCenter(element);
  const localPoint = rotatePoint(point, center, -element.rotation);
  const fixed =
    handle === 'start' ? { x: element.endX, y: element.endY } : { x: element.startX, y: element.startY };
  const clamped = clampRectDraft(fixed, localPoint, elementLocalDoc(doc, element));
  const patch =
    handle === 'start'
      ? { startX: round1(clamped.x), startY: round1(clamped.y) }
      : { endX: round1(clamped.x), endY: round1(clamped.y) };
  return { ...element, ...patch };
}

function elementLocalDoc(
  doc: DrawingDocument,
  element: { startX: number; startY: number; endX: number; endY: number; rotation: number; id: string },
): DrawingDocument {
  const center = rectCenter(element);
  const rot = (p: Vec2) => rotatePoint(p, center, -element.rotation);
  const mapWall = (wall: Wall): Wall => {
    const a = rot({ x: wall.startX, y: wall.startY });
    const b = rot({ x: wall.endX, y: wall.endY });
    return { ...wall, startX: a.x, startY: a.y, endX: b.x, endY: b.y };
  };
  const mapRect = (rect: Pillar | Fabric): Pillar | Fabric => {
    const a = rot({ x: rect.startX, y: rect.startY });
    const b = rot({ x: rect.endX, y: rect.endY });
    return { ...rect, startX: a.x, startY: a.y, endX: b.x, endY: b.y };
  };
  return {
    ...doc,
    walls: doc.walls.filter((w) => w.id !== element.id).map(mapWall),
    outsideWalls: doc.outsideWalls.filter((w) => w.id !== element.id).map(mapWall),
    pillars: doc.pillars.filter((p) => p.id !== element.id).map(mapRect),
    fabrics: doc.fabrics.filter((f) => f.id !== element.id).map(mapRect),
  };
}

function applyRectReshapeUpdate(state: EditorState, drag: ReshapeDrag, point: Vec2): EditorState {
  if (drag.elementKind === 'pillar') {
    const pillar = state.doc.pillars.find((p) => p.id === drag.elementId);
    if (!pillar) {
      return state;
    }
    const next = reshapeRectElement(pillar, clampToDocBounds(state.doc, point), drag.handle, state.doc);
    if (!isRectInsideBounds(state.doc, next.startX, next.startY, next.endX, next.endY)) {
      return state;
    }
    return {
      ...state,
      doc: { ...state.doc, pillars: state.doc.pillars.map((p) => (p.id === pillar.id ? next : p)) },
    };
  }
  const fabric = state.doc.fabrics.find((f) => f.id === drag.elementId);
  if (!fabric) {
    return state;
  }
  const next = reshapeRectElement(fabric, clampToDocBounds(state.doc, point), drag.handle, state.doc);
  if (!isRectInsideBounds(state.doc, next.startX, next.startY, next.endX, next.endY)) {
    return state;
  }
  return {
    ...state,
    doc: { ...state.doc, fabrics: state.doc.fabrics.map((f) => (f.id === fabric.id ? next : f)) },
  };
}

function rotateRectElement<
  T extends { startX: number; startY: number; endX: number; endY: number; rotation: number },
>(element: T, point: Vec2): T {
  const center = rectCenter(element);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  if (dx === 0 && dy === 0) {
    return element;
  }
  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  return { ...element, rotation: round1(((degrees % 360) + 360) % 360) };
}

function applyRotateUpdate(state: EditorState, drag: RotateDrag, point: Vec2): EditorState {
  if (drag.elementKind === 'pillar') {
    const pillar = state.doc.pillars.find((p) => p.id === drag.elementId);
    if (!pillar) {
      return state;
    }
    const next = rotateRectElement(pillar, point);
    const clamped = { ...next, rotation: clampRotate(pillar, next.rotation, state.doc) };
    return {
      ...state,
      doc: { ...state.doc, pillars: state.doc.pillars.map((p) => (p.id === pillar.id ? clamped : p)) },
    };
  }
  const fabric = state.doc.fabrics.find((f) => f.id === drag.elementId);
  if (!fabric) {
    return state;
  }
  const next = rotateRectElement(fabric, point);
  const clamped = { ...next, rotation: clampRotate(fabric, next.rotation, state.doc) };
  return {
    ...state,
    doc: { ...state.doc, fabrics: state.doc.fabrics.map((f) => (f.id === fabric.id ? clamped : f)) },
  };
}
