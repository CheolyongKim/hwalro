import { Link } from 'react-router-dom';
import type { PriorityRiskItem } from '../types/home';

interface PriorityRiskPanelProps {
  items: PriorityRiskItem[];
  isPending: boolean;
  isError: boolean;
  errorMessage: string;
  onRetry: () => void;
}

function RiskRow({ item }: { item: PriorityRiskItem }) {
  return (
    <li className="rounded-xl border-l-4 border-danger bg-danger-soft px-4 py-3">
      <p className="text-xs font-bold text-danger">긴급</p>
      <p className="mt-1 text-sm font-bold text-ink">{item.title}</p>
      <p className="mt-1 text-xs text-text-muted">
        {item.status}
        {item.assigneeName ? ` · 담당 ${item.assigneeName}` : ''}
      </p>
    </li>
  );
}

export function PriorityRiskPanel({
  items,
  isPending,
  isError,
  errorMessage,
  onRetry,
}: PriorityRiskPanelProps) {
  return (
    <section
      aria-label="우선 확인할 항목"
      className="flex min-h-80 flex-col rounded-2xl border border-line bg-white p-6 shadow-sm shadow-ink/5"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black tracking-tight text-ink">우선 확인할 항목</h2>
        {!isPending && !isError && items.length > 0 && (
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-danger-soft px-2 text-xs font-bold text-danger">
            {items.length}
          </span>
        )}
      </div>

      {isPending ? (
        <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
          위험 항목을 불러오는 중입니다.
        </div>
      ) : isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
          >
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-bold text-text-strong hover:bg-surface"
          >
            다시 시도
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-center text-sm text-text-muted">
          우선 확인할 항목이 없습니다.
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {items.map((item) => (
            <RiskRow key={item.id} item={item} />
          ))}
        </ul>
      )}

      <Link
        to="/risk-management"
        className="mt-auto flex items-center justify-between gap-3 rounded-xl bg-ink px-5 py-4 text-sm font-bold text-white hover:opacity-90"
      >
        모든 위험 항목 확인
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime text-ink"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </Link>
    </section>
  );
}
