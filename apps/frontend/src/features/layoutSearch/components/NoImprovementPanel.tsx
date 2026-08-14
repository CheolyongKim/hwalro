import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { DrawingElements } from './LayoutDiffCanvas';

const ZOOM_STEP = 1.25;
const MAX_TABS = 20;
const REASON_CLASS: Record<string, string> = {
  '도면 경계를 벗어남': 'is-boundary',
  '통로가 막힘': 'is-corridor',
  '대피 경로 단절': 'is-route',
  '좌표가 유효하지 않음': 'is-geometry',
  '고정된 구조물': 'is-fixed',
  '금지 영역과 겹침': 'is-zone',
  '벽면 접촉을 벗어남': 'is-wall',
};

interface CandidateTabsProps {
  improved: SearchCandidate[];
  rejected: SearchCandidate[];
  activeKey: string;
  onSelect: (key: string) => void;
}

export function CandidateTabs({ improved, rejected, activeKey, onSelect }: CandidateTabsProps) {
  const tabs = [
    ...improved.map((candidate) => ({ key: `i-${candidate.candidateId}`, candidate, isImproved: true })),
    ...rejected.map((candidate) => ({ key: `r-${candidate.candidateId}`, candidate, isImproved: false })),
  ];
  const visibleTabs = tabs.slice(0, MAX_TABS);
  return (
    <div className="no-improvement-tabs" role="tablist" aria-label="탐색 후보">
      {visibleTabs.map((tab) => {
        const reasonLabel = tab.isImproved ? null : rejectReasonLabel(tab.candidate.rejectReason);
        const className = tab.isImproved
          ? 'no-improvement-tab is-improved'
          : `no-improvement-tab ${reasonClass(reasonLabel ?? '기타 사유')}`;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`candidate-tab-${tab.key}`}
            aria-selected={tab.key === activeKey}
            aria-controls="candidate-tabpanel"
            className={`${className}${tab.key === activeKey ? ' is-active' : ''}`}
            onClick={() => onSelect(tab.key)}
            title={reasonLabel ?? '개선 확인'}
          >
            {operatorLabel(tab.candidate.operatorType)}
            {tab.isImproved && <span className="candidate-tab__mark">개선</span>}
          </button>
        );
      })}
      {tabs.length > MAX_TABS && (
        <span className="no-improvement-tab no-improvement-tab__overflow" aria-hidden="true">
          +{tabs.length - MAX_TABS}
        </span>
      )}
    </div>
  );
}

export function RejectedCandidateDetail({
  candidate,
  drawing,
}: {
  candidate: SearchCandidate;
  drawing: SimulationDrawing | null;
}) {
  const fabricNameById = useMemo(() => {
    const byId = new Map<number, string>();
    drawing?.fabrics.forEach((fabric) => byId.set(fabric.id, fabric.name));
    return (id: number) => byId.get(id) ?? `구조물 ${id}`;
  }, [drawing]);

  const reasonLabel = rejectReasonLabel(candidate.rejectReason);
  const delta = primaryDelta(candidate);

  return (
    <div className="no-improvement-candidate">
      <div className="no-improvement-candidate__summary">
        {reasonLabel ? (
          <span className={`no-improvement-reason ${reasonClass(reasonLabel)}`}>{reasonLabel}</span>
        ) : (
          <span className="no-improvement-reason is-other">
            {CANDIDATE_STATUS_LABELS[candidate.status]}
          </span>
        )}
        <span className={`candidate-chip is-${candidate.status.toLowerCase()}`}>
          {CANDIDATE_STATUS_LABELS[candidate.status]}
        </span>
        {delta && <em className="delta-badge">{formatDelta(delta)}</em>}
      </div>
      {candidate.changeSet.ops.length > 0 && (
        <small className="no-improvement-candidate__change">
          {summarizeChangeSet(candidate.changeSet.ops, fabricNameById)}
        </small>
      )}
      {drawing && <RejectedMiniMap candidate={candidate} drawing={drawing} />}
    </div>
  );
}

function reasonClass(reasonLabel: string): string {
  return REASON_CLASS[reasonLabel] ?? 'is-other';
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

function RejectedMiniMap({ candidate, drawing }: { candidate: SearchCandidate; drawing: SimulationDrawing }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const viewportMetrics = useCallback(() => {
    const node = containerRef.current;
    if (!node) {
      return { scale: 1, offsetX: 0, offsetY: 0 };
    }
    const scale = Math.min(node.clientWidth / drawing.width, node.clientHeight / drawing.height);
    return {
      scale,
      offsetX: (node.clientWidth - drawing.width * scale) / 2,
      offsetY: (node.clientHeight - drawing.height * scale) / 2,
    };
  }, [drawing.height, drawing.width]);

  const zoomAt = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      const node = containerRef.current;
      if (!node) {
        return;
      }
      const rect = node.getBoundingClientRect();
      const { scale, offsetX, offsetY } = viewportMetrics();
      const oldK = scale * view.zoom;
      const userX = (clientX - rect.left - offsetX) / oldK + view.panX;
      const userY = (clientY - rect.top - offsetY) / oldK + view.panY;
      const nextZoom = view.zoom * factor;
      const newK = scale * nextZoom;
      setView({
        zoom: nextZoom,
        panX: userX - (clientX - rect.left - offsetX) / newK,
        panY: userY - (clientY - rect.top - offsetY) / newK,
      });
    },
    [view, viewportMetrics],
  );

  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAtRef.current(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, event.clientX, event.clientY);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  const ops = candidate.changeSet?.ops ?? [];
  if (ops.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="no-improvement-minimap"
      onPointerDown={(event) => {
        if (event.button === 0) {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            panX: view.panX,
            panY: view.panY,
          };
        }
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (drag === null) {
          return;
        }
        const { scale } = viewportMetrics();
        const k = scale * view.zoom;
        const dx = (event.clientX - drag.startX) / k;
        const dy = (event.clientY - drag.startY) / k;
        setView({ ...view, panX: drag.panX - dx, panY: drag.panY - dy });
      }}
      onPointerUp={(event) => {
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      onPointerCancel={(event) => {
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
    >
      <svg
        viewBox={`0 0 ${drawing.width} ${drawing.height}`}
        role="img"
        aria-label={`${operatorLabel(candidate.operatorType)} 시도 배치`}
      >
        <g transform={`translate(${-view.panX} ${-view.panY}) scale(${view.zoom})`}>
          <DrawingElements drawing={drawing} />
          {ops.map((op) => {
            const x = Math.min(op.after.startX, op.after.endX);
            const y = Math.min(op.after.startY, op.after.endY);
            const width = Math.abs(op.after.endX - op.after.startX);
            const height = Math.abs(op.after.endY - op.after.startY);
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            const beforeX = (op.before.startX + op.before.endX) / 2;
            const beforeY = (op.before.startY + op.before.endY) / 2;
            return (
              <g key={op.fabricId}>
                <line
                  x1={beforeX}
                  y1={beforeY}
                  x2={centerX}
                  y2={centerY}
                  className="no-improvement-minimap__arrow"
                />
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  transform={`rotate(${op.after.rotation} ${centerX} ${centerY})`}
                  className="no-improvement-minimap__attempt"
                />
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
