import type { CandidateStatus, MetricDelta, SearchStatus } from '../api/layoutSearchApi';

export const SEARCH_STATUS_LABELS: Record<SearchStatus, string> = {
  PENDING: '준비 중',
  DIAGNOSING: '진단 중',
  GENERATING: '후보 생성 중',
  VERIFYING: '검증 중',
  COMPLETED: '완료',
  NO_IMPROVEMENT: '개선 후보 없음',
  FAILED: '실패',
  CANCELLED: '취소됨',
};

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  GENERATED: '생성됨',
  REJECTED_CONSTRAINT: '제약 위반',
  QUEUED: '대기 중',
  RUNNING: '검증 중',
  EVALUATED: '개선 확인',
  NOT_IMPROVED: '개선 미달',
  FAILED: '검증 실패',
};

export const OPERATOR_LABELS: Record<string, string> = {
  CLEAR_CORRIDOR: '통로 확보',
  RELIEVE_HOTSPOT: '혼잡 완화',
  REBALANCE_EXIT: '출구 균형',
  ROTATE_TO_OPEN: '회전 개방',
};

export const FINDING_LABELS: Record<string, string> = {
  BOTTLENECK: '병목 구역',
  CONGESTION_HOTSPOT: '혼잡 구역',
  EXIT_IMBALANCE: '출구 편중',
  EVACUATION_TAIL: '대피 지연',
};

export const REJECT_REASON_LABELS: Record<string, string> = {
  OUTSIDE_BOUNDARY: '도면 경계를 벗어남',
  OVERLAP: '다른 구조물과 겹침',
  CORRIDOR_BLOCKED: '통로가 막힘',
  AGENT_UNREACHABLE_EXIT: '대피 경로 단절',
  INVALID_GEOMETRY: '좌표가 유효하지 않음',
};

export function operatorLabel(operatorType: string) {
  return OPERATOR_LABELS[operatorType] ?? operatorType;
}

export function findingLabel(findingType: string) {
  return FINDING_LABELS[findingType] ?? findingType;
}

export function rejectReasonLabel(reason: string | null) {
  if (!reason) {
    return null;
  }
  return REJECT_REASON_LABELS[reason] ?? reason;
}

export function formatDuration(totalSeconds: number) {
  if (totalSeconds < 60) {
    return `약 ${Math.max(1, Math.round(totalSeconds))}초`;
  }
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) {
    return `약 ${minutes}분`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `약 ${hours}시간 ${rest}분` : `약 ${hours}시간`;
}

export function formatNumber(value: number) {
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

export function formatDelta(delta: MetricDelta) {
  const percent = Math.round(delta.ratio * 1000) / 10;
  const sign = delta.difference > 0 ? '+' : '';
  return `${sign}${formatNumber(delta.difference)} (${sign}${percent}%)`;
}
