import { ArrowRight, FilePlus2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export function QuickActionCard() {
  return (
    <section
      aria-label="빠른 실행"
      className="flex min-h-64 flex-col rounded-xl border border-line bg-surface-subtle p-6"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <FilePlus2 aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <h2 className="mt-5 text-xl font-bold tracking-tight text-ink">새 안전 검토 시작</h2>
      <p className="mt-3 text-sm leading-6 text-text-muted">
        도면 등록부터 시뮬레이션 결과 비교까지 하나의 검토 흐름으로 진행합니다.
      </p>
      <Link
        to="/drawings/new"
        className="mt-auto inline-flex h-10 w-fit items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary-hover"
      >
        새 도면 등록
        <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
      </Link>
    </section>
  );
}
