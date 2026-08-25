import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, EmptyState, ErrorState, PageHeader, buttonClassName } from '../../../components/ui';
import { drawingApi } from '../../drawings/api/drawingApi';
import type { Drawing } from '../../drawings/types/drawing';
import { getDrawingErrorMessage } from '../../drawings/utils/getDrawingErrorMessage';
import { layoutMetadataApi, type LayoutZone } from '../../layout/api/layoutMetadataApi';
import { zoneApi, type EvacuationRoute } from '../api/zoneApi';
import { narrowPassageWarning } from '../utils/evacuationStatus';
import { exitColorOf } from '../utils/exitColors';
import { ZoneRouteCanvas } from '../components/ZoneRouteCanvas';

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
  const observerRef = useRef<ResizeObserver | null>(null);
  const [width, setWidth] = useState(0);

  /**
   * 캔버스 자리는 로딩이 끝난 뒤에야 DOM에 붙는다. useEffect로 관찰을 걸면 이펙트가 도는 시점에
   * 아직 그 자리가 없어 관찰이 아예 시작되지 않고, 폭이 0으로 남아 도면이 통째로 보이지 않는다.
   * 붙고 떨어지는 순간에 직접 반응하는 콜백 ref를 쓴다 - 의존성 목록을 조건부 렌더와 맞춰 관리할
   * 필요가 없다.
   */
  const attachContainer = useCallback((element: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    if (element === null) {
      observerRef.current = null;
      return;
    }
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(element);
    observerRef.current = observer;
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

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

  // 색은 도면 안에서 몇 번째 비상구인지로 정한다. 저장할 때마다 ID가 새로 매겨지므로 ID를 직접 쓰면
  // 색이 통째로 바뀐다.
  const exitIds = useMemo(
    () =>
      (drawing?.exits ?? [])
        .map((exit) => exit.id)
        .filter((id): id is number => typeof id === 'number'),
    [drawing],
  );
  const selectedRoute = useMemo(
    () => routes.find((route) => route.zoneId === selectedZoneId) ?? null,
    [routes, selectedZoneId],
  );
  const selectedZone = useMemo(
    () => zones.find((zone) => zone.zoneId === selectedZoneId) ?? null,
    [zones, selectedZoneId],
  );

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

            {/* 도면과 목록을 좌우로 나눈다. 목록이 도면 아래에 있으면 구역을 고를 때마다 스크롤해야 한다. */}
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <Card padded={false} className="overflow-hidden">
                <div
                  ref={attachContainer}
                  className="relative w-full"
                  style={{ height: VIEW_HEIGHT }}
                >
                  {width > 0 ? (
                    <ZoneRouteCanvas
                      drawing={drawing}
                      route={selectedRoute}
                      zone={selectedZone}
                      exitIds={exitIds}
                      width={width}
                      height={VIEW_HEIGHT}
                    />
                  ) : null}
                </div>
              </Card>

              <Card padded={false} className="flex flex-col overflow-hidden">
                <div className="border-b border-line px-4 py-3">
                  <h2 className="text-sm font-bold text-text-strong">구역 목록</h2>
                  <p className="mt-0.5 text-xs text-text-muted">
                    구역을 고르면 그 구역의 대피 동선만 도면에 표시됩니다.
                  </p>
                </div>
                <ul
                  className="divide-y divide-line overflow-y-auto"
                  style={{ maxHeight: VIEW_HEIGHT - 58 }}
                >
                  {routes.map((route) => {
                    const warning = narrowPassageWarning(route.narrowestMeters);
                    const unavailable = route.status !== 'AVAILABLE';
                    const selected = selectedZoneId === route.zoneId;
                    return (
                      <li key={route.zoneId}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setSelectedZoneId(route.zoneId)}
                          className={`w-full px-4 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring ${
                            selected ? 'bg-primary-soft/50' : 'hover:bg-primary-soft/25'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-bold text-text-strong">
                              {route.zoneName}
                            </span>
                            {unavailable ? (
                              <span className="shrink-0 text-[11px] font-bold text-danger-strong">
                                경로 없음
                              </span>
                            ) : (
                              <span className="shrink-0 text-[11px] tabular-nums text-text-muted">
                                {Math.round(route.distanceMeters)}m
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted">
                            {unavailable ? null : (
                              <span
                                aria-hidden
                                className="inline-block h-2 w-2 shrink-0 rounded-full"
                                style={{
                                  backgroundColor:
                                    route.recommendedExitId === null
                                      ? 'transparent'
                                      : exitColorOf(route.recommendedExitId, exitIds),
                                }}
                              />
                            )}
                            <span className="truncate">
                              {route.recommendedExitName ?? '안내할 비상구 없음'}
                              {route.partitions.length > 1
                                ? ` 외 ${route.partitions.length - 1}곳으로 분산`
                                : ''}
                            </span>
                            {warning !== null && !unavailable ? (
                              <span className="shrink-0 font-bold text-danger-strong">병목</span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>

            {selectedRoute !== null && selectedRoute.partitions.length > 1 ? (
              <Card className="mt-4">
                <h2 className="text-sm font-bold text-text-strong">
                  {selectedRoute.zoneName} - 비상구가 갈리는 영역 {selectedRoute.partitions.length}
                  곳
                </h2>
                <p className="mt-1 text-xs text-text-muted">
                  이 구역에는 담당 비상구가 지정되어 있지 않아, 자리마다 가장 빨리 닿는 비상구가
                  다릅니다. 도면의 색과 아래 목록의 색이 같습니다.
                </p>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedRoute.partitions.map((partition) => (
                    <li
                      key={partition.exitId}
                      className="flex items-center gap-2 rounded-lg border border-line px-3 py-2"
                    >
                      <span
                        aria-hidden
                        className="inline-block h-3 w-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: exitColorOf(partition.exitId, exitIds) }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-text-strong">
                        {partition.exitName}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-text-muted">
                        {Math.round(partition.distanceMeters)}m
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

export default EvacuationRoutesPage;
