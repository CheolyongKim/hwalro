import { apiClient } from '../../../api/client';
import type {
  ReportDetailResponse,
  ReportListResponse,
  ReportStatus,
  ReportUpdateRequest,
} from '../types/report';

interface ReportListParams {
  query?: string;
  status?: ReportStatus;
  page: number;
  size: number;
}

export interface AiReportDraftCreateRequest {
  sourceSimulationResultId: number;
  comparisonSimulationResultIds: number[];
}

export const reportApi = {
  list: (params: ReportListParams) =>
    apiClient.get<ReportListResponse>('/api/reports', { params }).then((response) => response.data),
  get: (id: string) =>
    apiClient.get<ReportDetailResponse>(`/api/reports/${id}`).then((response) => response.data),
  update: (id: string, request: ReportUpdateRequest) =>
    apiClient
      .put<ReportDetailResponse>(`/api/reports/${id}`, request)
      .then((response) => response.data),
  createAiDraft: (request: AiReportDraftCreateRequest) =>
    apiClient
      .post<ReportDetailResponse>('/api/reports/ai-drafts', request)
      .then((response) => response.data),
};
