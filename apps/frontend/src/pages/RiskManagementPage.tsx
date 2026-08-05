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
    <div className="mx-auto w-full max-w-[1360px] px-1 pt-2 pb-10 sm:px-4 lg:pt-4">
      <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-primary">안전 운영</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">
            위험 예상 항목 관리
          </h1>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            시뮬레이션과 현장 점검에서 발견한 위험을 담당자와 상태로 관리합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="h-11 shrink-0 rounded-lg bg-primary px-5 text-sm font-bold text-white transition-colors hover:bg-primary/85"
        >
          위험 예상 항목 등록
        </button>
      </header>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="overflow-hidden rounded-xl border border-line bg-white shadow-sm shadow-ink/5">
          <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-7">
            <h2 className="text-xl font-black text-ink">위험 예상 목록</h2>
            <p className="text-sm text-text-muted">총 {totalCount}건</p>
          </div>
          <div>
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

        <section className="flex min-h-[500px] flex-col rounded-xl border border-line bg-white p-6 shadow-sm shadow-ink/5">
          <h2 className="text-xl font-black text-ink">위험 상세</h2>
          <div className="mt-5">
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
