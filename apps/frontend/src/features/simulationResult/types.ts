export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawingSegment {
  name: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface DrawingRect extends DrawingSegment {
  rotation?: number;
}

export interface SimulationDrawing {
  name: string;
  width: number;
  height: number;
  walls: DrawingSegment[];
  exits: DrawingSegment[];
  pillars: DrawingRect[];
  fabrics: DrawingRect[];
}

export interface AgentFrameBuffer {
  timeSeconds: number;
  positions: Float32Array;
  activeAgentCount: number;
  evacuatedCount: number;
}

export interface HeatmapFrame {
  timeSeconds: number;
  values: Float32Array;
}

export interface HeatmapData {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  maxDensity: number;
  frames: HeatmapFrame[];
}

export interface DetectedBottleneck {
  id: number;
  order: number;
  name: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  peakDensity: number;
  thresholdValue: number;
  geometry: Bounds;
}

export interface EvacuationPoint {
  timeSeconds: number;
  evacuatedCount: number;
}

export interface ComparableSimulation {
  id: number;
  simulationResultId: number;
  name: string;
  totalEvacuationTime: number;
}

export interface RiskZone extends Bounds {
  id: string;
  name: string;
}

export interface SimulationResultViewModel {
  simulationId: string;
  simulationResultId: number;
  title: string;
  subtitle: string;
  durationSeconds: number;
  totalPeople: number;
  maxDensity: number;
  densityThreshold: number;
  drawing: SimulationDrawing;
  agentFrames: AgentFrameBuffer[];
  heatmap: HeatmapData;
  bottlenecks: DetectedBottleneck[];
  evacuationProgress: EvacuationPoint[];
  comparableSimulations: ComparableSimulation[];
}

export interface SimulationResultProvider {
  getResult(simulationId: string): Promise<SimulationResultViewModel | null>;
}
