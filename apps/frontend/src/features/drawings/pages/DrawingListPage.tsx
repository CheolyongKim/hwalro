import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useDeleteDrawing, useDrawingList } from '../hooks';
import DrawingListTable from '../components/DrawingListTable';
import {
  Button,
  buttonClassName,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  PageHeader,
} from '../../../components/ui';
import { getDrawingErrorMessage } from '../utils/getDrawingErrorMessage';
import type { DrawingSummary } from '../types/drawing';

const PAGE_SIZE = 5;
const PAGE_BUTTON_COUNT = 5;

function DrawingListPage() {
  const [page, setPage] = useState(1);
  const [drawingToDelete, setDrawingToDelete] = useState<DrawingSummary | null>(null);
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
    setDrawingToDelete(drawing);
  };

  const confirmDelete = () => {
    if (drawingToDelete === null) {
      return;
    }
    deleteDrawing.mutate(drawingToDelete.id, {
      onError: (deleteError) => {
        window.alert(getDrawingErrorMessage(deleteError));
      },
    });
    setDrawingToDelete(null);
  };

  return (
    <main className="bg-background">
      <div className="mx-auto w-full max-w-[1360px] px-1 pt-2 pb-10 sm:px-4 lg:pt-4">
        <PageHeader
          eyebrow="도면"
          title="도면 목록"
          description="등록된 도면을 확인하고 관리합니다. 도면명을 선택하면 수정 화면으로 이동합니다."
          actions={
            <Link to="/drawings/new" className={buttonClassName({ variant: 'primary', size: 'lg' })}>
              도면 등록
            </Link>
          }
        />

        <Card padded={false} className="mt-4 overflow-hidden" aria-label="도면 목록">
          {isPending ? (
            <div className="flex min-h-64 items-center justify-center px-6 text-center text-sm text-text-muted">
              도면을 불러오는 중...
            </div>
          ) : isError ? (
            <div className="flex min-h-64 items-center justify-center px-6">
              <ErrorState message={getDrawingErrorMessage(error)} className="w-full" />
            </div>
          ) : items.length > 0 ? (
            <DrawingListTable items={items} onDelete={handleDelete} />
          ) : totalCount > 0 ? (
            <EmptyState
              icon={FileText}
              title="페이지에 표시할 도면이 없습니다."
              description="다른 페이지로 이동해 도면을 확인해 보세요."
            />
          ) : (
            <EmptyState
              icon={FileText}
              title="등록된 도면이 없습니다."
              description="도면 등록 버튼으로 첫 도면을 만들어 보세요."
              action={
                <Link
                  to="/drawings/new"
                  className={buttonClassName({ variant: 'primary', size: 'md' })}
                >
                  도면 등록
                </Link>
              }
            />
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
                className="rounded-lg px-3 py-1.5 text-xs font-bold text-text-muted outline-none transition hover:bg-surface hover:text-text-strong focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-40"
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
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold tabular-nums outline-none transition focus-visible:ring-2 focus-visible:ring-focus-ring ${page === pageNumber ? 'bg-primary text-white' : 'text-text-muted hover:bg-surface hover:text-text-strong'}`}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage(page + 1)}
                disabled={page === pageCount}
                className="rounded-lg px-3 py-1.5 text-xs font-bold text-text-muted outline-none transition hover:bg-surface hover:text-text-strong focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-40"
              >
                다음
              </button>
            </nav>
          )}
        </Card>

        <Modal
          open={drawingToDelete !== null}
          onClose={() => setDrawingToDelete(null)}
          title="도면 삭제"
          size="sm"
          description={
            drawingToDelete !== null
              ? `도면 "${drawingToDelete.title}"을(를) 삭제하시겠습니까?`
              : undefined
          }
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setDrawingToDelete(null)}>
                취소
              </Button>
              <Button type="button" variant="danger" onClick={confirmDelete}>
                삭제
              </Button>
            </>
          }
        >
          <p className="text-sm text-text-muted">삭제한 도면은 복구할 수 없습니다.</p>
        </Modal>
      </div>
    </main>
  );
}

export default DrawingListPage;
