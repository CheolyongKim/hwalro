import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { riskApi } from '../../features/risks/api/riskApi';
import { RiskZonePreview } from '../../features/risks/components/RiskZonePreview';
import { SEVERITY_OPTIONS, STATUS_OPTIONS } from '../../features/risks/constants/riskOptions';
import { useRiskForm } from '../../features/risks/hooks/useRiskForm';
import { useDeleteRisk, useUpdateRisk } from '../../features/risks/hooks/useRiskMutations';
import type { Risk } from '../../features/risks/types/risks';
import { getRiskErrorMessage } from '../../features/risks/utils/getRiskErrorMessage';

const INPUT_CLASSES =
  'mt-2 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-text-muted outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15';

const SELECT_CLASSES =
  'rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-bold text-text-strong outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15';

function RiskDetailPanel({ risk }: { risk: Risk }) {
  const navigate = useNavigate();
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

  const zoneBounds = useMemo(() => {
    if (
      risk.simulationResultId === null ||
      risk.startX === null ||
      risk.startY === null ||
      risk.endX === null ||
      risk.endY === null
    ) {
      return null;
    }
    return {
      simulationResultId: risk.simulationResultId,
      startX: risk.startX,
      startY: risk.startY,
      endX: risk.endX,
      endY: risk.endY,
    };
  }, [risk.endX, risk.endY, risk.simulationResultId, risk.startX, risk.startY]);

  const simulationResultId = zoneBounds?.simulationResultId;
  const drawingContextQuery = useQuery({
    queryKey: ['risk-drawing', simulationResultId],
    queryFn: () => {
      if (simulationResultId === undefined) {
        throw new Error('연결된 시뮬레이션 결과가 없습니다.');
      }
      return riskApi.getDrawingContext(simulationResultId);
    },
    enabled: simulationResultId !== undefined,
  });

  const errorMessage = updateMutation.isError
    ? getRiskErrorMessage(updateMutation.error)
    : deleteMutation.isError
      ? getRiskErrorMessage(deleteMutation.error)
      : null;

  const handleSave = () => {
    updateMutation.mutate({ id: risk.id, body: toUpdateRequest() });
  };

  const handleDelete = () => {
    if (window.confirm('삭제하시겠습니까?')) {
      deleteMutation.mutate(risk.id);
    }
  };

  const handleOpenSimulation = () => {
    if (drawingContextQuery.data) {
      navigate(`/simulations/${drawingContextQuery.data.simulationId}/results`);
    }
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

      <label className="mt-6 block text-xs font-bold text-text-muted" htmlFor="risk-title">
        위험 항목명
      </label>
      <input
        id="risk-title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className={INPUT_CLASSES}
      />

      <label className="mt-6 block text-xs font-bold text-text-muted" htmlFor="risk-description">
        설명
      </label>
      <textarea
        id="risk-description"
        rows={4}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        className={INPUT_CLASSES}
      />

      {zoneBounds && (
        <section className="mt-6" aria-label="시뮬레이션 구역">
          <span className="text-xs font-bold text-text-muted">시뮬레이션 구역</span>
          {drawingContextQuery.isPending ? (
            <p className="mt-2 text-sm text-text-muted">도면 불러오는 중...</p>
          ) : drawingContextQuery.isError ? (
            <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {getRiskErrorMessage(drawingContextQuery.error)}
            </p>
          ) : (
            drawingContextQuery.data && (
              <div className="mt-2 space-y-2">
                <button
                  type="button"
                  onClick={handleOpenSimulation}
                  title="시뮬레이션 결과 페이지로 이동"
                  className="block w-full overflow-hidden rounded-xl border border-line bg-white transition-colors hover:border-primary"
                >
                  <RiskZonePreview drawing={drawingContextQuery.data.drawing} zone={zoneBounds} />
                </button>
                <button
                  type="button"
                  onClick={handleOpenSimulation}
                  className="h-10 w-full rounded-lg border border-primary bg-primary-soft px-4 text-sm font-bold text-primary transition-colors hover:bg-primary/15"
                >
                  시뮬레이션 결과 보러가기
                </button>
              </div>
            )
          )}
        </section>
      )}

      {errorMessage && (
        <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 pb-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="h-11 rounded-lg bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {updateMutation.isPending ? '저장 중...' : '저장'}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="h-11 rounded-lg border border-line-strong bg-white px-4 text-sm font-bold text-text-strong transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleteMutation.isPending ? '삭제 중...' : '삭제'}
        </button>
      </div>
    </div>
  );
}

export default RiskDetailPanel;
