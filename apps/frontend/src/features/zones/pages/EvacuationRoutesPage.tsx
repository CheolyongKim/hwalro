import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Layer, Line, Rect, Stage, Circle } from 'react-konva';
import { Card, EmptyState, ErrorState, PageHeader, buttonClassName } from '../../../components/ui';
import { drawingApi } from '../../drawings/api/drawingApi';
import type { Drawing } from '../../drawings/types/drawing';
import { getDrawingErrorMessage } from '../../drawings/utils/getDrawingErrorMessage';
import { layoutMetadataApi, type LayoutZone } from '../../layout/api/layoutMetadataApi';
import { CANVAS_COLORS } from '../../layout/utils/colors';
import { fitCamera, PX_PER_METER } from '../../layout/utils/geometry';
import { zoneApi, type EvacuationRoute } from '../api/zoneApi';
import { narrowPassageWarning } from '../utils/evacuationStatus';

const VIEW_HEIGHT = 560;

/**
 * 도면 한 장의 모든 구역 대피 동선을 한 화면에서 검토한다.
 *
 * <p>안전 담당자용이다. 어느 구역이 어디로 대피하는지, 담당 비상구가 비어 있어 자동으로 정해진 곳은 어디인지,
 * 경로가 막힌 구역은 없는지를 한눈에 보기 위한 화면이다.
 */
function EvacuationRoutesPage() {
  const { drawingId = '' } = useParams();
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [zones, setZones] = useState<LayoutZone[]>([]);
  const [routes, setRoutes] = useState<EvacuationRoute[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (element === null) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    Promise.all([
      drawingApi.get(Number(drawingId)),
      zoneApi.evacuationRoutes(Number(drawingId)),
      layoutMetadataApi.get(Number(drawingId)),
    ])
      .then(([loadedDrawing, loadedRoutes, metadata]) => {
        if (!active) return;
        setDrawing(loadedDrawing);
        setRoutes(loadedRoutes);
        setZones(metadata.zones);
        setSelectedZoneId(
          loadedRoutes.find((route) => route.status === 'AVAILABLE')?.zoneId ??
            loadedRoutes[0]?.zoneId ??
            null,
        );
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (active) setErrorMessage(getDrawingErrorMessage(error));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [drawingId]);

  const summary = useMemo(() => {
    return {
      total: routes.length,
      assigned: routes.filter((route) => route.exitChoice === 'ASSIGNED').length,
      nearest: routes.filter((route) => route.exitChoice === 'NEAREST').length,
      blocked: routes.filter((route) => route.status !== 'AVAILABLE').length,
    };
  }, [routes]);

  return (
    <main className="bg-background">
      <div className="mx-auto w-full max-w-[1360px] px-1 pt-2 pb-10 sm:px-4 lg:pt-4">
        <div className="border-b border-line pb-6">
          <PageHeader
            eyebrow="대피 계획 검토"
            title="구역별 대피 동선"
            description={drawing?.title ?? ''}
            actions={
              <Link
                to={`/layout/${drawingId}`}
                className={buttonClassName({ variant: 'secondary', size: 'sm' })}
              >
                도면 편집기로
              </Link>
            }
          />
        </div>

        <p className="mt-5 rounded-lg border border-line bg-panel-soft px-4 py-3 text-sm text-text-muted">
          평상시 기준 정적 경로입니다. 통로 폭이 좁을수록 불리하게 계산해 병목이 덜한 길로
          안내합니다.
        </p>

        {isLoading ? (
          <Card className="mt-4">
            <p className="py-10 text-center text-sm text-text-muted">대피 동선을 계산하는 중...</p>
          </Card>
        ) : errorMessage !== null || drawing === null ? (
          <Card className="mt-4">
            <ErrorState
              message={errorMessage ?? '대피 동선을 불러오지 못했습니다.'}
              className="w-full"
            />
          </Card>
        ) : routes.length === 0 ? (
          <Card className="mt-4">
            <EmptyState
              title="구역이 없습니다"
              description="도면 편집기에서 구역을 만들면 구역별 대피 동선을 검토할 수 있습니다."
            />
          </Card>
        ) : (
          <>
            <Card className="mt-4">
              <dl className="grid gap-3 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-text-muted">구역</dt>
                  <dd className="mt-1 text-sm font-bold tabular-nums text-text-strong">
                    {summary.total}개
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">담당 비상구 지정됨</dt>
                  <dd className="mt-1 text-sm font-medium tabular-nums text-text-strong">
                    {summary.assigned}개
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">자동 선택(미지정)</dt>
                  <dd className="mt-1 text-sm font-medium tabular-nums text-text-strong">
                    {summary.nearest}개
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">경로 없음</dt>
                  <dd
                    className={`mt-1 text-sm font-bold tabular-nums ${summary.blocked > 0 ? 'text-danger-strong' : 'text-text-strong'}`}
                  >
                    {summary.blocked}개
                  </dd>
                </div>
              </dl>
            </Card>

            <Card padded={false} className="mt-4 overflow-hidden">
              <div ref={containerRef} className="w-full" style={{ height: VIEW_HEIGHT }}>
                {width > 0 ? (
                  <AllRoutesCanvas
                    drawing={drawing}
                    routes={routes}
                    zones={zones}
                    width={width}
                    selectedZoneId={selectedZoneId}
                  />
                ) : null}
              </div>
            </Card>

            <Card padded={false} className="mt-4 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line bg-surface-elevated/40 text-[11px] font-semibold text-text-muted">
                    <tr>
                      <th className="px-6 py-2">구역</th>
                      <th className="px-4 py-2">안내 비상구</th>
                      <th className="px-4 py-2">선택 방식</th>
                      <th className="px-4 py-2">이동 거리</th>
                      <th className="px-4 py-2">가장 좁은 구간</th>
                      <th className="px-4 py-2">비고</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {routes.map((route) => {
                      const warning = narrowPassageWarning(route.narrowestMeters);
                      const unavailable = route.status !== 'AVAILABLE';
                      return (
                        <tr
                          key={route.zoneId}
                          onClick={() => setSelectedZoneId(route.zoneId)}
                          className={`cursor-pointer transition-colors ${selectedZoneId === route.zoneId ? 'bg-primary-soft/40' : ''}`}
                        >
                          <td className="px-6 py-1.5 font-bold text-text-strong">
                            <button
                              type="button"
                              aria-pressed={selectedZoneId === route.zoneId}
                              onClick={() => setSelectedZoneId(route.zoneId)}
                              className="w-full rounded-md py-1 text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                            >
                              {route.zoneName}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-text-strong">
                            {route.recommendedExitName ?? '-'}
                          </td>
                          <td className="px-4 py-2.5 text-text-muted">
                            {route.exitChoice === 'ASSIGNED'
                              ? '담당 지정'
                              : route.exitChoice === 'NEAREST'
                                ? '자동 선택'
                                : '-'}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-text-strong">
                            {unavailable ? '-' : `${Math.round(route.distanceMeters)}m`}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-text-strong">
                            {unavailable || route.narrowestMeters === null
                              ? '-'
                              : `${(route.narrowestMeters * 2).toFixed(1)}m`}
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {unavailable ? (
                              <span className="font-bold text-danger-strong">경로 없음</span>
                            ) : warning !== null ? (
                              <span className="text-danger-strong">병목 주의</span>
                            ) : (
                              <span className="text-text-muted">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </main>
  );
}

function AllRoutesCanvas({
  drawing,
  routes,
  zones,
  width,
  selectedZoneId,
}: {
  drawing: Drawing;
  routes: EvacuationRoute[];
  zones: LayoutZone[];
  width: number;
  selectedZoneId: number | null;
}) {
  const camera = useMemo(
    () => fitCamera(drawing.width, drawing.height, width, VIEW_HEIGHT),
    [drawing.width, drawing.height, width],
  );
  const k = camera.zoom * PX_PER_METER;
  // 화면에서 value 픽셀로 보이게 하는 도면 좌표 길이. 레이어 배율이 k이므로 zoom이 아니라 k로 나눈다.
  // zoom으로 나누면 PX_PER_METER배 두꺼워져 벽이 도면을 덮어 버린다.
  const s = (value: number) => value / k;
  const selectedRoute = routes.find((route) => route.zoneId === selectedZoneId) ?? null;
  const selectedZone = zones.find((zone) => zone.zoneId === selectedZoneId) ?? null;

  return (
    <Stage width={width} height={VIEW_HEIGHT}>
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
        {selectedZone !== null ? (
          <Rect
            x={selectedZone.rect.x}
            y={selectedZone.rect.y}
            width={selectedZone.rect.width}
            height={selectedZone.rect.height}
            fill={CANVAS_COLORS.zoneSelectedFill}
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
              stroke={CANVAS_COLORS.fabricStroke}
              strokeWidth={s(1)}
            />
          );
        })}
        {drawing.exits.map((exit, index) => {
          const highlighted =
            exit.id !== null &&
            (exit.id === selectedRoute?.recommendedExitId ||
              exit.id === selectedRoute?.defaultExit?.id);
          return (
            <Line
              key={`exit-${index}`}
              points={[exit.startX, exit.startY, exit.endX, exit.endY]}
              stroke={highlighted ? CANVAS_COLORS.exitStrong : CANVAS_COLORS.exit}
              strokeWidth={s(highlighted ? 6 : 4)}
              opacity={highlighted ? 1 : 0.45}
            />
          );
        })}
        {routes.map((route) =>
          route.waypoints.length < 2 ? null : (
            <Line
              key={`route-${route.zoneId}`}
              points={route.waypoints.flatMap((point) => [point.x, point.y])}
              stroke={CANVAS_COLORS.accent}
              strokeWidth={s(selectedZoneId === route.zoneId ? 4 : 1.5)}
              opacity={selectedZoneId === route.zoneId ? 0.95 : 0.12}
              dash={selectedZoneId === route.zoneId ? [s(6), s(4)] : undefined}
              lineCap="round"
              lineJoin="round"
            />
          ),
        )}
        {selectedRoute !== null ? (
          <Circle
            x={selectedRoute.routeOrigin.x}
            y={selectedRoute.routeOrigin.y}
            radius={s(5)}
            fill={selectedRoute.status === 'AVAILABLE' ? CANVAS_COLORS.accent : CANVAS_COLORS.exit}
            stroke={CANVAS_COLORS.canvas}
            strokeWidth={s(2)}
          />
        ) : null}
      </Layer>
    </Stage>
  );
}

export default EvacuationRoutesPage;
