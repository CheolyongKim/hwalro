import type { CollapsibleWorkspacePanelController } from '../../../components/workspace';

interface Props {
  panel: CollapsibleWorkspacePanelController;
  onCompare: () => void;
}

export function ImprovementComparisonPanel({ panel, onCompare }: Props) {
  if (panel.isMinimized) {
    return (
      <button type="button" className="improvement-action-restore" onClick={panel.restore}>
        배치 개선안 찾기
      </button>
    );
  }

  return (
    <section
      className={`improvement-action floating-surface ${panel.isCollapsing ? 'is-collapsing' : ''} ${panel.isExpanding ? 'is-expanding' : ''}`}
      onAnimationEnd={(event) => {
        if (event.currentTarget === event.target) panel.handleAnimationEnd();
      }}
    >
      <div className="improvement-action-header">
        <div>
          <small>LAYOUT SEARCH</small>
          <strong>배치 개선안 찾기</strong>
        </div>
        <button
          type="button"
          className="improvement-collapse"
          aria-label="배치 개선안 찾기 최소화"
          onClick={panel.collapse}
        >
          −
        </button>
      </div>
      <p>병목·혼잡·출구 편중을 진단하고, 후보를 실제 엔진으로 검증해 개선된 배치만 제시합니다.</p>
      <button type="button" onClick={onCompare}>
        배치 개선안 찾기
      </button>
    </section>
  );
}
