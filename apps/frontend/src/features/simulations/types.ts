export interface SimulationPoint {
  x: number;
  y: number;
}

export interface SimulationLine {
  name: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface SimulationRect extends SimulationLine {
  rotation: number;
}

export interface SimulationExit extends SimulationLine {
  id: number;
}

export interface SimulationLayoutText {
  text: string;
  x: number;
  y: number;
}

export interface SimulationHazardZone {
  id?: number;
  centerX: number;
  centerY: number;
  radius: number;
}

export interface SimulationDrawing {
  layoutId: number;
  title: string;
  width: number;
  height: number;
  outsideBoundary: SimulationPoint[];
  walls: SimulationLine[];
  pillars: SimulationRect[];
  fabrics: SimulationRect[];
  layoutTexts: SimulationLayoutText[];
  exits: SimulationExit[];
}

export interface SimulationSetup {
  simulationId: number;
  layoutVersionId: number;
  parentSimulationId: number | null;
  status: string;
  createdAt: string;
  randomSeed: number;
  totalPeople: number;
  walkingSpeed: number;
  reactionTime: number;
  modelProfile: string;
  agentPositions: SimulationPoint[];
  hazardZones: SimulationHazardZone[];
  selectedExitIds: number[];
  drawing: SimulationDrawing;
}

export interface SimulationSummary {
  id: number;
  status: string;
  createdAt: string;
  totalPeople: number;
}

export interface CreateSimulationDraftRequest {
  layoutVersionId: number;
  parentSimulationId?: number;
}

export interface UpdateSimulationSetupRequest {
  walkingSpeed: number;
  reactionTime: number;
  agentPositions: SimulationPoint[];
  hazardZones: Array<Pick<SimulationHazardZone, 'centerX' | 'centerY' | 'radius'>>;
  selectedExitIds: number[];
}

export interface EditableHazardZone extends SimulationHazardZone {
  clientId: string;
}
