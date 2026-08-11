import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDeleteDrawing, useDrawingList } from '../hooks';
import DrawingListTable from '../components/DrawingListTable';
import { getDrawingErrorMessage } from '../utils/getDrawingErrorMessage';
import type { DrawingSummary } from '../types/drawing';

const PAGE_SIZE = 5;
const PAGE_BUTTON_COUNT = 5;

function DrawingListPage() {
  const [page, setPage] = useState(1);
  const { items, totalCount, isPending, isError, error } = useDrawingList(page, PAGE_SIZE);
  const deleteDrawing = useDeleteDrawing();

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageGroupStart = Math.floor((page - 1) / PAGE_BUTTON_COUNT) * PAGE_BUTTON_COUNT + 1;
  const pageGroupEnd = Math.min(pageGroupStart + PAGE_BUTTON_COUNT - 1, pageCount);

  useEffect(() => {
    if (!isPending && !isError && page > pageCount) {
      setPage(pageCount);
    }
  }, [isPending, isError, page, pageCount]);

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
          ) : items.length > 0 ? (
            <DrawingListTable items={items} onDelete={handleDelete} />
          ) : (
            <div className="flex min-h-64 items-center justify-center px-6 text-center text-sm text-text-muted">
              {totalCount > 0
                ? '페이지에 표시할 도면이 없습니다.'
                : '등록된 도면이 없습니다. 도면 등록 버튼으로 첫 도면을 만들어 보세요.'}
            </div>
          )}
          {pageCount > 1 && (
            <nav
              className="flex items-center justify-center gap-2 border-t border-line px-5 py-3"
              aria-label="도면 목록 페이지"
            >
              <button
                type="button"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
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
                onClick={() => setPage(page + 1)}
                disabled={page === pageCount}
                className="rounded-md px-3 py-1.5 text-xs font-bold text-text-muted disabled:opacity-40"
              >
                다음
              </button>
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}

export default DrawingListPage;
