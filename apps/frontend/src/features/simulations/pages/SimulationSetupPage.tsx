import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SimulationCanvas } from '../components/SimulationCanvas';
import type { SimulationTool } from '../components/SimulationCanvas';
import { simulationApi } from '../api/simulationApi';
import type { EditableHazardZone, SimulationPoint, SimulationSetup } from '../types';
import {
  AGENT_RADIUS,
  MAX_AGENTS,
  addSprayedAgents,
  createUniformPlacement,
  eraseAgents,
} from '../utils/placement';
import { getSimulationErrorMessage } from '../utils/getSimulationErrorMessage';
import { useRecordLastActivity } from '../../home/hooks/useRecordLastActivity';

interface PlacementSnapshot {
  agents: SimulationPoint[];
  hazards: EditableHazardZone[];
}

type LoadState = 'loading' | 'ready' | 'error';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface InfoTooltipProps {
  id: string;
  label: string;
  align?: 'left' | 'right';
  children: ReactNode;
}

const TOOL_LABELS: Array<{ value: SimulationTool; label: string }> = [
  { value: 'select', label: '선택' },
  { value: 'spray', label: '에이전트 배치' },
  { value: 'erase', label: '지우개' },
  { value: 'hazard', label: '위험구역' },
];

function InfoTooltip({ id, label, align = 'left', children }: InfoTooltipProps) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] leading-none outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        i
      </button>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none invisible absolute top-full z-30 mt-2 w-48 rounded-lg bg-ink px-3 py-2 text-[11px] font-medium leading-5 text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${align === 'right' ? 'right-0' : 'left-0'}`}
      >
        {children}
      </span>
    </span>
  );
}

function sameSnapshot(a: PlacementSnapshot, b: PlacementSnapshot): boolean {
  return a.agents === b.agents && a.hazards === b.hazards;
}

function SimulationSetupPage() {
  const { simulationId = '' } = useParams();
  const navigate = useNavigate();
  const recordLastActivity = useRecordLastActivity();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [executing, setExecuting] = useState(false);
  const [setup, setSetup] = useState<SimulationSetup | null>(null);
  const [agents, setAgents] = useState<SimulationPoint[]>([]);
  const [hazards, setHazards] = useState<EditableHazardZone[]>([]);
  const [selectedExitIds, setSelectedExitIds] = useState<number[]>([]);
  const [highlightedExitId, setHighlightedExitId] = useState<number | null>(null);
  const [walkingSpeed, setWalkingSpeed] = useState(1.25);
  const [reactionTime, setReactionTime] = useState(0.5);
  const [tool, setTool] = useState<SimulationTool>('spray');
  const [sprayRadius, setSprayRadius] = useState(1);
  const [eraserRadius, setEraserRadius] = useState(1);
  const [uniformCount, setUniformCount] = useState(100);
  const [selectedHazardId, setSelectedHazardId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [, setHistoryRevision] = useState(0);
  const placementRef = useRef<PlacementSnapshot>({ agents: [], hazards: [] });
  const pastRef = useRef<PlacementSnapshot[]>([]);
  const futureRef = useRef<PlacementSnapshot[]>([]);
  const gestureOriginRef = useRef<PlacementSnapshot | null>(null);
  const hazardSequenceRef = useRef(0);

  const replacePlacement = useCallback((next: PlacementSnapshot) => {
    placementRef.current = next;
    setAgents(next.agents);
    setHazards(next.hazards);
  }, []);

  const commitPlacement = useCallback(
    (next: PlacementSnapshot) => {
      const current = placementRef.current;
      if (sameSnapshot(current, next)) return;
      pastRef.current = [...pastRef.current.slice(-29), current];
      futureRef.current = [];
      setHistoryRevision((revision) => revision + 1);
      replacePlacement(next);
    },
    [replacePlacement],
  );

  const loadSetup = useCallback(
    (data: SimulationSetup) => {
      const loadedHazards = data.hazardZones.map((hazard, index) => ({
        ...hazard,
        clientId: `hazard-${hazard.id ?? index}-${hazardSequenceRef.current++}`,
      }));
      setSetup(data);
      setSelectedExitIds(data.selectedExitIds);
      setHighlightedExitId(null);
      setWalkingSpeed(data.walkingSpeed);
      setReactionTime(data.reactionTime);
      setSelectedHazardId(null);
      pastRef.current = [];
      futureRef.current = [];
      gestureOriginRef.current = null;
      setHistoryRevision((revision) => revision + 1);
      replacePlacement({ agents: data.agentPositions, hazards: loadedHazards });
    },
    [replacePlacement],
  );

  useEffect(() => {
    const id = Number(simulationId);
    if (!Number.isInteger(id) || id <= 0) {
      setMessage('잘못된 시뮬레이션 번호입니다.');
      setLoadState('error');
      return;
    }
    let cancelled = false;
    setLoadState('loading');
    simulationApi
      .getSetup(id)
      .then((data) => {
        if (!cancelled) {
          loadSetup(data);
          setLoadState('ready');
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMessage(getSimulationErrorMessage(error));
          setLoadState('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadSetup, simulationId]);

  const undo = useCallback(() => {
    const previous = pastRef.current[pastRef.current.length - 1];
    if (!previous) return;
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [placementRef.current, ...futureRef.current].slice(0, 30);
    setHistoryRevision((revision) => revision + 1);
    replacePlacement(previous);
    setSelectedHazardId(null);
  }, [replacePlacement]);

  const redo = useCallback(() => {
    const next = futureRef.current[0];
    if (!next) return;
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current.slice(-29), placementRef.current];
    setHistoryRevision((revision) => revision + 1);
    replacePlacement(next);
    setSelectedHazardId(null);
  }, [replacePlacement]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (modifier && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  if (loadState === 'loading') {
    return (
      <div className="flex h-dvh items-center justify-center bg-background text-sm text-text-muted">
        시뮬레이션 설정을 불러오는 중...
      </div>
    );
  }

  if (loadState === 'error' || setup === null) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700"
        >
          {message ?? '시뮬레이션 설정을 불러오지 못했습니다.'}
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

  const editable = setup.status === 'DRAFT';
  const allExitsSelected =
    setup.drawing.exits.length > 0 &&
    setup.drawing.exits.every((exit) => selectedExitIds.includes(exit.id));
  const selectedHazard = hazards.find((hazard) => hazard.clientId === selectedHazardId) ?? null;

  const beginGesture = () => {
    if (editable && gestureOriginRef.current === null) {
      gestureOriginRef.current = placementRef.current;
    }
  };

  const endGesture = () => {
    const origin = gestureOriginRef.current;
    gestureOriginRef.current = null;
    if (origin && !sameSnapshot(origin, placementRef.current)) {
      pastRef.current = [...pastRef.current.slice(-29), origin];
      futureRef.current = [];
      setHistoryRevision((revision) => revision + 1);
    }
  };

  const applySpray = (point: SimulationPoint) => {
    if (!editable) return;
    const current = placementRef.current;
    const nextAgents = addSprayedAgents(point, sprayRadius, setup.drawing, current.agents);
    if (nextAgents !== current.agents) replacePlacement({ ...current, agents: nextAgents });
    if (nextAgents.length >= MAX_AGENTS)
      setMessage(`최대 ${MAX_AGENTS.toLocaleString()}명까지 배치할 수 있습니다.`);
  };

  const applyErase = (point: SimulationPoint) => {
    if (!editable) return;
    const current = placementRef.current;
    const nextAgents = eraseAgents(point, eraserRadius, current.agents);
    if (nextAgents.length !== current.agents.length) {
      replacePlacement({ ...current, agents: nextAgents });
    }
  };

  const createHazard = (point: SimulationPoint) => {
    if (!editable) return;
    const hazard: EditableHazardZone = {
      clientId: `hazard-new-${hazardSequenceRef.current++}`,
      centerX: point.x,
      centerY: point.y,
      radius: 2,
    };
    commitPlacement({ ...placementRef.current, hazards: [...hazards, hazard] });
    setSelectedHazardId(hazard.clientId);
    setTool('select');
  };

  const moveHazard = (clientId: string, point: SimulationPoint) => {
    if (!editable) return;
    const current = placementRef.current;
    replacePlacement({
      ...current,
      hazards: current.hazards.map((hazard) =>
        hazard.clientId === clientId ? { ...hazard, centerX: point.x, centerY: point.y } : hazard,
      ),
    });
  };

  const handleUniformPlacement = () => {
    if (!editable) return;
    setMessage(null);
    if (!Number.isInteger(uniformCount) || uniformCount < 0 || uniformCount > MAX_AGENTS) {
      setMessage(`균등 배치 인원은 0명부터 ${MAX_AGENTS.toLocaleString()}명까지 입력해 주세요.`);
      return;
    }
    const result = createUniformPlacement(uniformCount, setup.drawing, setup.randomSeed);
    if (result.capacity < uniformCount) {
      setMessage(
        `현재 공간에는 최대 ${result.capacity.toLocaleString()}명까지 균등 배치할 수 있습니다.`,
      );
      return;
    }
    commitPlacement({ ...placementRef.current, agents: result.positions });
  };

  const handleClearAgents = () => {
    if (!editable || agents.length === 0) return;
    if (
      !window.confirm(
        `배치된 에이전트 ${agents.length.toLocaleString()}명을 모두 삭제할까요?\n위험구역과 시뮬레이션 조건은 유지됩니다.`,
      )
    ) {
      return;
    }
    commitPlacement({ ...placementRef.current, agents: [] });
  };

  const validateOptions = (): string | null => {
    if (reactionTime < 0.1 || reactionTime > 2) {
      return '속도 반응시간은 0.1초 이상 2.0초 이하로 입력해 주세요.';
    }
    if (walkingSpeed <= 0 || walkingSpeed > 3) {
      return '희망 이동속도는 0보다 크고 3.0m/s 이하로 입력해 주세요.';
    }
    return null;
  };

  const saveCurrentSetup = async (): Promise<SimulationSetup | null> => {
    const validationMessage = validateOptions();
    if (validationMessage) {
      setMessage(validationMessage);
      return null;
    }

    setMessage(null);
    try {
      const saved = await simulationApi.updateSetup(setup.simulationId, {
        walkingSpeed,
        reactionTime,
        agentPositions: agents,
        hazardZones: hazards.map(({ centerX, centerY, radius }) => ({ centerX, centerY, radius })),
        selectedExitIds,
      });
      loadSetup(saved);
      recordLastActivity('SIMULATION_SETUP', saved.simulationId);
      return saved;
    } catch (error) {
      setMessage(getSimulationErrorMessage(error));
      return null;
    }
  };

  const handleSave = async () => {
    if (!editable || saveState === 'saving' || executing) return;
    setSaveState('saving');
    const saved = await saveCurrentSetup();
    if (saved) {
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1800);
    } else {
      setSaveState('error');
    }
  };

  const handleExecute = async () => {
    if (!editable || executing || saveState === 'saving') return;
    if (agents.length === 0) {
      setMessage('시뮬레이션을 실행하려면 에이전트를 1명 이상 배치해 주세요.');
      return;
    }
    if (selectedExitIds.length === 0) {
      setMessage('시뮬레이션을 실행하려면 출입구를 1개 이상 선택해 주세요.');
      return;
    }

    setExecuting(true);
    setSaveState('saving');
    try {
      const saved = await saveCurrentSetup();
      if (!saved) {
        setSaveState('error');
        return;
      }
      await simulationApi.execute(saved.simulationId);
      navigate('/simulations');
    } catch (error) {
      setSaveState('error');
      setMessage(getSimulationErrorMessage(error));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <main className="flex h-dvh min-w-[960px] flex-col overflow-hidden bg-background text-ink">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-white px-5">
        <button
          type="button"
          onClick={() => navigate(`/layout/${setup.drawing.layoutId}`)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-text-strong hover:bg-surface"
          aria-label="도면 편집 화면으로 돌아가기"
        >
          ←
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-black">시뮬레이션 배치 · {setup.drawing.title}</h1>
          <p className="text-xs text-text-muted">
            도면 버전 ID #{setup.layoutVersionId} · {setup.modelProfile}
          </p>
        </div>
        <span className="ml-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
          {setup.status}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={!editable || pastRef.current.length === 0}
            className="h-9 rounded-lg border border-line px-3 text-sm font-bold text-text-strong disabled:opacity-40"
          >
            실행 취소
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!editable || futureRef.current.length === 0}
            className="h-9 rounded-lg border border-line px-3 text-sm font-bold text-text-strong disabled:opacity-40"
          >
            다시 실행
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!editable || saveState === 'saving' || executing}
            className="h-9 rounded-lg border border-primary px-4 text-sm font-bold text-primary disabled:opacity-50"
          >
            {saveState === 'saving'
              ? '저장 중...'
              : saveState === 'saved'
                ? '저장 완료'
                : '설정 저장'}
          </button>
          <button
            type="button"
            onClick={() => void handleExecute()}
            disabled={!editable || executing || saveState === 'saving'}
            title={
              agents.length === 0
                ? '에이전트를 1명 이상 배치해 주세요.'
                : selectedExitIds.length === 0
                  ? '출입구를 1개 이상 선택해 주세요.'
                  : undefined
            }
            className="h-9 rounded-lg bg-primary px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {executing ? '실행 요청 중...' : '시뮬레이션 실행'}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="relative min-w-0 flex-1" aria-label="배치 미리보기">
          <SimulationCanvas
            drawing={setup.drawing}
            agents={agents}
            hazards={hazards}
            tool={editable ? tool : 'select'}
            brushRadius={tool === 'erase' ? eraserRadius : sprayRadius}
            selectedHazardId={selectedHazardId}
            selectedExitIds={selectedExitIds}
            highlightedExitId={highlightedExitId}
            onSpray={applySpray}
            onErase={applyErase}
            onCreateHazard={createHazard}
            onMoveHazard={moveHazard}
            onSelectHazard={setSelectedHazardId}
            onGestureStart={beginGesture}
            onGestureEnd={endGesture}
          />
          <div className="absolute left-4 top-4 z-10 flex gap-2 rounded-xl border border-line bg-white p-2 shadow-lg">
            {TOOL_LABELS.map((item) => (
              <button
                key={item.value}
                type="button"
                disabled={!editable}
                onClick={() => setTool(item.value)}
                className={`h-9 rounded-lg px-3 text-xs font-bold transition-all duration-300 disabled:opacity-40 ${
                  tool === item.value
                    ? item.value === 'erase'
                      ? 'scale-105 bg-danger text-white shadow-md shadow-red-200'
                      : 'scale-105 bg-primary text-white shadow-md shadow-emerald-200'
                    : 'bg-surface text-text-strong hover:bg-primary-soft'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {message && (
            <div
              role="alert"
              className="absolute bottom-4 left-1/2 z-10 flex max-w-xl -translate-x-1/2 items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg"
            >
              <span>{message}</span>
              <button
                type="button"
                onClick={() => setMessage(null)}
                className="font-black"
                aria-label="알림 닫기"
              >
                ×
              </button>
            </div>
          )}
        </section>

        <aside className="w-[360px] shrink-0 overflow-y-auto border-l border-line bg-white p-5">
          <section>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-bold text-text-muted">전체 배치 인원</p>
                <p className="mt-1 text-2xl font-black text-primary">
                  {agents.length.toLocaleString()}명
                </p>
              </div>
              <p className="text-xs text-text-muted">최대 {MAX_AGENTS.toLocaleString()}명</p>
            </div>
          </section>

          <section className="mt-6 border-t border-line pt-5">
            <div
              aria-live="polite"
              className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-all duration-300 ${
                tool === 'erase'
                  ? 'scale-[1.02] border-red-200 bg-red-50 text-danger shadow-sm'
                  : tool === 'spray'
                    ? 'border-emerald-200 bg-emerald-50 text-primary shadow-sm'
                    : 'border-line bg-surface text-text-strong'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex size-7 items-center justify-center rounded-full text-base font-black transition-all duration-300 ${
                    tool === 'erase'
                      ? 'scale-110 bg-red-100 text-danger'
                      : tool === 'spray'
                        ? 'bg-emerald-100 text-primary'
                        : 'bg-white text-text-muted'
                  }`}
                  aria-hidden="true"
                >
                  {tool === 'erase' ? '−' : tool === 'spray' ? '+' : '·'}
                </span>
                <h2 className="text-sm font-black">
                  {tool === 'erase' ? '에이전트 지우기' : '에이전트 배치'}
                </h2>
              </div>
              <span className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-black">
                {tool === 'erase' ? '지우개 모드' : tool === 'spray' ? '배치 모드' : '도구 대기'}
              </span>
            </div>
            {(tool === 'spray' || tool === 'erase') && (
              <label className="mt-4 block text-xs font-bold text-text-muted">
                {tool === 'erase' ? '지우개' : '스프레이'} 크기 ·{' '}
                {(tool === 'erase' ? eraserRadius : sprayRadius).toFixed(1)}m
                <input
                  type="range"
                  min={AGENT_RADIUS}
                  max={5}
                  step={0.1}
                  value={tool === 'erase' ? eraserRadius : sprayRadius}
                  onChange={(event) => {
                    const radius = Number(event.target.value);
                    if (tool === 'erase') setEraserRadius(radius);
                    else setSprayRadius(radius);
                  }}
                  disabled={!editable}
                  className="mt-2 w-full accent-primary"
                />
              </label>
            )}
            <div className="mt-4 flex gap-2">
              <label className="min-w-0 flex-1 text-xs font-bold text-text-muted">
                균등 배치 인원
                <input
                  type="number"
                  min={0}
                  max={MAX_AGENTS}
                  value={uniformCount}
                  onChange={(event) => setUniformCount(Number(event.target.value))}
                  disabled={!editable}
                  className="mt-2 h-10 w-full rounded-lg border border-line px-3 text-sm text-ink outline-none focus:border-primary"
                />
              </label>
              <button
                type="button"
                onClick={handleUniformPlacement}
                disabled={!editable}
                className="mt-6 h-10 rounded-lg bg-primary-soft px-3 text-xs font-bold text-primary disabled:opacity-40"
              >
                균등분포 배치
              </button>
            </div>
            <button
              type="button"
              onClick={handleClearAgents}
              disabled={!editable || agents.length === 0}
              className="mt-3 h-10 w-full rounded-lg border border-red-200 text-xs font-bold text-danger disabled:cursor-not-allowed disabled:opacity-40"
            >
              에이전트 전체 삭제
            </button>
          </section>

          <section className="mt-6 border-t border-line pt-5">
            <h2 className="text-sm font-black">시뮬레이션 조건</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="text-xs font-bold text-text-muted">
                <div className="flex items-center gap-1">
                  <label htmlFor="walking-speed">희망 이동속도 (m/s)</label>
                  <InfoTooltip id="walking-speed-help" label="희망 이동속도 안내">
                    에이전트가 방해받지 않을 때 목표로 하는 속도입니다. 일반 자유 보행의 대표 평균은
                    약 1.34m/s이며, 3m/s는 빠른 대피 상황을 고려한 시스템 상한입니다. 실제 속도는
                    혼잡도와 상호작용에 따라 달라집니다.
                    <span className="mt-1 block text-white/70">
                      출처: Weidmann (1993), ETH Zürich
                    </span>
                  </InfoTooltip>
                </div>
                <input
                  id="walking-speed"
                  type="number"
                  min={0.1}
                  max={3}
                  step={0.05}
                  value={walkingSpeed}
                  onChange={(event) => setWalkingSpeed(Number(event.target.value))}
                  disabled={!editable}
                  className="mt-2 h-10 w-full rounded-lg border border-line px-3 text-sm text-ink outline-none focus:border-primary"
                />
              </div>
              <div className="text-xs font-bold text-text-muted">
                <div className="flex items-center gap-1">
                  <label htmlFor="reaction-time">속도 반응시간 (초)</label>
                  <InfoTooltip id="reaction-time-help" label="속도 반응시간 안내" align="right">
                    현재 속도가 희망속도와 방향에 적응하는 시간상수 τ입니다. 값이 작을수록 속도가 더
                    빠르게 변하며, 출발 전 대기시간은 아닙니다.
                    <span className="my-1 block font-mono text-[10px] text-white">
                      Fdrv = (희망속도 벡터 - 현재속도 벡터) / τ
                    </span>
                    JuPedSim SFM 기본값은 0.5초이고, 시스템 허용 범위는 0.1~2.0초입니다.
                    <span className="mt-1 block text-white/70">
                      출처: JuPedSim SFM, Helbing et al. (2000)
                    </span>
                  </InfoTooltip>
                </div>
                <input
                  id="reaction-time"
                  type="number"
                  min={0.1}
                  max={2}
                  step={0.1}
                  value={reactionTime}
                  onChange={(event) => setReactionTime(Number(event.target.value))}
                  disabled={!editable}
                  className="mt-2 h-10 w-full rounded-lg border border-line px-3 text-sm text-ink outline-none focus:border-primary"
                />
              </div>
            </div>
          </section>

          <section className="mt-6 border-t border-line pt-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">사용 출입구</h2>
              <button
                type="button"
                disabled={!editable || setup.drawing.exits.length === 0}
                onClick={() =>
                  setSelectedExitIds(
                    allExitsSelected ? [] : setup.drawing.exits.map((exit) => exit.id),
                  )
                }
                className="rounded-lg border border-primary px-2.5 py-1 text-xs font-bold text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                {allExitsSelected ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            <p className="mt-1 text-xs leading-5 text-text-muted">
              DRAFT 저장은 출입구를 선택하지 않아도 가능합니다.
            </p>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {setup.drawing.exits.length === 0 ? (
                <p className="rounded-lg bg-surface px-3 py-3 text-xs text-text-muted">
                  등록된 출입구가 없습니다.
                </p>
              ) : (
                setup.drawing.exits.map((exit) => (
                  <label
                    key={exit.id}
                    onMouseEnter={() => setHighlightedExitId(exit.id)}
                    onMouseLeave={(event) => {
                      if (!event.currentTarget.contains(document.activeElement)) {
                        setHighlightedExitId(null);
                      }
                    }}
                    onFocus={() => setHighlightedExitId(exit.id)}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        setHighlightedExitId(null);
                      }
                    }}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      highlightedExitId === exit.id
                        ? 'border-amber-400 bg-amber-50'
                        : selectedExitIds.includes(exit.id)
                          ? 'border-blue-500 bg-blue-50 text-blue-800'
                          : 'border-line'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedExitIds.includes(exit.id)}
                      disabled={!editable}
                      onChange={(event) =>
                        setSelectedExitIds((ids) =>
                          event.target.checked
                            ? [...ids, exit.id]
                            : ids.filter((id) => id !== exit.id),
                        )
                      }
                      className="accent-blue-600"
                    />
                    <span>{exit.name}</span>
                  </label>
                ))
              )}
            </div>
          </section>

          <section className="mt-6 border-t border-line pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <h2 className="text-sm font-black">위험구역</h2>
                <InfoTooltip id="hazard-cost-help" label="위험구역 경로 비용 안내">
                  에이전트의 대피 경로를 비교할 때 사용하는 상대 비용입니다.
                  <span className="my-1 block font-mono text-[10px] leading-4 text-white">
                    depth = clamp(1 - 중심거리 / 반지름, 0, 1)
                    <br />원 밖: M = 1
                    <br />원 안: M = 5 × 100^depth
                    <br />
                    간선 비용 = 길이 / 6 × (시작점 M + 4 × 중간점 M + 끝점 M)
                  </span>
                  경계는 5, 반지름 중간은 50, 중심은 500입니다. 전체 경로는 모든 간선 비용을
                  합산하고, 위험구역이 겹치면 가장 큰 M만 적용합니다.
                  <span className="mt-1 block text-white/70">
                    HAZARD_RADIAL_EXP_V3 · 활로가 정의한 상대 비용이며 공인 위험도나 사망확률이
                    아닙니다.
                  </span>
                </InfoTooltip>
              </div>
              <span className="text-xs text-text-muted">{hazards.length}개</span>
            </div>
            {selectedHazard ? (
              <div className="mt-3 rounded-xl border border-red-100 bg-red-50/60 p-3">
                <label className="text-xs font-bold text-red-700">
                  반지름 · {selectedHazard.radius.toFixed(1)}m
                  <input
                    type="range"
                    min={0.3}
                    max={20}
                    step={0.1}
                    value={selectedHazard.radius}
                    disabled={!editable}
                    onPointerDown={beginGesture}
                    onPointerUp={endGesture}
                    onPointerCancel={endGesture}
                    onKeyDown={beginGesture}
                    onKeyUp={endGesture}
                    onBlur={endGesture}
                    onChange={(event) => {
                      const radius = Number(event.target.value);
                      const current = placementRef.current;
                      replacePlacement({
                        ...current,
                        hazards: current.hazards.map((hazard) =>
                          hazard.clientId === selectedHazard.clientId
                            ? { ...hazard, radius }
                            : hazard,
                        ),
                      });
                    }}
                    className="mt-2 w-full accent-danger"
                  />
                </label>
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => {
                    commitPlacement({
                      ...placementRef.current,
                      hazards: hazards.filter(
                        (hazard) => hazard.clientId !== selectedHazard.clientId,
                      ),
                    });
                    setSelectedHazardId(null);
                  }}
                  className="mt-3 h-9 w-full rounded-lg border border-red-200 text-xs font-bold text-danger disabled:opacity-40"
                >
                  선택 위험구역 삭제
                </button>
              </div>
            ) : (
              <p className="mt-3 rounded-lg bg-surface px-3 py-3 text-xs leading-5 text-text-muted">
                위험구역 도구로 원을 추가하거나 선택 도구로 기존 위험구역을 선택하세요.
              </p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

export default SimulationSetupPage;
