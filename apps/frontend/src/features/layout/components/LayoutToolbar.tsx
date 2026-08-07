import type { EditorState } from '../types';

interface LayoutToolbarProps {
  state: EditorState;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  onSave: () => void;
  onStartSimulation: () => void;
  readOnly: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function LayoutToolbar({
  state,
  saveStatus,
  onSave,
  onStartSimulation,
  readOnly,
  collapsed,
  onToggleCollapse,
}: LayoutToolbarProps) {
  return (
    <div className="shrink-0 border-b border-panel-divider p-3">
      <div className="flex items-center gap-2">
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
          <button
            type="button"
            onClick={onSave}
            disabled={readOnly}
            className={`h-9 rounded-md text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
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
            <p className="rounded-md bg-panel-soft px-2 py-1.5 text-[11px] leading-4 text-panel-muted">
              시뮬레이션에 사용된 버전으로, 도면 편집이 잠겨 있습니다.
            </p>
          )}
          <button
            type="button"
            onClick={onStartSimulation}
            className="h-9 rounded-md border border-panel-accent text-[13px] font-bold text-panel-accent transition-colors hover:bg-panel-accent/10"
          >
            시뮬레이션 배치
          </button>
        </div>
      )}
    </div>
  );
}
