import { describe, expect, it } from 'vitest';
import {
  executionPollDelay,
  findTimelineFrames,
  interpolateTimeline,
  timelineChunkWindow,
} from './timeline';

describe('simulation timeline', () => {
  const frames = [
    {
      frameIndex: 0,
      timeSeconds: 0,
      activeAgentCount: 1,
      evacuatedCount: 0,
      agents: [{ agentId: 7, x: 0, y: 0 }],
    },
    {
      frameIndex: 1,
      timeSeconds: 1,
      activeAgentCount: 1,
      evacuatedCount: 0,
      agents: [{ agentId: 7, x: 2, y: 4 }],
    },
  ];

  it('finds adjacent frames and interpolates agent positions', () => {
    const [previous, next] = findTimelineFrames(frames, 0.25);
    expect(previous).toBe(frames[0]);
    expect(next).toBe(frames[1]);
    expect(interpolateTimeline(previous!, next, 0.25)).toEqual([{ x: 0.5, y: 1 }]);
  });

  it('keeps an agent until the frame where it leaves the simulation', () => {
    expect(
      interpolateTimeline(
        frames[0],
        {
          frameIndex: 1,
          timeSeconds: 1,
          activeAgentCount: 0,
          evacuatedCount: 1,
          agents: [],
        },
        0.5,
      ),
    ).toEqual([{ x: 0, y: 0 }]);
  });

  it('backs off polling and keeps only adjacent timeline chunks', () => {
    expect([1, 2, 3, 4, 5].map(executionPollDelay)).toEqual([1000, 2000, 4000, 8000, 8000]);
    expect(timelineChunkWindow(0, 5)).toEqual([0, 1]);
    expect(timelineChunkWindow(2, 5)).toEqual([1, 2, 3]);
    expect(timelineChunkWindow(4, 5)).toEqual([3, 4]);
  });
});
