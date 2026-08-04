import type { Risk } from '../../features/risks/types/risks';
import { formatDate } from '../../features/risks/utils/formatDate';

const TABLE_HEADERS = ['위험 예상 항목', '심각도', '담당자', '등록일'] as const;

const TABLE_COLUMNS = 'grid-cols-[minmax(0,2.5fr)_1fr_1fr_2fr]';

function RiskItemTable({
  items,
  selectedId,
  onSelect,
  hasNext,
  onLoadMore,
  isFetchingMore,
}: {
  items: Risk[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  hasNext: boolean;
  onLoadMore: () => void;
  isFetchingMore: boolean;
}) {
  return (
    <div>
      <div
        className={`grid ${TABLE_COLUMNS} items-center gap-x-6 rounded-lg bg-surface px-5 py-3.5`}
      >
        {TABLE_HEADERS.map((header) => (
          <span key={header} className="text-sm font-bold text-text-muted">
            {header}
          </span>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-text-muted">등록된 위험 항목이 없습니다.</p>
      ) : (
        <ul className="mt-2.5 space-y-2.5">
          {items.map((item) => {
            const isSelected = item.id === selectedId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-pressed={isSelected}
                  className={`grid w-full ${TABLE_COLUMNS} items-center gap-x-6 border px-5 py-4 text-left transition-colors ${
                    isSelected
                      ? 'border-line bg-primary-soft'
                      : 'border-line bg-white hover:bg-surface'
                  }`}
                >
                  <span className="text-sm font-bold text-ink">{item.title}</span>
                  <span className="text-sm text-text-strong">{item.severity}</span>
                  <span className="text-sm text-text-strong">{item.assigneeId ?? '-'}</span>
                  <span className="text-sm text-text-strong">{formatDate(item.createdAt)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {hasNext && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isFetchingMore}
          className="mt-2.5 w-full rounded-lg border border-line bg-white px-4 py-3 text-sm font-bold text-text-strong transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isFetchingMore ? '불러오는 중...' : '더 보기'}
        </button>
      )}
    </div>
  );
}

export default RiskItemTable;
