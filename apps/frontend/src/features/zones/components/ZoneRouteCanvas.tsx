import { Circle, Layer, Line, Rect, Stage } from 'react-konva';
import type { Drawing } from '../../drawings/types/drawing';
import type { LayoutZone } from '../../layout/api/layoutMetadataApi';
import { CANVAS_COLORS } from '../../layout/utils/colors';
import { PX_PER_METER } from '../../layout/utils/geometry';
import type { EvacuationRoute } from '../api/zoneApi';
import { useCanvasCamera } from '../hooks/useCanvasCamera';
import { exitColorOf } from '../utils/exitColors';

/**
 * 선택한 구역 하나의 대피 동선을 그린다.
 *
 * 모든 구역의 경로를 흐리게 겹쳐 두면 도면이 실타래처럼 보여 정작 보려던 구역의 경로를 읽기 어렵다.
 * 구역에 담당 비상구가 없어 자리마다 나가는 곳이 갈리는 경우에는 갈래 경로를 비상구 색으로 구분한다.
 */
export function ZoneRouteCanvas({
  drawing,
  route,
  zone,
  exitIds,
  width,
  height,
}: {
  drawing: Drawing;
  route: EvacuationRoute | null;
  zone: LayoutZone | null;
  exitIds: readonly number[];
  width: number;
  height: number;
}) {
  const { camera, isPanning, onWheel, startPan, movePan, endPan, fit } = useCanvasCamera({
    docWidth: drawing.width,
    docHeight: drawing.height,
    viewWidth: width,
    viewHeight: height,
    fitKey: drawing.id,
  });
  const k = camera.zoom * PX_PER_METER;
  // 화면에서 value 픽셀로 보이게 하는 도면 좌표 길이. 레이어 배율이 k이므로 zoom이 아니라 k로 나눈다.
  const s = (value: number) => value / k;
  const partitions = route?.partitions ?? [];
  const split = partitions.length > 1;

  return (
    <>
      {/* 캔버스 위에 덮는 조작 판. Konva 노드에 리스너를 다는 것보다 단순하고, 도형 위 어디서나 잡힌다. */}
      <div
        data-testid="camera-surface"
        className={`absolute inset-0 z-10 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onWheel={onWheel}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          startPan({ x: event.clientX, y: event.clientY });
        }}
        onPointerMove={(event) => movePan({ x: event.clientX, y: event.clientY })}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      />
      <button
        type="button"
        onClick={fit}
        className="absolute right-3 top-3 z-20 rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-bold text-text-strong shadow-sm transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        전체 보기
      </button>
      <Stage width={width} height={height}>
        <Layer listening={false} x={-camera.panX * k} y={-camera.panY * k} scaleX={k} scaleY={k}>
          <Rect
            x={0}
            y={0}
            width={drawing.width}
            height={drawing.height}
            fill={CANVAS_COLORS.canvas}
            stroke={CANVAS_COLORS.gridBoundary}
            strokeWidth={s(1)}
          />
          {zone !== null ? (
            <Rect
              x={zone.rect.x}
              y={zone.rect.y}
              width={zone.rect.width}
              height={zone.rect.height}
              fill={split ? undefined : CANVAS_COLORS.zoneSelectedFill}
              stroke={CANVAS_COLORS.zoneStroke}
              strokeWidth={s(2)}
              dash={[s(6), s(4)]}
            />
          ) : null}
          {drawing.outsideWalls.map((wall, index) => (
            <Line
              key={`outside-${index}`}
              points={[wall.startX, wall.startY, wall.endX, wall.endY]}
              stroke={CANVAS_COLORS.outsideWall}
              strokeWidth={s(3)}
            />
          ))}
          {drawing.walls.map((wall, index) => (
            <Line
              key={`wall-${index}`}
              points={[wall.startX, wall.startY, wall.endX, wall.endY]}
              stroke={CANVAS_COLORS.ink}
              strokeWidth={s(2)}
            />
          ))}
          {drawing.pillars.map((pillar, index) => {
            const pillarWidth = Math.abs(pillar.endX - pillar.startX);
            const pillarHeight = Math.abs(pillar.endY - pillar.startY);
            return (
              <Rect
                key={`pillar-${index}`}
                x={(pillar.startX + pillar.endX) / 2}
                y={(pillar.startY + pillar.endY) / 2}
                width={pillarWidth}
                height={pillarHeight}
                offsetX={pillarWidth / 2}
                offsetY={pillarHeight / 2}
                rotation={pillar.rotation}
                fill={CANVAS_COLORS.pillarFill}
              />
            );
          })}
          {drawing.fabrics.map((fabric, index) => {
            const fabricWidth = Math.abs(fabric.endX - fabric.startX);
            const fabricHeight = Math.abs(fabric.endY - fabric.startY);
            return (
              <Rect
                key={`fabric-${index}`}
                x={(fabric.startX + fabric.endX) / 2}
                y={(fabric.startY + fabric.endY) / 2}
                width={fabricWidth}
                height={fabricHeight}
                offsetX={fabricWidth / 2}
                offsetY={fabricHeight / 2}
                rotation={fabric.rotation}
                fill={CANVAS_COLORS.fabricFill}
              />
            );
          })}
          {drawing.exits.map((exit, index) => (
            <Line
              key={`exit-${index}`}
              points={[exit.startX, exit.startY, exit.endX, exit.endY]}
              stroke={CANVAS_COLORS.exit}
              strokeWidth={s(4)}
            />
          ))}
          {split
            ? partitions.map((partition) =>
                partition.waypoints.length < 2 ? null : (
                  <Line
                    key={`route-${partition.exitId}`}
                    points={partition.waypoints.flatMap((point) => [point.x, point.y])}
                    stroke={exitColorOf(partition.exitId, exitIds)}
                    strokeWidth={s(3)}
                    lineCap="round"
                    lineJoin="round"
                  />
                ),
              )
            : null}
          {!split && route !== null && route.waypoints.length >= 2 ? (
            <Line
              points={route.waypoints.flatMap((point) => [point.x, point.y])}
              stroke={CANVAS_COLORS.accent}
              strokeWidth={s(3)}
              lineCap="round"
              lineJoin="round"
            />
          ) : null}
          {route !== null ? (
            <Circle
              x={route.routeOrigin.x}
              y={route.routeOrigin.y}
              radius={s(5)}
              fill={CANVAS_COLORS.accent}
            />
          ) : null}
        </Layer>
      </Stage>
    </>
  );
}
