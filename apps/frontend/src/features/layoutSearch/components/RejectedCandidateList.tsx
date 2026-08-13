import type { SearchCandidate } from '../api/layoutSearchApi';
import {
  CANDIDATE_STATUS_LABELS,
  formatDelta,
  operatorLabel,
  rejectReasonLabel,
} from '../utils/searchLabels';
import { primaryDelta } from './CandidateList';

export function RejectedCandidateList({ candidates }: { candidates: SearchCandidate[] }) {
  if (candidates.length === 0) {
    return null;
  }
  return (
    <section className="rejected-section" aria-label="그 밖의 검증 결과">
      <div className="workspace-section-heading">
        <span>그 밖의 검증 결과</span>
        <small>{candidates.length}건</small>
      </div>
      <ul className="rejected-list">
        {candidates.map((candidate) => {
          const delta = primaryDelta(candidate);
          const reason = rejectReasonLabel(candidate.rejectReason);
          return (
            <li key={candidate.candidateId}>
              <strong>{operatorLabel(candidate.operatorType)}</strong>
              <span className={`candidate-chip is-${candidate.status.toLowerCase()}`}>
                {CANDIDATE_STATUS_LABELS[candidate.status]}
              </span>
              {delta && <em className="delta-badge">{formatDelta(delta)}</em>}
              {reason && <small>{reason}</small>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
