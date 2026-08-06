import { apiClient } from '../../../api/client';
import type {
  CreateSimulationDraftRequest,
  SimulationSetup,
  SimulationSummary,
  UpdateSimulationSetupRequest,
} from '../types';

export const simulationApi = {
  listByLayoutVersion: (layoutVersionId: number) =>
    apiClient
      .get<SimulationSummary[]>('/api/simulations', { params: { layoutVersionId } })
      .then((response) => response.data),

  createDraft: (body: CreateSimulationDraftRequest) =>
    apiClient
      .post<SimulationSetup>('/api/simulations/drafts', body)
      .then((response) => response.data),

  getSetup: (simulationId: number) =>
    apiClient
      .get<SimulationSetup>(`/api/simulations/${simulationId}/setup`)
      .then((response) => response.data),

  updateSetup: (simulationId: number, body: UpdateSimulationSetupRequest) =>
    apiClient
      .put<SimulationSetup>(`/api/simulations/${simulationId}/setup`, body)
      .then((response) => response.data),
};
