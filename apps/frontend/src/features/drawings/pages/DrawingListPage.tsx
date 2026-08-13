import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useDeleteDrawing, useDrawingList, useDuplicateDrawing } from '../hooks';
import DrawingListTable from '../components/DrawingListTable';
import {
  Button,
  buttonClassName,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  PageHeader,
  Pagination,
} from '../../../components/ui';
import { getDrawingErrorMessage } from '../utils/getDrawingErrorMessage';
import type { DrawingSummary } from '../types/drawing';

const PAGE_SIZE = 5;

function DrawingListPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [drawingToDelete, setDrawingToDelete] = useState<DrawingSummary | null>(null);
  const { items, totalCount, isPending, isError, error } = useDrawingList(page, PAGE_SIZE);
  const deleteDrawing = useDeleteDrawing();
  const duplicateDrawing = useDuplicateDrawing();

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    if (!isPending && !isError && page > pageCount) {
      setPage(pageCount);
    }
  }, [isPending, isError, page, pageCount]);

  const handleDelete = (drawing: DrawingSummary) => {
    setDrawingToDelete(drawing);
  };

  const handleDuplicate = (drawing: DrawingSummary) => {
    duplicateDrawing.mutate(drawing.id, {
      onSuccess: (duplicated) => navigate(`/layout/${duplicated.id}`),
      onError: (duplicateError) => {
        window.alert(getDrawingErrorMessage(duplicateError));
      },
    });
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
            <Link
              to="/drawings/new"
              className={buttonClassName({ variant: 'primary', size: 'lg' })}
            >
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
            <>
              <DrawingListTable
                items={items}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
              />
              <div className="flex flex-col items-center justify-between gap-3 border-t border-line px-5 py-3 sm:flex-row">
                <p className="text-sm tabular-nums text-text-muted">
                  총 {totalCount.toLocaleString()}건
                </p>
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  onPageChange={setPage}
                  ariaLabel="도면 목록 페이지"
                />
              </div>
            </>
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
