import type { EditorState, Exit, Vec2, Wall } from '../types';
import { round1 } from '../utils/geometry';
import { snapPoint } from '../utils/snapping';
import { translateDoc } from '../utils/document';

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
  if (drag.kind === 'reshapeExit') {
    return applyReshapeExit(state, drag, point);
  }
  const wall = state.doc.walls.find((w) => w.id === drag.wallId);
  if (!wall) {
    return state;
  }
  const other =
    drag.handle === 'start' ? { x: wall.endX, y: wall.endY } : { x: wall.startX, y: wall.startY };
  const exclude = [
    { x: wall.startX, y: wall.startY },
    { x: wall.endX, y: wall.endY },
  ];
  const snapped = snapPoint(point, other, state.doc.walls, exclude, state.camera.zoom);
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
  drag: Extract<EditorState['drag'], { kind: 'reshapeExit' }>,
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
  const snapped = snapPoint(point, other, state.doc.walls, exclude, state.camera.zoom);
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
