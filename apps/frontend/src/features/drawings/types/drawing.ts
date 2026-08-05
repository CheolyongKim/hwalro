export type DrawingStatus = '작성 중' | '검토 대기' | '검토 중' | '검토 완료' | '위험 발견';

export interface DrawingItem {
  id: number;
  title: string;
  description: string;
  createdBy: string;
  createdAt: string;
  status: DrawingStatus;
}

export type DrawingPeriod = '전체' | '최근 7일' | '최근 30일';
