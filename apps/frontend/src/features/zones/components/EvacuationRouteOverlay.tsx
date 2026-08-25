import { useEffect, useRef } from 'react';
import type Konva from 'konva';
import { Group, Line } from 'react-konva';
import type { EvacuationRoute } from '../api/zoneApi';
import { exitColorOf } from '../utils/exitColors';

interface EvacuationRouteOverlayProps {
  routes: readonly EvacuationRoute[];
  exitIds: readonly number[];
  scale: (pixels: number) => number;
}

export function EvacuationRouteOverlay({ routes, exitIds, scale }: EvacuationRouteOverlayProps) {
  const lineRefs = useRef(new Map<string, Konva.Line>());

  useEffect(() => {
    if (routes.length === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return;
    let frame = 0;
    let previousTime = performance.now();
    const animate = (time: number) => {
      const distance = ((time - previousTime) / 1000) * scale(18);
      previousTime = time;
      for (const line of lineRefs.current.values()) {
        line.dashOffset(line.dashOffset() - distance);
      }
      lineRefs.current.values().next().value?.getLayer()?.batchDraw();
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [routes, scale]);

  const registerLine = (key: string) => (node: Konva.Line | null) => {
    if (node === null) lineRefs.current.delete(key);
    else lineRefs.current.set(key, node);
  };

  return (
    <Group listening={false}>
      {routes.flatMap((route) => {
        const branches =
          route.partitions.length > 0
            ? route.partitions.map((partition) => ({
                key: `${route.zoneId}-${partition.exitId}`,
                exitId: partition.exitId,
                waypoints: partition.waypoints,
              }))
            : [
                {
                  key: `${route.zoneId}-${route.recommendedExitId ?? 'none'}`,
                  exitId: route.recommendedExitId,
                  waypoints: route.waypoints,
                },
              ];
        return branches.map((branch) =>
          branch.exitId === null || branch.waypoints.length < 2 ? null : (
            <Line
              key={branch.key}
              ref={registerLine(branch.key)}
              name="evacuation-route-line"
              points={branch.waypoints.flatMap((point) => [point.x, point.y])}
              stroke={exitColorOf(branch.exitId, exitIds)}
              strokeWidth={scale(8)}
              dash={[scale(8), scale(6)]}
              lineCap="round"
              lineJoin="round"
            />
          ),
        );
      })}
    </Group>
  );
}
