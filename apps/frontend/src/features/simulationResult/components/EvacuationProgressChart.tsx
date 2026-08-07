import type { EvacuationPoint } from '../types';

export function EvacuationProgressChart({
  points,
  currentTime,
  duration,
  totalPeople,
  isCollapsing = false,
  isExpanding = false,
  onCollapseEnd,
  onExpandEnd,
}: {
  points: EvacuationPoint[];
  currentTime: number;
  duration: number;
  totalPeople: number;
  isCollapsing?: boolean;
  isExpanding?: boolean;
  onCollapseEnd?: () => void;
  onExpandEnd?: () => void;
}) {
  const visible = points.filter((point) => point.timeSeconds <= currentTime);
  const current = visible.length > 0 ? visible[visible.length - 1].evacuatedCount : 0;
  const path = visible
    .map((point, index) => {
      const x = 10 + (point.timeSeconds / duration) * 260;
      const y = 82 - (point.evacuatedCount / totalPeople) * 66;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
  return (
    <section
      className={`evacuation-chart ${isCollapsing ? 'is-collapsing' : ''} ${isExpanding ? 'is-expanding' : ''}`}
      aria-label="시간별 대피 인원"
      onAnimationEnd={() => {
        if (isCollapsing) onCollapseEnd?.();
        if (isExpanding) onExpandEnd?.();
      }}
    >
      <div className="floating-title-row">
        <strong>시간별 대피 인원</strong>
        <span>{current.toLocaleString()}명 · {Math.round((current / totalPeople) * 100)}%</span>
      </div>
      <svg viewBox="0 0 280 92" role="img" aria-label={`현재 ${current}명 대피`}>
        <path d="M10 82H270 M10 49H270 M10 16H270" className="chart-grid" />
        <path d={path} className="chart-line" />
      </svg>
    </section>
  );
}
