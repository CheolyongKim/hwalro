import { useNavigate } from 'react-router-dom';
import type { Dispatch } from 'react';
import type { EditorState, Tool } from '../types';
import type { EditorAction } from '../state/editorReducer';

interface LayoutToolbarProps {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onSave: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
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

export function LayoutToolbar({
  state,
  dispatch,
  saveStatus,
  onSave,
  collapsed,
  onToggleCollapse,
}: LayoutToolbarProps) {
  const navigate = useNavigate();

  return (
    <div className="shrink-0 border-b border-panel-divider p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="목록"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-panel-muted transition-colors hover:bg-panel-soft hover:text-panel-text"
        >
          <svg
            width="14"
            height="14"
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
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-bold text-panel-text">
          {state.doc.name}
        </h1>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? '패널 펼치기' : '패널 접기'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-panel-muted transition-colors hover:bg-panel-soft hover:text-panel-text"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {collapsed ? (
              <>
                <path d="M8 3 L12 8 L8 13" />
                <path d="M4 3 L8 8 L4 13" />
              </>
            ) : (
              <>
                <path d="M8 3 L4 8 L8 13" />
                <path d="M12 3 L8 8 L12 13" />
              </>
            )}
          </svg>
        </button>
      </div>
      {!collapsed && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="grid grid-cols-4 gap-1.5">
            {TOOLS.map((tool) => {
              const active = state.tool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => dispatch({ type: 'setTool', tool: tool.id })}
                  className={`h-8 rounded-md text-[12px] transition-colors ${
                    active
                      ? 'bg-panel-accent font-bold text-ink'
                      : 'bg-panel-soft font-semibold text-panel-text hover:bg-panel-border'
                  }`}
                >
                  {tool.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onSave}
            className={`h-9 rounded-md text-[13px] font-bold transition-colors ${
              saveStatus === 'error'
                ? 'bg-panel-danger text-white'
                : 'bg-panel-accent text-ink hover:opacity-85'
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
        </div>
      )}
    </div>
  );
}
