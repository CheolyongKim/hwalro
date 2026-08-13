import { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { EditorState } from '../types';

interface LayoutToolbarProps {
  state: EditorState;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onSave: () => void;
  onStartSimulation: () => void;
  onRename: (name: string) => void;
  readOnly: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function LayoutToolbar({
  state,
  saveStatus,
  onSave,
  onStartSimulation,
  onRename,
  readOnly,
  collapsed,
  onToggleCollapse,
}: LayoutToolbarProps) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');

  const startEditing = () => {
    setDraftName(state.doc.name);
    setEditing(true);
  };

  const commitRename = () => {
    setEditing(false);
    const next = draftName.trim();
    if (next !== '' && next !== state.doc.name) {
      onRename(next);
    }
  };

  return (
    <div className="shrink-0 border-b border-panel-divider p-3">
      <div className="flex items-center gap-2">
        {editing ? (
          <input
            autoFocus
            type="text"
            value={draftName}
            onChange={(event) => setDraftName(event.currentTarget.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitRename();
              } else if (event.key === 'Escape') {
                setEditing(false);
              }
            }}
            aria-label="도면 이름"
            maxLength={50}
            className="h-8 min-w-0 flex-1 rounded-md border border-panel-border bg-panel-soft px-2 text-[15px] font-bold text-panel-text outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
        ) : (
          <h1 className="min-w-0 flex-1 truncate text-[15px] font-bold text-panel-text">
            {state.doc.name}
          </h1>
        )}
        {!editing && (
          <button
            type="button"
            onClick={startEditing}
            disabled={readOnly}
            aria-label="도면 이름 수정"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-panel-muted transition-colors hover:bg-panel-soft hover:text-panel-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Pencil aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? '패널 펼치기' : '패널 접기'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-panel-muted transition-colors hover:bg-panel-soft hover:text-panel-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
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
          <button
            type="button"
            onClick={onSave}
            disabled={readOnly}
            className={`h-9 rounded-lg text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-45 ${
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
          {readOnly && (
            <p className="rounded-md bg-panel-soft px-2 py-1.5 text-xs leading-4 text-panel-muted">
              시뮬레이션에 사용된 버전으로, 도면 편집이 잠겨 있습니다.
            </p>
          )}
          <button
            type="button"
            onClick={onStartSimulation}
            className="h-9 rounded-lg border border-panel-accent text-sm font-bold text-panel-accent transition-colors hover:bg-panel-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            시뮬레이션 배치
          </button>
        </div>
      )}
    </div>
  );
}
