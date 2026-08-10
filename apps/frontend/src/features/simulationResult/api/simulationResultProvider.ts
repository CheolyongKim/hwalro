import axios from 'axios';
import { apiClient } from '../../../api/client';
import type { SimulationResultProvider, SimulationResultViewModel } from '../types';

interface SegmentResponse {
  name: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  rotation?: number;
}

interface SimulationResultDetailResponse {
  simulationId: number;
  simulationResultId: number;
  title: string;
  subtitle: string;
  durationSeconds: number;
  totalPeople: number;
  maxDensity: number;
  densityThreshold: number;
  drawing: {
    name: string;
    width: number;
    height: number;
    walls: SegmentResponse[];
    exits: SegmentResponse[];
    pillars: SegmentResponse[];
    fabrics: SegmentResponse[];
  };
  agentFrames: Array<{
    timeSeconds: number;
    positions: number[];
    activeAgentCount: number;
    evacuatedCount: number;
  }>;
  heatmap: {
    columns: number;
    rows: number;
    cellWidth: number;
    cellHeight: number;
    maxDensity: number;
    frames: Array<{ timeSeconds: number; values: number[] }>;
  };
  bottlenecks: Array<{
    id: number;
    order: number;
    name: string;
    startTimeSeconds: number;
    endTimeSeconds: number;
    peakDensity: number;
    thresholdValue: number;
    geometry: { x: number; y: number; width: number; height: number };
  }>;
  evacuationProgress: Array<{ timeSeconds: number; evacuatedCount: number }>;
  comparableSimulations: Array<{
    id: number;
    simulationResultId: number;
    name: string;
    totalEvacuationTime: number;
  }>;
}

function toViewModel(response: SimulationResultDetailResponse): SimulationResultViewModel {
  return {
    ...response,
    simulationId: String(response.simulationId),
    agentFrames: response.agentFrames.map((frame) => ({
      ...frame,
      positions: Float32Array.from(frame.positions),
    })),
    heatmap: {
      ...response.heatmap,
      frames: response.heatmap.frames.map((frame) => ({
        ...frame,
        values: Float32Array.from(frame.values),
      })),
    },
  };
}

export const simulationResultProvider: SimulationResultProvider = {
  async getResult(simulationId) {
    try {
      const response = await apiClient.get<SimulationResultDetailResponse>(
        `/api/simulations/${simulationId}/result`,
      );
      return toViewModel(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    }
  },
};
