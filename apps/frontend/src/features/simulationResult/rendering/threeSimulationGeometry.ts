import type { Bounds, DrawingRect, DrawingSegment, Point } from '../types';

export interface ScenePoint {
  x: number;
  z: number;
}

export interface EscalatorPlacement extends ScenePoint {
  length: number;
  width: number;
  rotationY: number;
}

export interface ExitPortalPlacement extends ScenePoint {
  width: number;
  rotationY: number;
  postWidth: number;
  postOffset: number;
  openingWidth: number;
}

export function worldToScene(
  x: number,
  y: number,
  worldWidth: number,
  worldHeight: number,
): ScenePoint {
  return { x: x - worldWidth / 2, z: y - worldHeight / 2 };
}

export function segmentTransform(segment: DrawingSegment, worldWidth: number, worldHeight: number) {
  const start = worldToScene(segment.startX, segment.startY, worldWidth, worldHeight);
  const end = worldToScene(segment.endX, segment.endY, worldWidth, worldHeight);
  return {
    x: (start.x + end.x) / 2,
    z: (start.z + end.z) / 2,
    length: Math.hypot(end.x - start.x, end.z - start.z),
    rotationY: -Math.atan2(end.z - start.z, end.x - start.x),
  };
}

export function exitPortalPlacement(
  exit: DrawingSegment,
  worldWidth: number,
  worldHeight: number,
): ExitPortalPlacement {
  const transform = segmentTransform(exit, worldWidth, worldHeight);
  const width = Math.max(0.4, transform.length);
  const postWidth = Math.min(0.28, Math.max(0.14, width * 0.12));
  const postOffset = Math.max(0, width / 2 - postWidth / 2);

  return {
    x: transform.x,
    z: transform.z,
    width,
    rotationY: transform.rotationY,
    postWidth,
    postOffset,
    openingWidth: Math.max(0.12, width - postWidth * 2),
  };
}

export function boundsTransform(bounds: Bounds, worldWidth: number, worldHeight: number) {
  const center = worldToScene(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
    worldWidth,
    worldHeight,
  );
  return {
    ...center,
    width: Math.max(0.01, Math.abs(bounds.width)),
    depth: Math.max(0.01, Math.abs(bounds.height)),
  };
}

export function isEscalatorLabel(text: string) {
  return text.toUpperCase().replace(/[\s/]/g, '') === 'ES';
}

export function drawingRectContainsPoint(rectangle: DrawingRect, point: Point) {
  const centerX = (rectangle.startX + rectangle.endX) / 2;
  const centerY = (rectangle.startY + rectangle.endY) / 2;
  const halfWidth = Math.abs(rectangle.endX - rectangle.startX) / 2;
  const halfHeight = Math.abs(rectangle.endY - rectangle.startY) / 2;
  const angle = -((rectangle.rotation ?? 0) * Math.PI) / 180;
  const deltaX = point.x - centerX;
  const deltaY = point.y - centerY;
  const localX = deltaX * Math.cos(angle) - deltaY * Math.sin(angle);
  const localY = deltaX * Math.sin(angle) + deltaY * Math.cos(angle);
  const tolerance = 0.001;
  return Math.abs(localX) <= halfWidth + tolerance && Math.abs(localY) <= halfHeight + tolerance;
}

export function escalatorPlacementFromRect(
  rectangle: DrawingRect,
  worldWidth: number,
  worldHeight: number,
): EscalatorPlacement {
  const rectangleWidth = Math.max(0.2, Math.abs(rectangle.endX - rectangle.startX));
  const rectangleHeight = Math.max(0.2, Math.abs(rectangle.endY - rectangle.startY));
  const center = worldToScene(
    (rectangle.startX + rectangle.endX) / 2,
    (rectangle.startY + rectangle.endY) / 2,
    worldWidth,
    worldHeight,
  );
  return {
    ...center,
    length: Math.max(rectangleWidth, rectangleHeight),
    width: Math.min(rectangleWidth, rectangleHeight),
    rotationY:
      -((rectangle.rotation ?? 0) * Math.PI) / 180 -
      (rectangleHeight > rectangleWidth ? Math.PI / 2 : 0),
  };
}

export function escalatorRunElevation(progress: number, direction: 1 | -1, rise: number) {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  return rise * (direction === 1 ? clampedProgress : 1 - clampedProgress);
}

export function createBoundarySegments(points: Point[]): DrawingSegment[] {
  if (points.length < 2) return [];
  return points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return {
      name: `outside-wall-${index}`,
      startX: point.x,
      startY: point.y,
      endX: next.x,
      endY: next.y,
    };
  });
}

function pointDistanceToLine(point: Point, segment: DrawingSegment) {
  const deltaX = segment.endX - segment.startX;
  const deltaY = segment.endY - segment.startY;
  const length = Math.hypot(deltaX, deltaY);
  if (length === 0) return Number.POSITIVE_INFINITY;
  return (
    Math.abs(
      deltaY * point.x -
        deltaX * point.y +
        segment.endX * segment.startY -
        segment.endY * segment.startX,
    ) / length
  );
}

function isParallelToSegment(first: DrawingSegment, second: DrawingSegment) {
  const firstX = first.endX - first.startX;
  const firstY = first.endY - first.startY;
  const secondX = second.endX - second.startX;
  const secondY = second.endY - second.startY;
  const firstLength = Math.hypot(firstX, firstY);
  const secondLength = Math.hypot(secondX, secondY);
  if (firstLength === 0 || secondLength === 0) return false;
  return Math.abs((firstX * secondX + firstY * secondY) / (firstLength * secondLength)) >= 0.9;
}

function overlapsSegmentProjection(exit: DrawingSegment, segment: DrawingSegment) {
  const deltaX = segment.endX - segment.startX;
  const deltaY = segment.endY - segment.startY;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared === 0) return false;
  const project = (x: number, y: number) =>
    ((x - segment.startX) * deltaX + (y - segment.startY) * deltaY) / lengthSquared;
  const start = Math.min(project(exit.startX, exit.startY), project(exit.endX, exit.endY));
  const end = Math.max(project(exit.startX, exit.startY), project(exit.endX, exit.endY));
  return Math.min(1, end) - Math.max(0, start) > 0.001;
}

const MAX_BOUNDARY_EXIT_OFFSET = 2;

export function splitBoundarySegmentsAtExits(
  segments: DrawingSegment[],
  exits: DrawingSegment[],
) {
  const exitsBySegment = new Map<DrawingSegment, DrawingSegment[]>();

  for (const exit of exits) {
    const midpoint = {
      x: (exit.startX + exit.endX) / 2,
      y: (exit.startY + exit.endY) / 2,
    };
    const nearestCandidate = segments
      .filter(
        (segment) => isParallelToSegment(exit, segment) && overlapsSegmentProjection(exit, segment),
      )
      .map((segment) => ({ segment, distance: pointDistanceToLine(midpoint, segment) }))
      .sort((first, second) => first.distance - second.distance)[0];
    if (!nearestCandidate || nearestCandidate.distance > MAX_BOUNDARY_EXIT_OFFSET) continue;
    const nearestSegment = nearestCandidate.segment;
    const assignedExits = exitsBySegment.get(nearestSegment) ?? [];
    assignedExits.push(exit);
    exitsBySegment.set(nearestSegment, assignedExits);
  }

  return segments.flatMap((segment) =>
    splitBoundarySegmentAtExits(
      segment,
      exitsBySegment.get(segment) ?? [],
      MAX_BOUNDARY_EXIT_OFFSET,
    ),
  );
}

export function splitBoundarySegmentAtExits(
  segment: DrawingSegment,
  exits: DrawingSegment[],
  tolerance = 0.45,
): DrawingSegment[] {
  const deltaX = segment.endX - segment.startX;
  const deltaY = segment.endY - segment.startY;
  const lengthSquared = deltaX * deltaX + deltaY * deltaY;
  if (lengthSquared === 0) return [];

  const openingRanges = exits
    .filter(
      (exit) =>
        pointDistanceToLine({ x: exit.startX, y: exit.startY }, segment) <= tolerance &&
        pointDistanceToLine({ x: exit.endX, y: exit.endY }, segment) <= tolerance,
    )
    .map((exit) => {
      const project = (x: number, y: number) =>
        ((x - segment.startX) * deltaX + (y - segment.startY) * deltaY) / lengthSquared;
      return [
        Math.max(0, Math.min(project(exit.startX, exit.startY), project(exit.endX, exit.endY))),
        Math.min(1, Math.max(project(exit.startX, exit.startY), project(exit.endX, exit.endY))),
      ] as const;
    })
    .filter(([start, end]) => end - start > 0.001)
    .sort(([firstStart], [secondStart]) => firstStart - secondStart);

  const mergedRanges: Array<[number, number]> = [];
  for (const [start, end] of openingRanges) {
    const previous = mergedRanges[mergedRanges.length - 1];
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else mergedRanges.push([start, end]);
  }

  const wallRanges: Array<[number, number]> = [];
  let cursor = 0;
  for (const [start, end] of mergedRanges) {
    if (start - cursor > 0.001) wallRanges.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (1 - cursor > 0.001) wallRanges.push([cursor, 1]);

  return wallRanges.map(([start, end], index) => ({
    name: `${segment.name}-part-${index}`,
    startX: segment.startX + deltaX * start,
    startY: segment.startY + deltaY * start,
    endX: segment.startX + deltaX * end,
    endY: segment.startY + deltaY * end,
  }));
}
