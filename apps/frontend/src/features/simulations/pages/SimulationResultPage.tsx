import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { simulationApi } from '../api/simulationApi';
import { SimulationCanvas } from '../components/SimulationCanvas';
import type {
  EditableHazardZone,
  SimulationExecution,
  SimulationSetup,
  SimulationTimelineChunk,
} from '../types';
import { getSimulationErrorMessage } from '../utils/getSimulationErrorMessage';
import { findTimelineFrames, interpolateTimeline } from '../utils/timeline';

const FRAMES_PER_CHUNK = 10;
const NOOP = () => undefined;

function formatSeconds(value: number | undefined): string {
  if (value === undefined) return '-';
  return `${value.toFixed(1)}초`;
}

function SimulationResultPage() {
  const { simulationId = '' } = useParams();
  const navigate = useNavigate();
  const id = Number(simulationId);
  const [setup, setSetup] = useState<SimulationSetup | null>(null);
  const [execution, setExecution] = useState<SimulationExecution | null>(null);
  const [chunks, setChunks] = useState<Record<number, SimulationTimelineChunk>>({});
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const lastAnimationTimeRef = useRef<number | null>(null);
  const requestedChunksRef = useRef(new Set<number>());

  const refreshExecution = useCallback(() => simulationApi.getExecution(id), [id]);

  useEffect(() => {
    if (!Number.isSafeInteger(id) || id < 1) {
      setMessage('올바르지 않은 시뮬레이션 번호입니다.');
      setLoading(false);
      return;
    }
    let active = true;
    Promise.all([simulationApi.getSetup(id), simulationApi.getExecution(id)])
      .then(([loadedSetup, loadedExecution]) => {
        if (!active) return;
        setSetup(loadedSetup);
        setExecution(loadedExecution);
      })
      .catch((error: unknown) => {
        if (active) setMessage(getSimulationErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (execution?.status !== 'REQUESTED' && execution?.status !== 'RUNNING') return;
    let cancelled = false;
    let timer = 0;
    const poll = async () => {
      try {
        const next = await refreshExecution();
        if (cancelled) return;
        setExecution(next);
        if (next.status === 'REQUESTED' || next.status === 'RUNNING') {
          timer = window.setTimeout(() => void poll(), 1000);
        }
      } catch (error) {
        if (cancelled) return;
        setMessage(getSimulationErrorMessage(error));
        timer = window.setTimeout(() => void poll(), 1000);
      }
    };
    timer = window.setTimeout(() => void poll(), 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [execution?.status, refreshExecution]);

  const loadChunk = useCallback(
    async (sequence: number) => {
      if (sequence < 0 || requestedChunksRef.current.has(sequence)) return;
      requestedChunksRef.current.add(sequence);
      try {
        const chunk = await simulationApi.getTimelineChunk(id, sequence);
        setChunks((current) => ({ ...current, [sequence]: chunk }));
      } catch (error) {
        requestedChunksRef.current.delete(sequence);
        throw error;
      }
    },
    [id],
  );

  const result = execution?.result ?? null;
  const duration = result?.simulationDurationSeconds ?? 0;
  const frameInterval = result?.frameIntervalSeconds ?? 1;
  const chunkSequence = Math.min(
    Math.max(0, (result?.timelineChunkCount ?? 1) - 1),
    Math.floor(currentTime / (frameInterval * FRAMES_PER_CHUNK)),
  );

  useEffect(() => {
    if (execution?.status !== 'COMPLETED' || !result || result.timelineChunkCount === 0) return;
    for (const sequence of [chunkSequence - 1, chunkSequence, chunkSequence + 1]) {
      if (sequence >= 0 && sequence < result.timelineChunkCount && !chunks[sequence]) {
        void loadChunk(sequence).catch((error: unknown) => {
          setMessage(getSimulationErrorMessage(error));
        });
      }
    }
  }, [chunkSequence, chunks, execution?.status, loadChunk, result]);

  useEffect(() => {
    if (!playing || !result) {
      lastAnimationTimeRef.current = null;
      return;
    }
    let animationFrame = 0;
    const tick = (now: number) => {
      const previous = lastAnimationTimeRef.current ?? now;
      lastAnimationTimeRef.current = now;
      setCurrentTime((time) => {
        const next = Math.min(duration, time + ((now - previous) / 1000) * playbackRate);
        if (next >= duration) setPlaying(false);
        return next;
      });
      animationFrame = window.requestAnimationFrame(tick);
    };
    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [duration, playbackRate, playing, result]);

  const visibleFrames = useMemo(
    () =>
      Object.values(chunks)
        .flatMap((chunk) => chunk.frames)
        .sort((a, b) => a.timeSeconds - b.timeSeconds),
    [chunks],
  );
  const renderedAgents = useMemo(() => {
    const [previous, next] = findTimelineFrames(visibleFrames, currentTime);
    if (!previous) return setup?.agentPositions ?? [];
    return interpolateTimeline(previous, next, currentTime);
  }, [currentTime, setup?.agentPositions, visibleFrames]);
  const renderedHazards = useMemo<EditableHazardZone[]>(
    () =>
      setup?.hazardZones.map((hazard, index) => ({
        ...hazard,
        clientId: `result-hazard-${hazard.id ?? index}`,
      })) ?? [],
    [setup?.hazardZones],
  );

  const metric = (type: string) =>
    result?.metrics.find((item) => item.metricType === type)?.metricValue;

  const retry = async () => {
    setRetrying(true);
    setMessage(null);
    try {
      setExecution(await simulationApi.execute(id));
      setChunks({});
      requestedChunksRef.current.clear();
      setCurrentTime(0);
      setPlaying(false);
    } catch (error) {
      setMessage(getSimulationErrorMessage(error));
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background text-sm text-text-muted">
        시뮬레이션 결과를 불러오는 중입니다.
      </div>
    );
  }

  if (!setup || !execution) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-6">
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700"
        >
          {message ?? '시뮬레이션 결과를 불러오지 못했습니다.'}
        </p>
        <button
          type="button"
          onClick={() => navigate('/drawings')}
          className="h-10 rounded-lg bg-primary px-5 text-sm font-bold text-white"
        >
          도면 목록으로 이동
        </button>
      </div>
    );
  }

  const running = execution.status === 'REQUESTED' || execution.status === 'RUNNING';
  const statusLabel =
    execution.status === 'REQUESTED'
      ? '실행 대기'
      : execution.status === 'RUNNING'
        ? '실행 중'
        : execution.status === 'COMPLETED'
          ? '실행 완료'
          : execution.status === 'FAILED'
            ? '실행 실패'
            : '실행 전';

  return (
    <main className="flex h-dvh min-w-[960px] flex-col overflow-hidden bg-background text-ink">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-white px-5">
        <button
          type="button"
          onClick={() => navigate(`/simulations/${id}/setup`)}
          className="flex h-9 items-center rounded-lg border border-line px-3 text-sm font-bold text-text-strong hover:bg-surface"
        >
          배치 화면
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-black">시뮬레이션 결과 · {setup.drawing.title}</h1>
          <p className="text-xs text-text-muted">
            시뮬레이션 #{id} · {setup.modelProfile}
          </p>
        </div>
        <span className="ml-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
          {statusLabel}
        </span>
        {execution.status === 'COMPLETED' && result && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (currentTime >= duration) setCurrentTime(0);
                setPlaying((value) => !value);
              }}
              className="h-9 rounded-lg bg-primary px-4 text-sm font-bold text-white"
            >
              {playing ? '일시정지' : '재생'}
            </button>
            {[0.5, 1, 2].map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setPlaybackRate(rate)}
                className={`h-9 rounded-lg px-3 text-xs font-bold ${playbackRate === rate ? 'bg-primary-soft text-primary' : 'border border-line text-text-muted'}`}
              >
                {rate}×
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="relative min-w-0 flex-1" aria-label="시뮬레이션 결과 재생">
          <SimulationCanvas
            drawing={setup.drawing}
            agents={renderedAgents}
            hazards={renderedHazards}
            tool="select"
            brushRadius={0.3}
            selectedHazardId={null}
            onSpray={NOOP}
            onErase={NOOP}
            onCreateHazard={NOOP}
            onMoveHazard={NOOP}
            onSelectHazard={NOOP}
            onGestureStart={NOOP}
            onGestureEnd={NOOP}
          />
          {running && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
              <div className="rounded-xl border border-line bg-white px-6 py-5 text-center shadow-xl">
                <p className="font-black text-ink">{statusLabel}</p>
                <p className="mt-2 text-sm text-text-muted">
                  JuPedSim이 대피 경로를 계산하고 있습니다.
                </p>
              </div>
            </div>
          )}
          {result && (
            <div className="absolute bottom-4 left-1/2 z-10 w-[min(720px,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-line bg-white/95 px-5 py-3 shadow-lg">
              <div className="flex items-center gap-4">
                <span className="w-16 text-right text-xs font-bold text-text-strong">
                  {currentTime.toFixed(1)}초
                </span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(duration, 0.1)}
                  step={0.1}
                  value={currentTime}
                  onChange={(event) => {
                    setPlaying(false);
                    setCurrentTime(Number(event.target.value));
                  }}
                  className="min-w-0 flex-1 accent-primary"
                  aria-label="재생 시간"
                />
                <span className="w-16 text-xs font-bold text-text-muted">
                  {duration.toFixed(1)}초
                </span>
              </div>
            </div>
          )}
        </section>

        <aside className="w-[360px] shrink-0 overflow-y-auto border-l border-line bg-white p-5">
          <h2 className="text-lg font-black">실행 결과</h2>
          {message && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700"
            >
              {message}
            </p>
          )}
          {execution.status === 'FAILED' && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="font-bold text-red-700">실행에 실패했습니다.</p>
              <p className="mt-2 text-sm leading-5 text-red-600">
                {execution.failureMessage ?? '엔진 오류를 확인해주세요.'}
              </p>
              <button
                type="button"
                onClick={() => void retry()}
                disabled={retrying}
                className="mt-4 h-9 rounded-lg bg-primary px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {retrying ? '재시도 중…' : '동일 설정으로 재시도'}
              </button>
            </div>
          )}
          {execution.status === 'DRAFT' && (
            <button
              type="button"
              onClick={() => navigate(`/simulations/${id}/setup`)}
              className="mt-4 h-10 w-full rounded-lg bg-primary px-4 text-sm font-bold text-white"
            >
              배치 설정으로 돌아가기
            </button>
          )}
          {result && (
            <>
              <dl className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-surface p-4">
                  <dt className="text-xs font-bold text-text-muted">모의시간</dt>
                  <dd className="mt-2 text-lg font-black">
                    {formatSeconds(result.simulationDurationSeconds)}
                  </dd>
                </div>
                <div className="rounded-xl bg-surface p-4">
                  <dt className="text-xs font-bold text-text-muted">종료 사유</dt>
                  <dd className="mt-2 text-sm font-black">
                    {result.terminationReason === 'ALL_EVACUATED' ? '전원 대피' : '최대시간 도달'}
                  </dd>
                </div>
                <div className="rounded-xl bg-surface p-4">
                  <dt className="text-xs font-bold text-text-muted">대피 완료</dt>
                  <dd className="mt-2 text-lg font-black text-primary">
                    {metric('EVACUATED_PEOPLE')?.toLocaleString() ?? '-'}명
                  </dd>
                </div>
                <div className="rounded-xl bg-surface p-4">
                  <dt className="text-xs font-bold text-text-muted">잔류 인원</dt>
                  <dd className="mt-2 text-lg font-black text-danger">
                    {metric('REMAINING_PEOPLE')?.toLocaleString() ?? '-'}명
                  </dd>
                </div>
              </dl>
              <div className="mt-5 space-y-3 border-t border-line pt-5 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">전원 대피시간</span>
                  <strong>{formatSeconds(metric('TOTAL_EVACUATION_TIME_SECONDS'))}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">평균 대피시간</span>
                  <strong>{formatSeconds(metric('AVERAGE_EVACUATION_TIME_SECONDS'))}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">엔진</span>
                  <strong className="text-right text-xs">{result.engineVersion}</strong>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

export default SimulationResultPage;
