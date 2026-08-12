import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useAuth } from '../../auth/context/AuthContext';
import { reportApi } from '../api/reportApi';
import type { ReportListResponse, ReportListStatusFilter, ReportStatus } from '../types/report';
import { getReportErrorMessage } from '../utils/getReportErrorMessage';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Select,
  Skeleton,
  type BadgeTone,
} from '../../../components/ui';

type StatusFilter = ReportListStatusFilter;

const PAGE_SIZE = 5;
const PAGE_BUTTON_COUNT = 5;
const STATUS_BADGE_TONES: Record<ReportStatus, BadgeTone> = {
  초안: 'neutral',
  '작성 중': 'primary',
  완료: 'success',
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
      <div className="mx-auto w-full max-w-[1360px] px-1 pt-2 pb-10 sm:px-4 lg:pt-4">
        <div className="border-b border-line pb-6">
          <PageHeader
            eyebrow="보고서"
            title="보고서 목록"
            description="시뮬레이션 결과를 바탕으로 작성된 안전 검토 보고서를 확인합니다."
          />
        </div>

        <Card className="mt-5" aria-label="보고서 검색">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label htmlFor="report-search" className="sr-only">
              보고서 제목 검색
            </label>
            <Input
              id="report-search"
              type="search"
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="보고서 제목 검색"
              className="min-w-0 flex-1"
            />
            <label htmlFor="report-status" className="sr-only">
              보고서 상태
            </label>
            <Select
              id="report-status"
              value={status}
              onChange={(event) => updateStatus(event.target.value as StatusFilter)}
              className="lg:w-44"
            >
              <option value="전체">전체</option>
              <option value="초안">초안</option>
              <option value="작성 중">작성 중</option>
              <option value="완료">완료</option>
            </Select>
          </div>
        </Card>

        <Card
          className="mt-4 overflow-hidden"
          padded={false}
          aria-labelledby="report-table-title"
        >
          <div className="border-b border-line px-5 py-4 sm:px-7">
            <h2 id="report-table-title" className="text-xl font-black text-ink">
              보고서 목록
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              총 <span className="font-bold tabular-nums text-primary">{totalCount}</span>건
            </p>
          </div>
          {isLoading ? (
            <div className="px-5 py-5 sm:px-7">
              <div className="space-y-5">
                {Array.from({ length: 5 }, (_, index) => (
                  <div key={index} className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="flex min-h-64 items-center justify-center px-6">
              <ErrorState message={error} className="w-full" />
            </div>
          ) : reports.length > 0 ? (
            <>
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
                        className="group transition-colors hover:bg-primary-faint"
                      >
                        <td className="px-7 py-4">
                          <Link
                            to={`/reports/${report.id}`}
                            className="block rounded outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                          >
                            <span className="block text-sm font-bold text-ink group-hover:text-primary">
                              {report.title}
                            </span>
                            <span className="mt-1 block text-xs tabular-nums text-text-muted">
                              보고서 #{report.id}
                            </span>
                          </Link>
                        </td>
                        {canViewAllReports && (
                          <td className="px-5 py-4 text-sm font-medium text-text-strong">
                            {report.authorName ?? '-'}
                          </td>
                        )}
                        <td className="px-7 py-4 text-sm tabular-nums text-text-strong">
                          {formatUpdatedAt(report.updatedAt)}
                        </td>
                        <td className="px-5 py-4">
                          <Badge tone={STATUS_BADGE_TONES[report.status]}>
                            {report.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pageCount > 1 && (
                <nav
                  className="flex items-center justify-center gap-2 border-t border-line px-5 py-3"
                  aria-label="보고서 목록 페이지"
                >
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, pageGroupStart - PAGE_BUTTON_COUNT))}
                  disabled={pageGroupStart === 1}
                  className="h-9 rounded-lg border border-line px-3 text-sm font-bold text-text-strong outline-none transition hover:bg-surface focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-40"
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
                    className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-bold tabular-nums outline-none transition focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-40 ${
                      page === pageNumber
                        ? 'bg-primary text-white'
                        : 'border border-line text-text-strong hover:bg-surface'
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage(Math.min(pageCount, pageGroupEnd + 1))}
                  disabled={pageGroupEnd === pageCount}
                  className="h-9 rounded-lg border border-line px-3 text-sm font-bold text-text-strong outline-none transition hover:bg-surface focus-visible:ring-2 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-40"
                >
                  다음
                </button>
                </nav>
              )}
            </>
          ) : (
            <div className="flex min-h-64 items-center justify-center px-6">
              <EmptyState
                icon={FileText}
                title="조건에 맞는 보고서가 없습니다."
                description="검색어나 상태 필터를 변경한 뒤 다시 확인해보세요."
              />
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}

export default ReportListPage;
