import { useEffect, useRef, useState } from 'react';
import { simulationApi } from '../api/simulationApi';
import type { SimulationSummary } from '../types';
import { getSimulationErrorMessage } from '../utils/getSimulationErrorMessage';

interface CreateSimulationDraftDialogProps {
  layoutVersionId: number;
  pending: boolean;
  onClose: () => void;
  onConfirm: (parentSimulationId?: number) => void;
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
}

export function CreateSimulationDraftDialog({
  layoutVersionId,
  pending,
  onClose,
  onConfirm,
}: CreateSimulationDraftDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const pendingRef = useRef(pending);
  const [summaries, setSummaries] = useState<SimulationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);
  onCloseRef.current = onClose;
  pendingRef.current = pending;

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!pendingRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    return () => {
      dialog.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSummaries([]);
    setLoading(true);
    setError(null);
    setSelectedParentId(null);
    simulationApi
      .listByLayoutVersion(layoutVersionId)
      .then((items) => {
        if (!cancelled) setSummaries(items);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(getSimulationErrorMessage(loadError));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [layoutVersionId]);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="simulation-draft-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="simulation-draft-title" className="text-xl font-black text-ink">
          새 시뮬레이션 배치
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          빈 배치로 시작하거나 같은 도면 버전의 기존 인원 좌표를 복사할 수 있습니다.
        </p>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 has-checked:border-primary has-checked:bg-primary-soft/40">
          <input
            type="radio"
            name="draft-source"
            checked={selectedParentId === null}
            onChange={() => setSelectedParentId(null)}
            className="mt-1 accent-primary"
          />
          <span>
            <span className="block text-sm font-bold text-ink">빈 배치로 시작</span>
            <span className="mt-1 block text-xs text-text-muted">
              에이전트 없이 새 DRAFT를 만듭니다.
            </span>
          </span>
        </label>

        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {loading ? (
            <p className="rounded-xl bg-surface px-4 py-4 text-center text-sm text-text-muted">
              이전 배치를 불러오는 중...
            </p>
          ) : error ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </p>
          ) : summaries.length === 0 ? (
            <p className="rounded-xl bg-surface px-4 py-4 text-center text-sm text-text-muted">
              복사할 수 있는 이전 시뮬레이션이 없습니다.
            </p>
          ) : (
            summaries.map((summary) => (
              <label
                key={summary.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 has-checked:border-primary has-checked:bg-primary-soft/40"
              >
                <input
                  type="radio"
                  name="draft-source"
                  checked={selectedParentId === summary.id}
                  onChange={() => setSelectedParentId(summary.id)}
                  className="mt-1 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3 text-sm font-bold text-ink">
                    <span>시뮬레이션 #{summary.id}</span>
                    <span className="text-primary">{summary.totalPeople.toLocaleString()}명</span>
                  </span>
                  <span className="mt-1 block text-xs text-text-muted">
                    {formatCreatedAt(summary.createdAt)} · {summary.status}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-line pt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="h-10 rounded-lg border border-line px-4 text-sm font-bold text-text-strong disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedParentId ?? undefined)}
            disabled={pending}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending ? 'DRAFT 생성 중...' : '배치 시작'}
          </button>
        </div>
      </div>
    </div>
  );
}
