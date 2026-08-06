import type {
  Camera,
  DrawingDocument,
  EditorState,
  Exit,
  Tool,
  Vec2,
  Wall,
  WallHandle,
  LayoutText,
} from '../types';
import { round1 } from '../utils/geometry';
import { snapPoint } from '../utils/snapping';
import {
  createEmptyDocument,
  emptySelection,
  nextExitName,
  nextWallName,
  uid,
} from '../utils/document';
import { applyRedo, applyUndo, clearInteraction, commit } from './history';
import { applyDragUpdate } from './drag';
import { applySelectAt } from './selection';
import {
  applyBackgroundDragStart,
  applyBackgroundInsert,
  applyBackgroundOpacity,
  applyBackgroundRemove,
  applyBackgroundResize,
} from './background';

export type EditorAction =
  | { type: 'setTool'; tool: Tool }
  | { type: 'setCamera'; camera: Camera }
  | { type: 'cursorMove'; world: Vec2 | null }
  | { type: 'wallStart'; point: Vec2 }
  | { type: 'wallUpdate'; point: Vec2 }
  | { type: 'wallCommit' }
  | { type: 'exitStart'; point: Vec2 }
  | { type: 'exitUpdate'; point: Vec2 }
  | { type: 'exitCommit' }
  | { type: 'textPlace'; point: Vec2 }
  | { type: 'textCommit'; text: string }
  | { type: 'textCancel' }
  | {
      type: 'selectAt';
      wallId: string | null;
      exitId: string | null;
      textId: string | null;
      additive: boolean;
    }
  | { type: 'dragStartMove'; point: Vec2 }
  | { type: 'reshapeStart'; wallId: string; handle: WallHandle; point: Vec2 }
  | { type: 'reshapeExitStart'; exitId: string; handle: WallHandle; point: Vec2 }
  | { type: 'dragUpdate'; point: Vec2 }
  | { type: 'dragEnd' }
  | { type: 'deleteSelection' }
  | { type: 'backgroundInsert'; image: string; aspect: number }
  | { type: 'backgroundDragStart'; point: Vec2 }
  | { type: 'backgroundResize'; width: number }
  | { type: 'backgroundOpacity'; opacity: number }
  | { type: 'backgroundRemove' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'commit'; prev: DrawingDocument; next: DrawingDocument }
  | { type: 'replaceDoc'; doc: DrawingDocument }
  | { type: 'loadDocument'; doc: DrawingDocument }
  | { type: 'setError'; message: string | null }
  | { type: 'clearSelection' }
  | { type: 'escape' }
  | {
      type: 'updateWall';
      wallId: string;
      patch: Partial<Pick<Wall, 'startX' | 'startY' | 'endX' | 'endY'>>;
    }
  | {
      type: 'updateExit';
      exitId: string;
      patch: Partial<Pick<Exit, 'startX' | 'startY' | 'endX' | 'endY'>>;
    }
  | { type: 'updateText'; textId: string; patch: Partial<Pick<LayoutText, 'x' | 'y'>> };

export function createInitialState(): EditorState {
  return {
    doc: createEmptyDocument(),
    past: [],
    future: [],
    tool: 'select',
    selection: emptySelection(),
    camera: { zoom: 1, panX: 0, panY: 0 },
    draft: null,
    textDraft: null,
    drag: null,
    cursor: null,
    snapHint: null,
    error: null,
    cameraFitNonce: 0,
  };
}

function applyDraftStart(state: EditorState, point: Vec2): EditorState {
  const snapped = snapPoint(point, point, state.doc.walls, [], state.camera.zoom);
  return {
    ...state,
    draft: {
      start: snapped.point,
      end: snapped.point,
      axisSnapped: false,
      snappedToEndpoint: null,
    },
    snapHint: snapped.snappedToEndpoint,
    textDraft: null,
    error: null,
  };
}

function applyDraftUpdate(state: EditorState, point: Vec2): EditorState {
  if (!state.draft) {
    return state;
  }
  const snapped = snapPoint(
    point,
    state.draft.start,
    state.doc.walls,
    [state.draft.start],
    state.camera.zoom,
  );
  return {
    ...state,
    draft: {
      ...state.draft,
      end: snapped.point,
      axisSnapped: snapped.axisSnapped,
      snappedToEndpoint: snapped.snappedToEndpoint,
    },
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'setTool':
      return {
        ...state,
        tool: action.tool,
        draft: null,
        textDraft: null,
        snapHint: null,
        error: null,
      };

    case 'setCamera':
      return { ...state, camera: action.camera };

    case 'cursorMove':
      return { ...state, cursor: action.world };

    case 'wallStart':
      return applyDraftStart(state, action.point);

    case 'wallUpdate':
      return applyDraftUpdate(state, action.point);

    case 'wallCommit': {
      if (!state.draft) {
        return state;
      }
      const { start, end } = state.draft;
      if (round1(end.x) === round1(start.x) && round1(end.y) === round1(start.y)) {
        return { ...state, draft: null, snapHint: null };
      }
      const wall: Wall = {
        id: uid(),
        name: nextWallName(state.doc),
        startX: round1(start.x),
        startY: round1(start.y),
        endX: round1(end.x),
        endY: round1(end.y),
      };
      const next = { ...state.doc, walls: [...state.doc.walls, wall] };
      return commit(state, state.doc, next);
    }

    case 'exitStart':
      return applyDraftStart(state, action.point);

    case 'exitUpdate':
      return applyDraftUpdate(state, action.point);

    case 'exitCommit': {
      if (!state.draft) {
        return state;
      }
      const { start, end } = state.draft;
      if (round1(end.x) === round1(start.x) && round1(end.y) === round1(start.y)) {
        return { ...state, draft: null, snapHint: null };
      }
      const exit: Exit = {
        id: uid(),
        name: nextExitName(state.doc),
        startX: round1(start.x),
        startY: round1(start.y),
        endX: round1(end.x),
        endY: round1(end.y),
      };
      const next = { ...state.doc, exits: [...state.doc.exits, exit] };
      return commit(state, state.doc, next);
    }

    case 'textPlace':
      return {
        ...state,
        textDraft: { point: action.point },
        draft: null,
        snapHint: null,
        error: null,
      };

    case 'textCommit': {
      if (!state.textDraft) {
        return state;
      }
      const trimmed = action.text.trim();
      if (trimmed === '') {
        return { ...state, textDraft: null };
      }
      const text: LayoutText = {
        id: uid(),
        text: trimmed,
        x: round1(state.textDraft.point.x),
        y: round1(state.textDraft.point.y),
      };
      const next = { ...state.doc, layoutTexts: [...state.doc.layoutTexts, text] };
      return commit(state, state.doc, next);
    }

    case 'textCancel':
      return { ...state, textDraft: null };

    case 'selectAt':
      return applySelectAt(state, action);

    case 'dragStartMove':
      return { ...state, drag: { kind: 'move', origin: action.point, originDoc: state.doc } };

    case 'reshapeStart':
      return {
        ...state,
        drag: {
          kind: 'reshape',
          origin: action.point,
          originDoc: state.doc,
          wallId: action.wallId,
          handle: action.handle,
        },
      };

    case 'reshapeExitStart':
      return {
        ...state,
        drag: {
          kind: 'reshapeExit',
          origin: action.point,
          originDoc: state.doc,
          exitId: action.exitId,
          handle: action.handle,
        },
      };

    case 'dragUpdate':
      return applyDragUpdate(state, action.point);

    case 'backgroundInsert':
      return applyBackgroundInsert(state, action.image, action.aspect);

    case 'backgroundDragStart':
      return applyBackgroundDragStart(state, action.point);

    case 'backgroundResize':
      return applyBackgroundResize(state, action.width);

    case 'backgroundOpacity':
      return applyBackgroundOpacity(state, action.opacity);

    case 'backgroundRemove':
      return applyBackgroundRemove(state);

    case 'dragEnd': {
      if (!state.drag) {
        return state;
      }
      return commit(state, state.drag.originDoc, state.doc);
    }

    case 'deleteSelection': {
      const { selection } = state;
      if (
        selection.wallIds.length === 0 &&
        selection.exitIds.length === 0 &&
        selection.textIds.length === 0
      ) {
        return state;
      }
      const walls = state.doc.walls.filter((w) => !selection.wallIds.includes(w.id));
      const exits = state.doc.exits.filter((e) => !selection.exitIds.includes(e.id));
      const layoutTexts = state.doc.layoutTexts.filter((t) => !selection.textIds.includes(t.id));
      const next = { ...state.doc, walls, exits, layoutTexts };
      return commit(state, state.doc, next);
    }

    case 'commit':
      return commit(state, action.prev, action.next);

    case 'replaceDoc':
      return { ...state, doc: action.doc, error: null };

    case 'loadDocument':
      return {
        ...clearInteraction({ ...state, doc: action.doc }),
        past: [],
        future: [],
        cameraFitNonce: state.cameraFitNonce + 1,
      };

    case 'updateWall': {
      const wall = state.doc.walls.find((w) => w.id === action.wallId);
      if (!wall) {
        return state;
      }
      const nextWall: Wall = { ...wall, ...action.patch };
      const next = {
        ...state.doc,
        walls: state.doc.walls.map((w) => (w.id === wall.id ? nextWall : w)),
      };
      return commit(state, state.doc, next);
    }

    case 'updateExit': {
      const exit = state.doc.exits.find((e) => e.id === action.exitId);
      if (!exit) {
        return state;
      }
      const nextExit: Exit = { ...exit, ...action.patch };
      const next = {
        ...state.doc,
        exits: state.doc.exits.map((e) => (e.id === exit.id ? nextExit : e)),
      };
      return commit(state, state.doc, next);
    }

    case 'updateText': {
      const text = state.doc.layoutTexts.find((t) => t.id === action.textId);
      if (!text) {
        return state;
      }
      const nextText: LayoutText = { ...text, ...action.patch };
      const next = {
        ...state.doc,
        layoutTexts: state.doc.layoutTexts.map((t) => (t.id === text.id ? nextText : t)),
      };
      return commit(state, state.doc, next);
    }

    case 'undo':
      return applyUndo(state);

    case 'redo':
      return applyRedo(state);

    case 'setError':
      return { ...state, error: action.message };

    case 'clearSelection':
      return { ...state, selection: emptySelection(), snapHint: null };

    case 'escape': {
      if (state.draft) {
        return { ...state, draft: null, snapHint: null };
      }
      if (state.textDraft) {
        return { ...state, textDraft: null };
      }
      if (
        state.selection.wallIds.length > 0 ||
        state.selection.exitIds.length > 0 ||
        state.selection.textIds.length > 0
      ) {
        return { ...state, selection: emptySelection() };
      }
      return state;
    }

    default:
      return state;
  }
}
