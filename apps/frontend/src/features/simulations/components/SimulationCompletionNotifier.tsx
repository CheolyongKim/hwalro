import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { simulationApi } from '../api/simulationApi';
import type {
  SimulationExecutionStatus,
  SimulationOverview,
  SimulationOverviewPage,
} from '../types';

const POLL_INTERVAL_MS = 3000;
const TOAST_DURATION_MS = 6000;
const MONITOR_PAGE_SIZE = 100;

type OverviewPageLoader = (page: number, size: number) => Promise<SimulationOverviewPage>;

export async function listAllSimulationOverviews(
  loadPage: OverviewPageLoader = simulationApi.listOverview,
): Promise<SimulationOverview[]> {
  const firstPage = await loadPage(1, MONITOR_PAGE_SIZE);
  const pageCount = Math.ceil(firstPage.totalCount / firstPage.size);
  if (pageCount <= 1) return firstPage.items;

  const items = [...firstPage.items];
  // ponytail: Reuse the existing API until history volume justifies a dedicated active-monitor endpoint.
  for (let page = 2; page <= pageCount; page += 1) {
    items.push(...(await loadPage(page, MONITOR_PAGE_SIZE)).items);
  }
  return items;
}

export function findNewlyCompletedSimulations(
  previousStatuses: ReadonlyMap<number, SimulationExecutionStatus>,
  simulations: SimulationOverview[],
  userId: number,
): SimulationOverview[] {
  return simulations.filter((simulation) => {
    const previousStatus = previousStatuses.get(simulation.id);
    return (
      simulation.createdBy === userId &&
      simulation.status === 'COMPLETED' &&
      previousStatus !== undefined &&
      previousStatus !== 'COMPLETED'
    );
  });
}

interface CompletionToastProps {
  simulation: SimulationOverview;
  onDismiss: (simulationId: number) => void;
}

function CompletionToast({ simulation, onDismiss }: CompletionToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(simulation.id), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss, simulation.id]);

  return (
    <article
      role="status"
      className="pointer-events-auto overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-xl shadow-ink/15"
    >
      <div className="flex gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path
              d="m5 12.5 4.2 4.2L19 7"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-ink">시뮬레이션 실행이 완료되었습니다</p>
          <p className="mt-1 truncate text-sm text-text-muted">
            {simulation.layoutTitle} · 시뮬레이션 #{simulation.id}
          </p>
          <Link
            to={`/simulations/${simulation.id}/result`}
            onClick={() => onDismiss(simulation.id)}
            className="mt-3 inline-flex text-sm font-bold text-primary hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            결과 보기
          </Link>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(simulation.id)}
          aria-label="완료 알림 닫기"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-muted hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div className="h-1 bg-emerald-500" />
    </article>
  );
}

interface SimulationCompletionNotifierProps {
  userId: number;
}

function SimulationCompletionNotifier({ userId }: SimulationCompletionNotifierProps) {
  const [toasts, setToasts] = useState<SimulationOverview[]>([]);
  const previousStatusesRef = useRef<Map<number, SimulationExecutionStatus> | null>(null);
  const notifiedIdsRef = useRef(new Set<number>());
  const query = useQuery({
    queryKey: ['simulations', 'completion-monitor'],
    queryFn: () => listAllSimulationOverviews(),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const dismiss = useCallback((simulationId: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== simulationId));
  }, []);

  useEffect(() => {
    if (!query.data) return;

    const currentStatuses = new Map<number, SimulationExecutionStatus>(
      query.data.map((simulation) => [simulation.id, simulation.status]),
    );
    const previousStatuses = previousStatusesRef.current;
    previousStatusesRef.current = currentStatuses;
    if (!previousStatuses) return;

    const completed = findNewlyCompletedSimulations(previousStatuses, query.data, userId).filter(
      (simulation) => !notifiedIdsRef.current.has(simulation.id),
    );
    if (completed.length === 0) return;

    completed.forEach((simulation) => notifiedIdsRef.current.add(simulation.id));
    setToasts((current) => [...current, ...completed]);
  }, [query.data, userId]);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed top-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
      aria-live="polite"
      aria-label="시뮬레이션 완료 알림"
    >
      {toasts.map((simulation) => (
        <CompletionToast key={simulation.id} simulation={simulation} onDismiss={dismiss} />
      ))}
    </div>
  );
}

export default SimulationCompletionNotifier;
