import type { DragState, EditorState, Exit, RectHandle, Vec2, Wall } from '../types';
import { rectCenter, rotatePoint, round1 } from '../utils/geometry';
import { docSnapSources, snapPoint } from '../utils/snapping';
import { translateDoc } from '../utils/document';

type ReshapeDrag = Extract<DragState, { kind: 'reshape' }>;
type RotateDrag = Extract<DragState, { kind: 'rotate' }>;

export function applyDragUpdate(state: EditorState, point: Vec2): EditorState {
  const drag = state.drag;
  if (!drag) {
    return state;
  }
  if (drag.kind === 'move') {
    const delta = { x: point.x - drag.origin.x, y: point.y - drag.origin.y };
    return { ...state, doc: translateDoc(drag.originDoc, state.selection, delta) };
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
  if (drag.elementKind === 'wall') {
    return applyWallReshapeUpdate(state, drag, point);
  }
  return applyRectReshapeUpdate(state, drag, point);
}

function applyWallReshapeUpdate(state: EditorState, drag: ReshapeDrag, point: Vec2): EditorState {
  const wall = state.doc.walls.find((w) => w.id === drag.elementId);
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
  const nextWall: Wall =
    drag.handle === 'start'
      ? { ...wall, startX: round1(snapped.point.x), startY: round1(snapped.point.y) }
      : { ...wall, endX: round1(snapped.point.x), endY: round1(snapped.point.y) };
  const walls = state.doc.walls.map((w) => (w.id === wall.id ? nextWall : w));
  return {
    ...state,
    doc: { ...state.doc, walls },
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
  const nextExit: Exit =
    drag.handle === 'start'
      ? { ...exit, startX: round1(snapped.point.x), startY: round1(snapped.point.y) }
      : { ...exit, endX: round1(snapped.point.x), endY: round1(snapped.point.y) };
  const exits = state.doc.exits.map((e) => (e.id === exit.id ? nextExit : e));
  return {
    ...state,
    doc: { ...state.doc, exits },
    snapHint: snapped.snappedToEndpoint,
  };
}

function reshapeRectElement<
  T extends { startX: number; startY: number; endX: number; endY: number; rotation: number },
>(element: T, point: Vec2, handle: RectHandle): T {
  const center = rectCenter(element);
  const local = rotatePoint(point, center, -element.rotation);
  const patch =
    handle === 'start'
      ? { startX: round1(local.x), startY: round1(local.y) }
      : { endX: round1(local.x), endY: round1(local.y) };
  return { ...element, ...patch };
}

function applyRectReshapeUpdate(state: EditorState, drag: ReshapeDrag, point: Vec2): EditorState {
  if (drag.elementKind === 'pillar') {
    const pillar = state.doc.pillars.find((p) => p.id === drag.elementId);
    if (!pillar) {
      return state;
    }
    const next = reshapeRectElement(pillar, point, drag.handle);
    return {
      ...state,
      doc: { ...state.doc, pillars: state.doc.pillars.map((p) => (p.id === pillar.id ? next : p)) },
    };
  }
  const fabric = state.doc.fabrics.find((f) => f.id === drag.elementId);
  if (!fabric) {
    return state;
  }
  const next = reshapeRectElement(fabric, point, drag.handle);
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
    return {
      ...state,
      doc: { ...state.doc, pillars: state.doc.pillars.map((p) => (p.id === pillar.id ? next : p)) },
    };
  }
  const fabric = state.doc.fabrics.find((f) => f.id === drag.elementId);
  if (!fabric) {
    return state;
  }
  const next = rotateRectElement(fabric, point);
  return {
    ...state,
    doc: { ...state.doc, fabrics: state.doc.fabrics.map((f) => (f.id === fabric.id ? next : f)) },
  };
}
