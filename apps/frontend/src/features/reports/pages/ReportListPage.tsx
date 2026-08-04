import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/context/AuthContext';
import { reportApi } from '../api/reportApi';
import type { ReportListResponse, ReportListStatusFilter, ReportStatus } from '../types/report';
import { getReportErrorMessage } from '../utils/getReportErrorMessage';

type StatusFilter = ReportListStatusFilter;

const PAGE_SIZE = 5;
const PAGE_BUTTON_COUNT = 5;
const STATUS_STYLES: Record<ReportStatus, string> = {
  초안: 'bg-surface text-text-muted',
  '작성 중': 'bg-primary-soft text-primary',
  완료: 'bg-lime/40 text-ink',
};

function formatUpdatedAt(value: string): string {
  const [date, time = ''] = value.split('T');
  return `${date.split('-').join('. ')}. ${time.slice(0, 5)}`;
}

function getErrorMessage(error: unknown): string {
  return getReportErrorMessage(error, '보고서 목록을 불러오지 못했습니다.');
}

function ReportListPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('전체');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReportListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canViewAllReports =
    user?.roles.includes('SAFETY_REVIEWER') || user?.roles.includes('ADMIN') || false;

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    void reportApi
      .list({
        query: query.trim() || undefined,
        status: status === '전체' ? undefined : status,
        page,
        size: PAGE_SIZE,
      })
      .then((response) => {
        if (active) setData(response);
      })
      .catch((requestError: unknown) => {
        if (active) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, query, status]);

  const totalCount = data?.totalCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const reports = data?.items ?? [];
  const pageGroupStart = Math.floor((page - 1) / PAGE_BUTTON_COUNT) * PAGE_BUTTON_COUNT + 1;
  const pageGroupEnd = Math.min(pageGroupStart + PAGE_BUTTON_COUNT - 1, pageCount);

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    setPage(1);
  }

  function updateStatus(nextStatus: StatusFilter) {
    setStatus(nextStatus);
    setPage(1);
  }

  return (
    <main className="bg-background">
      <div className="mx-auto w-full max-w-[1360px] px-1 pt-2 sm:px-4 lg:pt-4">
        <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-primary">보고서 관리</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">
              보고서 목록
            </h1>
            <p className="mt-3 text-sm leading-6 text-text-muted">
              시뮬레이션 결과를 바탕으로 작성된 안전 검토 보고서를 확인합니다.
            </p>
          </div>
        </header>
        <section
          className="mt-5 rounded-xl border border-line bg-white p-4 shadow-sm shadow-ink/5 sm:p-5"
          aria-label="보고서 검색"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label htmlFor="report-search" className="sr-only">
              보고서 제목 검색
            </label>
            <input
              id="report-search"
              type="search"
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="보고서 제목 검색"
              className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-4 text-sm text-ink outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <label className="flex h-11 items-center gap-3 rounded-lg border border-line bg-white px-3.5 text-sm font-bold text-text-strong">
              <span className="text-text-muted">상태</span>
              <select
                value={status}
                onChange={(event) => updateStatus(event.target.value as StatusFilter)}
                className="min-w-24 bg-transparent outline-none"
              >
                <option value="전체">전체</option>
                <option value="초안">초안</option>
                <option value="작성 중">작성 중</option>
                <option value="완료">완료</option>
              </select>
            </label>
          </div>
        </section>
        <section
          className="mt-4 overflow-hidden rounded-xl border border-line bg-white shadow-sm shadow-ink/5"
          aria-labelledby="report-table-title"
        >
          <div className="border-b border-line px-5 py-4 sm:px-7">
            <h2 id="report-table-title" className="text-xl font-black text-ink">
              보고서 목록
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              총 <span className="font-bold text-primary">{totalCount}</span>건
            </p>
          </div>
          {isLoading ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-text-muted">
              보고서 목록을 불러오는 중입니다.
            </div>
          ) : error ? (
            <div className="flex min-h-64 items-center justify-center px-6 text-center text-sm text-red-600">
              {error}
            </div>
          ) : reports.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] table-fixed border-collapse text-left">
                <caption className="sr-only">보고서 목록</caption>
                <colgroup>
                  <col className={canViewAllReports ? 'w-[52%]' : 'w-[64%]'} />
                  {canViewAllReports && <col className="w-[14%]" />}
                  <col className="w-[21%]" />
                  <col className="w-[13%]" />
                </colgroup>
                <thead className="bg-surface text-xs font-bold tracking-wide text-text-muted">
                  <tr>
                    <th className="px-7 py-4">보고서 제목</th>
                    {canViewAllReports && <th className="px-5 py-4">작성자</th>}
                    <th className="px-7 py-4">최근 수정</th>
                    <th className="px-5 py-4">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {reports.map((report) => (
                    <tr
                      key={report.id}
                      className="group transition-colors hover:bg-primary-soft/35"
                    >
                      <td className="px-7 py-4">
                        <Link
                          to={`/reports/${report.id}`}
                          className="block rounded outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <span className="block text-sm font-bold text-ink group-hover:text-primary">
                            {report.title}
                          </span>
                          <span className="mt-1 block text-xs text-text-muted">
                            보고서 #{report.id}
                          </span>
                        </Link>
                      </td>
                      {canViewAllReports && (
                        <td className="px-5 py-4 text-sm font-medium text-text-strong">
                          {report.authorName ?? '-'}
                        </td>
                      )}
                      <td className="px-7 py-4 text-sm text-text-strong">
                        {formatUpdatedAt(report.updatedAt)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${STATUS_STYLES[report.status]}`}
                        >
                          {report.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-64 items-center justify-center px-6 text-center text-sm text-text-muted">
              조건에 맞는 보고서가 없습니다.
            </div>
          )}
          <nav
            className="flex items-center justify-center gap-2 border-t border-line px-5 py-3"
            aria-label="보고서 목록 페이지"
          >
            <button
              type="button"
              onClick={() => setPage(Math.max(1, pageGroupStart - PAGE_BUTTON_COUNT))}
              disabled={pageGroupStart === 1}
              className="rounded-md px-3 py-1.5 text-xs font-bold text-text-muted disabled:opacity-40"
            >
              이전
            </button>
            {Array.from(
              { length: pageGroupEnd - pageGroupStart + 1 },
              (_, index) => pageGroupStart + index,
            ).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                aria-current={page === pageNumber ? 'page' : undefined}
                className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold ${page === pageNumber ? 'bg-primary text-white' : 'text-text-muted hover:bg-surface'}`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage(Math.min(pageCount, pageGroupEnd + 1))}
              disabled={pageGroupEnd === pageCount}
              className="rounded-md px-3 py-1.5 text-xs font-bold text-text-muted disabled:opacity-40"
            >
              다음
            </button>
          </nav>
        </section>
      </div>
    </main>
  );
}

export default ReportListPage;
