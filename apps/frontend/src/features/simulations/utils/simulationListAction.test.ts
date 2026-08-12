import { describe, expect, it } from 'vitest';
import type { SimulationExecutionStatus } from '../types';
import { getSimulationListAction } from './simulationListAction';

describe('getSimulationListAction', () => {
  it.each([
    ['DRAFT', { type: 'navigate', to: '/simulations/7/setup' }],
    ['COMPLETED', { type: 'navigate', to: '/simulations/7/results' }],
    ['FAILED', { type: 'show-failure' }],
    ['CANCELLED', { type: 'show-cancelled' }],
    ['REQUESTED', { type: 'disabled' }],
    ['RUNNING', { type: 'disabled' }],
  ] satisfies Array<[SimulationExecutionStatus, ReturnType<typeof getSimulationListAction>]>)(
    '%s 상태의 목록 동작을 반환한다',
    (status, expected) => {
      expect(getSimulationListAction({ id: 7, status })).toEqual(expected);
    },
  );
});
