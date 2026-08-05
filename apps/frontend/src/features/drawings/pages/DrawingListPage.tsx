import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/context/AuthContext';
import { useDeleteDrawing, useDrawingList } from '../hooks';
import DrawingListTable from '../components/DrawingListTable';
import { DRAWING_PERIOD_OPTIONS } from '../constants/drawingOptions';
import { getDrawingErrorMessage } from '../utils/getDrawingErrorMessage';
import type { DrawingPeriod, DrawingSummary } from '../types/drawing';

type CreatorFilter = number | '전체';

function isWithinPeriod(createdAt: string, period: DrawingPeriod): boolean {
  if (period === '전체') {
    return true;
  }
  const days = period === '최근 7일' ? 7 : 30;
  const createdTime = new Date(createdAt).getTime();
  return createdTime >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function DrawingListPage() {
  const {
    items,
    totalCount,
    hasNextPage,
    isPending,
    isError,
    error,
    fetchNextPage,
    isFetchingNextPage,
  } = useDrawingList();
  const deleteDrawing = useDeleteDrawing();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [creator, setCreator] = useState<CreatorFilter>('전체');
  const [period, setPeriod] = useState<DrawingPeriod>('전체');

  const creatorOptions = useMemo(() => {
    const ids = new Set(items.map((drawing) => drawing.createdBy));
    return ['전체' as const, ...ids];
  }, [items]);

  const filteredDrawings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((drawing) => {
      const matchesQuery =
        normalizedQuery === '' || drawing.title.toLowerCase().includes(normalizedQuery);
      const matchesCreator = creator === '전체' || drawing.createdBy === creator;
      const matchesPeriod = isWithinPeriod(drawing.createdAt, period);
      return matchesQuery && matchesCreator && matchesPeriod;
    });
  }, [creator, items, period, query]);

  const handleDelete = (drawing: DrawingSummary) => {
    const confirmed = window.confirm(
      `도면 "${drawing.title}"을(를) 삭제하시겠습니까? 삭제한 도면은 복구할 수 없습니다.`,
    );
    if (!confirmed) {
      return;
    }
    deleteDrawing.mutate(drawing.id, {
      onError: (deleteError) => {
        window.alert(getDrawingErrorMessage(deleteError));
      },
    });
  };

  return (
    <main className="bg-background">
      <div className="mx-auto w-full max-w-[1360px] px-1 pt-2 pb-10 sm:px-4 lg:pt-4">
        <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-primary">시뮬레이션 검토</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">
              도면 목록
            </h1>
            <p className="mt-3 text-sm leading-6 text-text-muted">
              등록된 도면을 확인하고 관리합니다. 도면명을 선택하면 수정 화면으로 이동합니다.
            </p>
          </div>
          <Link
            to="/drawings/new"
            className="inline-flex h-11 shrink-0 items-center rounded-lg bg-primary px-5 text-sm font-bold text-white transition-colors hover:bg-primary/85"
          >
            도면 등록
          </Link>
        </header>

        <section
          className="mt-5 rounded-xl border border-line bg-white p-4 shadow-sm shadow-ink/5 sm:p-5"
          aria-label="도면 검색"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label htmlFor="drawing-search" className="sr-only">
              도면명 검색
            </label>
            <input
              id="drawing-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="도면명 검색"
              className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-4 text-sm text-ink outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <label className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-soft-gray px-3.5 text-sm font-bold text-text-strong">
              <span className="text-text-muted">등록자</span>
              <select
                value={creator === '전체' ? '전체' : String(creator)}
                onChange={(event) => {
                  const value = event.target.value;
                  setCreator(value === '전체' ? '전체' : Number(value));
                }}
                className="min-w-20 rounded-lg bg-transparent outline-none transition focus-visible:ring-2 focus-visible:ring-primary/15"
              >
                {creatorOptions.map((option) => (
                  <option key={String(option)} value={String(option)}>
                    {option === '전체'
                      ? '전체'
                      : user !== null && option === user.id
                        ? user.name
                        : `#${option}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-soft-gray px-3.5 text-sm font-bold text-text-strong">
              <span className="text-text-muted">등록일</span>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value as DrawingPeriod)}
                className="min-w-20 rounded-lg bg-transparent outline-none transition focus-visible:ring-2 focus-visible:ring-primary/15"
              >
                {DRAWING_PERIOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section
          className="mt-4 overflow-hidden rounded-xl border border-line bg-white shadow-sm shadow-ink/5"
          aria-label="도면 목록"
        >
          {isPending ? (
            <div className="flex min-h-64 items-center justify-center px-6 text-center text-sm text-text-muted">
              도면을 불러오는 중...
            </div>
          ) : isError ? (
            <div className="flex min-h-64 items-center justify-center px-6 text-center">
              <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-600">
                {getDrawingErrorMessage(error)}
              </p>
            </div>
          ) : filteredDrawings.length > 0 ? (
            <DrawingListTable
              items={filteredDrawings}
              onDelete={handleDelete}
              hasNext={hasNextPage}
              onLoadMore={() => void fetchNextPage()}
              isFetchingMore={isFetchingNextPage}
            />
          ) : (
            <div className="flex min-h-64 items-center justify-center px-6 text-center text-sm text-text-muted">
              {totalCount > 0
                ? '조건에 맞는 도면이 없습니다.'
                : '등록된 도면이 없습니다. 도면 등록 버튼으로 첫 도면을 만들어 보세요.'}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default DrawingListPage;
