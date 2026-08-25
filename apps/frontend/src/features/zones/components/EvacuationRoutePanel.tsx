import type { LayoutZone } from '../../layout/api/layoutMetadataApi';

interface EvacuationRoutePanelProps {
  zone: LayoutZone;
  enabled: boolean;
  loading: boolean;
  errorMessage: string | null;
  onToggle: (enabled: boolean) => void;
}

export function EvacuationRoutePanel({
  zone,
  enabled,
  loading,
  errorMessage,
  onToggle,
}: EvacuationRoutePanelProps) {
  return (
    <section
      className="rounded-lg border border-panel-divider bg-panel-soft px-3 py-3"
      aria-labelledby="evacuation-route-title"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 id="evacuation-route-title" className="text-sm font-bold text-panel-text">
            대피 동선
          </h3>
          <p className="mt-1 truncate text-xs text-panel-muted">{zone.name} 경로를 표시합니다.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={`${zone.name} 대피 동선 표시`}
          aria-busy={loading}
          className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-wait disabled:opacity-70 ${
            enabled ? 'border-panel-accent bg-panel-accent' : 'border-panel-divider bg-panel-muted'
          }`}
          onClick={() => onToggle(!enabled)}
          disabled={loading}
        >
          <span
            aria-hidden="true"
            className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
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
    </section>
  );
}
