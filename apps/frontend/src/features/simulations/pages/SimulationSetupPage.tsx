import { useCallback, useEffect, useRef, useState } from 'react';
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

interface PlacementSnapshot {
  agents: SimulationPoint[];
  hazards: EditableHazardZone[];
}

type LoadState = 'loading' | 'ready' | 'error';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const TOOL_LABELS: Array<{ value: SimulationTool; label: string }> = [
  { value: 'select', label: '선택' },
  { value: 'spray', label: '에이전트 배치' },
  { value: 'erase', label: '지우개' },
  { value: 'hazard', label: '위험구역' },
];

function sameSnapshot(a: PlacementSnapshot, b: PlacementSnapshot): boolean {
  return a.agents === b.agents && a.hazards === b.hazards;
}

function SimulationSetupPage() {
  const { simulationId = '' } = useParams();
  const navigate = useNavigate();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [executing, setExecuting] = useState(false);
  const [setup, setSetup] = useState<SimulationSetup | null>(null);
  const [agents, setAgents] = useState<SimulationPoint[]>([]);
  const [hazards, setHazards] = useState<EditableHazardZone[]>([]);
  const [selectedExitIds, setSelectedExitIds] = useState<number[]>([]);
  const [walkingSpeed, setWalkingSpeed] = useState(1.25);
  const [reactionTime, setReactionTime] = useState(0.5);
  const [tool, setTool] = useState<SimulationTool>('spray');
  const [brushRadius, setBrushRadius] = useState(1);
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
    const nextAgents = addSprayedAgents(point, brushRadius, setup.drawing, current.agents);
    if (nextAgents !== current.agents) replacePlacement({ ...current, agents: nextAgents });
    if (nextAgents.length >= MAX_AGENTS)
      setMessage(`최대 ${MAX_AGENTS.toLocaleString()}명까지 배치할 수 있습니다.`);
  };

  const applyErase = (point: SimulationPoint) => {
    if (!editable) return;
    const current = placementRef.current;
    const nextAgents = eraseAgents(point, brushRadius, current.agents);
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

  const validateOptions = (): string | null => {
    if (reactionTime < 0.1 || reactionTime > 2) {
      return '초기 반응시간은 0.1초 이상 2.0초 이하로 입력해 주세요.';
    }
    if (walkingSpeed <= 0 || walkingSpeed > 3) {
      return '평균 이동속도는 0보다 크고 3.0m/s 이하로 입력해 주세요.';
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
      navigate(`/simulations/${saved.simulationId}/result`);
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
            brushRadius={brushRadius}
            selectedHazardId={selectedHazardId}
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
                className={`h-9 rounded-lg px-3 text-xs font-bold transition-colors disabled:opacity-40 ${
                  tool === item.value
                    ? 'bg-primary text-white'
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
            <h2 className="text-sm font-black">에이전트 배치</h2>
            <label className="mt-4 block text-xs font-bold text-text-muted">
              스프레이 크기 · {brushRadius.toFixed(1)}m
              <input
                type="range"
                min={AGENT_RADIUS}
                max={5}
                step={0.1}
                value={brushRadius}
                onChange={(event) => setBrushRadius(Number(event.target.value))}
                disabled={!editable}
                className="mt-2 w-full accent-primary"
              />
            </label>
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
          </section>

          <section className="mt-6 border-t border-line pt-5">
            <h2 className="text-sm font-black">시뮬레이션 조건</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs font-bold text-text-muted">
                평균 이동속도 (m/s)
                <input
                  type="number"
                  min={0.1}
                  max={3}
                  step={0.05}
                  value={walkingSpeed}
                  onChange={(event) => setWalkingSpeed(Number(event.target.value))}
                  disabled={!editable}
                  className="mt-2 h-10 w-full rounded-lg border border-line px-3 text-sm text-ink outline-none focus:border-primary"
                />
              </label>
              <label className="text-xs font-bold text-text-muted">
                초기 반응시간 (초)
                <input
                  type="number"
                  min={0.1}
                  max={2}
                  step={0.1}
                  value={reactionTime}
                  onChange={(event) => setReactionTime(Number(event.target.value))}
                  disabled={!editable}
                  className="mt-2 h-10 w-full rounded-lg border border-line px-3 text-sm text-ink outline-none focus:border-primary"
                />
              </label>
            </div>
          </section>

          <section className="mt-6 border-t border-line pt-5">
            <h2 className="text-sm font-black">사용 출입구</h2>
            <p className="mt-1 text-xs leading-5 text-text-muted">
              DRAFT 저장은 출입구를 선택하지 않아도 가능합니다.
            </p>
            <div className="mt-3 space-y-2">
              {setup.drawing.exits.length === 0 ? (
                <p className="rounded-lg bg-surface px-3 py-3 text-xs text-text-muted">
                  등록된 출입구가 없습니다.
                </p>
              ) : (
                setup.drawing.exits.map((exit) => (
                  <label
                    key={exit.id}
                    className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm"
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
                      className="accent-primary"
                    />
                    <span>{exit.name}</span>
                  </label>
                ))
              )}
            </div>
          </section>

          <section className="mt-6 border-t border-line pt-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">위험구역</h2>
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
