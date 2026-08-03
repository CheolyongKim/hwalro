import { SEVERITY_OPTIONS, STATUS_OPTIONS } from '../../features/risks/constants/riskOptions';
import { useRiskForm } from '../../features/risks/hooks/useRiskForm';
import { useDeleteRisk, useUpdateRisk } from '../../features/risks/hooks/useRiskMutations';
import type { Risk } from '../../features/risks/types/risks';
import { getRiskErrorMessage } from '../../features/risks/utils/getRiskErrorMessage';

const INPUT_CLASSES =
  'mt-2 w-full rounded-2xl border border-ink/15 bg-white px-5 py-4 text-ink placeholder:text-ink/30 outline-none transition focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-ink';

const SELECT_CLASSES =
  'rounded-2xl border border-ink/15 bg-white px-4 py-2 text-sm font-bold text-text-strong outline-none transition focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-ink';

function RiskDetailPanel({ risk }: { risk: Risk }) {
  const {
    title,
    setTitle,
    severity,
    setSeverity,
    status,
    setStatus,
    description,
    setDescription,
    toUpdateRequest,
  } = useRiskForm({
    title: risk.title,
    severity: risk.severity,
    status: risk.status,
    description: risk.description ?? '',
  });

  const updateMutation = useUpdateRisk();
  const deleteMutation = useDeleteRisk();

  const errorMessage = updateMutation.isError
    ? getRiskErrorMessage(updateMutation.error)
    : deleteMutation.isError
      ? getRiskErrorMessage(deleteMutation.error)
      : null;

  const handleSave = () => {
    updateMutation.mutate({ id: risk.id, body: toUpdateRequest() });
  };

  const handleDelete = () => {
    deleteMutation.mutate(risk.id);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3">
        <select
          aria-label="위험도"
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
          className={SELECT_CLASSES}
        >
          {SEVERITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          aria-label="상태"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={`ml-auto ${SELECT_CLASSES}`}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <label className="mt-8 block text-sm font-bold text-text-muted" htmlFor="risk-title">
        위험 항목명
      </label>
      <input
        id="risk-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className={INPUT_CLASSES}
      />

      <label className="mt-8 block text-sm font-bold text-text-muted" htmlFor="risk-description">
        설명
      </label>
      <textarea
        id="risk-description"
        rows={4}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        className={INPUT_CLASSES}
      />

      {errorMessage && (
        <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      <div className="mt-8 grid grid-cols-2 gap-4 pb-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {updateMutation.isPending ? '저장 중...' : '저장'}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="rounded-lg border border-line-strong bg-white px-4 py-3 text-sm font-bold text-text-strong transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleteMutation.isPending ? '삭제 중...' : '삭제'}
        </button>
      </div>
    </div>
  );
}

export default RiskDetailPanel;
