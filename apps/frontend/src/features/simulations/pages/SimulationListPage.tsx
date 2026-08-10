import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { simulationApi } from '../api/simulationApi';
import type { SimulationExecutionStatus, SimulationOverview } from '../types';
import { getSimulationErrorMessage } from '../utils/getSimulationErrorMessage';

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<SimulationExecutionStatus, string> = {
  DRAFT: '배치 작성 중',
  REQUESTED: '실행 대기',
  RUNNING: '실행 중',
  COMPLETED: '실행 완료',
  FAILED: '실행 실패',
};

const STATUS_STYLES: Record<SimulationExecutionStatus, string> = {
  DRAFT: 'bg-soft-gray text-text-strong',
  REQUESTED: 'bg-amber-50 text-amber-700',
  RUNNING: 'bg-primary-soft text-primary',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-red-50 text-red-700',
};

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function resultLabel(simulation: SimulationOverview): string {
  if (simulation.terminationReason === 'ALL_EVACUATED') return '전원 대피';
  if (simulation.terminationReason === 'MAX_DURATION') return '최대시간 도달';
  return '-';
}

function destination(simulation: SimulationOverview): string {
  return simulation.status === 'DRAFT'
    ? `/simulations/${simulation.id}/setup`
    : `/simulations/${simulation.id}/result`;
}

function SimulationListPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['simulations', 'overview', page],
    queryFn: () => simulationApi.listOverview(page, PAGE_SIZE),
  });
  const items = query.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((query.data?.totalCount ?? 0) / PAGE_SIZE));
  const visiblePages = useMemo(() => {
    const count = Math.min(5, totalPages);
    const start = Math.max(1, Math.min(page - 2, totalPages - count + 1));
    return Array.from({ length: count }, (_, index) => start + index);
  }, [page, totalPages]);
  const hasRunning = items.some(
    (simulation) => simulation.status === 'REQUESTED' || simulation.status === 'RUNNING',
  );

  useEffect(() => {
    if (!hasRunning) return;
    const timer = window.setInterval(() => void query.refetch(), 3000);
    return () => window.clearInterval(timer);
  }, [hasRunning, query.refetch]);

  return (
    <main className="bg-background">
      <div className="mx-auto w-full max-w-[1360px] px-1 pt-2 pb-10 sm:px-4 lg:pt-4">
        <header className="border-b border-line pb-5">
          <p className="text-sm font-bold text-primary">시뮬레이션 검토</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">
            시뮬레이션 목록
          </h1>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            실행 중인 작업과 이전 결과를 확인하고 배치 또는 결과 화면으로 다시 이동할 수 있습니다.
          </p>
        </header>

        <section
          className="mt-5 overflow-hidden rounded-xl border border-line bg-white shadow-sm shadow-ink/5"
          aria-label="시뮬레이션 목록"
        >
          {query.isPending ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-text-muted">
              시뮬레이션을 불러오는 중입니다.
            </div>
          ) : query.isError && items.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
                {getSimulationErrorMessage(query.error)}
              </p>
              <button
                type="button"
                onClick={() => void query.refetch()}
                disabled={query.isFetching}
                className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-bold text-text-strong hover:bg-surface disabled:opacity-50"
              >
                {query.isFetching ? '불러오는 중...' : '다시 시도'}
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 text-center text-sm text-text-muted">
              <p>생성된 시뮬레이션이 없습니다.</p>
              <Link
                to="/drawings"
                className="inline-flex h-10 items-center rounded-lg bg-primary px-4 font-bold text-white"
              >
                도면 목록으로 이동
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse text-left">
                  <caption className="sr-only">시뮬레이션 실행 및 배치 목록</caption>
                  <thead className="bg-surface text-xs font-bold tracking-wide text-text-muted">
                    <tr>
                      <th className="px-6 py-4">도면</th>
                      <th className="px-4 py-4">시뮬레이션</th>
                      <th className="px-4 py-4">상태</th>
                      <th className="px-4 py-4">인원</th>
                      <th className="px-4 py-4">결과</th>
                      <th className="px-4 py-4">생성일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {items.map((simulation) => (
                      <tr
                        key={simulation.id}
                        className="transition-colors hover:bg-primary-soft/30"
                      >
                        <td className="px-6 py-4">
                          <Link
                            to={destination(simulation)}
                            className="block rounded outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            <span className="block max-w-64 truncate text-sm font-bold text-ink hover:text-primary">
                              {simulation.layoutTitle}
                            </span>
                            <span className="mt-1 block text-xs text-text-muted">
                              도면 #{simulation.layoutId} · 버전 {simulation.layoutVersionNumber}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-sm font-bold text-text-strong">
                          #{simulation.id}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[simulation.status]}`}
                          >
                            {STATUS_LABELS[simulation.status]}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-text-strong">
                          {simulation.totalPeople.toLocaleString()}명
                        </td>
                        <td className="px-4 py-4 text-sm text-text-strong">
                          {resultLabel(simulation)}
                        </td>
                        <td className="px-4 py-4 text-sm text-text-muted">
                          {formatDateTime(simulation.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-5 py-3 sm:flex-row">
                <p className="text-sm text-text-muted">
                  총 {(query.data?.totalCount ?? 0).toLocaleString()}건
                </p>
                <nav className="flex items-center gap-1" aria-label="시뮬레이션 목록 페이지">
                  <button
                    type="button"
                    onClick={() => setPage((current) => current - 1)}
                    disabled={page === 1 || query.isFetching}
                    className="h-9 rounded-lg border border-line px-3 text-sm font-bold text-text-strong hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    이전
                  </button>
                  {visiblePages.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setPage(pageNumber)}
                      disabled={query.isFetching}
                      aria-current={pageNumber === page ? 'page' : undefined}
                      aria-label={`${pageNumber}페이지`}
                      className={`h-9 min-w-9 rounded-lg px-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        pageNumber === page
                          ? 'bg-primary text-white'
                          : 'border border-line text-text-strong hover:bg-surface'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={page === totalPages || query.isFetching}
                    className="h-9 rounded-lg border border-line px-3 text-sm font-bold text-text-strong hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    다음
                  </button>
                </nav>
              </div>
              {query.isError && (
                <div
                  role="alert"
                  className="flex items-center justify-between gap-4 border-t border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700"
                >
                  <span>{getSimulationErrorMessage(query.error)}</span>
                  <button
                    type="button"
                    onClick={() => void query.refetch()}
                    disabled={query.isFetching}
                    className="shrink-0 rounded-lg border border-red-300 px-3 py-1.5 font-bold disabled:opacity-50"
                  >
                    다시 시도
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default SimulationListPage;
