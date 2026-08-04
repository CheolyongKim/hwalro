import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../features/auth/context/AuthContext';
import { safetyCheckApi } from '../features/safetyChecks/api/safetyCheckApi';
import type { InspectionArea } from '../features/safetyChecks/types';
import { getSafetyCheckError } from '../features/safetyChecks/utils';
import SafetyCheckHeader from './safetyChecks/SafetyCheckHeader';

interface EditableItem {
  key: string;
  title: string;
  criterion: string;
  category: string;
}

const CATEGORY_OPTIONS = [
  { value: 'EVACUATION', label: '피난·대피' },
  { value: 'FIRE', label: '화재·방재' },
  { value: 'STRUCTURE', label: '구조물' },
  { value: 'GUIDANCE', label: '안내·유도' },
  { value: 'CONTROL', label: '접근 통제' },
  { value: 'SIMULATION', label: '시뮬레이션' },
  { value: 'OTHER', label: '기타' },
];

function createEmptyItem(): EditableItem {
  return {
    key: crypto.randomUUID(),
    title: '',
    criterion: '',
    category: 'EVACUATION',
  };
}

function SafetyCheckTemplatePage() {
  const { areaId: areaIdParam } = useParams();
  const areaId = Number(areaIdParam);
  const { user } = useAuth();
  const [area, setArea] = useState<InspectionArea | null>(null);
  const [version, setVersion] = useState(0);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canManage = user?.roles.includes('ADMIN') || user?.roles.includes('SAFETY_REVIEWER');

  useEffect(() => {
    let active = true;
    if (!Number.isSafeInteger(areaId) || areaId < 1) {
      setError('올바르지 않은 점검 구역입니다.');
      setIsLoading(false);
      return;
    }

    void Promise.all([safetyCheckApi.getAreas(), safetyCheckApi.getChecklistTemplate(areaId)])
      .then(([areas, template]) => {
        if (!active) return;
        setArea(areas.find((item) => item.id === areaId) ?? null);
        setVersion(template.version);
        setItems(
          template.items.length > 0
            ? template.items.map((item) => ({
                key: `template-item-${item.id}`,
                title: item.title,
                criterion: item.criterion ?? '',
                category: item.category,
              }))
            : [createEmptyItem()],
        );
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

  function updateItem(key: string, values: Partial<Omit<EditableItem, 'key'>>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...values } : item)),
    );
    setNotice(null);
  }

  function moveItem(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    setItems((current) => {
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    setNotice(null);
  }

  function removeItem(key: string) {
    setItems((current) => current.filter((item) => item.key !== key));
    setNotice(null);
  }

  async function saveTemplate() {
    if (!canManage) return;
    if (items.length === 0 || items.some((item) => !item.title.trim())) {
      setError('모든 점검 항목의 이름을 입력하세요.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await safetyCheckApi.updateChecklistTemplate(areaId, {
        items: items.map((item) => ({
          title: item.title.trim(),
          criterion: item.criterion.trim() || null,
          category: item.category,
        })),
      });
      setVersion(updated.version);
      setItems(
        updated.items.map((item) => ({
          key: `template-item-${item.id}`,
          title: item.title,
          criterion: item.criterion ?? '',
          category: item.category,
        })),
      );
      setNotice(`체크리스트 v${updated.version}을 활성화했습니다. 새 점검부터 적용됩니다.`);
    } catch (requestError) {
      setError(getSafetyCheckError(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-96 w-full max-w-[1392px] items-center justify-center rounded-xl border border-line bg-white text-sm text-text-muted">
        점검 항목을 불러오는 중입니다.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] pb-10">
      <SafetyCheckHeader
        eyebrow="체크리스트 설정"
        title={`${area?.name ?? '점검 구역'} 점검 항목`}
        description="항목을 저장하면 새 템플릿 버전이 생성되며, 기존 점검 이력은 변경되지 않습니다."
        backTo={`/safety-checklists/areas/${areaId}`}
        backLabel="점검 이력으로 돌아가기"
        action={
          canManage ? (
            <button
              type="button"
              onClick={() => void saveTemplate()}
              disabled={isSaving || items.length === 0}
              className="h-11 rounded-lg bg-primary px-5 text-sm font-bold text-white hover:bg-primary/85 disabled:opacity-50"
            >
              {isSaving ? '저장 중...' : '새 버전으로 저장'}
            </button>
          ) : undefined
        }
      />

      {(error || notice) && (
        <div
          className={`mt-5 rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-600' : 'border-primary/20 bg-primary-soft text-primary'}`}
        >
          {error ?? notice}
        </div>
      )}

      {!canManage && (
        <div className="mt-5 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
          점검 항목을 수정할 권한이 없습니다.
        </div>
      )}

      <section className="mt-7 rounded-xl border border-line bg-white p-5 shadow-sm shadow-ink/5 sm:p-7">
        <div className="flex items-end justify-between gap-4 border-b border-line pb-5">
          <div>
            <h2 className="text-xl font-black text-ink">항목 구성</h2>
            <p className="mt-2 text-sm text-text-muted">
              현재 버전 v{version} · 총 {items.length}개 항목
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setItems((current) => [...current, createEmptyItem()])}
              className="rounded-lg border border-primary/30 bg-primary-soft px-4 py-2 text-sm font-bold text-primary hover:bg-primary/15"
            >
              항목 추가
            </button>
          )}
        </div>

        <div className="mt-6 space-y-4">
          {items.map((item, index) => {
            const knownCategory = CATEGORY_OPTIONS.some((option) => option.value === item.category);
            return (
              <article key={item.key} className="rounded-xl border border-line bg-surface/70 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-sm font-black text-primary">
                      {index + 1}
                    </span>
                    <p className="text-sm font-black text-ink">점검 항목</p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveItem(index, -1)}
                        disabled={index === 0}
                        aria-label={`${index + 1}번 항목 위로 이동`}
                        className="h-8 rounded-md px-2 text-sm text-text-muted hover:bg-white disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(index, 1)}
                        disabled={index === items.length - 1}
                        aria-label={`${index + 1}번 항목 아래로 이동`}
                        className="h-8 rounded-md px-2 text-sm text-text-muted hover:bg-white disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        aria-label={`${index + 1}번 항목 삭제`}
                        className="h-8 rounded-md px-2 text-xs font-bold text-danger hover:bg-danger-soft"
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <label className="text-xs font-bold text-text-muted">
                    항목명
                    <input
                      type="text"
                      value={item.title}
                      onChange={(event) => updateItem(item.key, { title: event.target.value })}
                      readOnly={!canManage}
                      maxLength={200}
                      placeholder="점검 항목명을 입력하세요."
                      className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 read-only:bg-surface"
                    />
                  </label>
                  <label className="text-xs font-bold text-text-muted">
                    분류
                    <select
                      value={item.category}
                      onChange={(event) => updateItem(item.key, { category: event.target.value })}
                      disabled={!canManage}
                      className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-primary"
                    >
                      {!knownCategory && <option value={item.category}>{item.category}</option>}
                      {CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="mt-4 block text-xs font-bold text-text-muted">
                  판정 기준
                  <textarea
                    value={item.criterion}
                    onChange={(event) => updateItem(item.key, { criterion: event.target.value })}
                    readOnly={!canManage}
                    placeholder="현장에서 확인할 구체적인 기준을 입력하세요."
                    className="mt-2 min-h-20 w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 read-only:bg-surface"
                  />
                </label>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default SafetyCheckTemplatePage;
