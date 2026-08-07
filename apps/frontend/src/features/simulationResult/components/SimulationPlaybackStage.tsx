import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import {
  applyPixiCamera,
  createCameraTransform,
  createPixiSimulationScene,
  destroyPixiSimulationScene,
  pixiScreenToWorld,
  updatePixiSimulationScene,
  type PixiSimulationScene,
} from '../rendering/pixiSimulationRenderer';
import type { Bounds, RiskZone, SimulationResultViewModel } from '../types';

interface Props {
  result: SimulationResultViewModel;
  currentTimeSeconds: number;
  selectedBottleneckId: number | null;
  showBottlenecks: boolean;
  riskDrawingMode: boolean;
  riskZones: RiskZone[];
  onRiskZoneCreated: (bounds: Bounds) => void;
  onViewportPan: () => void;
}

interface PanSession {
  pointerX: number;
  pointerY: number;
  panX: number;
  panY: number;
  notified: boolean;
}

export function SimulationPlaybackStage(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PixiSimulationScene | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const panSessionRef = useRef<PanSession | null>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [camera, setCamera] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [draftZone, setDraftZone] = useState<Bounds | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [sceneVersion, setSceneVersion] = useState(0);

  const transform = useMemo(
    () =>
      createCameraTransform(
        size.width,
        size.height,
        props.result.drawing.width,
        props.result.drawing.height,
        camera.zoom,
        camera.panX,
        camera.panY,
      ),
    [camera, props.result.drawing.height, props.result.drawing.width, size],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      sceneRef.current?.app.renderer.resize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let createdScene: PixiSimulationScene | null = null;
    void createPixiSimulationScene(host, props.result).then((scene) => {
      if (disposed) {
        destroyPixiSimulationScene(scene);
        return;
      }
      createdScene = scene;
      sceneRef.current = scene;
      setSceneVersion((version) => version + 1);
    });
    return () => {
      disposed = true;
      if (createdScene) destroyPixiSimulationScene(createdScene);
      if (sceneRef.current === createdScene) sceneRef.current = null;
    };
  }, [props.result]);

  useEffect(() => {
    if (!sceneRef.current) return;
    applyPixiCamera(sceneRef.current, transform);
  }, [sceneVersion, transform]);

  useEffect(() => {
    if (!sceneRef.current) return;
    updatePixiSimulationScene(
      sceneRef.current,
      props.result,
      props.currentTimeSeconds,
      props.selectedBottleneckId,
      props.showBottlenecks,
      props.riskZones,
      draftZone,
    );
  }, [
    draftZone,
    props.currentTimeSeconds,
    props.result,
    props.riskZones,
    props.selectedBottleneckId,
    props.showBottlenecks,
    sceneVersion,
  ]);

  const pointerPoint = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return pixiScreenToWorld(event.clientX - rect.left, event.clientY - rect.top, transform);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (props.riskDrawingMode) {
      dragStartRef.current = pointerPoint(event);
    } else {
      panSessionRef.current = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        panX: camera.panX,
        panY: camera.panY,
        notified: false,
      };
      setIsPanning(true);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current) {
      const point = pointerPoint(event);
      setDraftZone({
        x: Math.min(point.x, dragStartRef.current.x),
        y: Math.min(point.y, dragStartRef.current.y),
        width: Math.abs(point.x - dragStartRef.current.x),
        height: Math.abs(point.y - dragStartRef.current.y),
      });
      return;
    }
    const session = panSessionRef.current;
    if (!session) return;
    const deltaX = event.clientX - session.pointerX;
    const deltaY = event.clientY - session.pointerY;
    if (!session.notified && Math.hypot(deltaX, deltaY) >= 3) {
      session.notified = true;
      props.onViewportPan();
    }
    setCamera((current) => ({
      ...current,
      panX: session.panX + deltaX,
      panY: session.panY + deltaY,
    }));
  };

  const onPointerUp = () => {
    if (panSessionRef.current) {
      panSessionRef.current = null;
      setIsPanning(false);
      return;
    }
    dragStartRef.current = null;
    if (draftZone && draftZone.width >= 1 && draftZone.height >= 1) {
      props.onRiskZoneCreated(draftZone);
    }
    setDraftZone(null);
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const world = pixiScreenToWorld(pointerX, pointerY, transform);
    const zoomFactor = Math.exp(-event.deltaY * 0.0012);
    const nextZoom = Math.min(4, Math.max(0.55, camera.zoom * zoomFactor));
    const fitTransform = createCameraTransform(
      size.width,
      size.height,
      props.result.drawing.width,
      props.result.drawing.height,
      nextZoom,
      0,
      0,
    );
    setCamera({
      zoom: nextZoom,
      panX: pointerX - world.x * fitTransform.scale - fitTransform.offsetX,
      panY: pointerY - world.y * fitTransform.scale - fitTransform.offsetY,
    });
  };

  return (
    <div
      ref={hostRef}
      className={`simulation-canvas-wrap simulation-canvas--interactive ${props.riskDrawingMode ? 'is-drawing' : 'is-pannable'} ${isPanning ? 'is-panning' : ''}`}
      role="application"
      aria-label="더현대 서울 지하 2층 PixiJS 시뮬레이션 재생 도면"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    />
  );
}
