import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from 'react';
import type { SimulationResultViewModel } from '../types';

const MAX_COMPARISON_COUNT = 5;

interface Props {
  open: boolean;
  result: SimulationResultViewModel;
  isGenerating: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onGenerate: (comparisonResultIds: number[]) => void;
}

export function ReportDraftDialog({
  open,
  result,
  isGenerating,
  errorMessage,
  onClose,
  onGenerate,
}: Props) {
  const [selectedComparisons, setSelectedComparisons] = useState<number[]>([]);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) setSelectedComparisons([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const animationFrame = window.requestAnimationFrame(() => {
      const firstControl = dialogRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]), button:not([disabled])',
      );
      (firstControl ?? dialogRef.current)?.focus();
    });
    return () => {
      window.cancelAnimationFrame(animationFrame);
      previouslyFocused?.focus();
    };
  }, [open]);

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      if (!isGenerating) {
        event.preventDefault();
        onClose();
      }
      return;
    }
    if (event.key !== 'Tab') return;

    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (focusableElements.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const toggleComparison = (simulationResultId: number) => {
    setSelectedComparisons((values) =>
      values.includes(simulationResultId)
        ? values.filter((value) => value !== simulationResultId)
        : [...values, simulationResultId],
    );
  };

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={() => {
        if (!isGenerating) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="report-dialog"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="report-dialog-title"
        aria-busy={isGenerating}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        <h2 id="report-dialog-title">AI 보고서 비교 결과 선택</h2>
        <p>현재 결과와 함께 분석할 시뮬레이션을 최대 5개 선택하세요.</p>
        <div className="current-simulation">
          <strong>{result.title}</strong>
          <span>현재 결과 · 필수</span>
        </div>
        {result.comparableSimulations.map((item) => {
          const comparisonResultId = item.simulationResultId;
          return (
            <label key={item.id}>
              <input
                type="checkbox"
                checked={selectedComparisons.includes(comparisonResultId)}
                disabled={
                  isGenerating ||
                  (!selectedComparisons.includes(comparisonResultId) &&
                    selectedComparisons.length >= MAX_COMPARISON_COUNT)
                }
                onChange={() => toggleComparison(comparisonResultId)}
              />
              <span>
                <strong>{item.name}</strong>
                <small>총 대피 시간 {item.totalEvacuationTime}초</small>
              </span>
            </label>
          );
        })}
        {errorMessage && (
          <p className="report-dialog-error" role="alert">
            {errorMessage}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" disabled={isGenerating} onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            disabled={isGenerating}
            onClick={() => onGenerate(selectedComparisons)}
          >
            {isGenerating ? 'AI 초안 생성 중…' : '초안 생성하기'}
          </button>
        </div>
      </section>
    </div>
  );
}
