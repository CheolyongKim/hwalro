import { useEffect, useState } from 'react';
import type { Bounds, RiskZone } from '../types';

interface Props {
  bounds: Bounds;
  drawingWidth: number;
  onCancel: () => void;
  onConfirm: (zone: RiskZone) => void;
}

export function RiskZoneEditorDialog({ bounds, drawingWidth, onCancel, onConfirm }: Props) {
  const [zoneName, setZoneName] = useState('AI 구역 이름 생성 중...');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setZoneName(bounds.x > drawingWidth / 2 ? '동측 혼잡 예상 구역' : '서측 이동 주의 구역');
    }, 600);
    return () => window.clearTimeout(timer);
  }, [bounds.x, drawingWidth]);

  return (
    <div
      className="dialog-backdrop zone-editor-backdrop"
      role="presentation"
      onMouseDown={onCancel}
    >
      <section
        className="zone-editor floating-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="zone-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="zone-editor-title">위험 예상 항목 이름</h2>
        <input
          aria-label="위험 예상 항목 이름"
          value={zoneName}
          onChange={(event) => setZoneName(event.target.value)}
          autoFocus
        />
        <div>
          <button type="button" onClick={onCancel}>
            취소
          </button>
          <button
            type="button"
            onClick={() => onConfirm({ ...bounds, id: crypto.randomUUID(), name: zoneName })}
          >
            확정
          </button>
        </div>
      </section>
    </div>
  );
}
