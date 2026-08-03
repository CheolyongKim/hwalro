export interface Risk {
  id: number;
  simulationResultId: number;
  assigneeId: number | null;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  createdAt: string;
}

export interface RiskCreateRequest {
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
