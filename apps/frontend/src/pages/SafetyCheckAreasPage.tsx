import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { safetyCheckApi } from '../features/safetyChecks/api/safetyCheckApi';
import type { InspectionArea } from '../features/safetyChecks/types';
import { formatInspectionDate, getSafetyCheckError } from '../features/safetyChecks/utils';
import SafetyCheckHeader from './safetyChecks/SafetyCheckHeader';

function SafetyCheckAreasPage() {
  const navigate = useNavigate();
  const [areas, setAreas] = useState<InspectionArea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void safetyCheckApi
      .getAreas()
      .then((data) => {
        if (active) setAreas(data);
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
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1360px] px-1 pt-2 pb-10 sm:px-4 lg:pt-4">
      <SafetyCheckHeader
        eyebrow="안전 운영"
        title="안전 점검·체크리스트"
        description="점검할 층 또는 구역을 선택해 이전 점검 이력과 체크리스트 결과를 확인합니다."
      />

      <section className="mt-5" aria-labelledby="inspection-area-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="inspection-area-title" className="text-xl font-black text-ink">
              점검 구역
            </h2>
            <p className="mt-2 text-sm text-text-muted">등록된 구역 {areas.length}곳</p>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-5 flex min-h-64 items-center justify-center rounded-xl border border-line bg-white text-sm text-text-muted">
            점검 구역을 불러오는 중입니다.
          </div>
        ) : error ? (
          <div
            role="alert"
            className="mt-5 flex min-h-64 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 text-sm text-red-600"
          >
            {error}
          </div>
        ) : areas.length === 0 ? (
          <div className="mt-5 flex min-h-64 items-center justify-center rounded-xl border border-line bg-white text-sm text-text-muted">
            등록된 점검 구역이 없습니다.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {areas.map((area) => (
              <button
                key={area.id}
                type="button"
                onClick={() => navigate(`/safety-checklists/areas/${area.id}`)}
                className="group rounded-xl border border-line bg-white p-6 text-left shadow-sm shadow-ink/5 transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <svg
                      aria-hidden="true"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M4 21V5a2 2 0 0 1 2-2h8v18M14 9h6v12M8 7h2M8 11h2M8 15h2M3 21h18" />
                    </svg>
                  </div>
                  <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-text-muted">
                    점검 {area.inspectionCount}회
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-black text-ink group-hover:text-primary">
                  {area.name}
                </h3>
                <p className="mt-2 min-h-10 text-sm leading-5 text-text-muted">
                  {area.description ?? '구역 설명이 없습니다.'}
                </p>
                <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-xs text-text-muted">
                  <span>최근 점검</span>
                  <span className="font-bold text-text-strong">
                    {formatInspectionDate(area.lastInspectedAt)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default SafetyCheckAreasPage;
