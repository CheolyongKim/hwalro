import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { safetyCheckApi } from '../features/safetyChecks/api/safetyCheckApi';
import type { InspectionArea, InspectionHistory } from '../features/safetyChecks/types';
import {
  formatInspectionDate,
  getInspectionSummary,
  getSafetyCheckError,
} from '../features/safetyChecks/utils';
import { useAuth } from '../features/auth/context/AuthContext';
import SafetyCheckHeader from './safetyChecks/SafetyCheckHeader';

function SafetyCheckHistoryPage() {
  const { areaId: areaIdParam } = useParams();
  const areaId = Number(areaIdParam);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [area, setArea] = useState<InspectionArea | null>(null);
  const [inspections, setInspections] = useState<InspectionHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!Number.isSafeInteger(areaId) || areaId < 1) {
      setError('올바르지 않은 점검 구역입니다.');
      setIsLoading(false);
      return;
    }
    void Promise.all([safetyCheckApi.getAreas(), safetyCheckApi.getHistory(areaId)])
      .then(([areas, history]) => {
        if (!active) return;
        setArea(areas.find((item) => item.id === areaId) ?? null);
        setInspections(history);
      })
      .catch((requestError: unknown) => {
        if (active) setError(getSafetyCheckError(requestError));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [areaId]);

  async function createInspection() {
    setIsCreating(true);
    setError(null);
    try {
      const inspection = await safetyCheckApi.createInspection(areaId);
      navigate(`/safety-checklists/inspections/${inspection.id}`);
    } catch (requestError) {
      setError(getSafetyCheckError(requestError));
      setIsCreating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1392px] pb-10">
      <SafetyCheckHeader
        eyebrow="점검 구역"
        title={area?.name ?? '점검 이력'}
        description="이 구역에서 수행한 체크리스트를 시간순으로 확인합니다."
        backTo="/safety-checklists"
        backLabel="점검 구역 목록"
        action={
          <button
            type="button"
            onClick={() => void createInspection()}
            disabled={isCreating || !area}
            className="h-11 shrink-0 rounded-lg bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreating ? '생성 중...' : '새 점검 시작'}
          </button>
        }
      />

      <section className="mt-8 overflow-hidden rounded-xl border border-line bg-white shadow-sm shadow-ink/5">
        <div className="border-b border-line px-6 py-5">
          <h2 className="text-xl font-black text-ink">점검 이력</h2>
          <p className="mt-1 text-sm text-text-muted">총 {inspections.length}회</p>
        </div>
        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-text-muted">
            점검 이력을 불러오는 중입니다.
          </div>
        ) : error ? (
          <div className="flex min-h-64 items-center justify-center px-6 text-sm text-red-600">
            {error}
          </div>
        ) : inspections.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="font-bold text-ink">아직 수행한 점검이 없습니다.</p>
            <p className="text-sm text-text-muted">새 점검을 시작하면 이곳에 이력이 쌓입니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {inspections.map((inspection) => {
              const needsAttention = inspection.failCount > 0 || inspection.reviewRequiredCount > 0;
              const inspectorName =
                inspection.inspectorId === user?.id ? user.name : `점검자 #${inspection.inspectorId}`;
              return (
                <button
                  key={inspection.id}
                  type="button"
                  onClick={() => navigate(`/safety-checklists/inspections/${inspection.id}`)}
                  className="grid w-full gap-4 px-6 py-5 text-left transition hover:bg-primary-soft/30 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center"
                >
                  <div>
                    <p className="font-black text-ink">{formatInspectionDate(inspection.updatedAt)}</p>
                    <p className="mt-1 text-xs text-text-muted">점검 #{inspection.id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">점검 담당자</p>
                    <p className="mt-1 text-sm font-bold text-text-strong">{inspectorName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">진행률</p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${inspection.totalItemCount === 0 ? 0 : (inspection.completedItemCount / inspection.totalItemCount) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold text-text-strong">
                        {inspection.completedItemCount}/{inspection.totalItemCount}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 md:justify-end">
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-bold ${needsAttention ? 'bg-danger-soft text-danger' : inspection.status === 'COMPLETED' ? 'bg-primary-soft text-primary' : 'bg-orange-50 text-orange-600'}`}
                    >
                      {getInspectionSummary(inspection)}
                    </span>
                    <span aria-hidden="true" className="text-text-muted">
                      →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default SafetyCheckHistoryPage;
