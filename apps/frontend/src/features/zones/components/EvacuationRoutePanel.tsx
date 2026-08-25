import type { LayoutZone } from '../../layout/api/layoutMetadataApi';

interface EvacuationRoutePanelProps {
  zones: readonly LayoutZone[];
  enabledZoneIds: ReadonlySet<number>;
  loading: boolean;
  errorMessage: string | null;
  onToggle: (zoneId: number) => void;
  onToggleAll: (enabled: boolean) => void;
}

export function EvacuationRoutePanel({
  zones,
  enabledZoneIds,
  loading,
  errorMessage,
  onToggle,
  onToggleAll,
}: EvacuationRoutePanelProps) {
  const allEnabled = zones.length > 0 && zones.every((zone) => enabledZoneIds.has(zone.zoneId));

  return (
    <section
      className="border-b border-panel-divider px-3 py-3"
      aria-labelledby="evacuation-route-title"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h3 id="evacuation-route-title" className="text-sm font-bold text-panel-text">
            대피 동선
          </h3>
          <p className="mt-1 text-xs text-panel-muted">검토할 구역의 경로만 도면에 표시합니다.</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md border border-panel-divider px-2 py-1 text-xs font-bold text-panel-text hover:border-panel-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          onClick={() => onToggleAll(!allEnabled)}
          disabled={zones.length === 0}
        >
          {allEnabled ? '전체 끄기' : '전체 켜기'}
        </button>
      </div>
      {loading ? (
        <p className="py-2 text-xs text-panel-muted" role="status">
          대피 동선을 계산하고 있습니다.
        </p>
      ) : null}
      {errorMessage !== null ? (
        <p
          className="rounded-md border border-danger/40 bg-panel-soft px-2 py-2 text-xs text-danger"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
      {zones.length === 0 ? (
        <p className="py-2 text-xs text-panel-muted">표시할 구역이 없습니다.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {zones.map((zone) => (
            <li key={zone.zoneId}>
              <label className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-panel-text hover:bg-panel-soft">
                <input
                  type="checkbox"
                  className="size-4 accent-panel-accent"
                  checked={enabledZoneIds.has(zone.zoneId)}
                  onChange={() => onToggle(zone.zoneId)}
                />
                <span className="truncate">{zone.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
