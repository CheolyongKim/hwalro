export type ReportStatus = '초안' | '작성 중' | '완료';

export type ReportListStatusFilter = '전체' | ReportStatus;

export interface ReportListItem {
  id: number;
  authorId: number;
  authorName: string | null;
  title: string;
  status: ReportStatus;
  updatedAt: string;
}

export interface ReportListResponse {
  totalCount: number;
  page: number;
  size: number;
  hasNext: boolean;
  items: ReportListItem[];
}

export interface ReportContent {
  overview: string;
  analysis: string;
  improvements: string;
}

export interface ReportDetailResponse {
  id: number;
  title: string;
  content: ReportContent;
  status: Exclude<ReportStatus, '초안'>;
  createdAt: string;
  simulationResultIds: number[];
}

export interface ReportUpdateRequest {
  title: string;
  content: ReportContent;
  status: Exclude<ReportStatus, '초안'>;
}

export interface ReportVisualContext {
  simulationResultId: number;
  simulationId: number;
  layoutTitle: string;
  drawing: import('../../simulationResult/types').SimulationDrawing;
  bottlenecks: import('../../simulationResult/types').DetectedBottleneck[];
}
