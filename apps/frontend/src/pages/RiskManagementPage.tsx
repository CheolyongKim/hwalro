import { useState } from 'react';
import { useRiskList } from '../features/risks/hooks/useRiskList';
import { getRiskErrorMessage } from '../features/risks/utils/getRiskErrorMessage';
import RiskCreateDialog from './riskManagement/RiskCreateDialog';
import RiskDetailPanel from './riskManagement/RiskDetailPanel';
import RiskItemTable from './riskManagement/RiskItemTable';

function RiskManagementPage() {
  const {
    items,
    totalCount,
    hasNextPage,
    isPending,
    isError,
    error,
    fetchNextPage,
    isFetchingNextPage,
  } = useRiskList();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const selectedItem = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-[1392px] pb-10">
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-ink">위험 예상 항목 관리</h1>
          <p className="mt-3 text-sm text-text-muted">
            시뮬레이션과 현장 점검에서 발견한 위험을 담당자와 상태로 관리합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="shrink-0 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary/85"
        >
          위험 예상 항목 등록
        </button>
      </header>

      <div className="mt-11 grid grid-cols-1 gap-11 lg:grid-cols-[722fr_342fr]">
        <section className="rounded-lg border border-line bg-white px-5 pb-5 pt-11">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold text-ink">위험 예상 목록</h2>
            <p className="text-sm text-text-muted">전체 {totalCount}건</p>
          </div>
          <div className="mt-6">
            {isPending ? (
              <p className="text-sm text-text-muted">불러오는 중...</p>
            ) : isError ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-600">
                {getRiskErrorMessage(error)}
              </p>
            ) : (
              <RiskItemTable
                items={items}
                selectedId={selectedItem?.id ?? null}
                onSelect={setSelectedId}
                hasNext={hasNextPage}
                onLoadMore={() => void fetchNextPage()}
                isFetchingMore={isFetchingNextPage}
              />
            )}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white px-7 pb-7 pt-9">
          <h2 className="text-2xl font-bold text-ink">위험 상세</h2>
          <div className="mt-12">
            {selectedItem ? (
              <RiskDetailPanel key={selectedItem.id} risk={selectedItem} />
            ) : (
              <p className="text-sm text-text-muted">선택된 위험 항목이 없습니다.</p>
            )}
          </div>
        </section>
      </div>

      {isCreateOpen && <RiskCreateDialog onClose={() => setIsCreateOpen(false)} />}
    </div>
  );
}

export default RiskManagementPage;
