import type { Dispatch } from 'react';
import type { EditorState, Tool } from '../types';
import type { EditorAction } from '../state/editorReducer';

interface ToolToolbarProps {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  className?: string;
}

const TOOLS: Array<{ id: Tool; label: string }> = [
  { id: 'select', label: '선택' },
  { id: 'wall', label: '벽' },
  { id: 'outsideWall', label: '외각벽' },
  { id: 'exit', label: '비상구' },
  { id: 'pillar', label: '기둥' },
  { id: 'fabric', label: '구조물' },
  { id: 'text', label: '텍스트' },
  { id: 'erase', label: '지우개' },
  { id: 'background', label: '배경' },
];

export function ToolToolbar({ state, dispatch, className }: ToolToolbarProps) {
  return (
    <div
      className={`flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-1.5 rounded-xl border border-panel-divider bg-panel p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] ${className ?? ''}`}
    >
      {TOOLS.map((tool) => {
        const active = state.tool === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            aria-pressed={active}
            onClick={() => dispatch({ type: 'setTool', tool: tool.id })}
            className={`h-9 min-w-14 rounded-lg px-2 text-[13px] transition-colors ${
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
  );
}
