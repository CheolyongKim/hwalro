import type { SearchCandidate } from '../api/layoutSearchApi';
import { operatorLabel } from '../utils/searchLabels';

const MAX_TABS = 20;

interface CandidateTabsProps {
  improved: SearchCandidate[];
  activeKey: string;
  onSelect: (key: string) => void;
}

/**
 * 실측으로 개선이 확인된 후보만 탭으로 올린다.
 *
 * 기하학적으로 놓을 수 없거나 사용자가 건 제약과 충돌한 변경은 제안이 아니라 "그 자리에는
 * 못 넣는다"는 사실일 뿐이라, 사용자가 accept/decline할 대상이 되지 못한다.
 */
export function CandidateTabs({ improved, activeKey, onSelect }: CandidateTabsProps) {
  const visibleTabs = improved.slice(0, MAX_TABS);
  return (
    <div className="no-improvement-tabs" role="tablist" aria-label="개선 후보">
      {visibleTabs.map((candidate) => {
        const key = `i-${candidate.candidateId}`;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            id={`candidate-tab-${key}`}
            aria-selected={key === activeKey}
            aria-controls="candidate-tabpanel"
            className={`no-improvement-tab is-improved${key === activeKey ? ' is-active' : ''}`}
            onClick={() => onSelect(key)}
            title="개선 확인"
          >
            {operatorLabel(candidate.operatorType)}
            <span className="candidate-tab__mark">개선</span>
          </button>
        );
      })}
      {improved.length > MAX_TABS && (
        <span className="no-improvement-tab no-improvement-tab__overflow" aria-hidden="true">
          +{improved.length - MAX_TABS}
        </span>
      )}
    </div>
  );
}
