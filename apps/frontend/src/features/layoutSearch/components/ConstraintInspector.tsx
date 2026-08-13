import type { SimulationDrawing } from '../../simulations/types';
import type { SearchConstraints } from '../api/layoutSearchApi';

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

export function ConstraintInspector({ drawing, constraints, onChange, onStart, starting }: Props) {
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

  return (
    <section className="constraint-inspector" aria-label="구조물 제약 설정">
      <div className="workspace-section-heading">
        <span>구조물 제약 설정</span>
        <small>움직여도 되는 범위를 지정합니다. 기본은 모두 자유입니다.</small>
      </div>
      <ul className="constraint-inspector__list">
        {drawing.fabrics.map((fabric) => {
          const radius = constraints.moveRadii[fabric.id];
          const radiusValue = radius === undefined ? -1 : radius;
          const rotationAllowed = constraints.rotationAllowed[fabric.id] ?? true;
          const wallAnchored = constraints.wallAnchored[fabric.id] ?? false;
          return (
            <li key={fabric.id} className="constraint-inspector__row">
              <strong>{fabric.name || `구조물 ${fabric.id}`}</strong>
              <div className="constraint-inspector__controls">
                <div className="constraint-inspector__segments" role="radiogroup" aria-label={`${fabric.name} 이동 반경`}>
                  {RADIUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={radiusValue === option.value}
                      onClick={() => setRadius(fabric.id, option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <label className="constraint-inspector__check">
                  <input
                    type="checkbox"
                    checked={rotationAllowed}
                    onChange={() => toggleRotation(fabric.id)}
                  />
                  회전 허용
                </label>
                <label className="constraint-inspector__check">
                  <input
                    type="checkbox"
                    checked={wallAnchored}
                    onChange={() => toggleWallAnchored(fabric.id)}
                  />
                  벽면 접촉 유지
                </label>
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="search-start-button"
        disabled={starting}
        onClick={onStart}
      >
        {starting ? '탐색 준비 중' : '배치 개선안 탐색 시작'}
      </button>
    </section>
  );
}
