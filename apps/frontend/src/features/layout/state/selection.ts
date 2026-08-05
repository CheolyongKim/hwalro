import type { EditorState } from '../types';
import { emptySelection, toggleId } from '../utils/document';

export interface SelectAtAction {
  wallId: string | null;
  textId: string | null;
  additive: boolean;
}

export function applySelectAt(state: EditorState, action: SelectAtAction): EditorState {
  if (action.wallId === null && action.textId === null) {
    if (action.additive) {
      return state;
    }
    return { ...state, selection: emptySelection(), snapHint: null };
  }
  if (action.wallId !== null) {
    const selected = action.additive ? state.selection.wallIds.includes(action.wallId) : false;
    return {
      ...state,
      selection: {
        wallIds: action.additive
          ? toggleId(state.selection.wallIds, action.wallId)
          : [action.wallId],
        textIds: action.additive && !selected ? state.selection.textIds : [],
      },
      snapHint: null,
    };
  }
  const textId = action.textId as string;
  const selected = action.additive ? state.selection.textIds.includes(textId) : false;
  return {
    ...state,
    selection: {
      wallIds: action.additive && !selected ? state.selection.wallIds : [],
      textIds: action.additive ? toggleId(state.selection.textIds, textId) : [textId],
    },
    snapHint: null,
  };
}
