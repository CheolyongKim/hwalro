import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { mockSimulationResultProvider } from '../api/simulationResultProvider';
import { EvacuationProgressChart } from '../components/EvacuationProgressChart';
import { SimulationPlaybackStage } from '../components/SimulationPlaybackStage';
import { useSimulationPlayback } from '../hooks/useSimulationPlayback';
import type { Bounds, RiskZone, SimulationResultViewModel } from '../types';
import { formatDuration, selectFramePair } from '../utils/playback';
import '../simulationResult.css';
import '../simulationResultMotion.css';

const COMPACT_SUPPORT_PANEL_QUERY = '(max-width: 1400px), (max-height: 900px)';
const NARROW_RESULT_VIEWPORT_QUERY = '(max-width: 1100px)';

function shouldStartWithCompactSupportPanels() {
  return typeof window !== 'undefined' && window.matchMedia(COMPACT_SUPPORT_PANEL_QUERY).matches;
}

function ResultView({ result }: { result: SimulationResultViewModel }) {
  const navigate = useNavigate();
  const playback = useSimulationPlayback(result.durationSeconds);
  const [summaryMinimized, setSummaryMinimized] = useState(false);
  const [summaryCollapsing, setSummaryCollapsing] = useState(false);
  const [selectedBottleneckId, setSelectedBottleneckId] = useState<number | null>(1);
  const [riskDrawingMode, setRiskDrawingMode] = useState(false);
  const [riskZones, setRiskZones] = useState<RiskZone[]>([]);
  const [pendingBounds, setPendingBounds] = useState<Bounds | null>(null);
  const [zoneName, setZoneName] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedComparisons, setSelectedComparisons] = useState<number[]>([]);
  const [evacuationChartMinimized, setEvacuationChartMinimized] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(NARROW_RESULT_VIEWPORT_QUERY).matches,
  );
  const [evacuationChartCollapsing, setEvacuationChartCollapsing] = useState(false);
  const [evacuationChartExpanding, setEvacuationChartExpanding] = useState(false);
  const [improvementPanelMinimized, setImprovementPanelMinimized] = useState(
    shouldStartWithCompactSupportPanels,
  );
  const [improvementPanelCollapsing, setImprovementPanelCollapsing] = useState(false);
  const [improvementPanelExpanding, setImprovementPanelExpanding] = useState(false);
  const [resultsRevealed, setResultsRevealed] = useState(false);
  const bottlenecksVisible = playback.hasCompletedPlayback || resultsRevealed;
  const currentFrame = selectFramePair(result.agentFrames, playback.currentTimeSeconds).previous;
  const evacuationRate = Math.round((currentFrame.evacuatedCount / result.totalPeople) * 100);
  const selectedBottleneck = result.bottlenecks.find((item) => item.id === selectedBottleneckId);

  useEffect(() => {
    if (!pendingBounds) return;
    setZoneName('AI 구역 이름 생성 중...');
    const timer = window.setTimeout(() => {
      setZoneName(
        pendingBounds.x > result.drawing.width / 2 ? '동측 혼잡 예상 구역' : '서측 이동 주의 구역',
      );
    }, 600);
    return () => window.clearTimeout(timer);
  }, [pendingBounds, result.drawing.width]);

  useEffect(() => {
    const compactViewport = window.matchMedia(COMPACT_SUPPORT_PANEL_QUERY);
    const minimizeSupportPanel = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      setImprovementPanelCollapsing(false);
      setImprovementPanelExpanding(false);
      setImprovementPanelMinimized(true);
    };

    compactViewport.addEventListener('change', minimizeSupportPanel);
    return () => compactViewport.removeEventListener('change', minimizeSupportPanel);
  }, []);

  useEffect(() => {
    const narrowViewport = window.matchMedia(NARROW_RESULT_VIEWPORT_QUERY);
    const minimizeEvacuationChart = (event: MediaQueryListEvent) => {
      if (!event.matches) return;
      setEvacuationChartCollapsing(false);
      setEvacuationChartExpanding(false);
      setEvacuationChartMinimized(true);
    };

    narrowViewport.addEventListener('change', minimizeEvacuationChart);
    return () => narrowViewport.removeEventListener('change', minimizeEvacuationChart);
  }, []);

  return (
    <main className="simulation-result-page">
      <SimulationPlaybackStage
        result={result}
        currentTimeSeconds={playback.currentTimeSeconds}
        selectedBottleneckId={selectedBottleneckId}
        showBottlenecks={bottlenecksVisible}
        riskDrawingMode={riskDrawingMode}
        riskZones={riskZones}
        onRiskZoneCreated={(bounds) => {
          setPendingBounds(bounds);
          setRiskDrawingMode(false);
        }}
        onViewportPan={() => {
          if (!evacuationChartMinimized) {
            setEvacuationChartExpanding(false);
            setEvacuationChartCollapsing(true);
          }
          if (!improvementPanelMinimized) {
            setImprovementPanelExpanding(false);
            setImprovementPanelCollapsing(true);
          }
        }}
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
          {riskDrawingMode ? '도면을 드래그해 구역을 설정하세요' : '위험 예상 구역 설정'}
        </button>
      </div>

      {summaryMinimized ? (
        <button
          type="button"
          className="summary-restore"
          onClick={() => setSummaryMinimized(false)}
        >
          결과 요약 열기
        </button>
      ) : (
        <aside
          className={`result-summary ${summaryCollapsing ? 'is-collapsing' : ''}`}
          onAnimationEnd={() => {
            if (summaryCollapsing) {
              setSummaryMinimized(true);
              setSummaryCollapsing(false);
            }
          }}
        >
          <div className="summary-header">
            <div>
              <small>SIMULATION RESULT</small>
              <h1 style={{ fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.04em' }}>
                결과 요약
              </h1>
            </div>
            <button
              type="button"
              aria-label="결과 요약 최소화"
              onClick={() => setSummaryCollapsing(true)}
            >
              −
            </button>
          </div>
          <div className="metric-grid">
            <div className="metric metric-wide">
              <span>총 대피 시간</span>
              <strong>{result.durationSeconds}초</strong>
            </div>
            <div className="metric">
              <span>최대 밀집도</span>
              <strong>{result.maxDensity}명/㎡</strong>
            </div>
            <div className="metric">
              <span>병목 구간</span>
              <strong>{result.bottlenecks.length}곳</strong>
            </div>
          </div>
          <div className="evacuation-complete">
            <span>대피 진행 · {currentFrame.evacuatedCount.toLocaleString()}명</span>
            <strong>{evacuationRate}%</strong>
          </div>
          <h2>병목 분석</h2>
          {bottlenecksVisible ? (
            <>
              <div className="bottleneck-list">
                {result.bottlenecks.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={selectedBottleneckId === item.id ? 'is-selected' : ''}
                    onClick={() => setSelectedBottleneckId(item.id)}
                  >
                    <strong>{item.name}</strong>
                    <span>
                      {Math.round(item.endTimeSeconds - item.startTimeSeconds)}초 동안 기준 밀집도
                      초과
                    </span>
                    <em>{item.peakDensity}명/㎡</em>
                  </button>
                ))}
              </div>
              {selectedBottleneck && (
                <p className="analysis-note">
                  기준 {selectedBottleneck.thresholdValue}명/㎡ · 최고{' '}
                  {selectedBottleneck.peakDensity}명/㎡
                </p>
              )}
            </>
          ) : (
            <div className="bottleneck-analysis-locked" role="status">
              <strong>병목 상세 분석 대기</strong>
              <span>시뮬레이션을 끝까지 재생하거나 하단의 결과 보기를 눌러 확인하세요.</span>
            </div>
          )}
          {riskZones.length > 0 && (
            <section className="risk-zone-summary" aria-labelledby="risk-zone-summary-title">
              <h2 id="risk-zone-summary-title">위험 예상 구역</h2>
              <div className="risk-zone-list">
                {riskZones.map((zone) => (
                  <div className="risk-zone-summary-card" key={zone.id}>
                    <strong>{zone.name}</strong>
                    <span>사용자 지정 위험 예상 구역</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          <button type="button" className="primary-action" onClick={() => setReportOpen(true)}>
            AI 보고서 초안 생성
          </button>
        </aside>
      )}

      {evacuationChartMinimized ? (
        <button
          type="button"
          className="evacuation-chart-restore"
          onClick={() => {
            setEvacuationChartMinimized(false);
            setEvacuationChartExpanding(true);
          }}
        >
          시간별 대피 인원 열기
        </button>
      ) : (
        <EvacuationProgressChart
          points={result.evacuationProgress}
          currentTime={playback.currentTimeSeconds}
          duration={result.durationSeconds}
          totalPeople={result.totalPeople}
          isCollapsing={evacuationChartCollapsing}
          isExpanding={evacuationChartExpanding}
          onCollapseEnd={() => {
            if (!evacuationChartCollapsing) return;
            setEvacuationChartMinimized(true);
            setEvacuationChartCollapsing(false);
          }}
          onExpandEnd={() => setEvacuationChartExpanding(false)}
        />
      )}

      <div className="playback-controls">
        <button
          type="button"
          className="playback-toggle"
          aria-label={playback.isPlaying ? '일시정지' : '재생'}
          title={playback.isPlaying ? '일시정지' : '재생'}
          onClick={playback.toggle}
        >
          <span aria-hidden="true">{playback.isPlaying ? 'Ⅱ' : '▶'}</span>
        </button>
        <strong>{formatDuration(playback.currentTimeSeconds)}</strong>
        <input
          aria-label="재생 위치"
          type="range"
          min="0"
          max={result.durationSeconds}
          step="0.1"
          value={playback.currentTimeSeconds}
          onChange={(event) => playback.seek(Number(event.target.value))}
        />
        <span>{formatDuration(result.durationSeconds)}</span>
        <button
          type="button"
          className="playback-rate"
          aria-label={`현재 ${playback.playbackRate}배속, 다음 재생 속도로 변경`}
          onClick={() =>
            playback.setPlaybackRate(
              playback.playbackRate === 1 ? 2 : playback.playbackRate === 2 ? 4 : 1,
            )
          }
        >
          {playback.playbackRate}×
        </button>
        <button
          type="button"
          className={`playback-result ${bottlenecksVisible ? 'is-visible' : ''}`}
          aria-pressed={bottlenecksVisible}
          disabled={bottlenecksVisible}
          onClick={() => {
            playback.pause();
            playback.seek(result.durationSeconds);
            setResultsRevealed(true);
          }}
        >
          {bottlenecksVisible ? '결과 표시됨' : '결과 보기'}
        </button>
      </div>

      {improvementPanelMinimized ? (
        <button
          type="button"
          className="improvement-action-restore"
          onClick={() => {
            setImprovementPanelMinimized(false);
            setImprovementPanelExpanding(true);
          }}
        >
          배치 개선안 비교 열기
        </button>
      ) : (
        <section
          className={`improvement-action floating-surface ${improvementPanelCollapsing ? 'is-collapsing' : ''} ${improvementPanelExpanding ? 'is-expanding' : ''}`}
          onAnimationEnd={() => {
            if (improvementPanelCollapsing) {
              setImprovementPanelMinimized(true);
              setImprovementPanelCollapsing(false);
            }
            if (improvementPanelExpanding) setImprovementPanelExpanding(false);
          }}
        >
          <div className="improvement-action-header">
            <div>
              <small>LAYOUT IMPROVEMENT</small>
              <strong>배치 개선안 비교</strong>
            </div>
            <button
              type="button"
              className="improvement-collapse"
              aria-label="배치 개선안 비교 최소화"
              onClick={() => {
                setImprovementPanelExpanding(false);
                setImprovementPanelCollapsing(true);
              }}
            >
              −
            </button>
          </div>
          <p>현재 결과를 기준으로 개선 시뮬레이션 3개를 비교합니다.</p>
          <button
            type="button"
            onClick={() => window.alert('개선안 비교 페이지는 다음 단계에서 연결됩니다.')}
          >
            개선안 3개 비교하기
          </button>
        </section>
      )}

      {pendingBounds && (
        <div
          className="dialog-backdrop zone-editor-backdrop"
          role="presentation"
          onMouseDown={() => setPendingBounds(null)}
        >
          <section
            className="zone-editor floating-surface"
            role="dialog"
            aria-modal="true"
            aria-labelledby="zone-editor-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="zone-editor-title">위험 예상 구역 이름</h2>
            <input
              aria-label="위험 예상 구역 이름"
              value={zoneName}
              onChange={(event) => setZoneName(event.target.value)}
              autoFocus
            />
            <div>
              <button type="button" onClick={() => setPendingBounds(null)}>
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setRiskZones((zones) => [
                    ...zones,
                    { ...pendingBounds, id: crypto.randomUUID(), name: zoneName },
                  ]);
                  setPendingBounds(null);
                }}
              >
                확정
              </button>
            </div>
          </section>
        </div>
      )}

      {reportOpen && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={() => setReportOpen(false)}
        >
          <section
            className="report-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="report-dialog-title">AI 보고서 비교 결과 선택</h2>
            <p>현재 결과와 함께 분석할 시뮬레이션을 최대 3개 선택하세요.</p>
            <div className="current-simulation">
              <strong>{result.title}</strong>
              <span>현재 결과 · 필수</span>
            </div>
            {result.comparableSimulations.map((item) => (
              <label key={item.id}>
                <input
                  type="checkbox"
                  checked={selectedComparisons.includes(item.id)}
                  disabled={
                    !selectedComparisons.includes(item.id) && selectedComparisons.length >= 3
                  }
                  onChange={() =>
                    setSelectedComparisons((values) =>
                      values.includes(item.id)
                        ? values.filter((id) => id !== item.id)
                        : [...values, item.id],
                    )
                  }
                />
                <span>
                  <strong>{item.name}</strong>
                  <small>총 대피 시간 {item.totalEvacuationTime}초</small>
                </span>
              </label>
            ))}
            <div className="dialog-actions">
              <button type="button" onClick={() => setReportOpen(false)}>
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setReportOpen(false);
                  window.alert('보고서 초안 생성 요청을 준비했습니다.');
                }}
              >
                초안 생성하기
              </button>
            </div>
          </section>
        </div>
      )}
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
    mockSimulationResultProvider
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
  if (status === 'loading')
    return <div className="result-state">5,000명 시뮬레이션 결과를 준비하고 있습니다.</div>;
  if (status !== 'ready' || !result)
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
  return <ResultView result={result} />;
}
