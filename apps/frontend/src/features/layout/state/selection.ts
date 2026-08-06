import type { EditorState } from '../types';
import { emptySelection, toggleId } from '../utils/document';

export interface SelectAtAction {
  wallId: string | null;
  textId: string | null;
  pillarId: string | null;
  fabricId: string | null;
  additive: boolean;
}

export function applySelectAt(state: EditorState, action: SelectAtAction): EditorState {
  if (
    action.wallId === null &&
    action.textId === null &&
    action.pillarId === null &&
    action.fabricId === null
  ) {
    if (action.additive) {
      return state;
    }
    return { ...state, selection: emptySelection(), snapHint: null };
  }
  const { selection } = state;
  let wallIds = selection.wallIds;
  let textIds = selection.textIds;
  let pillarIds = selection.pillarIds;
  let fabricIds = selection.fabricIds;
  if (action.wallId !== null) {
    wallIds = action.additive ? toggleId(wallIds, action.wallId) : [action.wallId];
    if (!action.additive) {
      textIds = [];
      pillarIds = [];
      fabricIds = [];
    }
  } else if (action.textId !== null) {
    textIds = action.additive ? toggleId(textIds, action.textId) : [action.textId];
    if (!action.additive) {
      wallIds = [];
      pillarIds = [];
      fabricIds = [];
    }
  } else if (action.pillarId !== null) {
    pillarIds = action.additive ? toggleId(pillarIds, action.pillarId) : [action.pillarId];
    if (!action.additive) {
      wallIds = [];
      textIds = [];
      fabricIds = [];
    }
  } else if (action.fabricId !== null) {
    fabricIds = action.additive ? toggleId(fabricIds, action.fabricId) : [action.fabricId];
    if (!action.additive) {
      wallIds = [];
      textIds = [];
      pillarIds = [];
    }
  }
  return { ...state, selection: { wallIds, textIds, pillarIds, fabricIds }, snapHint: null };
}
