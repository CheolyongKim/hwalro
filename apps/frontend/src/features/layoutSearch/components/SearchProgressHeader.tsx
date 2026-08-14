import type { LayoutSearch } from '../api/layoutSearchApi';
import { isActiveSearchStatus } from '../hooks/useLayoutSearch';
import { formatDuration, formatNumber, SEARCH_STATUS_LABELS } from '../utils/searchLabels';

const PHASE_MESSAGES: Record<LayoutSearch['status'], string> = {
  PENDING: '탐색 작업을 준비하고 있습니다',
  DIAGNOSING: '시뮬레이션 결과를 진단하고 있습니다',
  GENERATING: '검증할 배치 후보를 생성하고 있습니다',
  VERIFYING: '실제 엔진으로 후보를 검증하고 있습니다',
  COMPLETED: '배치 개선안 탐색',
  NO_IMPROVEMENT: '배치 개선안 탐색',
  FAILED: '배치 개선안 탐색',
  CANCELLED: '배치 개선안 탐색',
};

interface Props {
  search: LayoutSearch;
  onCancel: () => void;
  cancelling: boolean;
  onBackToResult: () => void;
  onRerun: () => void;
  rerunning: boolean;
}

export function SearchProgressHeader({
  search,
  onCancel,
  cancelling,
  onBackToResult,
  onRerun,
  rerunning,
}: Props) {
  const { progress } = search;
  const active = isActiveSearchStatus(search.status);
  return (
    <header className="search-progress">
      <div className="search-progress__status">
        <button type="button" className="search-back-button" onClick={onBackToResult}>
          ← 결과 화면
        </button>
        <span className={`search-status-badge is-${search.status.toLowerCase()}`}>
          {SEARCH_STATUS_LABELS[search.status]}
        </span>
        <strong>{PHASE_MESSAGES[search.status]}</strong>
        {active && progress.round > 0 && (
          <small>{progress.round === 1 ? '1차 개선' : `${progress.round}차 개선`}</small>
        )}
      </div>
      <div className="search-progress__meta">
        {active && progress.plannedCount === null ? (
          <span>진행 {formatNumber(progress.verifiedCount)}건 검증 · 전체 후보 계산 중</span>
        ) : active ? (
          <span>
            진행 {formatNumber(progress.verifiedCount)}/{formatNumber(progress.plannedCount ?? 0)}
          </span>
        ) : null}
        {active &&
          progress.estimatedRemainingSeconds !== null &&
          progress.estimatedRemainingSeconds > 0 && (
            <span>남은 시간 {formatDuration(progress.estimatedRemainingSeconds)}</span>
          )}
        {active && (
          <button
            type="button"
            className="search-cancel-button"
            disabled={cancelling}
            onClick={onCancel}
          >
            {cancelling ? '취소 요청 중' : '탐색 취소'}
          </button>
        )}
        {!active && (
          <button
            type="button"
            className="search-rerun-button"
            disabled={rerunning}
            onClick={onRerun}
          >
            {rerunning ? '준비 중' : '제약 설정 다시 열기'}
          </button>
        )}
      </div>
      {active && (
        <p className="search-progress__note" role="status">
          취소해도 그때까지 검증된 후보는 결과로 남습니다.
        </p>
      )}
      {search.failureMessage && (
        <p className="search-progress__failure" role="alert">
          {search.failureMessage}
        </p>
      )}
    </header>
  );
}
