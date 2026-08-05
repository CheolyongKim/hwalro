import type { Dispatch } from 'react';
import type { EditorState } from '../types';
import type { EditorAction } from '../state/editorReducer';
import { clampPan, zoomAtPoint } from '../utils/geometry';

interface ZoomControlProps {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  size: { w: number; h: number };
  className?: string;
}

export function ZoomControl({ state, dispatch, size, className }: ZoomControlProps) {
  const { camera, doc } = state;

  const zoomAtCenter = (factor: number) => {
    if (size.w === 0 || size.h === 0) {
      return;
    }
    const zoomed = zoomAtPoint(
      camera,
      { x: size.w / 2, y: size.h / 2 },
      { left: 0, top: 0 },
      factor,
    );
    const viewW = size.w / zoomed.zoom;
    const viewH = size.h / zoomed.zoom;
    dispatch({ type: 'setCamera', camera: clampPan(zoomed, doc.width, doc.height, viewW, viewH) });
  };

  const fit = () => {
    if (size.w === 0 || size.h === 0) {
      return;
    }
    const zoom = Math.min(size.w / doc.width, size.h / doc.height) * 0.95;
    const clamped = Math.min(8, Math.max(0.25, zoom));
    dispatch({
      type: 'setCamera',
      camera: {
        zoom: clamped,
        panX: (doc.width - size.w / clamped) / 2,
        panY: (doc.height - size.h / clamped) / 2,
      },
    });
  };

  return (
    <div
      className={`flex items-center rounded-md border border-line bg-white p-1 ${className ?? ''}`}
    >
      <button
        type="button"
        onClick={() => zoomAtCenter(1 / 1.25)}
        aria-label="축소"
        className="flex h-7 w-7 items-center justify-center rounded-md text-text-strong transition-colors hover:bg-background"
      >
        −
      </button>
      <span className="min-w-11 text-center font-mono text-xs text-text-muted">
        {Math.round(camera.zoom * 100)}%
      </span>
      <button
        type="button"
        onClick={() => zoomAtCenter(1.25)}
        aria-label="확대"
        className="flex h-7 w-7 items-center justify-center rounded-md text-text-strong transition-colors hover:bg-background"
      >
        +
      </button>
      <button
        type="button"
        onClick={fit}
        className="h-7 rounded-md px-2.5 text-[13px] font-semibold text-text-strong transition-colors hover:bg-background"
      >
        맞춤
      </button>
    </div>
  );
}
