import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';
import { simulationApi } from '../api/simulationApi';
import type { SimulationExecutionStatus, SimulationOverview } from '../types';

const POLL_INTERVAL_MS = 3000;
const TOAST_DURATION_MS = 6000;

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
      className="pointer-events-auto overflow-hidden rounded-2xl border border-success/25 bg-white shadow-floating"
    >
      <div className="flex gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-strong">
          <CheckCircle2 aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-ink">시뮬레이션 실행이 완료되었습니다</p>
          <p className="mt-1 truncate text-sm tabular-nums text-text-muted">
            {simulation.layoutTitle} · 시뮬레이션 #{simulation.id}
          </p>
          <Link
            to={`/simulations/${simulation.id}/results`}
            onClick={() => onDismiss(simulation.id)}
            className="mt-3 inline-flex text-sm font-bold text-primary hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            결과 보기
          </Link>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(simulation.id)}
          aria-label="완료 알림 닫기"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-text-muted outline-none transition hover:bg-surface hover:text-ink focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <div className="h-1 bg-success-strong" />
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
    queryKey: ['simulations', 'completion-monitor', userId],
    queryFn: simulationApi.listMonitor,
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
