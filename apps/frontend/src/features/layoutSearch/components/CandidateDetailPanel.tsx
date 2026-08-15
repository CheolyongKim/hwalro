import { Info, Lock } from 'lucide-react';
import type { MetricDelta, SearchCandidate } from '../api/layoutSearchApi';
import { formatDelta, formatNumber, findingLabel, metricLabel, operatorLabel } from '../utils/searchLabels';

export function primaryDelta(candidate: SearchCandidate): MetricDelta | null {
  return (
    candidate.delta.find((item) => item.metricType === 'TOTAL_EVACUATION_TIME_SECONDS') ??
    candidate.delta.find((item) => item.metricType === 'REMAINING_PEOPLE') ??
    candidate.delta[0] ??
    null
  );
}

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
      <div className="search-insight__header">
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
      </div>

      <div className="candidate-operations">
        <div className="candidate-operations__header">
          <strong>구조물 변경</strong>
          <span className="candidate-operations__count">{candidate.changeSet.ops.length}개 위치 조정</span>
        </div>
        <div className="candidate-operations__list">
          {candidate.changeSet.ops.map((op, index) => (
            <div className="candidate-operations__item" key={`${op.fabricId}-${index}`}>
              <span className="candidate-operations__name">구조물 #{op.fabricId}</span>
              <span className="candidate-operations__coords">
                ({formatNumber(op.before.startX)}, {formatNumber(op.before.startY)}) → ({formatNumber(op.after.startX)}, {formatNumber(op.after.startY)})
              </span>
            </div>
          ))}
        </div>
      </div>

      {candidate.measuredMetrics && candidate.measuredMetrics.length > 0 && (
        <div className="comparison-metrics">
          <span className="comparison-metrics__title">실측 검증 지표</span>
          {candidate.measuredMetrics.map((metric) => {
            const metricDelta = candidate.delta.find(
              (item) => item.metricType === metric.metricType,
            );
            return (
              <div className="comparison-metric" key={metric.metricType}>
                <div className="comparison-metric__main">
                  <span>{metricLabel(metric.metricType)}</span>
                  <strong>{formatNumber(metric.metricValue)}</strong>
                </div>
                {metricDelta && (
                  <em className="delta-badge is-improved">{formatDelta(metricDelta)}</em>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="metric-source">
        <Info className="metric-source__icon" aria-hidden="true" />
        <span>
          표시된 수치는 엔진이 실제로 검증한 공식 지표입니다. 준비 시 원본을 유지하고 별도의 시뮬레이션 설정(초안)이 생성됩니다.
        </span>
      </div>

      <div className="candidate-actions">
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
              {preparing ? '시뮬레이션 준비 중...' : '이 개선안으로 시뮬레이션 준비'}
            </button>
          </>
        )}

        {candidate.changeSet.ops.length > 0 && (
          <button
            type="button"
            className="reject-candidate-button"
            disabled={rejecting}
            onClick={onReject}
            title="이 개선안에서 이동된 구조물을 고정 제약으로 추가하고 다시 탐색합니다."
          >
            <Lock className="reject-candidate-button__icon" aria-hidden="true" />
            <span>{rejecting ? '제약 반영 중...' : '해당 구조물 고정 후 재탐색'}</span>
          </button>
        )}
      </div>
    </aside>
  );
}
