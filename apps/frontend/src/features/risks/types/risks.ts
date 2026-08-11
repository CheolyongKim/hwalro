export interface Risk {
  id: number;
  simulationResultId: number | null;
  assigneeId: number | null;
  title: string;
  description: string | null;
  startX: number | null;
  startY: number | null;
  endX: number | null;
  endY: number | null;
  severity: string;
  status: string;
  createdAt: string;
}

export interface RiskCreateRequest {
  simulationResultId: number | null;
  startX: number | null;
  startY: number | null;
  endX: number | null;
  endY: number | null;
  title: string;
  description: string | null;
  severity: string;
  status: string;
}

export interface RiskUpdateRequest {
  title: string;
  description: string | null;
  severity: string;
  status: string;
}

export interface RiskListResponse {
  totalCount: number;
  page: number;
  size: number;
  hasNext: boolean;
  items: Risk[];
}
