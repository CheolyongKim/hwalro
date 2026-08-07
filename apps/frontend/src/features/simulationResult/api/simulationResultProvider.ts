import { createMockSimulationResult } from '../mock/createMockSimulationResult';
import type { SimulationResultProvider } from '../types';

export const mockSimulationResultProvider: SimulationResultProvider = {
  async getResult(simulationId) {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    if (simulationId === 'missing') return null;
    if (simulationId === 'error') throw new Error('시뮬레이션 결과를 불러오지 못했습니다.');
    return createMockSimulationResult(simulationId);
  },
};
