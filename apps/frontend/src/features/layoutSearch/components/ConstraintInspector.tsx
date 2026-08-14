import { useState } from 'react';
import type { SimulationDrawing, SimulationRect } from '../../simulations/types';
import type { ForbiddenZone, SearchConstraints } from '../api/layoutSearchApi';
import { ConstraintEditor, type ConstraintEditorTool } from './ConstraintEditor';

const WALL_CONTACT_EPSILON = 0.05;

function pointToSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.min(Math.max(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0), 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function segmentDistance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): number {
  return Math.min(
    pointToSegmentDistance(ax, ay, cx, cy, dx, dy),
    pointToSegmentDistance(bx, by, cx, cy, dx, dy),
    pointToSegmentDistance(cx, cy, ax, ay, bx, by),
    pointToSegmentDistance(dx, dy, ax, ay, bx, by),
  );
}

function fabricCorners(fabric: SimulationRect): Array<[number, number]> {
  const minX = Math.min(fabric.startX, fabric.endX);
  const maxX = Math.max(fabric.startX, fabric.endX);
  const minY = Math.min(fabric.startY, fabric.endY);
  const maxY = Math.max(fabric.startY, fabric.endY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rad = (fabric.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners: Array<[number, number]> = [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ];
  return corners.map(([x, y]) => [
    cx + (x - cx) * cos - (y - cy) * sin,
    cy + (x - cx) * sin + (y - cy) * cos,
  ]);
}

function touchesWall(fabric: SimulationRect, drawing: SimulationDrawing): boolean {
  const segments: Array<[number, number, number, number]> = [];
  for (const wall of drawing.walls) {
    segments.push([wall.startX, wall.startY, wall.endX, wall.endY]);
  }
  const boundary = drawing.outsideBoundary;
  if (boundary.length >= 2) {
    for (let i = 0; i < boundary.length; i += 1) {
      const start = boundary[i];
      const end = boundary[(i + 1) % boundary.length];
      segments.push([start.x, start.y, end.x, end.y]);
    }
  }
  const corners = fabricCorners(fabric);
  for (let i = 0; i < corners.length; i += 1) {
    const [ax, ay] = corners[i];
    const [bx, by] = corners[(i + 1) % corners.length];
    for (const [cx, cy, dx, dy] of segments) {
      if (segmentDistance(ax, ay, bx, by, cx, cy, dx, dy) <= WALL_CONTACT_EPSILON) {
        return true;
      }
    }
  }
  return false;
}

const RADIUS_OPTIONS = [
  { value: 0, label: '고정' },
  { value: 0.5, label: '0.5m' },
  { value: 1, label: '1m' },
  { value: -1, label: '자유' },
];

interface Props {
  drawing: SimulationDrawing;
  constraints: SearchConstraints;
  onChange: (updater: (current: SearchConstraints) => SearchConstraints) => void;
  onStart: () => void;
  starting: boolean;
}

function fabricBadges(fabricId: number, constraints: SearchConstraints): string[] {
  const badges: string[] = [];
  const radius = constraints.moveRadii[fabricId];
  if (radius === 0) badges.push('고정');
  else if (radius === 0.5) badges.push('0.5m');
  else if (radius === 1) badges.push('1m');
  if (constraints.rotationAllowed[fabricId] === false) badges.push('회전');
  if (constraints.wallAnchored[fabricId] === true) badges.push('벽면');
  return badges;
}

function formatZone(zone: ForbiddenZone): string {
  const width = Math.round(zone.width * 10) / 10;
  const height = Math.round(zone.height * 10) / 10;
  return `${width} × ${height} m`;
}

export function ConstraintInspector({ drawing, constraints, onChange, onStart, starting }: Props) {
  const [selectedFabricId, setSelectedFabricId] = useState<number | null>(null);
  const [tool, setTool] = useState<ConstraintEditorTool>('select');
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(null);

  const selectedFabric =
    selectedFabricId === null
      ? null
      : drawing.fabrics.find((fabric) => fabric.id === selectedFabricId) ?? null;

  const selectedTouchesWall =
    selectedFabric !== null && touchesWall(selectedFabric, drawing);

  const setRadius = (fabricId: number, optionValue: number) => {
    onChange((current) => {
      const next: SearchConstraints = {
        ...current,
        moveRadii: { ...current.moveRadii },
      };
      if (optionValue === -1) {
        delete next.moveRadii[fabricId];
      } else {
        next.moveRadii[fabricId] = optionValue;
      }
      return next;
    });
  };

  const toggleRotation = (fabricId: number) => {
    onChange((current) => {
      const next: SearchConstraints = {
        ...current,
        rotationAllowed: { ...current.rotationAllowed },
      };
      next.rotationAllowed[fabricId] = !(current.rotationAllowed[fabricId] ?? true);
      return next;
    });
  };

  const toggleWallAnchored = (fabricId: number) => {
    onChange((current) => {
      const next: SearchConstraints = {
        ...current,
        wallAnchored: { ...current.wallAnchored },
      };
      next.wallAnchored[fabricId] = !(current.wallAnchored[fabricId] ?? false);
      return next;
    });
  };

  const addForbiddenZone = (zone: ForbiddenZone) => {
    onChange((current) => ({
      ...current,
      forbiddenZones: [...current.forbiddenZones, zone],
    }));
    setSelectedZoneIndex(constraints.forbiddenZones.length);
  };

  const deleteForbiddenZone = (index: number) => {
    onChange((current) => ({
      ...current,
      forbiddenZones: current.forbiddenZones.filter((_, i) => i !== index),
    }));
    setSelectedZoneIndex((current) => {
      if (current === null) return null;
      if (current === index) return null;
      return current > index ? current - 1 : current;
    });
  };

  const moveForbiddenZone = (index: number, dx: number, dy: number) => {
    onChange((current) => ({
      ...current,
      forbiddenZones: current.forbiddenZones.map((zone, i) =>
        i === index
          ? {
              x: Math.round((zone.x + dx) * 100) / 100,
              y: Math.round((zone.y + dy) * 100) / 100,
              width: zone.width,
              height: zone.height,
            }
          : zone,
      ),
    }));
  };

  return (
    <section className="constraint-inspector" aria-label="구조물 제약 설정">
      <div className="constraint-inspector__canvas">
        <div className="constraint-editor-toolbar">
          <span className="constraint-editor-toolbar__hint">
            {tool === 'zone'
              ? '드래그하여 금지 영역을 그립니다'
              : '구조물을 클릭하여 제약을 지정합니다'}
          </span>
          <button
            type="button"
            aria-pressed={tool === 'zone'}
            onClick={() => setTool((current) => (current === 'zone' ? 'select' : 'zone'))}
          >
            금지 영역 그리기
          </button>
        </div>
        <ConstraintEditor
          drawing={drawing}
          constraints={constraints}
          selectedFabricId={selectedFabricId}
          tool={tool}
          onSelectFabric={setSelectedFabricId}
          onAddForbiddenZone={addForbiddenZone}
          onMoveForbiddenZone={moveForbiddenZone}
          selectedZoneIndex={selectedZoneIndex}
          onSelectZone={setSelectedZoneIndex}
        />
        {tool === 'zone' && (
          <p className="constraint-editor-zone-hint" role="status">
            금지 영역 안으로는 구조물이 이동할 수 없습니다. 최소 크기는 0.2m입니다.
          </p>
        )}
      </div>
      <aside className="constraint-inspector__panel">
        <div className="constraint-inspector__group">
          <h3 className="constraint-inspector__group-title">
            구조물 목록
            {drawing.fabrics.length > 0 && <small>{drawing.fabrics.length}개</small>}
          </h3>
          {drawing.fabrics.length === 0 ? (
            <p className="constraint-inspector__empty">구조물이 없습니다.</p>
          ) : (
            <ul className="constraint-inspector__list">
              {drawing.fabrics.map((fabric) => {
                const badges = fabricBadges(fabric.id, constraints);
                const selected = fabric.id === selectedFabricId;
                return (
                  <li key={fabric.id}>
                    <button
                      type="button"
                      className={`constraint-fabric-row${selected ? ' is-selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => setSelectedFabricId(fabric.id)}
                    >
                      <span>{fabric.name || `구조물 ${fabric.id}`}</span>
                      {badges.length > 0 && (
                        <span className="constraint-fabric-badges">
                          {badges.map((badge) => (
                            <em key={badge} className="constraint-fabric-badge">
                              {badge}
                            </em>
                          ))}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {selectedFabric && (
          <div className="constraint-inspector__group">
            <h3 className="constraint-inspector__group-title">
              {selectedFabric.name || `구조물 ${selectedFabric.id}`} 제약
            </h3>
            <div className="constraint-inspector__detail">
              <div className="constraint-inspector__controls">
                <span className="constraint-inspector__label">이동 반경</span>
                <div
                  className="constraint-inspector__segments"
                  role="radiogroup"
                  aria-label={`${selectedFabric.name ?? `구조물 ${selectedFabric.id}`} 이동 반경`}
                >
                  {RADIUS_OPTIONS.map((option) => {
                    const radius = constraints.moveRadii[selectedFabric.id];
                    const radiusValue = radius === undefined ? -1 : radius;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={radiusValue === option.value}
                        onClick={() => setRadius(selectedFabric.id, option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="constraint-inspector__controls">
                <label className="constraint-inspector__check">
                  <input
                    type="checkbox"
                    checked={constraints.rotationAllowed[selectedFabric.id] ?? true}
                    onChange={() => toggleRotation(selectedFabric.id)}
                  />
                  회전 허용
                </label>
                <label
                  className={`constraint-inspector__check${
                    selectedTouchesWall ? '' : ' is-disabled'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={constraints.wallAnchored[selectedFabric.id] === true}
                    disabled={!selectedTouchesWall}
                    onChange={() => toggleWallAnchored(selectedFabric.id)}
                  />
                  벽면 접촉 유지
                </label>
                {!selectedTouchesWall && (
                  <small className="constraint-inspector__check-hint">
                    벽에 닿아 있는 구조물만 벽면 접촉 유지를 설정할 수 있습니다.
                  </small>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="constraint-inspector__group">
          <h3 className="constraint-inspector__group-title">금지 영역</h3>
          {constraints.forbiddenZones.length === 0 ? (
            <p className="constraint-inspector__empty">
              {tool === 'zone'
                ? '캔버스에서 드래그하여 금지 영역을 추가하세요.'
                : '금지 영역이 없습니다.'}
            </p>
          ) : (
            <ul className="constraint-zone-list">
              {constraints.forbiddenZones.map((zone, index) => (
                <li
                  key={`${zone.x}-${zone.y}-${index}`}
                  className={`constraint-zone-item${index === selectedZoneIndex ? ' is-selected' : ''}`}
                >
                  <button
                    type="button"
                    className="constraint-zone-item__select"
                    onClick={() =>
                      setSelectedZoneIndex((current) => (current === index ? null : index))
                    }
                  >
                    <span>금지 영역 {index + 1}</span>
                    <small>{formatZone(zone)}</small>
                  </button>
                  <button
                    type="button"
                    className="constraint-zone-item__delete"
                    aria-label={`금지 영역 ${index + 1} 삭제`}
                    onClick={() => deleteForbiddenZone(index)}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="constraint-inspector__note">
          화면을 떠나도 서버에서 탐색이 계속되며 나중에 돌아와 진행 상태를 확인할 수 있습니다.
        </p>
        <button
          type="button"
          className="search-start-button"
          disabled={starting}
          onClick={onStart}
        >
          {starting ? '탐색 준비 중' : '배치 개선안 탐색 시작'}
        </button>
      </aside>
    </section>
  );
}
