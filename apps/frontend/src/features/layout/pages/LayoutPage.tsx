import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import { LayoutCanvas } from '../components/LayoutCanvas';
import { LayoutToolbar } from '../components/LayoutToolbar';
import { ToolToolbar } from '../components/ToolToolbar';
import { ZoomControl } from '../components/ZoomControl';
import { SettingsPanel } from '../components/SettingsPanel';
import { InlineTextInput } from '../components/InlineTextInput';
import { createInitialState, editorReducer } from '../state/editorReducer';
import { fetchDrawing, saveDrawing } from '../api/layoutApi';
import type { DrawingSession } from '../api/layoutApi';
import type { ValidationProblem, ValidationProblemKind } from '../types';
import { CreateSimulationDraftDialog } from '../../simulations/components/CreateSimulationDraftDialog';
import { simulationApi } from '../../simulations/api/simulationApi';
import { getSimulationErrorMessage } from '../../simulations/utils/getSimulationErrorMessage';
import { getDrawingErrorMessage } from '../../drawings/utils/getDrawingErrorMessage';
import '../layout.css';

type LoadStatus = 'loading' | 'ready' | 'missing' | 'error';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const VALIDATION_KINDS: ValidationProblemKind[] = [
  'wall',
  'outsideWall',
  'exit',
  'pillar',
  'fabric',
];

function parseValidationProblems(data: unknown): ValidationProblem[] {
  const raw = (data as { problems?: unknown } | undefined)?.problems;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (entry): entry is ValidationProblem =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as ValidationProblem).name === 'string' &&
      (VALIDATION_KINDS as string[]).includes((entry as ValidationProblem).kind),
  );
}

function LayoutPage() {
  const { drawingId = '' } = useParams();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(editorReducer, undefined, createInitialState);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [retryCount, setRetryCount] = useState(0);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [draftPending, setDraftPending] = useState(false);
  const stateRef = useRef(state);
  const sessionRef = useRef<DrawingSession | null>(null);
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
    sessionRef.current = null;
    setLoadStatus('loading');
    fetchDrawing(drawingId)
      .then((session) => {
        if (cancelled) {
          return;
        }
        if (session === null) {
          setLoadStatus('missing');
          return;
        }
        sessionRef.current = session;
        dispatch({ type: 'loadDocument', doc: session.doc });
        setLoadStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setLoadStatus('error');
        }
      });
    return () => {
      cancelled = true;
      loadedRef.current = false;
    };
  }, [drawingId, retryCount]);

  const performSave = useCallback(async () => {
    if (saveStatus === 'saving' || loadStatus !== 'ready' || sessionRef.current === null) {
      return;
    }
    if (sessionRef.current.layoutVersionStatus === '잠금') {
      dispatch({
        type: 'setError',
        message: '시뮬레이션에 사용된 도면 버전은 잠겨 있어 수정할 수 없습니다.',
      });
      return;
    }
    setSaveStatus('saving');
    try {
      const version = await saveDrawing(drawingId, {
        ...sessionRef.current,
        doc: stateRef.current.doc,
      });
      sessionRef.current = {
        ...sessionRef.current,
        doc: stateRef.current.doc,
        version,
      };
      dispatch({ type: 'setValidationProblems', problems: [] });
      setSaveStatus('saved');
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        setSaveStatus('idle');
        saveTimerRef.current = null;
      }, 2000);
    } catch (error) {
      setSaveStatus('error');
      const conflict = error instanceof AxiosError && error.response?.status === 409;
      dispatch({
        type: 'setValidationProblems',
        problems: conflict
          ? []
          : parseValidationProblems(error instanceof AxiosError ? error.response?.data : undefined),
      });
      dispatch({
        type: 'setError',
        message: conflict
          ? '다른 사용자가 이 도면을 수정했습니다. 새로고침 후 다시 시도해 주세요.'
          : getDrawingErrorMessage(error),
      });
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        setSaveStatus('idle');
        saveTimerRef.current = null;
      }, 2000);
    }
  }, [saveStatus, loadStatus, drawingId]);

  const handleOpenDraftDialog = useCallback(async () => {
    const session = sessionRef.current;
    if (session === null || draftPending) return;
    const hasUnsavedChanges = JSON.stringify(stateRef.current.doc) !== JSON.stringify(session.doc);
    if (!hasUnsavedChanges || session.layoutVersionStatus === '잠금') {
      setDraftDialogOpen(true);
      return;
    }
    setDraftPending(true);
    try {
      const version = await saveDrawing(drawingId, { ...session, doc: stateRef.current.doc });
      sessionRef.current = { ...session, doc: stateRef.current.doc, version };
      setDraftDialogOpen(true);
    } catch (error) {
      dispatch({ type: 'setError', message: getSimulationErrorMessage(error) });
    } finally {
      setDraftPending(false);
    }
  }, [draftPending, drawingId]);

  const handleCreateDraft = useCallback(
    async (parentSimulationId?: number) => {
      const session = sessionRef.current;
      if (session === null || draftPending) return;
      setDraftPending(true);
      try {
        const draft = await simulationApi.createDraft({
          layoutVersionId: session.layoutVersionId,
          ...(parentSimulationId === undefined ? {} : { parentSimulationId }),
        });
        navigate(`/simulations/${draft.simulationId}/setup`);
      } catch (error) {
        setDraftDialogOpen(false);
        dispatch({
          type: 'setError',
          message: getSimulationErrorMessage(error),
        });
      } finally {
        setDraftPending(false);
      }
    },
    [draftPending, navigate],
  );

  useEffect(() => {
    if (state.error === null) {
      return;
    }
    const timer = window.setTimeout(() => {
      dispatch({ type: 'setError', message: null });
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [state.error, state.errorNonce]);

  useEffect(() => {
    if (state.validationProblems.length === 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      dispatch({ type: 'setValidationProblems', problems: [] });
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [state.validationProblems]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const locked = sessionRef.current?.layoutVersionStatus === '잠금';
      if (
        locked &&
        ((mod && (key === 's' || key === 'z' || key === 'y')) ||
          event.key === 'Delete' ||
          event.key === 'Backspace')
      ) {
        event.preventDefault();
        return;
      }
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

  const readOnly = sessionRef.current?.layoutVersionStatus === '잠금';
  const draftTextId = state.textDraft === null ? null : state.textDraft.textId;
  const draftInitialText =
    draftTextId === null
      ? ''
      : (state.doc.layoutTexts.find((t) => t.id === draftTextId)?.text ?? '');

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
          onClick={() => navigate('/drawings')}
          className="h-9 rounded-md bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary/85"
        >
          목록으로 이동
        </button>
      </div>
    );
  }

  if (loadStatus === 'error') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background">
        <p className="text-sm text-text-muted">도면을 불러오지 못했습니다</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="h-9 rounded-md bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary/85"
          >
            다시 시도
          </button>
          <button
            type="button"
            onClick={() => navigate('/drawings')}
            className="h-9 rounded-md border border-line-strong bg-white px-4 text-sm font-bold text-text-strong transition-colors hover:bg-surface"
          >
            목록으로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-background">
      <button
        type="button"
        onClick={() => navigate('/drawings')}
        aria-label="도면 목록으로 돌아가기"
        className="fixed left-4 top-4 z-30 flex h-8 w-8 items-center justify-center rounded-md border border-panel-divider bg-panel text-panel-muted shadow-[0_2px_8px_rgba(0,0,0,0.25)] transition-colors hover:bg-panel-soft hover:text-panel-text"
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
      <LayoutCanvas
        state={state}
        dispatch={dispatch}
        size={size}
        onSizeChange={onSizeChange}
        readOnly={readOnly}
      />
      <div className="absolute right-4 top-4 z-20 flex max-h-[calc(100dvh-2rem)] w-[312px] flex-col overflow-hidden rounded-xl bg-panel shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
        <LayoutToolbar
          state={state}
          saveStatus={saveStatus}
          onSave={() => void performSave()}
          onStartSimulation={() => void handleOpenDraftDialog()}
          readOnly={readOnly}
          collapsed={panelCollapsed}
          onToggleCollapse={() => setPanelCollapsed((value) => !value)}
        />
        {!panelCollapsed && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
              <SettingsPanel state={state} dispatch={dispatch} />
            </div>
          </div>
        )}
      </div>
      <ToolToolbar
        state={state}
        dispatch={dispatch}
        disabled={readOnly}
        className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2"
      />
      <ZoomControl
        state={state}
        dispatch={dispatch}
        size={size}
        className="absolute left-4 top-16 z-20"
      />
      {state.textDraft && (
        <InlineTextInput
          key={`${state.textDraft.point.x}:${state.textDraft.point.y}`}
          point={state.textDraft.point}
          zoom={state.camera.zoom}
          panX={state.camera.panX}
          panY={state.camera.panY}
          initialText={draftInitialText}
          onCommit={(text) => dispatch({ type: 'textCommit', text })}
          onCancel={() => dispatch({ type: 'textCancel' })}
        />
      )}
      {state.error && (
        <div
          role="alert"
          className="absolute bottom-4 right-4 z-20 flex max-w-[320px] items-center gap-2 rounded-md border border-danger bg-white px-3 py-2 text-[13px] text-danger shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
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
      {draftDialogOpen && sessionRef.current !== null && (
        <CreateSimulationDraftDialog
          layoutVersionId={sessionRef.current.layoutVersionId}
          pending={draftPending}
          onClose={() => setDraftDialogOpen(false)}
          onConfirm={(parentSimulationId) => void handleCreateDraft(parentSimulationId)}
        />
      )}
    </div>
  );
}

export default LayoutPage;
