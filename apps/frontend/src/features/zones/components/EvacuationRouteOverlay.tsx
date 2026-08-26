import { useEffect, useMemo, useRef } from 'react';
import type Konva from 'konva';
import { Circle, Group, Line } from 'react-konva';
import type { EvacuationRoute, RoutePoint } from '../api/zoneApi';
import { CANVAS_COLORS } from '../../layout/utils/colors';

interface EvacuationRouteOverlayProps {
  routes: readonly EvacuationRoute[];
  exitIds?: readonly number[];
  scale: (pixels: number) => number;
}

interface Segment {
  start: RoutePoint;
  end: RoutePoint;
  length: number;
  angle: number;
  accumulatedStart: number;
}

interface PathData {
  key: string;
  waypoints: RoutePoint[];
  segments: Segment[];
  totalLength: number;
}

function interpolatePoint(
  segments: Segment[],
  totalLength: number,
  dist: number,
): { x: number; y: number; angle: number } | null {
  if (segments.length === 0 || totalLength <= 0) return null;
  const wrapped = ((dist % totalLength) + totalLength) % totalLength;

  for (const seg of segments) {
    if (wrapped >= seg.accumulatedStart && wrapped <= seg.accumulatedStart + seg.length) {
      const t = seg.length > 0 ? (wrapped - seg.accumulatedStart) / seg.length : 0;
      return {
        x: seg.start.x + (seg.end.x - seg.start.x) * t,
        y: seg.start.y + (seg.end.y - seg.start.y) * t,
        angle: seg.angle,
      };
    }
  }
  const last = segments[segments.length - 1];
  return { x: last.end.x, y: last.end.y, angle: last.angle };
}

export function EvacuationRouteOverlay({ routes, scale }: EvacuationRouteOverlayProps) {
  const markerGroupRef = useRef<Konva.Group>(null);
  const arrowRefs = useRef<Map<string, Konva.Line>>(new Map());

  const paths: PathData[] = useMemo(() => {
    return routes.flatMap((route) => {
      const branches =
        route.partitions.length > 0
          ? route.partitions.map((partition) => ({
              key: `${route.zoneId}-${partition.exitId}`,
              waypoints: partition.waypoints,
            }))
          : [
              {
                key: `${route.zoneId}-${route.recommendedExitId ?? 'none'}`,
                waypoints: route.waypoints,
              },
            ];

      return branches
        .filter((branch) => branch.waypoints.length >= 2)
        .map((branch) => {
          let accumulated = 0;
          const segments: Segment[] = [];
          for (let i = 0; i < branch.waypoints.length - 1; i++) {
            const p1 = branch.waypoints[i];
            const p2 = branch.waypoints[i + 1];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const length = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);
            segments.push({
              start: p1,
              end: p2,
              length,
              angle,
              accumulatedStart: accumulated,
            });
            accumulated += length;
          }
          return {
            key: branch.key,
            waypoints: branch.waypoints,
            segments,
            totalLength: accumulated,
          };
        });
    });
  }, [routes]);

  // 화살표 펄스 위치 업데이트 애니메이션
  useEffect(() => {
    if (paths.length === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    let frame = 0;
    const speed = scale(32); // 초당 32px 속도로 자연스러운 흐름
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsedSec = (now - startTime) / 1000;
      const offset = elapsedSec * speed;

      paths.forEach((path) => {
        const step = scale(40); // 40px 간격으로 화살표 배치
        const count = Math.max(1, Math.floor(path.totalLength / step));

        for (let i = 0; i < count; i++) {
          const arrowKey = `${path.key}-arrow-${i}`;
          const node = arrowRefs.current.get(arrowKey);
          if (!node) continue;

          const dist = (i * (path.totalLength / count) + offset) % path.totalLength;
          const pos = interpolatePoint(path.segments, path.totalLength, dist);
          if (pos) {
            node.position({ x: pos.x, y: pos.y });
            node.rotation((pos.angle * 180) / Math.PI);
            node.visible(true);
          }
        }
      });

      markerGroupRef.current?.getLayer()?.batchDraw();
      frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [paths, scale]);

  const registerArrow = (key: string) => (node: Konva.Line | null) => {
    if (node === null) arrowRefs.current.delete(key);
    else arrowRefs.current.set(key, node);
  };

  const arrowSize = scale(6);

  return (
    <Group listening={false}>
      {paths.map((path) => {
        const firstPoint = path.waypoints[0];
        const lastPoint = path.waypoints[path.waypoints.length - 1];
        const step = scale(40);
        const arrowCount = Math.max(1, Math.floor(path.totalLength / step));

        return (
          <Group key={path.key}>
            {/* 1. 은은한 배경 글로우 라인 */}
            <Line
              points={path.waypoints.flatMap((p) => [p.x, p.y])}
              stroke={CANVAS_COLORS.accent}
              strokeWidth={scale(8)}
              opacity={0.18}
              lineCap="round"
              lineJoin="round"
            />
            {/* 2. 본체 솔리드 가이드 라인 (가만히 있는 깔끔한 메인 선) */}
            <Line
              name="evacuation-route-line"
              points={path.waypoints.flatMap((p) => [p.x, p.y])}
              stroke={CANVAS_COLORS.accent}
              strokeWidth={scale(3)}
              opacity={0.9}
              lineCap="round"
              lineJoin="round"
            />
            {/* 3. 출발점 표시 (원형 앵커) */}
            <Circle
              x={firstPoint.x}
              y={firstPoint.y}
              radius={scale(4.5)}
              fill={CANVAS_COLORS.accent}
              stroke="#ffffff"
              strokeWidth={scale(1.5)}
            />
            {/* 4. 도착점 표시 (비상구 연결 펄스 포인트) */}
            <Circle
              x={lastPoint.x}
              y={lastPoint.y}
              radius={scale(5.5)}
              fill="#ffffff"
              stroke={CANVAS_COLORS.accent}
              strokeWidth={scale(2.5)}
            />
            {/* 5. 방향 화살표 마커들 (선 위를 따라 부드럽게 전진하는 Chevron 화살표) */}
            <Group ref={markerGroupRef}>
              {Array.from({ length: arrowCount }, (_, idx) => {
                const arrowKey = `${path.key}-arrow-${idx}`;
                return (
                  <Line
                    key={arrowKey}
                    ref={registerArrow(arrowKey)}
                    points={[-arrowSize, -arrowSize, 0, 0, -arrowSize, arrowSize]}
                    stroke="#ffffff"
                    strokeWidth={scale(2)}
                    lineCap="round"
                    lineJoin="round"
                    opacity={0.95}
                  />
                );
              })}
            </Group>
          </Group>
        );
      })}
    </Group>
  );
}
