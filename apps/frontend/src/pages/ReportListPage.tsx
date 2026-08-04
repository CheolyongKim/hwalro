import { useMemo, useState } from 'react';

type ReportStatus = '초안' | '작성 중' | '완료';
type StatusFilter = '전체' | ReportStatus;

const PAGE_SIZE = 5;

interface ReportItem {
  id: number;
  title: string;
  authorName: string;
  status: ReportStatus;
  updatedAt: string;
}

const REPORTS: ReportItem[] = [
  {
    id: 1,
    title: '2026 여름 팝업스토어 안전 검토 보고서',
    authorName: '김안전',
    status: '완료',
    updatedAt: '2026. 08. 03. 14:20',
  },
  {
    id: 2,
    title: 'B2 전시장 동선 개선 검토 보고서',
    authorName: '박운영',
    status: '작성 중',
    updatedAt: '2026. 08. 02. 16:45',
  },
  {
    id: 3,
    title: '신규 브랜드 체험관 사전 안전 보고서',
    authorName: '이검토',
    status: '초안',
    updatedAt: '2026. 08. 01. 10:12',
  },
  {
    id: 4,
    title: '주말 행사장 비상 대피 분석 보고서',
    authorName: '정안전',
    status: '완료',
    updatedAt: '2026. 07. 30. 18:03',
  },
  {
    id: 5,
    title: '1층 임시 판매 공간 배치 검토',
    authorName: '박운영',
    status: '작성 중',
    updatedAt: '2026. 07. 29. 09:30',
  },
  {
    id: 6,
    title: '야외 휴게 공간 비상 유도선 점검 보고서',
    authorName: '김안전',
    status: '완료',
    updatedAt: '2026. 07. 28. 17:20',
  },
  {
    id: 7,
    title: '지하 주차장 행사 동선 안전 검토',
    authorName: '최운영',
    status: '초안',
    updatedAt: '2026. 07. 28. 11:05',
  },
  {
    id: 8,
    title: '문화 행사장 출입구 혼잡도 분석 보고서',
    authorName: '이검토',
    status: '완료',
    updatedAt: '2026. 07. 27. 15:40',
  },
  {
    id: 9,
    title: '2층 체험존 대피 안내 배치 검토',
    authorName: '정안전',
    status: '작성 중',
    updatedAt: '2026. 07. 26. 13:15',
  },
  {
    id: 10,
    title: '로비 임시 부스 설치 안전 보고서',
    authorName: '박운영',
    status: '초안',
    updatedAt: '2026. 07. 25. 09:40',
  },
  {
    id: 11,
    title: '공연장 객석 대피 경로 검토 보고서',
    authorName: '김안전',
    status: '완료',
    updatedAt: '2026. 07. 24. 18:10',
  },
  {
    id: 12,
    title: '행사장 안내 표지 가시성 점검 보고서',
    authorName: '최운영',
    status: '작성 중',
    updatedAt: '2026. 07. 23. 10:25',
  },
];

const STATUS_STYLES: Record<ReportStatus, string> = {
  초안: 'bg-surface text-text-muted',
  '작성 중': 'bg-primary-soft text-primary',
  완료: 'bg-lime/40 text-ink',
};

function ReportListPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('전체');
  const [page, setPage] = useState(1);

  const filteredReports = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return REPORTS.filter((report) => {
      const matchesStatus = status === '전체' || report.status === status;
      const matchesQuery =
        !normalizedQuery ||
        report.title.toLowerCase().includes(normalizedQuery) ||
        report.authorName.toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [query, status]);

  const pageCount = Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedReports = filteredReports.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
      <div className="mx-auto w-full max-w-[1392px] px-1 pt-2 sm:px-4 lg:px-8 lg:pt-4">
        <header className="flex max-w-[1360px] flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-primary">안전 운영</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">
              보고서 목록
            </h1>
            <p className="mt-3 text-sm leading-6 text-text-muted">
              시뮬레이션 결과를 바탕으로 작성된 안전 검토 보고서를 확인합니다.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary/85 active:translate-y-px"
          >
            보고서 작성
          </button>
        </header>

        <section className="mt-5 max-w-[1360px] rounded-xl border border-line bg-white p-4 shadow-sm shadow-ink/5 sm:p-5" aria-label="보고서 검색">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label htmlFor="report-search" className="sr-only">
              보고서 검색
            </label>
            <div className="relative min-w-0 flex-1">
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <circle cx="10.8" cy="10.8" r="6.8" />
                <path d="m16 16 4.5 4.5" />
              </svg>
              <input
                id="report-search"
                type="search"
                value={query}
                onChange={(event) => updateQuery(event.target.value)}
                placeholder="보고서 제목 또는 작성자 검색"
                className="h-11 w-full rounded-lg border border-line bg-surface pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <label className="flex h-11 items-center gap-3 rounded-lg border border-line bg-white px-3.5 text-sm font-bold text-text-strong">
              <span className="shrink-0 text-text-muted">상태</span>
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

        <section className="mt-4 max-w-[1360px] overflow-hidden rounded-xl border border-line bg-white shadow-sm shadow-ink/5" aria-labelledby="report-table-title">
          <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-7">
            <div>
              <h2 id="report-table-title" className="text-xl font-black text-ink">
                보고서 목록
              </h2>
              <p className="mt-1 text-sm text-text-muted">
                총 <span className="font-bold text-primary">{filteredReports.length}</span>건
              </p>
            </div>
            <button type="button" className="hidden text-sm font-bold text-text-muted hover:text-ink sm:block">
              최신 수정순
            </button>
          </div>

          {filteredReports.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] table-fixed border-collapse text-left">
                <caption className="sr-only">보고서 목록</caption>
                <colgroup>
                  <col className="w-[52%]" />
                  <col className="w-[14%]" />
                  <col className="w-[21%]" />
                  <col className="w-[13%]" />
                </colgroup>
                <thead className="bg-surface text-xs font-bold tracking-wide text-text-muted">
                  <tr>
                    <th scope="col" className="px-7 py-4">보고서 제목</th>
                    <th scope="col" className="px-5 py-4">작성자</th>
                    <th scope="col" className="px-7 py-4">최근 수정</th>
                    <th scope="col" className="px-5 py-4">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {paginatedReports.map((report) => (
                    <tr key={report.id} className="group transition-colors hover:bg-primary-soft/35">
                      <td className="px-7 py-4">
                        <button type="button" className="text-left">
                          <span className="block text-sm font-bold text-ink group-hover:text-primary">
                            {report.title}
                          </span>
                          <span className="mt-1 block text-xs text-text-muted">보고서 #{report.id}</span>
                        </button>
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-text-strong">
                        {report.authorName}
                      </td>
                      <td className="px-7 py-4 text-sm text-text-strong">{report.updatedAt}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${STATUS_STYLES[report.status]}`}>
                          {report.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
                <svg aria-hidden="true" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 5h14v14H5zM8 9h8M8 13h5" />
                </svg>
              </div>
              <h3 className="mt-4 text-base font-bold text-ink">조건에 맞는 보고서가 없습니다.</h3>
              <p className="mt-2 text-sm text-text-muted">검색어나 상태 필터를 바꿔 다시 확인해 보세요.</p>
            </div>
          )}

          <nav className="flex items-center justify-center gap-2 border-t border-line px-5 py-3" aria-label="보고서 목록 페이지">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage === 1}
              className="rounded-md px-3 py-1.5 text-xs font-bold text-text-muted transition hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              이전
            </button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                aria-current={currentPage === pageNumber ? 'page' : undefined}
                className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold transition ${
                  currentPage === pageNumber
                    ? 'bg-primary text-white'
                    : 'text-text-muted hover:bg-surface hover:text-ink'
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={currentPage === pageCount}
              className="rounded-md px-3 py-1.5 text-xs font-bold text-text-muted transition hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
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
