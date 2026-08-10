import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { reportApi } from '../../reports/api/reportApi';
import { simulationResultProvider } from '../api/simulationResultProvider';
import { EvacuationProgressChart } from '../components/EvacuationProgressChart';
import { ImprovementComparisonPanel } from '../components/ImprovementComparisonPanel';
import { PlaybackControls } from '../components/PlaybackControls';
import { ReportDraftDialog } from '../components/ReportDraftDialog';
import { ResultSummaryPanel } from '../components/ResultSummaryPanel';
import { RiskZoneEditorDialog } from '../components/RiskZoneEditorDialog';
import { SimulationPlaybackStage } from '../components/SimulationPlaybackStage';
import { useCollapsiblePanel } from '../hooks/useCollapsiblePanel';
import { useSimulationPlayback } from '../hooks/useSimulationPlayback';
import type { Bounds, RiskZone, SimulationResultViewModel } from '../types';
import { selectFramePair } from '../utils/playback';
import '../simulationResult.css';
import '../simulationResultMotion.css';

const COMPACT_SUPPORT_PANEL_QUERY = '(max-width: 1400px), (max-height: 900px)';
const NARROW_RESULT_VIEWPORT_QUERY = '(max-width: 1100px)';

function matchesMediaQuery(query: string) {
  return typeof window !== 'undefined' && window.matchMedia(query).matches;
}

function getReportDraftErrorMessage(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? 'AI 보고서 초안을 생성하지 못했습니다.';
  }
  return 'AI 보고서 초안을 생성하지 못했습니다.';
}

function ResultView({ result }: { result: SimulationResultViewModel }) {
  const navigate = useNavigate();
  const playback = useSimulationPlayback(result.durationSeconds);
  const evacuationChart = useCollapsiblePanel(() =>
    matchesMediaQuery(NARROW_RESULT_VIEWPORT_QUERY),
  );
  const improvementPanel = useCollapsiblePanel(() =>
    matchesMediaQuery(COMPACT_SUPPORT_PANEL_QUERY),
  );
  const [selectedBottleneckId, setSelectedBottleneckId] = useState<number | null>(1);
  const [riskDrawingMode, setRiskDrawingMode] = useState(false);
  const [riskZones, setRiskZones] = useState<RiskZone[]>([]);
  const [pendingBounds, setPendingBounds] = useState<Bounds | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [resultsRevealed, setResultsRevealed] = useState(false);

  const bottlenecksVisible = playback.hasCompletedPlayback || resultsRevealed;
  const currentFrame = selectFramePair(result.agentFrames, playback.currentTimeSeconds).previous;
  const evacuationRate = Math.round((currentFrame.evacuatedCount / result.totalPeople) * 100);

  useEffect(() => {
    const compactViewport = window.matchMedia(COMPACT_SUPPORT_PANEL_QUERY);
    const minimizeSupportPanel = (event: MediaQueryListEvent) => {
      if (event.matches) improvementPanel.minimize();
    };

    compactViewport.addEventListener('change', minimizeSupportPanel);
    return () => compactViewport.removeEventListener('change', minimizeSupportPanel);
  }, [improvementPanel.minimize]);

  useEffect(() => {
    const narrowViewport = window.matchMedia(NARROW_RESULT_VIEWPORT_QUERY);
    const minimizeEvacuationChart = (event: MediaQueryListEvent) => {
      if (event.matches) evacuationChart.minimize();
    };

    narrowViewport.addEventListener('change', minimizeEvacuationChart);
    return () => narrowViewport.removeEventListener('change', minimizeEvacuationChart);
  }, [evacuationChart.minimize]);

  const handleViewportPan = () => {
    if (!evacuationChart.isMinimized) evacuationChart.collapse();
    if (!improvementPanel.isMinimized) improvementPanel.collapse();
  };

  const handleRiskZoneCreated = (bounds: Bounds) => {
    setPendingBounds(bounds);
    setRiskDrawingMode(false);
  };

  const handleRevealResults = () => {
    playback.pause();
    playback.seek(result.durationSeconds);
    setResultsRevealed(true);
  };

  const handleOpenReport = () => {
    setReportError(null);
    setReportOpen(true);
  };

  const handleGenerateReport = async (comparisonResultIds: number[]) => {
    setReportGenerating(true);
    setReportError(null);
    try {
      const report = await reportApi.createAiDraft({
        sourceSimulationResultId: result.simulationResultId,
        comparisonSimulationResultIds: comparisonResultIds,
      });
      setReportOpen(false);
      navigate(`/reports/${report.id}`);
    } catch (error) {
      setReportError(getReportDraftErrorMessage(error));
    } finally {
      setReportGenerating(false);
    }
  };

  return (
    <main className="simulation-result-page">
      <SimulationPlaybackStage
        result={result}
        currentTimeSeconds={playback.currentTimeSeconds}
        selectedBottleneckId={selectedBottleneckId}
        showBottlenecks={bottlenecksVisible}
        riskDrawingMode={riskDrawingMode}
        riskZones={riskZones}
        onRiskZoneCreated={handleRiskZoneCreated}
        onViewportPan={handleViewportPan}
      />

      <button className="back-button" type="button" onClick={() => navigate(-1)}>
        뒤로
      </button>
      <header className="simulation-meta">
        <span className="status-dot" />
        <div>
          <strong>{result.title}</strong>
          <small>{result.subtitle}</small>
        </div>
        <span className="complete-badge">완료</span>
      </header>

      <div className="risk-zone-control">
        <button
          type="button"
          className={`risk-zone-button ${riskDrawingMode ? 'is-active' : ''}`}
          aria-pressed={riskDrawingMode}
          onClick={() => setRiskDrawingMode((value) => !value)}
        >
          {riskDrawingMode ? '도면을 드래그해 구역을 설정하세요' : '위험 예상 항목 설정'}
        </button>
      </div>

      <ResultSummaryPanel
        result={result}
        evacuatedCount={currentFrame.evacuatedCount}
        evacuationRate={evacuationRate}
        bottlenecksVisible={bottlenecksVisible}
        selectedBottleneckId={selectedBottleneckId}
        riskZones={riskZones}
        onSelectBottleneck={setSelectedBottleneckId}
        onOpenReport={handleOpenReport}
      />

      {evacuationChart.isMinimized ? (
        <button
          type="button"
          className="evacuation-chart-restore"
          onClick={evacuationChart.restore}
        >
          시간별 대피 인원 열기
        </button>
      ) : (
        <EvacuationProgressChart
          points={result.evacuationProgress}
          currentTime={playback.currentTimeSeconds}
          duration={result.durationSeconds}
          totalPeople={result.totalPeople}
          isCollapsing={evacuationChart.isCollapsing}
          isExpanding={evacuationChart.isExpanding}
          onCollapseEnd={evacuationChart.handleAnimationEnd}
          onExpandEnd={evacuationChart.handleAnimationEnd}
        />
      )}

      <PlaybackControls
        currentTimeSeconds={playback.currentTimeSeconds}
        durationSeconds={result.durationSeconds}
        isPlaying={playback.isPlaying}
        playbackRate={playback.playbackRate}
        resultsVisible={bottlenecksVisible}
        onToggle={playback.toggle}
        onSeek={playback.seek}
        onPlaybackRateChange={playback.setPlaybackRate}
        onRevealResults={handleRevealResults}
      />

      <ImprovementComparisonPanel
        panel={improvementPanel}
        onCompare={() => window.alert('개선안 비교 페이지는 다음 단계에서 연결됩니다.')}
      />

      {pendingBounds && (
        <RiskZoneEditorDialog
          bounds={pendingBounds}
          drawingWidth={result.drawing.width}
          onCancel={() => setPendingBounds(null)}
          onConfirm={(zone) => {
            setRiskZones((zones) => [...zones, zone]);
            setPendingBounds(null);
          }}
        />
      )}

      <ReportDraftDialog
        open={reportOpen}
        result={result}
        isGenerating={reportGenerating}
        errorMessage={reportError}
        onClose={() => {
          if (!reportGenerating) setReportOpen(false);
        }}
        onGenerate={handleGenerateReport}
      />
    </main>
  );
}

export default function SimulationResultPage() {
  const { simulationId = '1' } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<SimulationResultViewModel | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    simulationResultProvider
      .getResult(simulationId)
      .then((value) => {
        if (!active) return;
        if (!value) setStatus('missing');
        else {
          setResult(value);
          setStatus('ready');
        }
      })
      .catch(() => active && setStatus('error'));
    return () => {
      active = false;
    };
  }, [retry, simulationId]);

  if (status === 'loading') {
    return <div className="result-state">5,000명 시뮬레이션 결과를 준비하고 있습니다.</div>;
  }
  if (status !== 'ready' || !result) {
    return (
      <div className="result-state">
        <p>{status === 'missing' ? '완료된 결과가 없습니다.' : '결과를 불러오지 못했습니다.'}</p>
        <div>
          <button type="button" onClick={() => navigate(-1)}>
            이전 화면
          </button>
          {status === 'error' && (
            <button type="button" onClick={() => setRetry((value) => value + 1)}>
              다시 시도
            </button>
          )}
        </div>
      </div>
    );
  }
  return <ResultView result={result} />;
}
