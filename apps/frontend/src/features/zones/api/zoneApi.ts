import { apiClient } from '../../../api/client';

export interface MyZone {
  zoneId: number;
  zoneName: string;
  zoneType: string;
  drawingId: number;
  drawingTitle: string;
  layoutVersionId: number;
  defaultExitId: number | null;
  defaultExitName: string | null;
}

export interface RoutePoint {
  x: number;
  y: number;
}

export interface RouteExit {
  id: number;
  name: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export type EvacuationStatus = 'AVAILABLE' | 'UNREACHABLE' | 'NOT_CONFIGURED';

export interface EvacuationRoute {
  zoneId: number;
  zoneName: string;
  origin: RoutePoint;
  status: EvacuationStatus;
  defaultExit: RouteExit | null;
  recommendedExitId: number | null;
  waypoints: RoutePoint[];
}

export const zoneApi = {
  myZones: () => apiClient.get<MyZone[]>('/api/my-zones').then((response) => response.data),

  evacuationRoute: (zoneId: number) =>
    apiClient
      .get<EvacuationRoute>(`/api/my-zones/${zoneId}/evacuation-route`)
      .then((response) => response.data),
};
