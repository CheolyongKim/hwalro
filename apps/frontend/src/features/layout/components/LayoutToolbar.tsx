import { useNavigate } from 'react-router-dom';
import type { Dispatch } from 'react';
import type { EditorState, Tool } from '../types';
import type { EditorAction } from '../state/editorReducer';

interface LayoutToolbarProps {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onSave: () => void;
}

const TOOLS: Array<{ id: Tool; label: string }> = [
  { id: 'select', label: '선택' },
  { id: 'wall', label: '벽' },
  { id: 'exit', label: '비상구' },
  { id: 'pillar', label: '기둥' },
  { id: 'fabric', label: '구조물' },
  { id: 'text', label: '텍스트' },
  { id: 'erase', label: '삭제' },
];

export function LayoutToolbar({ state, dispatch, saveStatus, onSave }: LayoutToolbarProps) {
  const navigate = useNavigate();

  return (
    <div className="flex w-fit items-center gap-2 rounded-md border border-line bg-surface p-2">
      <button
        type="button"
        onClick={() => navigate('/')}
        aria-label="목록"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line-strong bg-white text-text-strong transition-colors hover:bg-background"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10 3 L5 8 L10 13" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onSave}
        className={`flex h-8 shrink-0 items-center rounded-md px-3 text-[13px] font-bold text-white transition-colors ${
          saveStatus === 'error' ? 'bg-danger' : 'bg-primary hover:bg-primary/85'
        }`}
      >
        {saveStatus === 'saving'
          ? '저장 중'
          : saveStatus === 'saved'
            ? '저장 완료'
            : saveStatus === 'error'
              ? '저장 실패'
              : '저장'}
      </button>
      <div className="mx-1 h-5 w-px shrink-0 bg-line" />
      <div className="flex items-center gap-1">
        {TOOLS.map((tool) => {
          const active = state.tool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              aria-pressed={active}
              onClick={() => dispatch({ type: 'setTool', tool: tool.id })}
              className={`h-8 rounded-md px-3 text-[13px] transition-colors ${
                active
                  ? 'bg-primary font-bold text-white'
                  : 'bg-toolbar font-semibold text-text-strong hover:bg-primary-soft'
              }`}
            >
              {tool.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
