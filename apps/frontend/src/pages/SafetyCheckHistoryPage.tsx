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
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const canManageTemplate =
    user?.roles.includes('ADMIN') || user?.roles.includes('SAFETY_REVIEWER');

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
    setActionError(null);
    try {
      const inspection = await safetyCheckApi.createInspection(areaId);
      navigate(`/safety-checklists/inspections/${inspection.id}`);
    } catch (requestError) {
      setActionError(getSafetyCheckError(requestError));
      setIsCreating(false);
    }
  }

  async function deleteInspection(inspection: InspectionHistory) {
    const confirmed = window.confirm(
      `점검 #${inspection.id}을 삭제하시겠습니까? 삭제한 작성 중 점검은 복구할 수 없습니다.`,
    );
    if (!confirmed) return;

    setDeletingId(inspection.id);
    setActionError(null);
    try {
      await safetyCheckApi.deleteInspection(inspection.id);
      setInspections((current) => current.filter((item) => item.id !== inspection.id));
    } catch (requestError) {
      setActionError(getSafetyCheckError(requestError));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1360px] px-1 pt-2 pb-10 sm:px-4 lg:pt-4">
      <SafetyCheckHeader
        eyebrow="점검 구역"
        title={area?.name ?? '점검 이력'}
        description="이 구역에서 수행한 체크리스트를 시간순으로 확인합니다."
        backTo="/safety-checklists"
        backLabel="점검 구역 목록"
        action={
          <div className="flex flex-wrap gap-3">
            {canManageTemplate && (
              <button
                type="button"
                onClick={() => navigate(`/safety-checklists/areas/${areaId}/template`)}
                disabled={!area}
                className="h-11 rounded-lg border border-line-strong bg-white px-5 text-sm font-bold text-text-strong hover:bg-surface disabled:opacity-50"
              >
                점검 항목 관리
              </button>
            )}
            <button
              type="button"
              onClick={() => void createInspection()}
              disabled={isCreating || !area}
              className="h-11 shrink-0 rounded-lg bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating ? '생성 중...' : '새 점검 시작'}
            </button>
          </div>
        }
      />

      {actionError && (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {actionError}
        </div>
      )}

      <section className="mt-5 overflow-hidden rounded-xl border border-line bg-white shadow-sm shadow-ink/5">
        <div className="border-b border-line px-5 py-4 sm:px-7">
          <h2 className="text-xl font-black text-ink">점검 이력</h2>
          <p className="mt-1 text-sm text-text-muted">총 {inspections.length}회</p>
        </div>
        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-text-muted">
            점검 이력을 불러오는 중입니다.
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex min-h-64 items-center justify-center px-6 text-sm text-red-600"
          >
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
                inspection.inspectorId === user?.id
                  ? user.name
                  : `점검자 #${inspection.inspectorId}`;
              const canDelete =
                inspection.status === 'DRAFT' &&
                (inspection.inspectorId === user?.id || user?.roles.includes('ADMIN'));
              return (
                <div key={inspection.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => navigate(`/safety-checklists/inspections/${inspection.id}`)}
                    className="grid w-full gap-4 px-5 py-4 text-left transition hover:bg-primary-soft/30 sm:px-7 md:grid-cols-2 md:items-center xl:grid-cols-[minmax(0,1.35fr)_minmax(10rem,0.9fr)_minmax(14rem,1fr)_18rem]"
                  >
                    <div>
                      <p className="font-black text-ink">
                        {formatInspectionDate(inspection.createdAt)}
                      </p>
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
                    <div
                      className={`flex flex-wrap items-center gap-2 md:justify-end ${canDelete ? 'pr-10' : ''}`}
                    >
                      <span
                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${inspection.status === 'COMPLETED' ? 'bg-primary-soft text-primary' : 'bg-orange-50 text-orange-600'}`}
                      >
                        {inspection.status === 'COMPLETED' ? '점검 완료' : '작성 중'}
                      </span>
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
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => void deleteInspection(inspection)}
                      disabled={deletingId === inspection.id}
                      aria-label={`점검 #${inspection.id} 삭제`}
                      title="작성 중 점검 삭제"
                      className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-text-muted transition hover:bg-danger-soft hover:text-danger disabled:opacity-40"
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default SafetyCheckHistoryPage;
