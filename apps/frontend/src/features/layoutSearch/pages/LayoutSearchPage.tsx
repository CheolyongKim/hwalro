import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { simulationApi } from '../../simulations/api/simulationApi';
import type { SimulationDrawing, SimulationSetup } from '../../simulations/types';
import { getSimulationErrorMessage } from '../../simulations/utils/getSimulationErrorMessage';
import type { BudgetPreset, SearchStatus } from '../api/layoutSearchApi';
import { CandidateDetailPanel } from '../components/CandidateDetailPanel';
import { CandidateList } from '../components/CandidateList';
import { ConstraintInspector } from '../components/ConstraintInspector';
import { DiagnosisPanel } from '../components/DiagnosisPanel';
import { HoldToCompare } from '../components/HoldToCompare';
import { RejectedCandidateList } from '../components/RejectedCandidateList';
import { SearchProgressHeader } from '../components/SearchProgressHeader';
import { useLayoutSearch } from '../hooks/useLayoutSearch';
import { applyChangeSet } from '../utils/applyChangeSet';
import { formatDuration } from '../utils/searchLabels';
import '../layoutSearch.css';

const BUDGET_ORDER: BudgetPreset[] = ['QUICK', 'STANDARD', 'THOROUGH'];

const BUDGET_LABELS: Record<BudgetPreset, string> = {
  QUICK: '빠른 탐색',
  STANDARD: '표준 탐색',
  THOROUGH: '전수 탐색',
};

const DIAGNOSIS_LOADING_STATUSES: SearchStatus[] = ['PENDING', 'DIAGNOSING', 'GENERATING'];

export const EXHAUSTIVE_CONFIRMATION_MESSAGE =
  '전수 탐색은 유효한 후보 전체를 실제 엔진으로 검증하므로 수시간에서 수일이 걸릴 수 있습니다. 화면을 닫아도 서버에서 계속 진행됩니다. 시작하시겠습니까?';

export function changedFabricIds(baseline: SimulationDrawing, after: SimulationDrawing) {
  const afterById = new Map(after.fabrics.map((fabric) => [fabric.id, fabric]));
  const changed = new Set<number>();
  baseline.fabrics.forEach((fabric) => {
    const next = afterById.get(fabric.id);
    if (
      next &&
      (fabric.startX !== next.startX ||
        fabric.startY !== next.startY ||
        fabric.endX !== next.endX ||
        fabric.endY !== next.endY ||
        fabric.rotation !== next.rotation)
    ) {
      changed.add(fabric.id);
    }
  });
  return changed;
}

function isKnownEstimate(value: number | null): value is number {
  return value !== null && value >= 0;
}

export default function LayoutSearchPage() {
  const { simulationId = '' } = useParams();
  const navigate = useNavigate();
  const id = Number(simulationId);
  const [sourceSetup, setSourceSetup] = useState<SimulationSetup | null>(null);
  const [sourceLoading, setSourceLoading] = useState(true);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<BudgetPreset>('STANDARD');
  const [constraintPanelOpen, setConstraintPanelOpen] = useState(false);
  const {
    search,
    estimate,
    hasSearch,
    loading,
    starting,
    cancelling,
    preparingCandidateIds,
    errorMessage,
    active,
    constraints,
    initialize,
    start,
    cancel,
    prepareSimulation,
    updateConstraints,
    rejectCandidate,
  } = useLayoutSearch(id);

  const loadSourceSetup = useCallback(async () => {
    if (!Number.isSafeInteger(id) || id < 1) {
      setSourceError('올바르지 않은 시뮬레이션 번호입니다.');
      setSourceLoading(false);
      return;
    }
    setSourceLoading(true);
    setSourceError(null);
    try {
      setSourceSetup(await simulationApi.getSetup(id));
    } catch (error) {
      setSourceError(getSimulationErrorMessage(error));
    } finally {
      setSourceLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadSourceSetup();
  }, [loadSourceSetup]);

  useEffect(() => {
    setSelectedCandidateId(null);
  }, [search?.searchId]);

  const selectedCandidate = useMemo(() => {
    const candidates = search?.improvedCandidates ?? [];
    return (
      candidates.find((candidate) => candidate.candidateId === selectedCandidateId) ??
      candidates[0] ??
      null
    );
  }, [search, selectedCandidateId]);

  const preview = useMemo(() => {
    if (!sourceSetup || !selectedCandidate) {
      return { drawing: null, error: null };
    }
    return applyChangeSet(sourceSetup.drawing, selectedCandidate.changeSet);
  }, [sourceSetup, selectedCandidate]);

  const changedIds = useMemo(() => {
    if (!sourceSetup || !preview.drawing) {
      return undefined;
    }
    return changedFabricIds(sourceSetup.drawing, preview.drawing);
  }, [sourceSetup, preview.drawing]);

  const runSearch = useCallback(
    async (budget: BudgetPreset) => {
      if (budget === 'THOROUGH' && !window.confirm(EXHAUSTIVE_CONFIRMATION_MESSAGE)) {
        return;
      }
      if (await start(budget)) {
        setSelectedCandidateId(null);
      }
    },
    [start],
  );

  const retry = useCallback(() => {
    void Promise.all([loadSourceSetup(), initialize()]);
  }, [initialize, loadSourceSetup]);

  const focusComparison = useCallback(() => {
    document.getElementById('compare-improved-button')?.focus();
  }, []);

  if (loading || sourceLoading) {
    return (
      <div className="improvement-page-state" role="status">
        배치 개선안 탐색을 준비하고 있습니다.
      </div>
    );
  }

  if (sourceError || (!hasSearch && errorMessage)) {
    return (
      <div className="improvement-page-state">
        <p role="alert">{sourceError ?? errorMessage}</p>
        <div className="improvement-page-state__actions">
          <button type="button" onClick={retry}>
            다시 시도
          </button>
          <button type="button" onClick={() => navigate(`/simulations/${id}/results`)}>
            결과 화면
          </button>
        </div>
      </div>
    );
  }

  if (!hasSearch || !search) {
    return (
      <main className="improvement-page">
        <header className="improvement-page-header">
          <button
            type="button"
            className="improvement-back"
            onClick={() => navigate(`/simulations/${id}/results`)}
          >
            ← 결과 화면
          </button>
          <div className="improvement-heading">
            <span>SIMULATION REVIEW / 배치 개선안 탐색</span>
            <h1>배치 개선안 탐색</h1>
            <p>{sourceSetup?.drawing.title ?? ''}</p>
          </div>
        </header>
        <section className="search-start">
          <div className="workspace-section-heading">
            <span>탐색 방식 선택</span>
            <small>검증은 실제 엔진 실행으로 진행됩니다</small>
          </div>
          {estimate && (
            <p className="search-start__baseline">
              기준 실행 1회 약 {formatDuration(estimate.baselineRunSeconds)}
            </p>
          )}
          <div className="budget-options">
            {BUDGET_ORDER.map((budget) => {
              const item = estimate?.budgets.find((entry) => entry.budget === budget);
              const count = item?.trials ?? null;
              const seconds = item?.estimatedSeconds ?? null;
              return (
                <label
                  key={budget}
                  className={`budget-option ${selectedBudget === budget ? 'is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="budget"
                    checked={selectedBudget === budget}
                    onChange={() => setSelectedBudget(budget)}
                  />
                  <strong>{BUDGET_LABELS[budget]}</strong>
                  <span>
                    {isKnownEstimate(count) ? `${count}회 검증` : '후보 생성 후 검증 수 확정'}
                  </span>
                  <em>
                    {isKnownEstimate(seconds)
                      ? `예상 ${formatDuration(seconds)}`
                      : budget === 'THOROUGH'
                        ? '수시간~수일 소요 가능'
                        : '예상 시간 계산 중'}
                  </em>
                  {budget === 'THOROUGH' && (
                    <small>유효 후보 전체를 검증하며 화면을 닫아도 계속 진행됩니다.</small>
                  )}
                </label>
              );
            })}
          </div>
          <button
            type="button"
            className="constraint-toggle"
            aria-expanded={constraintPanelOpen}
            onClick={() => setConstraintPanelOpen((open) => !open)}
          >
            {constraintPanelOpen ? '제약 설정 접기' : '구조물 제약 설정'}
          </button>
          {constraintPanelOpen && sourceSetup && (
            <ConstraintInspector
              drawing={sourceSetup.drawing}
              constraints={constraints}
              onChange={updateConstraints}
              onStart={() => void runSearch(selectedBudget)}
              starting={starting}
            />
          )}
          <button
            type="button"
            className="search-start-button"
            disabled={starting}
            onClick={() => void runSearch(selectedBudget)}
          >
            {starting ? '탐색 준비 중' : '배치 개선안 탐색 시작'}
          </button>
          <p className="search-start__note">
            화면을 떠나도 서버에서 탐색이 계속되며 나중에 돌아와 진행 상태를 확인할 수 있습니다.
          </p>
        </section>
      </main>
    );
  }

  const diagnosisLoading = DIAGNOSIS_LOADING_STATUSES.includes(search.status);

  return (
    <main className="improvement-page">
      <SearchProgressHeader
        search={search}
        onCancel={() => void cancel()}
        cancelling={cancelling}
        onBackToResult={() => navigate(`/simulations/${id}/results`)}
        onRerun={() => void runSearch(search.progress.budget)}
        rerunning={starting}
      />
      {errorMessage && (
        <div className="search-action-error" role="alert">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => void initialize()}>
            새로고침
          </button>
        </div>
      )}
      <div className="improvement-workspace">
        <div className="search-side">
          <DiagnosisPanel diagnosis={search.diagnosis} loading={diagnosisLoading} />
          <CandidateList
            candidates={search.improvedCandidates}
            selectedCandidateId={selectedCandidate?.candidateId ?? null}
            onSelect={setSelectedCandidateId}
          />
        </div>

        <section className="comparison-canvas" aria-labelledby="comparison-title">
          <div className="canvas-heading">
            <div>
              <span>배치 도면 비교</span>
              <h2 id="comparison-title">
                {selectedCandidate
                  ? '기존 배치와 개선 배치'
                  : search.status === 'NO_IMPROVEMENT'
                    ? '개선안을 찾지 못했습니다'
                    : '검증 중인 배치'}
              </h2>
            </div>
            <p>
              버튼으로 배치를 전환해 확인할 수 있으며 공식 검증은 서버의 실제 엔진이 수행합니다.
            </p>
          </div>
          <div className="comparison-plans">
            <div className="comparison-plan">
              <div className="comparison-plan__heading">
                <div>
                  <span>배치 도면 비교</span>
                  <strong>{selectedCandidate ? '기존 배치와 개선 배치' : '개선안 없음'}</strong>
                </div>
                {selectedCandidate && (
                  <p>
                    기본으로 개선 배치를 표시합니다. 캔버스를 누르는 동안 반대 배치를 볼 수
                    있습니다.
                  </p>
                )}
              </div>
              {sourceSetup && preview.drawing && selectedCandidate ? (
                <HoldToCompare
                  before={sourceSetup.drawing}
                  after={preview.drawing}
                  changedFabricIds={changedIds}
                />
              ) : preview.error ? (
                <div className="proposal-layout-error" role="alert">
                  <p>{preview.error}</p>
                  <button type="button" onClick={() => void loadSourceSetup()}>
                    원본 배치 다시 불러오기
                  </button>
                </div>
              ) : (
                <div className="proposal-layout-loading" role="status">
                  {active ? '개선안이 검증되면 배치를 표시합니다.' : '표시할 개선안이 없습니다.'}
                </div>
              )}
            </div>
          </div>
        </section>

        {selectedCandidate ? (
          <CandidateDetailPanel
            candidate={selectedCandidate}
            onPrepareSimulation={() => void prepareSimulation(selectedCandidate.candidateId)}
            preparing={preparingCandidateIds.has(selectedCandidate.candidateId)}
            onContinueComparing={focusComparison}
            previewAvailable={preview.drawing !== null}
            onReject={() => void rejectCandidate(selectedCandidate.candidateId, search.progress.budget)}
            rejecting={starting}
          />
        ) : (
          <aside className="search-insight">
            <p>
              {search.status === 'NO_IMPROVEMENT'
                ? '시도한 변경은 그 밖의 검증 결과에서 확인할 수 있습니다.'
                : '개선안이 검증되면 상세 비교를 볼 수 있습니다.'}
            </p>
          </aside>
        )}
      </div>
      <RejectedCandidateList candidates={search.rejectedCandidates} />
    </main>
  );
}
