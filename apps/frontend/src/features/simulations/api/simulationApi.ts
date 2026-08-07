import { apiClient } from '../../../api/client';
import type {
  CreateSimulationDraftRequest,
  SimulationExecution,
  SimulationSetup,
  SimulationSummary,
  SimulationTimelineChunk,
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

  execute: (simulationId: number) =>
    apiClient
      .post<SimulationExecution>(`/api/simulations/${simulationId}/execute`)
      .then((response) => response.data),

  getExecution: (simulationId: number) =>
    apiClient
      .get<SimulationExecution>(`/api/simulations/${simulationId}/execution`)
      .then((response) => response.data),

  getTimelineChunk: (simulationId: number, sequence: number) =>
    apiClient
      .get<SimulationTimelineChunk>(`/api/simulations/${simulationId}/timeline/${sequence}`)
      .then((response) => response.data),
};
