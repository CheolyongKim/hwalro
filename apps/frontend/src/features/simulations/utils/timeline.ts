import type { SimulationPoint, SimulationTimelineFrame, TimelineAgent } from '../types';

export const MAX_EXECUTION_POLL_FAILURES = 5;

export function executionPollDelay(failureCount: number): number {
  return Math.min(8_000, 1_000 * 2 ** Math.max(0, failureCount - 1));
}

export function timelineChunkWindow(current: number, count: number): number[] {
  return [current - 1, current, current + 1].filter(
    (sequence) => sequence >= 0 && sequence < count,
  );
}

function toPoint(agent: TimelineAgent): SimulationPoint {
  return { x: agent.x, y: agent.y };
}

export function interpolateTimeline(
  previous: SimulationTimelineFrame,
  next: SimulationTimelineFrame | undefined,
  timeSeconds: number,
): SimulationPoint[] {
  if (!next || next.timeSeconds <= previous.timeSeconds) {
    return previous.agents.map(toPoint);
  }

  const ratio = Math.min(
    1,
    Math.max(0, (timeSeconds - previous.timeSeconds) / (next.timeSeconds - previous.timeSeconds)),
  );
  const nextById = new Map(next.agents.map((agent) => [agent.agentId, agent]));

  return previous.agents.map((agent) => {
    const target = nextById.get(agent.agentId);
    if (!target) return toPoint(agent);
    return {
      x: agent.x + (target.x - agent.x) * ratio,
      y: agent.y + (target.y - agent.y) * ratio,
    };
  });
}

export function findTimelineFrames(
  frames: SimulationTimelineFrame[],
  timeSeconds: number,
): [SimulationTimelineFrame | undefined, SimulationTimelineFrame | undefined] {
  if (frames.length === 0) return [undefined, undefined];
  const nextIndex = frames.findIndex((frame) => frame.timeSeconds > timeSeconds);
  if (nextIndex === -1) return [frames[frames.length - 1], undefined];
  if (nextIndex === 0) return [frames[0], frames[1]];
  return [frames[nextIndex - 1], frames[nextIndex]];
}
