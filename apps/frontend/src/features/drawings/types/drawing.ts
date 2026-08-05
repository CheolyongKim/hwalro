export interface DrawingWall {
  name: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface DrawingLayoutText {
  text: string;
  x: number;
  y: number;
}

export interface DrawingSummary {
  id: number;
  title: string;
  description: string | null;
  createdBy: number;
  createdAt: string;
}

export interface Drawing extends DrawingSummary {
  width: number;
  height: number;
  walls: DrawingWall[];
  layoutTexts: DrawingLayoutText[];
  version: number;
}

export interface DrawingCreateRequest {
  title: string | null;
  description: string | null;
}

export interface DrawingUpdateRequest {
  title: string;
  description: string | null;
  walls: DrawingWall[];
  layoutTexts: DrawingLayoutText[];
  expectedVersion: number;
}

export interface DrawingListResponse {
  totalCount: number;
  page: number;
  size: number;
  hasNext: boolean;
  items: DrawingSummary[];
}

export type DrawingPeriod = '전체' | '최근 7일' | '최근 30일';
