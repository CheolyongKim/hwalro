import type { DetectedBottleneck } from '../types';

export const MAX_DISPLAYED_BOTTLENECKS = 5;

export function getNextDisplayedBottleneckCount(currentCount: number, totalCount: number): number {
  return Math.min(totalCount, currentCount + MAX_DISPLAYED_BOTTLENECKS);
}

function durationSeconds(bottleneck: DetectedBottleneck) {
  return bottleneck.endTimeSeconds - bottleneck.startTimeSeconds;
}

export function rankBottlenecks(bottlenecks: DetectedBottleneck[]): DetectedBottleneck[] {
  return [...bottlenecks].sort(
    (left, right) =>
      right.peakDensity - left.peakDensity ||
      durationSeconds(right) - durationSeconds(left) ||
      left.startTimeSeconds - right.startTimeSeconds ||
      left.order - right.order ||
      left.id - right.id,
  );
}

export function selectDisplayedBottlenecks(
  bottlenecks: DetectedBottleneck[],
): DetectedBottleneck[] {
  return rankBottlenecks(bottlenecks).slice(0, MAX_DISPLAYED_BOTTLENECKS);
}
