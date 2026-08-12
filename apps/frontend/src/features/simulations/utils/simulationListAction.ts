import type { SimulationExecutionStatus } from '../types';

type SimulationListItem = {
  id: number;
  status: SimulationExecutionStatus;
};

export type SimulationListAction =
  | { type: 'navigate'; to: string }
  | { type: 'show-failure' }
  | { type: 'show-cancelled' }
  | { type: 'disabled' };

export function getSimulationListAction({ id, status }: SimulationListItem): SimulationListAction {
  switch (status) {
    case 'DRAFT':
      return { type: 'navigate', to: `/simulations/${id}/setup` };
    case 'COMPLETED':
      return { type: 'navigate', to: `/simulations/${id}/results` };
    case 'FAILED':
      return { type: 'show-failure' };
    case 'CANCELLED':
      return { type: 'show-cancelled' };
    case 'REQUESTED':
    case 'RUNNING':
      return { type: 'disabled' };
  }
}
