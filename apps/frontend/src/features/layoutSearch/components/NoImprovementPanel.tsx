import { useMemo, useState } from 'react';
import type { SimulationDrawing } from '../../simulations/types';
import type { ChangeOp, SearchCandidate } from '../api/layoutSearchApi';
import {
  CANDIDATE_STATUS_LABELS,
  formatDelta,
  formatNumber,
  operatorLabel,
  rejectReasonLabel,
} from '../utils/searchLabels';
import { primaryDelta } from './CandidateList';

interface Props {
  candidates: SearchCandidate[];
  drawing: SimulationDrawing | null;
}

function summarizeChangeSet(ops: ChangeOp[], fabricNameById: (id: number) => string): string {
  const parts: string[] = [];
  for (const op of ops) {
    const dx = op.after.startX - op.before.startX;
    const dy = op.after.startY - op.before.startY;
    const distance = Math.hypot(dx, dy);
    const rotationDelta = op.after.rotation - op.before.rotation;
    const changes: string[] = [];
    if (distance > 0.001) {
      changes.push(`${formatNumber(distance)}m 이동`);
    }
    if (Math.abs(rotationDelta) > 0.001) {
      changes.push(`${Math.round(rotationDelta)}° 회전`);
    }
    if (changes.length === 0) {
      changes.push('위치 유지');
    }
    parts.push(`${fabricNameById(op.fabricId)} ${changes.join(' · ')}`);
  }
  return parts.join(', ');
}

export function NoImprovementPanel({ candidates, drawing }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  const groups = useMemo(() => {
    const byReason = new Map<string, SearchCandidate[]>();
    for (const candidate of candidates) {
      const reason = rejectReasonLabel(candidate.rejectReason) ?? '기타 사유';
      const list = byReason.get(reason) ?? [];
      list.push(candidate);
      byReason.set(reason, list);
    }
    return [...byReason.entries()];
  }, [candidates]);

  const fabricNameById = useMemo(() => {
    const byId = new Map<number, string>();
    drawing?.fabrics.forEach((fabric) => byId.set(fabric.id, fabric.name));
    return (id: number) => byId.get(id) ?? `구조물 ${id}`;
  }, [drawing]);

  const clampedIndex = Math.min(activeIndex, Math.max(groups.length - 1, 0));

  if (candidates.length === 0) {
    return (
      <section className="no-improvement-panel" aria-label="개선안을 찾지 못한 사유">
        <p className="no-improvement-panel__intro">
          개선을 위해 시도한 변경이 모두 제약 검사에서 탈락했습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="no-improvement-panel" aria-label="개선안을 찾지 못한 사유">
      <p className="no-improvement-panel__intro">
        개선을 위해 시도한 변경이 아래 사유로 제약 검사를 통과하지 못했습니다.
      </p>
      <div className="no-improvement-tabs" role="tablist" aria-label="거부 사유별 후보">
        {groups.map(([reason, list], index) => (
          <button
            key={reason}
            type="button"
            role="tab"
            id={`no-improvement-tab-${index}`}
            aria-selected={index === clampedIndex}
            aria-controls="no-improvement-tabpanel"
            className={`no-improvement-tab${index === clampedIndex ? ' is-active' : ''}`}
            onClick={() => setActiveIndex(index)}
          >
            {reason}
            <span className="no-improvement-tab__count">{list.length}건</span>
          </button>
        ))}
      </div>
      <div
        id="no-improvement-tabpanel"
        role="tabpanel"
        aria-labelledby={`no-improvement-tab-${clampedIndex}`}
        className="no-improvement-tabpanel"
      >
        <ul className="rejected-list">
          {groups[clampedIndex][1].map((candidate) => {
            const delta = primaryDelta(candidate);
            return (
              <li key={candidate.candidateId}>
                <strong>{operatorLabel(candidate.operatorType)}</strong>
                <span className={`candidate-chip is-${candidate.status.toLowerCase()}`}>
                  {CANDIDATE_STATUS_LABELS[candidate.status]}
                </span>
                {delta && <em className="delta-badge">{formatDelta(delta)}</em>}
                <small>{summarizeChangeSet(candidate.changeSet.ops, fabricNameById)}</small>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
