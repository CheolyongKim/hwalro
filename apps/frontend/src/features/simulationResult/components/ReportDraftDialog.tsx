import { useState } from 'react';
import type { SimulationResultViewModel } from '../types';

interface Props {
  open: boolean;
  result: SimulationResultViewModel;
  onClose: () => void;
  onGenerate: (comparisonIds: number[]) => void;
}

export function ReportDraftDialog({ open, result, onClose, onGenerate }: Props) {
  const [selectedComparisons, setSelectedComparisons] = useState<number[]>([]);

  const toggleComparison = (id: number) => {
    setSelectedComparisons((values) =>
      values.includes(id) ? values.filter((value) => value !== id) : [...values, id],
    );
  };

  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="report-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="report-dialog-title">AI 보고서 비교 결과 선택</h2>
        <p>현재 결과와 함께 분석할 시뮬레이션을 최대 3개 선택하세요.</p>
        <div className="current-simulation">
          <strong>{result.title}</strong>
          <span>현재 결과 · 필수</span>
        </div>
        {result.comparableSimulations.map((item) => (
          <label key={item.id}>
            <input
              type="checkbox"
              checked={selectedComparisons.includes(item.id)}
              disabled={!selectedComparisons.includes(item.id) && selectedComparisons.length >= 3}
              onChange={() => toggleComparison(item.id)}
            />
            <span>
              <strong>{item.name}</strong>
              <small>총 대피 시간 {item.totalEvacuationTime}초</small>
            </span>
          </label>
        ))}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button type="button" onClick={() => onGenerate(selectedComparisons)}>
            초안 생성하기
          </button>
        </div>
      </section>
    </div>
  );
}
