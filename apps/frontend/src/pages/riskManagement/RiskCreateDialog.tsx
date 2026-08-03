import { useEffect } from 'react';
import { SEVERITY_OPTIONS, STATUS_OPTIONS } from '../../features/risks/constants/riskOptions';
import { useRiskForm } from '../../features/risks/hooks/useRiskForm';
import { useCreateRisk } from '../../features/risks/hooks/useRiskMutations';
import { getRiskErrorMessage } from '../../features/risks/utils/getRiskErrorMessage';

const INPUT_CLASSES =
  'mt-2 w-full rounded-2xl border border-ink/15 bg-white px-5 py-4 text-ink placeholder:text-ink/30 outline-none transition focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-ink';

function RiskCreateDialog({ onClose }: { onClose: () => void }) {
  const {
    title,
    setTitle,
    severity,
    setSeverity,
    status,
    setStatus,
    description,
    setDescription,
    toCreateRequest,
  } = useRiskForm({
    title: '',
    severity: '보통',
    status: '임시저장',
    description: '',
  });

  const createMutation = useCreateRisk();

  const errorMessage = createMutation.isError ? getRiskErrorMessage(createMutation.error) : null;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const handleSubmit = () => {
    createMutation.mutate(toCreateRequest(), { onSuccess: onClose });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="risk-create-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-[520px] rounded-2xl bg-white p-8 shadow-xl">
        <button
          type="button"
          aria-label="닫기"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-lg text-text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          ×
        </button>

        <h2 id="risk-create-title" className="text-xl font-black text-ink">
          위험 예상 항목 등록
        </h2>

        <label className="mt-6 block text-sm font-bold text-ink" htmlFor="risk-create-name">
          위험 항목명
        </label>
        <input
          id="risk-create-name"
          required
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="예: 중앙 통로 밀집도 초과"
          className={INPUT_CLASSES}
        />

        <label className="mt-5 block text-sm font-bold text-ink" htmlFor="risk-create-severity">
          심각도
        </label>
        <select
          id="risk-create-severity"
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
          className={INPUT_CLASSES}
        >
          {SEVERITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <label className="mt-5 block text-sm font-bold text-ink" htmlFor="risk-create-status">
          상태
        </label>
        <select
          id="risk-create-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={INPUT_CLASSES}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <label className="mt-5 block text-sm font-bold text-ink" htmlFor="risk-create-description">
          설명
        </label>
        <textarea
          id="risk-create-description"
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="선택"
          className={INPUT_CLASSES}
        />

        {errorMessage && (
          <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-600">
            {errorMessage}
          </p>
        )}

        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line-strong bg-white px-4 py-3 text-sm font-bold text-text-strong transition-colors hover:bg-surface"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createMutation.isPending || !title.trim()}
            className="rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createMutation.isPending ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RiskCreateDialog;
