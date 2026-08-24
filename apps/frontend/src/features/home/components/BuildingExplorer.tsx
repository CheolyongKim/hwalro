import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, MousePointerClick, Move, Plus, X, ZoomIn } from 'lucide-react';
import {
  BUILDING,
  BUILDING_FLOORS,
  FLOORS_BY_ID,
  LINKED_DRAWING_ROUTE,
  type FloorId,
} from '../config/buildingFloors';
import { createBuildingScene, type BuildingSceneHandle } from '../three/createBuildingScene';
import '../homeExplorer.css';

function BuildingExplorer() {
  const sceneHostRef = useRef<HTMLDivElement>(null);
  const sceneHandleRef = useRef<BuildingSceneHandle | null>(null);
  const [selectedId, setSelectedId] = useState<FloorId | null>(null);

  useEffect(() => {
    const host = sceneHostRef.current;
    if (!host) return;
    const handle = createBuildingScene(host, {
      onSelect: (floorId) => setSelectedId(floorId),
    });
    sceneHandleRef.current = handle;
    return () => {
      handle.dispose();
      sceneHandleRef.current = null;
    };
  }, []);

  const selectFloor = (floorId: FloorId | null) => {
    setSelectedId(floorId);
    sceneHandleRef.current?.setSelected(floorId);
  };

  const handleOverlayPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const selectedFloor = selectedId ? FLOORS_BY_ID[selectedId] : null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#050b09] text-white">
      <div
        ref={sceneHostRef}
        className="absolute inset-0"
        role="img"
        aria-label={`${BUILDING.name} 건물 3D 뷰. 층을 선택하려면 층 목록 버튼을 사용하거나 건물 층을 클릭하세요.`}
      />
      <div className="home-scene-vignette pointer-events-none absolute inset-0" aria-hidden="true" />

      <div
        className="absolute top-5 left-5 z-10 max-w-[264px] rounded-2xl border border-white/10 bg-[#0b1613]/80 p-5 shadow-floating backdrop-blur-md max-md:left-4 max-md:max-w-[220px] max-md:p-4"
        onPointerDown={handleOverlayPointerDown}
      >
        <p className="text-[11px] font-bold tracking-[0.22em] text-lime/80">{BUILDING.nameEn}</p>
        <h2 className="mt-1.5 text-xl font-black tracking-tight">{BUILDING.name}</h2>
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-white/55">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {BUILDING.address}
        </p>
        <p className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-5 text-white/45">
          지하 2층 ~ 지상 6층 · 8개 층
          <br />
          층을 선택하면 해당 공간 검토를 시작합니다.
        </p>
      </div>

      <nav
        aria-label="층 목록"
        onPointerDown={handleOverlayPointerDown}
        className="absolute top-56 left-5 z-10 flex flex-col gap-1.5 max-md:top-auto max-md:right-4 max-md:bottom-24 max-md:left-4 max-md:flex-row max-md:overflow-x-auto max-md:pb-1"
      >
        {BUILDING_FLOORS.map((floor) => {
          const isSelected = floor.id === selectedId;
          return (
            <button
              key={floor.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => selectFloor(isSelected ? null : floor.id)}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition ${
                isSelected
                  ? 'border-lime/60 bg-lime/10 text-lime'
                  : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white'
              }`}
            >
              <span className="w-7 text-sm font-black">{floor.label}</span>
              <span className="text-[11px] whitespace-nowrap opacity-80">{floor.theme}</span>
              {floor.linked && (
                <span
                  className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-lime max-md:ml-1"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </nav>

      <section
        aria-live="polite"
        aria-label="선택한 층 정보"
        onPointerDown={handleOverlayPointerDown}
        className="absolute top-5 right-5 z-10 w-[320px] rounded-2xl border border-white/10 bg-[#0b1613]/80 p-5 shadow-floating backdrop-blur-md max-md:top-auto max-md:right-4 max-md:bottom-16 max-md:left-4 max-md:w-auto max-md:p-4"
      >
        {selectedFloor ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-[0.22em] text-white/45">선택한 층</p>
                <p className="mt-1 text-4xl font-black tracking-tight">{selectedFloor.label}</p>
                <p className="mt-1 text-sm font-bold text-lime/90">{selectedFloor.theme}</p>
              </div>
              <button
                type="button"
                onClick={() => selectFloor(null)}
                aria-label="층 선택 해제"
                className="rounded-lg border border-white/10 p-1.5 text-white/50 transition hover:border-white/25 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-3 text-xs leading-5 text-white/60">{selectedFloor.description}</p>
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="text-[11px] font-bold tracking-[0.18em] text-white/45">도면 연결</p>
              {selectedFloor.linked ? (
                <>
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-lime/40 bg-lime/10 px-2.5 py-1 text-[11px] font-bold text-lime">
                    <span className="h-1.5 w-1.5 rounded-full bg-lime" aria-hidden="true" />
                    기본 도면 연결됨 · 더현대 지하 2층
                  </p>
                  <Link
                    to={LINKED_DRAWING_ROUTE}
                    className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-lime text-sm font-bold text-ink transition hover:opacity-90"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    새 도면 등록
                  </Link>
                  <p className="mt-2 text-[11px] leading-4 text-white/40">
                    홈 빠른 실행과 같은 흐름으로, 기본 도면으로 시작해 배치를 수정합니다.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-white/50">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/30" aria-hidden="true" />
                    도면 준비 중
                  </p>
                  <button
                    type="button"
                    disabled
                    className="mt-3 flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] text-sm font-bold text-white/35"
                  >
                    해당 층은 아직 검토를 시작할 수 없습니다
                  </button>
                  <p className="mt-2 text-[11px] leading-4 text-white/40">
                    현재는 지하 2층(B2)만 기본 도면이 연결되어 있습니다.
                  </p>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] font-bold tracking-[0.22em] text-white/45">공간 탐색</p>
            <h2 className="mt-1 text-lg font-black tracking-tight">층을 선택해 검토를 시작하세요</h2>
            <p className="mt-2 text-xs leading-5 text-white/55">
              건물의 층을 클릭하거나 왼쪽 층 목록을 선택하면 해당 층의 도면 연결 상태를 확인할 수
              있습니다.
            </p>
            <p className="mt-3 flex items-center gap-2 rounded-lg border border-lime/30 bg-lime/[0.06] px-3 py-2.5 text-[11px] leading-4 text-lime/90">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-lime" aria-hidden="true" />
              지하 2층(B2)에는 기본 도면이 연결되어 바로 검토를 시작할 수 있습니다.
            </p>
          </>
        )}
      </section>

      <div
        className="pointer-events-none absolute bottom-5 left-5 z-10 flex flex-wrap items-center gap-2 max-md:hidden"
        aria-hidden="true"
      >
        <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0b1613]/70 px-3 py-1.5 text-[11px] text-white/50 backdrop-blur-md">
          <Move className="h-3.5 w-3.5" />
          드래그 — 회전
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0b1613]/70 px-3 py-1.5 text-[11px] text-white/50 backdrop-blur-md">
          <ZoomIn className="h-3.5 w-3.5" />
          휠 — 확대·축소
        </span>
        <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0b1613]/70 px-3 py-1.5 text-[11px] text-white/50 backdrop-blur-md">
          <MousePointerClick className="h-3.5 w-3.5" />
          클릭 — 층 선택
        </span>
      </div>
    </div>
  );
}

export default BuildingExplorer;
