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
export type EvacuationUnavailableReason =
  | 'NO_EXIT'
  | 'ASSIGNED_EXIT_NOT_FOUND'
  | 'NO_WALKABLE_ORIGIN_IN_ZONE'
  | 'NO_REACHABLE_EXIT';

/** ASSIGNED: 구역에 배정된 비상구. NEAREST: 배정이 없어 걸어서 가장 가까운 곳을 고른 경우. */
export type ExitChoice = 'ASSIGNED' | 'NEAREST';

export interface EvacuationRoute {
  zoneId: number;
  zoneName: string;
  origin: RoutePoint;
  routeOrigin: RoutePoint;
  originAdjusted: boolean;
  status: EvacuationStatus;
  unavailableReason: EvacuationUnavailableReason | null;
  defaultExit: RouteExit | null;
  recommendedExitId: number | null;
  recommendedExitName: string | null;
  exitChoice: ExitChoice | null;
  /** 안내 경로를 따라 걷는 거리(m). */
  distanceMeters: number;
  /** 경로에서 가장 좁은 지점의 통로 반폭(m). 작을수록 사람이 몰렸을 때 막히기 쉽다. */
  narrowestMeters: number | null;
  waypoints: RoutePoint[];
}

export const zoneApi = {
  myZones: () => apiClient.get<MyZone[]>('/api/my-zones').then((response) => response.data),

  evacuationRoute: (zoneId: number) =>
    apiClient
      .get<EvacuationRoute>(`/api/my-zones/${zoneId}/evacuation-route`)
      .then((response) => response.data),

  /** 도면의 모든 구역 대피 경로. 안전 담당 권한에서만 조회된다. */
  evacuationRoutes: (drawingId: number) =>
    apiClient
      .get<EvacuationRoute[]>(`/api/drawings/${drawingId}/evacuation-routes`)
      .then((response) => response.data),
};
