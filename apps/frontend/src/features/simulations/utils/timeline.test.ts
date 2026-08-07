import { describe, expect, it } from 'vitest';
import { findTimelineFrames, interpolateTimeline } from './timeline';

describe('simulation timeline', () => {
  const frames = [
    { timeSeconds: 0, agents: [[7, 0, 0] as [number, number, number]] },
    { timeSeconds: 1, agents: [[7, 2, 4] as [number, number, number]] },
  ];

  it('finds adjacent frames and interpolates agent positions', () => {
    const [previous, next] = findTimelineFrames(frames, 0.25);
    expect(previous).toBe(frames[0]);
    expect(next).toBe(frames[1]);
    expect(interpolateTimeline(previous!, next, 0.25)).toEqual([{ x: 0.5, y: 1 }]);
  });

  it('keeps an agent until the frame where it leaves the simulation', () => {
    expect(interpolateTimeline(frames[0], { timeSeconds: 1, agents: [] }, 0.5)).toEqual([
      { x: 0, y: 0 },
    ]);
  });
});
