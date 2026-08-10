import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/context/AuthContext';
import { safetyCheckApi } from '../features/safetyChecks/api/safetyCheckApi';
import type { InspectionArea } from '../features/safetyChecks/types';
import { formatInspectionDate, getSafetyCheckError } from '../features/safetyChecks/utils';
import SafetyCheckHeader from './safetyChecks/SafetyCheckHeader';

interface AreaEditor {
  id: number | null;
  name: string;
  description: string;
}

function SafetyCheckAreasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [areas, setAreas] = useState<InspectionArea[]>([]);
  const [editor, setEditor] = useState<AreaEditor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const canManage = user?.roles.includes('ADMIN') || user?.roles.includes('SAFETY_REVIEWER');

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

  function openCreateEditor() {
    setEditor({ id: null, name: '', description: '' });
    setActionError(null);
  }

  function openEditEditor(area: InspectionArea) {
    setEditor({ id: area.id, name: area.name, description: area.description ?? '' });
    setActionError(null);
  }

  async function saveArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || !canManage) return;

    const name = editor.name.trim();
    if (!name) {
      setActionError('점검 구역 이름을 입력하세요.');
      return;
    }

    setIsSaving(true);
    setActionError(null);
    try {
      const body = { name, description: editor.description.trim() || null };
      if (editor.id === null) {
        const created = await safetyCheckApi.createArea(body);
        navigate(`/safety-checklists/areas/${created.id}/template`);
        return;
      }

      const updated = await safetyCheckApi.updateArea(editor.id, body);
      setAreas((current) => current.map((area) => (area.id === updated.id ? updated : area)));
      setEditor(null);
    } catch (requestError) {
      setActionError(getSafetyCheckError(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteArea(area: InspectionArea) {
    if (
      !window.confirm(`‘${area.name}’ 점검 구역을 삭제하시겠습니까? 기존 점검 이력은 보존됩니다.`)
    ) {
      return;
    }

    setDeletingId(area.id);
    setActionError(null);
    try {
      await safetyCheckApi.deleteArea(area.id);
      setAreas((current) => current.filter((item) => item.id !== area.id));
      if (editor?.id === area.id) setEditor(null);
    } catch (requestError) {
      setActionError(getSafetyCheckError(requestError));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1360px] px-1 pt-2 pb-10 sm:px-4 lg:pt-4">
      <SafetyCheckHeader
        eyebrow="안전 운영"
        title="안전 점검·체크리스트"
        description="독립적으로 관리하는 점검 구역을 선택해 이전 점검 이력과 체크리스트 결과를 확인합니다."
      />

      <section className="mt-5" aria-labelledby="inspection-area-title">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="inspection-area-title" className="text-xl font-black text-ink">
              점검 구역
            </h2>
            <p className="mt-2 text-sm text-text-muted">등록된 구역 {areas.length}곳</p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={openCreateEditor}
              className="h-11 shrink-0 rounded-lg bg-primary px-5 text-sm font-bold text-white transition hover:bg-primary/85"
            >
              점검 구역 추가
            </button>
          )}
        </div>

        {actionError && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
          >
            {actionError}
          </div>
        )}

        {editor && (
          <form
            onSubmit={(event) => void saveArea(event)}
            className="mt-5 rounded-xl border border-primary/20 bg-primary-soft/30 p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-black text-ink">
                {editor.id === null ? '점검 구역 추가' : '점검 구역 수정'}
              </h3>
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="rounded-lg px-3 py-2 text-sm font-bold text-text-muted hover:bg-white"
              >
                취소
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-xs font-bold text-text-muted">
                구역 이름 <span className="text-danger">*</span>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={editor.name}
                  onChange={(event) => setEditor({ ...editor, name: event.target.value })}
                  className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </label>
              <label className="text-xs font-bold text-text-muted">
                설명
                <input
                  type="text"
                  maxLength={1000}
                  value={editor.description}
                  onChange={(event) => setEditor({ ...editor, description: event.target.value })}
                  className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="h-10 rounded-lg bg-primary px-5 text-sm font-bold text-white hover:bg-primary/85 disabled:opacity-50"
              >
                {isSaving ? '저장 중...' : editor.id === null ? '추가 후 항목 설정' : '저장'}
              </button>
            </div>
          </form>
        )}

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
          <div className="mt-5 flex min-h-64 flex-col items-center justify-center gap-4 rounded-xl border border-line bg-white px-6 text-center">
            <p className="text-sm text-text-muted">등록된 점검 구역이 없습니다.</p>
            {canManage && (
              <button
                type="button"
                onClick={openCreateEditor}
                className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-white hover:bg-primary/85"
              >
                첫 점검 구역 추가
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {areas.map((area) => (
              <article
                key={area.id}
                className="group overflow-hidden rounded-xl border border-line bg-white shadow-sm shadow-ink/5 transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/safety-checklists/areas/${area.id}`)}
                  className="w-full p-6 text-left"
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
                {canManage && (
                  <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openEditEditor(area)}
                      className="rounded-lg px-3 py-2 text-sm font-bold text-text-strong hover:bg-surface"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteArea(area)}
                      disabled={deletingId === area.id}
                      className="rounded-lg px-3 py-2 text-sm font-bold text-danger hover:bg-danger-soft disabled:opacity-50"
                    >
                      {deletingId === area.id ? '삭제 중...' : '삭제'}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default SafetyCheckAreasPage;
