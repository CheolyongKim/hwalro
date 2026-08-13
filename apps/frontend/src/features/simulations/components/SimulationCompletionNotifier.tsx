import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CompletionToast } from '../../../components/notifications/CompletionToast';
import { simulationApi } from '../api/simulationApi';
import type { SimulationExecutionStatus, SimulationOverview } from '../types';

const POLL_INTERVAL_MS = 3000;

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
    <>
      {toasts.map((simulation) => (
        <CompletionToast
          key={simulation.id}
          id={simulation.id}
          title="시뮬레이션 실행이 완료되었습니다"
          description={`${simulation.layoutTitle} · 시뮬레이션 #${simulation.id}`}
          dismissLabel="시뮬레이션 완료 알림 닫기"
          onDismiss={dismiss}
          action={
            <Link
              to={`/simulations/${simulation.id}/results`}
              onClick={() => dismiss(simulation.id)}
              className="mt-3 inline-flex text-sm font-bold text-primary hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              결과 보기
            </Link>
          }
        />
      ))}
    </>
  );
}

export default SimulationCompletionNotifier;
