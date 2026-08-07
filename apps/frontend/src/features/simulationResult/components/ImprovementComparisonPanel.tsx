import type { CollapsiblePanelController } from '../hooks/useCollapsiblePanel';

interface Props {
  panel: CollapsiblePanelController;
  onCompare: () => void;
}

export function ImprovementComparisonPanel({ panel, onCompare }: Props) {
  if (panel.isMinimized) {
    return (
      <button type="button" className="improvement-action-restore" onClick={panel.restore}>
        배치 개선안 비교 열기
      </button>
    );
  }

  return (
    <section
      className={`improvement-action floating-surface ${panel.isCollapsing ? 'is-collapsing' : ''} ${panel.isExpanding ? 'is-expanding' : ''}`}
      onAnimationEnd={panel.handleAnimationEnd}
    >
      <div className="improvement-action-header">
        <div>
          <small>LAYOUT IMPROVEMENT</small>
          <strong>배치 개선안 비교</strong>
        </div>
        <button
          type="button"
          className="improvement-collapse"
          aria-label="배치 개선안 비교 최소화"
          onClick={panel.collapse}
        >
          −
        </button>
      </div>
      <p>현재 결과를 기준으로 개선 시뮬레이션 3개를 비교합니다.</p>
      <button type="button" onClick={onCompare}>
        개선안 3개 비교하기
      </button>
    </section>
  );
}
