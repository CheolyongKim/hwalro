import { apiClient } from '../../../api/client';
import type {
  InspectionArea,
  InspectionDetail,
  InspectionHistory,
  InspectionUpdateRequest,
} from '../types';

export const safetyCheckApi = {
  getAreas: () =>
    apiClient.get<InspectionArea[]>('/api/safety-checks/areas').then((response) => response.data),
  getHistory: (areaId: number) =>
    apiClient
      .get<InspectionHistory[]>(`/api/safety-checks/areas/${areaId}/inspections`)
      .then((response) => response.data),
  getInspection: (inspectionId: number) =>
    apiClient
      .get<InspectionDetail>(`/api/safety-checks/inspections/${inspectionId}`)
      .then((response) => response.data),
  createInspection: (areaId: number) =>
    apiClient
      .post<InspectionDetail>(`/api/safety-checks/areas/${areaId}/inspections`, {})
      .then((response) => response.data),
  updateInspection: (inspectionId: number, body: InspectionUpdateRequest) =>
    apiClient
      .put<InspectionDetail>(`/api/safety-checks/inspections/${inspectionId}`, body)
      .then((response) => response.data),
};
