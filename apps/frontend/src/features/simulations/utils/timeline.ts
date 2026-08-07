import type { SimulationPoint, SimulationTimelineFrame, TimelineAgent } from '../types';

function toPoint(agent: TimelineAgent): SimulationPoint {
  return { x: agent[1], y: agent[2] };
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
  const nextById = new Map(next.agents.map((agent) => [agent[0], agent]));

  return previous.agents.map((agent) => {
    const target = nextById.get(agent[0]);
    if (!target) return toPoint(agent);
    return {
      x: agent[1] + (target[1] - agent[1]) * ratio,
      y: agent[2] + (target[2] - agent[2]) * ratio,
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
