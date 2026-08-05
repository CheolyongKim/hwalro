import type { DrawingPeriod, DrawingStatus } from '../types/drawing';

export const DRAWING_STATUS_OPTIONS: DrawingStatus[] = [
  '작성 중',
  '검토 대기',
  '검토 중',
  '검토 완료',
  '위험 발견',
];

export const DRAWING_STATUS_STYLES: Record<DrawingStatus, string> = {
  '작성 중': 'bg-soft-gray text-text-strong',
  '검토 대기': 'bg-soft-orange text-text-strong',
  '검토 중': 'bg-soft-blue text-text-strong',
  '검토 완료': 'bg-primary-soft text-text-strong',
  '위험 발견': 'bg-soft-purple text-text-strong',
};

export const DRAWING_PERIOD_OPTIONS: DrawingPeriod[] = ['전체', '최근 7일', '최근 30일'];
