import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/context/AuthContext';
import type { DrawingSummary } from '../types/drawing';

interface DrawingListTableProps {
  items: DrawingSummary[];
  onDelete: (drawing: DrawingSummary) => void;
  hasNext: boolean;
  onLoadMore: () => void;
  isFetchingMore: boolean;
}

function formatCreatedAt(value: string): string {
  const [date, time = ''] = value.split('T');
  return `${date.split('-').join('. ')}. ${time.slice(0, 5)}`;
}

function creatorLabel(createdBy: number, currentUserId: number | null, currentUserName: string): string {
  if (currentUserId !== null && createdBy === currentUserId) {
    return currentUserName;
  }
  return `#${createdBy}`;
}

function DrawingListTable({ items, onDelete, hasNext, onLoadMore, isFetchingMore }: DrawingListTableProps) {
  const { user } = useAuth();

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
          <caption className="sr-only">도면 목록</caption>
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[28%]" />
            <col className="w-[12%]" />
            <col className="w-[17%]" />
            <col className="w-[13%]" />
          </colgroup>
          <thead className="bg-surface text-xs font-bold tracking-wide text-text-muted">
            <tr>
              <th className="px-7 py-4">도면명</th>
              <th className="px-5 py-4">설명</th>
              <th className="px-5 py-4">등록자</th>
              <th className="px-5 py-4">등록일</th>
              <th className="px-5 py-4 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((drawing) => (
              <tr key={drawing.id} className="group transition-colors hover:bg-primary-soft/35">
                <td className="px-7 py-4">
                  <Link
                    to={`/layout/${drawing.id}`}
                    className="block rounded outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="block truncate text-sm font-bold text-ink group-hover:text-primary">
                      {drawing.title}
                    </span>
                    <span className="mt-1 block text-xs text-text-muted">도면 #{drawing.id}</span>
                  </Link>
                </td>
                <td className="px-5 py-4">
                  <span className="block truncate text-sm text-text-muted">
                    {drawing.description}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm font-medium text-text-strong">
                  {creatorLabel(drawing.createdBy, user?.id ?? null, user?.name ?? '')}
                </td>
                <td className="px-5 py-4 text-sm text-text-strong">
                  {formatCreatedAt(drawing.createdAt)}
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(drawing)}
                    aria-label={`도면 #${drawing.id} 삭제`}
                    title="도면 삭제"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-danger-soft hover:text-danger"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasNext && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isFetchingMore}
          className="w-full border-t border-line bg-white px-4 py-3 text-sm font-bold text-text-strong transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isFetchingMore ? '불러오는 중...' : '더 보기'}
        </button>
      )}
    </div>
  );
}

export default DrawingListTable;
