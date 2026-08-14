import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { simulationApi } from '../../simulations/api/simulationApi';
import type { SimulationDrawing, SimulationSetup } from '../../simulations/types';
import { getSimulationErrorMessage } from '../../simulations/utils/getSimulationErrorMessage';
import type { SearchStatus } from '../api/layoutSearchApi';
import { CandidateDetailPanel } from '../components/CandidateDetailPanel';
import { CandidateList } from '../components/CandidateList';
import { CandidateTabs } from '../components/NoImprovementPanel';
import { ConstraintInspector } from '../components/ConstraintInspector';
import { DiagnosisPanel } from '../components/DiagnosisPanel';
import { HoldToCompare } from '../components/HoldToCompare';
import { SearchProgressHeader } from '../components/SearchProgressHeader';
import { useLayoutSearch } from '../hooks/useLayoutSearch';
import { applyChangeSet } from '../utils/applyChangeSet';
import '../layoutSearch.css';

const DIAGNOSIS_LOADING_STATUSES: SearchStatus[] = ['PENDING', 'DIAGNOSING', 'GENERATING'];

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

export default function LayoutSearchPage() {
  const { simulationId = '' } = useParams();
  const navigate = useNavigate();
  const id = Number(simulationId);
  const [sourceSetup, setSourceSetup] = useState<SimulationSetup | null>(null);
  const [sourceLoading, setSourceLoading] = useState(true);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [selectedTabKey, setSelectedTabKey] = useState<string | null>(null);
  const {
    search,
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
    resetToSetup,
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
    setSelectedTabKey(null);
  }, [search?.searchId]);

  const improvedCandidates = search?.improvedCandidates ?? [];

  // 거부된 후보는 "그 자리에 넣을 수 없다"는 사실일 뿐 제안이 아니므로 탭에 올리지 않는다.
  const defaultTabKey = useMemo(
    () => (improvedCandidates.length > 0 ? `i-${improvedCandidates[0].candidateId}` : null),
    [improvedCandidates],
  );

  const activeTabKey = selectedTabKey ?? defaultTabKey;

  const selectedCandidate = useMemo(() => {
    if (activeTabKey === null) {
      return null;
    }
    const candidateId = Number(activeTabKey.slice(2));
    return improvedCandidates.find((entry) => entry.candidateId === candidateId) ?? null;
  }, [activeTabKey, improvedCandidates]);

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

  const runSearch = useCallback(async () => {
    if (await start()) {
      setSelectedTabKey(null);
    }
  }, [start]);

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
      <main className="constraint-page">
        <header className="constraint-page__header">
          <button
            type="button"
            aria-label="시뮬레이션 결과 화면으로 돌아가기"
            className="constraint-page__back"
            onClick={() => navigate(`/simulations/${id}/results`)}
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          </button>
          <div className="constraint-page__heading">
            <span>배치 개선안 탐색</span>
            <h1>구조물 제약 설정</h1>
            <p>{sourceSetup?.drawing.title ?? ''}</p>
          </div>
        </header>
        {sourceSetup && (
          <div className="constraint-page__body">
            <ConstraintInspector
              drawing={sourceSetup.drawing}
              constraints={constraints}
              onChange={updateConstraints}
              onStart={() => void runSearch()}
              starting={starting}
            />
          </div>
        )}
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
        onRerun={resetToSetup}
        rerunning={false}
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
            onSelect={(candidateId) => setSelectedTabKey(`i-${candidateId}`)}
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
                    ? '현재 탐색 범위에서 개선안을 찾지 못했습니다'
                    : '검증 중인 배치'}
              </h2>
            </div>
          </div>
          <CandidateTabs
            improved={search.improvedCandidates}
            activeKey={activeTabKey ?? ''}
            onSelect={setSelectedTabKey}
          />
          <div className="comparison-plans">
            <div className="comparison-plan">
              <div className="comparison-plan__heading">
                <div>
                  <span>배치 도면 비교</span>
                  <strong>{selectedCandidate ? '기존 배치와 개선 배치' : '시도 배치'}</strong>
                </div>
                {selectedCandidate && (
                  <p>
                    기본으로 개선 배치를 표시합니다. 캔버스를 누르는 동안 반대 배치를 볼 수
                    있습니다.
                  </p>
                )}
              </div>
              {selectedCandidate && sourceSetup && preview.drawing ? (
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
                  {active
                    ? '개선안이 검증되면 배치를 표시합니다.'
                    : '현재 탐색 범위에서 개선안을 찾지 못했습니다.'}
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
            onReject={() => void rejectCandidate(selectedCandidate.candidateId)}
            rejecting={starting}
          />
        ) : (
          <aside className="search-insight">
            <p>
              {search.status === 'NO_IMPROVEMENT'
                ? '구조물 제약을 조정한 뒤 다시 탐색하면 다른 배치안을 찾을 수 있습니다.'
                : '개선안이 검증되면 상세 비교를 볼 수 있습니다.'}
            </p>
          </aside>
        )}
      </div>
    </main>
  );
}
