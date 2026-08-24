import { useEffect, useState } from 'react';
import type { DrawingVersionSummary } from '../../drawings/types/drawing';
import { formatDate } from '../../risks/utils/formatDate';
import { fetchDrawingVersions, restoreDrawingVersion } from '../api/layoutApi';
import type { DrawingSession } from '../api/layoutApi';
import { Modal } from '../../../components/ui';

interface VersionHistoryDialogProps {
  drawingId: string;
  currentVersionId: number;
  onClose: () => void;
  onRestored: (session: DrawingSession) => void;
}

function statusBadge(status: DrawingVersionSummary['status']) {
  if (status === '잠금') {
    return (
      <span className="shrink-0 rounded-md bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning-strong">
        잠금
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-md bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
      초안
    </span>
  );
}

export function VersionHistoryDialog({
  drawingId,
  currentVersionId,
  onClose,
  onRestored,
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<DrawingVersionSummary[]>([]);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [confirmVersionId, setConfirmVersionId] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVersions([]);
    setLoadStatus('loading');
    fetchDrawingVersions(drawingId)
      .then((items) => {
        if (!cancelled) {
          setVersions(items);
          setLoadStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setLoadStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [drawingId]);

  const handleClose = () => {
    if (!restoring) onClose();
  };

  const handleRestore = async (versionId: number) => {
    if (restoring) {
      return;
    }
    setRestoring(true);
    try {
      const session = await restoreDrawingVersion(drawingId, versionId);
      onRestored(session);
    } catch {
      setConfirmVersionId(null);
      setRestoreError('버전을 복원하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Modal
      open
      onClose={handleClose}
      title="버전 이력"
      description="버전 카드를 클릭하면 그 상태를 복사해 새 초안 버전을 만들고 현재 버전으로 전환합니다."
      size="md"
    >
      <div className="max-h-[60vh] space-y-2 overflow-y-auto">
        {loadStatus === 'loading' && (
          <p className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-text-muted">
            버전 이력 불러오는 중...
          </p>
        )}

        {loadStatus === 'error' && (
          <p
            role="alert"
            className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger-strong"
          >
            버전 이력을 불러오지 못했습니다.
          </p>
        )}

        {loadStatus === 'ready' && versions.length === 0 && (
          <p className="rounded-xl bg-surface px-4 py-6 text-center text-sm text-text-muted">
            저장된 버전 이력이 없습니다.
          </p>
        )}

        {loadStatus === 'ready' &&
          versions.length > 0 &&
          versions.map((version) => {
            const isCurrent = version.layoutVersionId === currentVersionId;
            const isConfirming = confirmVersionId === version.layoutVersionId;
            const header = (
              <span className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 font-mono text-sm font-black text-ink">
                    v{version.version}
                  </span>
                  {statusBadge(version.status)}
                  {isCurrent && (
                    <span className="shrink-0 rounded-md bg-primary px-2 py-0.5 text-xs font-bold text-white">
                      현재
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-text-muted">
                  {formatDate(version.createdAt, true)}
                </span>
              </span>
            );

            if (isCurrent) {
              return (
                <div
                  key={version.layoutVersionId}
                  className="rounded-xl border border-primary bg-primary-faint p-4"
                >
                  {header}
                  <p className="mt-2 text-xs text-text-muted">이 버전이 현재 도면입니다.</p>
                </div>
              );
            }

            if (isConfirming) {
              return (
                <div
                  key={version.layoutVersionId}
                  className="rounded-xl border border-primary bg-primary-faint p-4"
                >
                  {header}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="min-w-0 text-xs leading-4 text-text-muted">
                      v{version.version}의 배치를 새 초안 버전으로 가져올까요?
                    </span>
                    <span className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfirmVersionId(null)}
                        disabled={restoring}
                        className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-text-strong transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRestore(version.layoutVersionId)}
                        disabled={restoring}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {restoring ? '복원 중...' : '복원'}
                      </button>
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <button
                key={version.layoutVersionId}
                type="button"
                onClick={() => setConfirmVersionId(version.layoutVersionId)}
                disabled={restoring}
                aria-label={`v${version.version} 버전으로 복원`}
                className="block w-full rounded-xl border border-line bg-white p-4 text-left transition hover:border-primary hover:bg-primary-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-45"
              >
                {header}
              </button>
            );
          })}
      </div>

      {restoreError && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {restoreError}
        </p>
      )}
    </Modal>
  );
}