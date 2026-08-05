import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LayoutCanvas } from '../components/LayoutCanvas';
import { LayoutToolbar } from '../components/LayoutToolbar';
import { ZoomControl } from '../components/ZoomControl';
import { SettingsPanel } from '../components/SettingsPanel';
import { InlineTextInput } from '../components/InlineTextInput';
import { createInitialState, editorReducer } from '../state/editorReducer';
import { fetchBackground, fetchDrawing, saveBackground, saveDrawing } from '../api/layoutApi';
import '../layout.css';

type LoadStatus = 'loading' | 'ready' | 'missing';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function LayoutPage() {
  const { drawingId = '' } = useParams();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(editorReducer, undefined, createInitialState);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const stateRef = useRef(state);
  const loadedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const onSizeChange = useCallback((next: { w: number; h: number }) => {
    setSize(next);
  }, []);

  useEffect(() => {
    if (loadedRef.current) {
      return;
    }
    loadedRef.current = true;
    let cancelled = false;
    Promise.all([fetchDrawing(drawingId), fetchBackground(drawingId)])
      .then(([doc, background]) => {
        if (cancelled) {
          return;
        }
        if (doc === null) {
          setLoadStatus('missing');
          return;
        }
        dispatch({ type: 'loadDocument', doc: { ...doc, background } });
        setLoadStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setLoadStatus('missing');
        }
      });
    return () => {
      cancelled = true;
      loadedRef.current = false;
    };
  }, [drawingId]);

  const performSave = useCallback(async () => {
    if (saveStatus === 'saving' || loadStatus !== 'ready') {
      return;
    }
    setSaveStatus('saving');
    try {
      await saveDrawing(drawingId, stateRef.current.doc);
      await saveBackground(drawingId, stateRef.current.doc.background);
      setSaveStatus('saved');
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        setSaveStatus('idle');
        saveTimerRef.current = null;
      }, 2000);
    } catch {
      setSaveStatus('error');
      dispatch({ type: 'setError', message: '저장에 실패했습니다' });
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        setSaveStatus('idle');
        saveTimerRef.current = null;
      }, 2000);
    }
  }, [saveStatus, loadStatus, drawingId]);

  const background = state.doc.background;

  useEffect(() => {
    if (loadStatus !== 'ready') {
      return;
    }
    void saveBackground(drawingId, background);
  }, [background, drawingId, loadStatus]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === 's') {
        event.preventDefault();
        void performSave();
      } else if (mod && key === 'z') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
      } else if (mod && key === 'y') {
        event.preventDefault();
        dispatch({ type: 'redo' });
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        dispatch({ type: 'deleteSelection' });
      } else if (event.key === 'Escape') {
        dispatch({ type: 'escape' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [performSave]);

  if (loadStatus === 'loading') {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="text-sm text-text-muted">도면 불러오는 중...</p>
      </div>
    );
  }

  if (loadStatus === 'missing') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background">
        <p className="text-sm text-text-muted">도면을 찾을 수 없습니다</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="h-9 rounded-md bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary/85"
        >
          목록으로 이동
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="relative z-10 shrink-0 px-4 pt-3">
        <LayoutToolbar
          state={state}
          dispatch={dispatch}
          saveStatus={saveStatus}
          onSave={() => void performSave()}
        />
      </div>
      <div className="flex min-h-0 flex-1 gap-4 px-4 pb-4 pt-3">
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-md border border-line-strong bg-white">
          <LayoutCanvas state={state} dispatch={dispatch} size={size} onSizeChange={onSizeChange} />
          <ZoomControl
            state={state}
            dispatch={dispatch}
            size={size}
            className="absolute right-3 top-3 z-10"
          />
          {state.textDraft && (
            <InlineTextInput
              key={`${state.textDraft.point.x}:${state.textDraft.point.y}`}
              point={state.textDraft.point}
              zoom={state.camera.zoom}
              panX={state.camera.panX}
              panY={state.camera.panY}
              onCommit={(text) => dispatch({ type: 'textCommit', text })}
              onCancel={() => dispatch({ type: 'textCancel' })}
            />
          )}
          {state.error && (
            <div
              role="alert"
              className="absolute bottom-3 right-3 z-10 flex max-w-[320px] items-center gap-2 rounded-md border border-danger bg-white px-3 py-2 text-[13px] text-danger shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
            >
              <span className="min-w-0">{state.error}</span>
              <button
                type="button"
                onClick={() => dispatch({ type: 'setError', message: null })}
                aria-label="닫기"
                className="shrink-0 text-danger transition-colors hover:opacity-70"
              >
                ×
              </button>
            </div>
          )}
        </div>
        <SettingsPanel state={state} dispatch={dispatch} />
      </div>
    </div>
  );
}

export default LayoutPage;
