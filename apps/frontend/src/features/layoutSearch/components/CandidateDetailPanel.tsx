import type { SearchCandidate } from '../api/layoutSearchApi';
import { formatDelta, formatNumber, findingLabel, metricLabel, operatorLabel } from '../utils/searchLabels';
import { primaryDelta } from './CandidateList';

interface Props {
  candidate: SearchCandidate;
  onPrepareSimulation: () => void;
  preparing: boolean;
  onContinueComparing: () => void;
  previewAvailable: boolean;
  onReject: () => void;
  rejecting: boolean;
}

export function CandidateDetailPanel({
  candidate,
  onPrepareSimulation,
  preparing,
  onContinueComparing,
  previewAvailable,
  onReject,
  rejecting,
}: Props) {
  const delta = primaryDelta(candidate);
  const preparedSimulation = candidate.preparedSimulation;

  return (
    <aside className="search-insight">
      <div className="workspace-section-heading">
        <span>개선안 상세</span>
        <small>{operatorLabel(candidate.operatorType)}</small>
      </div>
      <div className="strategy-tags">
        <span>{findingLabel(candidate.originFindingType)}</span>
        <span>{candidate.round === 1 ? '1차 개선안' : `${candidate.round}차 개선안`}</span>
      </div>
      <h2>{operatorLabel(candidate.operatorType)}</h2>
      <p>{candidate.rationale?.description ?? '변경 근거가 없습니다.'}</p>

      <div className="candidate-operations">
        <strong>구조물 변경 {candidate.changeSet.ops.length}개</strong>
        {candidate.changeSet.ops.map((op, index) => (
          <p key={`${op.fabricId}-${index}`}>
            <span>구조물 #{op.fabricId}</span>({formatNumber(op.before.startX)},
            {formatNumber(op.before.startY)}) → ({formatNumber(op.after.startX)},
            {formatNumber(op.after.startY)})
          </p>
        ))}
      </div>

      {candidate.measuredMetrics && (
        <div className="comparison-metrics">
          {candidate.measuredMetrics.map((metric) => {
            const metricDelta = candidate.delta.find(
              (item) => item.metricType === metric.metricType,
            );
            return (
              <div className="comparison-metric" key={metric.metricType}>
                <span>{metricLabel(metric.metricType)}</span>
                <strong>{formatNumber(metric.metricValue)}</strong>
                {metricDelta && (
                  <em className="delta-badge is-improved">{formatDelta(metricDelta)}</em>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="metric-source">
        표시된 수치는 엔진이 실제로 검증한 공식 지표입니다. 준비하면 원본은 유지되고 이 개선안의
        시뮬레이션 설정이 별도로 생성됩니다.
      </div>

      {candidate.changeSet.ops.length > 0 && (
        <button
          type="button"
          className="reject-candidate-button"
          disabled={rejecting}
          onClick={onReject}
        >
          {rejecting ? '제약 반영 중' : '이건 안 됨 — 구조물 고정하고 다시 탐색'}
        </button>
      )}

      {preparedSimulation ? (
        <>
          <p className="preparation-feedback is-success" role="status">
            시뮬레이션 준비됨
          </p>
          <div className="preparation-success-actions">
            <a
              className="run-simulation-button"
              href={`/simulations/${preparedSimulation.simulationId}/setup`}
            >
              시뮬레이션 설정 열기
            </a>
            <button
              type="button"
              className="continue-comparing-button"
              onClick={onContinueComparing}
            >
              계속 비교
            </button>
          </div>
        </>
      ) : (
        <>
          {!previewAvailable && (
            <p className="preparation-feedback is-error" role="alert">
              변경 배치를 확인할 수 있을 때 시뮬레이션을 준비할 수 있습니다.
            </p>
          )}
          <button
            type="button"
            className="run-simulation-button"
            disabled={preparing || delta === null || !previewAvailable}
            onClick={onPrepareSimulation}
          >
            {preparing ? '시뮬레이션 준비 중' : '이 개선안으로 시뮬레이션 준비'}
          </button>
        </>
      )}
    </aside>
  );
}
