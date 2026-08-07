import type { RiskZone, SimulationResultViewModel } from '../types';
import { useCollapsiblePanel } from '../hooks/useCollapsiblePanel';

interface Props {
  result: SimulationResultViewModel;
  evacuatedCount: number;
  evacuationRate: number;
  bottlenecksVisible: boolean;
  selectedBottleneckId: number | null;
  riskZones: RiskZone[];
  onSelectBottleneck: (id: number) => void;
  onOpenReport: () => void;
}

export function ResultSummaryPanel({
  result,
  evacuatedCount,
  evacuationRate,
  bottlenecksVisible,
  selectedBottleneckId,
  riskZones,
  onSelectBottleneck,
  onOpenReport,
}: Props) {
  const panel = useCollapsiblePanel();
  const selectedBottleneck = result.bottlenecks.find((item) => item.id === selectedBottleneckId);

  if (panel.isMinimized) {
    return (
      <button type="button" className="summary-restore" onClick={panel.restore}>
        결과 요약 열기
      </button>
    );
  }

  return (
    <aside
      className={`result-summary ${panel.isCollapsing ? 'is-collapsing' : ''}`}
      onAnimationEnd={panel.handleAnimationEnd}
    >
      <div className="summary-header">
        <div>
          <small>SIMULATION RESULT</small>
          <h1 style={{ fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.04em' }}>결과 요약</h1>
        </div>
        <button type="button" aria-label="결과 요약 최소화" onClick={panel.collapse}>
          −
        </button>
      </div>
      <div className="metric-grid">
        <div className="metric metric-wide">
          <span>총 대피 시간</span>
          <strong>{result.durationSeconds}초</strong>
        </div>
        <div className="metric">
          <span>최대 밀집도</span>
          <strong>{result.maxDensity}명/㎡</strong>
        </div>
        <div className="metric">
          <span>병목 구간</span>
          <strong>{result.bottlenecks.length}곳</strong>
        </div>
      </div>
      <div className="evacuation-complete">
        <span>대피 진행 · {evacuatedCount.toLocaleString()}명</span>
        <strong>{evacuationRate}%</strong>
      </div>
      <h2>병목 분석</h2>
      {bottlenecksVisible ? (
        <>
          <div className="bottleneck-list">
            {result.bottlenecks.map((item) => (
              <button
                key={item.id}
                type="button"
                className={selectedBottleneckId === item.id ? 'is-selected' : ''}
                onClick={() => onSelectBottleneck(item.id)}
              >
                <strong>{item.name}</strong>
                <span>
                  {Math.round(item.endTimeSeconds - item.startTimeSeconds)}초 동안 기준 밀집도 초과
                </span>
                <em>{item.peakDensity}명/㎡</em>
              </button>
            ))}
          </div>
          {selectedBottleneck && (
            <p className="analysis-note">
              기준 {selectedBottleneck.thresholdValue}명/㎡ · 최고 {selectedBottleneck.peakDensity}
              명/㎡
            </p>
          )}
        </>
      ) : (
        <div className="bottleneck-analysis-locked" role="status">
          <strong>병목 상세 분석 대기</strong>
          <span>시뮬레이션을 끝까지 재생하거나 하단의 결과 보기를 눌러 확인하세요.</span>
        </div>
      )}
      {riskZones.length > 0 && (
        <section className="risk-zone-summary" aria-labelledby="risk-zone-summary-title">
          <h2 id="risk-zone-summary-title">위험 예상 구역</h2>
          <div className="risk-zone-list">
            {riskZones.map((zone) => (
              <div className="risk-zone-summary-card" key={zone.id}>
                <strong>{zone.name}</strong>
                <span>사용자 지정 위험 예상 구역</span>
              </div>
            ))}
          </div>
        </section>
      )}
      <button type="button" className="primary-action" onClick={onOpenReport}>
        AI 보고서 초안 생성
      </button>
    </aside>
  );
}
