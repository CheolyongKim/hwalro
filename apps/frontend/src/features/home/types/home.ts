import type { SimulationExecutionStatus } from '../../simulations/types';

export type LastActivityType = 'LAYOUT_EDIT' | 'SIMULATION_SETUP' | 'SIMULATION_RESULT';

/** auth-service가 보관하는 마지막 작업 포인터. 표시값은 포함하지 않는다. */
export interface LastActivity {
  activityType: LastActivityType;
  resourceId: number;
  occurredAt: string;
}

export interface SimulationWorkSummary {
  inProgressCount: number;
  completedThisWeekCount: number;
}

/** 검토 파이프라인 3단계. 디자인의 스텝퍼 순서와 같다. */
export type ReviewStepKey = 'LAYOUT' | 'SETUP' | 'ANALYSIS';

export type ReviewStepState = 'done' | 'current' | 'upcoming';

export interface ReviewStep {
  key: ReviewStepKey;
  label: string;
  state: ReviewStepState;
}

/** 마지막 작업 포인터 + 조회한 표시값을 합친 화면 전용 상태. */
export interface ActiveReview {
  title: string;
  resumePath: string;
  subtitle: string;
  occurredAt: string;
  currentStageLabel: string;
  steps: ReviewStep[];
}

export interface PriorityRiskItem {
  id: number;
  title: string;
  severity: string;
  status: string;
  assigneeId: number | null;
  assigneeName: string | null;
}

export interface RecentSimulationRow {
  id: number;
  layoutTitle: string;
  executedAt: string | null;
  createdBy: number;
  assigneeName: string | null;
  status: SimulationExecutionStatus;
  path: string;
}
