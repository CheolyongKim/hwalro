import { useEffect, useState } from 'react';
import { SEVERITY_OPTIONS, STATUS_OPTIONS } from '../../risks/constants/riskOptions';
import { useCreateRisk } from '../../risks/hooks/useRiskMutations';
import type { Risk, RiskCreateRequest } from '../../risks/types/risks';
import { getRiskErrorMessage } from '../../risks/utils/getRiskErrorMessage';
import type { Bounds } from '../types';

interface Props {
  bounds: Bounds;
  drawingWidth: number;
  simulationResultId: number;
  onCancel: () => void;
  onConfirm: (risk: Risk) => void;
}

export function RiskZoneEditorDialog({
  bounds,
  drawingWidth,
  simulationResultId,
  onCancel,
  onConfirm,
}: Props) {
  const [zoneName, setZoneName] = useState('AI 구역 이름 생성 중...');
  const [severity, setSeverity] = useState('보통');
  const [status, setStatus] = useState('임시저장');

  const createMutation = useCreateRisk();

  const errorMessage = createMutation.isError ? getRiskErrorMessage(createMutation.error) : null;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setZoneName(bounds.x > drawingWidth / 2 ? '동측 혼잡 예상 구역' : '서측 이동 주의 구역');
    }, 600);
    return () => window.clearTimeout(timer);
  }, [bounds.x, drawingWidth]);

  const handleConfirm = () => {
    const body: RiskCreateRequest = {
      simulationResultId,
      startX: bounds.x,
      startY: bounds.y,
      endX: bounds.x + bounds.width,
      endY: bounds.y + bounds.height,
      title: zoneName.trim(),
      severity,
      status,
      description: null,
    };
    createMutation.mutate(body, { onSuccess: onConfirm });
  };

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
        <label htmlFor="zone-editor-severity">심각도</label>
        <select
          id="zone-editor-severity"
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
        >
          {SEVERITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <label htmlFor="zone-editor-status">상태</label>
        <select
          id="zone-editor-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {errorMessage && <p role="alert">{errorMessage}</p>}
        <div>
          <button type="button" onClick={onCancel}>
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={createMutation.isPending || !zoneName.trim()}
          >
            {createMutation.isPending ? '등록 중...' : '확정'}
          </button>
        </div>
      </section>
    </div>
  );
}
