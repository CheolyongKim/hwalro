import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui';
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
      <div className="border-b border-line pb-6">
        <PageHeader
          eyebrow="안전 운영"
          title="위험 예상 항목 관리"
          description="시뮬레이션과 현장 점검에서 발견한 위험을 담당자와 상태로 관리합니다."
          actions={
            <Button size="lg" onClick={() => setIsCreateOpen(true)}>
              위험 예상 항목 등록
            </Button>
          }
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-7">
            <h2 className="text-xl font-black text-ink">위험 예상 목록</h2>
            <p className="text-sm tabular-nums text-text-muted">총 {totalCount}건</p>
          </div>
          <div>
            {isPending ? (
              <ul className="divide-y divide-line">
                {Array.from({ length: 4 }).map((_, index) => (
                  <li
                    key={index}
                    className="grid grid-cols-[minmax(0,2.5fr)_1fr_1fr_2fr] items-center gap-x-6 px-5 py-4 sm:px-7"
                  >
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </li>
                ))}
              </ul>
            ) : isError ? (
              <div className="p-5 sm:p-7">
                <ErrorState message={getRiskErrorMessage(error)} />
              </div>
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
        </Card>

        <Card padded={false} className="flex min-h-[500px] flex-col p-6">
          <h2 className="text-xl font-black text-ink">위험 상세</h2>
          <div className="mt-5">
            {selectedItem ? (
              <RiskDetailPanel key={selectedItem.id} risk={selectedItem} />
            ) : (
              <EmptyState icon={ShieldAlert} title="선택된 위험 항목이 없습니다." />
            )}
          </div>
        </Card>
      </div>

      {isCreateOpen && <RiskCreateDialog onClose={() => setIsCreateOpen(false)} />}
    </div>
  );
}

export default RiskManagementPage;
