import type { SimulationExecutionStatus } from '../types';

export const STATUS_LABELS: Record<SimulationExecutionStatus, string> = {
  DRAFT: '배치 작성 중',
  REQUESTED: '실행 대기',
  RUNNING: '실행 중',
  COMPLETED: '실행 완료',
  FAILED: '실행 실패',
  CANCELLED: '실행 취소',
};

export const STATUS_STYLES: Record<SimulationExecutionStatus, string> = {
  DRAFT: 'bg-soft-gray text-text-strong',
  REQUESTED: 'bg-amber-50 text-amber-700',
  RUNNING: 'bg-primary-soft text-primary',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-red-50 text-red-700',
  CANCELLED: 'bg-soft-gray text-text-muted',
};
