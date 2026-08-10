import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import { Circle, Layer, Line, Rect, Shape, Stage, Text as KonvaText } from 'react-konva';
import type { Camera, Vec2 } from '../../layout/types';
import {
  clampPan,
  fitCamera,
  PX_PER_METER,
  screenToWorld,
  zoomAtPoint,
} from '../../layout/utils/geometry';
import { GridLayer } from '../../layout/components/layers';
import type { EditableHazardZone, SimulationDrawing, SimulationPoint } from '../types';
import { AGENT_RADIUS, pointInPolygon } from '../utils/placement';

export type SimulationTool = 'select' | 'spray' | 'erase' | 'hazard';

interface SimulationCanvasProps {
  drawing: SimulationDrawing;
  agents: SimulationPoint[];
  hazards: EditableHazardZone[];
  tool: SimulationTool;
  brushRadius: number;
  selectedHazardId: string | null;
  highlightedExitId?: number | null;
  onSpray: (point: SimulationPoint) => void;
  onErase: (point: SimulationPoint) => void;
  onCreateHazard: (point: SimulationPoint) => void;
  onMoveHazard: (clientId: string, point: SimulationPoint) => void;
  onSelectHazard: (clientId: string | null) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
}

interface PanSession {
  startScreen: Vec2;
  startCamera: Camera;
}

interface HazardDragSession {
  clientId: string;
}

export function SimulationCanvas({
  drawing,
  agents,
  hazards,
  tool,
  brushRadius,
  selectedHazardId,
  highlightedExitId = null,
  onSpray,
  onErase,
  onCreateHazard,
  onMoveHazard,
  onSelectHazard,
  onGestureStart,
  onGestureEnd,
}: SimulationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<PanSession | null>(null);
  const hazardDragRef = useRef<HazardDragSession | null>(null);
  const intervalRef = useRef<number | null>(null);
  const cursorRef = useRef<SimulationPoint | null>(null);
  const gestureRef = useRef(false);
  const spaceDownRef = useRef(false);
  const [spaceDown, setSpaceDown] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cursor, setCursor] = useState<SimulationPoint | null>(null);
  const [camera, setCamera] = useState<Camera>({ zoom: 1, panX: 0, panY: 0 });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (size.w > 0 && size.h > 0) {
      setCamera(fitCamera(drawing.width, drawing.height, size.w, size.h) as Camera);
    }
  }, [drawing.height, drawing.width, size.h, size.w]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !event.repeat) {
        spaceDownRef.current = true;
        setSpaceDown(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        spaceDownRef.current = false;
        setSpaceDown(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(
    () => () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    },
    [],
  );

  const worldAt = useCallback(
    (clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      return rect ? screenToWorld({ x: clientX, y: clientY }, rect, camera) : null;
    },
    [camera],
  );

  const finishGesture = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    hazardDragRef.current = null;
    if (gestureRef.current) {
      gestureRef.current = false;
      onGestureEnd();
    }
  }, [onGestureEnd]);

  const beginGesture = () => {
    if (!gestureRef.current) {
      gestureRef.current = true;
      onGestureStart();
    }
  };

  const beginBrush = (point: SimulationPoint, apply: (point: SimulationPoint) => void) => {
    beginGesture();
    apply(point);
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(() => {
      if (cursorRef.current) apply(cursorRef.current);
    }, 100);
  };

  const hitHazard = (point: SimulationPoint): EditableHazardZone | null => {
    for (let i = hazards.length - 1; i >= 0; i -= 1) {
      const hazard = hazards[i];
      if (Math.hypot(point.x - hazard.centerX, point.y - hazard.centerY) <= hazard.radius) {
        return hazard;
      }
    }
    return null;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = worldAt(event.clientX, event.clientY);
    if (!point) return;
    cursorRef.current = point;
    setCursor(point);

    if (event.button === 1 || (event.button === 0 && spaceDownRef.current)) {
      panRef.current = {
        startScreen: { x: event.clientX, y: event.clientY },
        startCamera: camera,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);

    if (tool === 'spray') {
      beginBrush(point, onSpray);
    } else if (tool === 'erase') {
      beginBrush(point, onErase);
    } else if (tool === 'hazard') {
      if (pointInPolygon(point, drawing.outsideBoundary)) onCreateHazard(point);
    } else {
      const hit = hitHazard(point);
      onSelectHazard(hit?.clientId ?? null);
      if (hit) {
        beginGesture();
        hazardDragRef.current = { clientId: hit.clientId };
      }
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = worldAt(event.clientX, event.clientY);
    if (!point) return;
    cursorRef.current = point;
    setCursor(point);
    if (panRef.current) {
      const dx = event.clientX - panRef.current.startScreen.x;
      const dy = event.clientY - panRef.current.startScreen.y;
      const start = panRef.current.startCamera;
      setCamera(
        clampPan(
          {
            zoom: start.zoom,
            panX: start.panX - dx / (start.zoom * PX_PER_METER),
            panY: start.panY - dy / (start.zoom * PX_PER_METER),
          },
          drawing.width,
          drawing.height,
          size.w / (start.zoom * PX_PER_METER),
          size.h / (start.zoom * PX_PER_METER),
        ) as Camera,
      );
    } else if (hazardDragRef.current && pointInPolygon(point, drawing.outsideBoundary)) {
      onMoveHazard(hazardDragRef.current.clientId, point);
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    panRef.current = null;
    finishGesture();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const next = zoomAtPoint(
      camera,
      { x: event.clientX, y: event.clientY },
      rect,
      event.deltaY < 0 ? 1.12 : 1 / 1.12,
    );
    setCamera(
      clampPan(
        next,
        drawing.width,
        drawing.height,
        size.w / (next.zoom * PX_PER_METER),
        size.h / (next.zoom * PX_PER_METER),
      ) as Camera,
    );
  };

  const k = camera.zoom * PX_PER_METER;
  const s = (pixels: number) => pixels / k;
  const boundaryPoints = drawing.outsideBoundary.flatMap((point) => [point.x, point.y]);
  const viewW = size.w > 0 ? size.w / k : 1;
  const viewH = size.h > 0 ? size.h / k : 1;
  const showBrush = cursor && (tool === 'spray' || tool === 'erase');
  const agentShape = useMemo(
    () => (
      <Shape
        fill="#168f80"
        sceneFunc={(context, shape) => {
          context.beginPath();
          for (const agent of agents) {
            context.moveTo(agent.x + AGENT_RADIUS, agent.y);
            context.arc(agent.x, agent.y, AGENT_RADIUS, 0, Math.PI * 2, false);
          }
          context.fillStrokeShape(shape);
        }}
      />
    ),
    [agents],
  );
  const cursorClass = panRef.current
    ? 'cursor-grabbing'
    : spaceDown
      ? 'cursor-grab'
      : tool === 'select'
        ? 'cursor-default'
        : 'cursor-crosshair';

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden bg-[#f3f7f6] ${cursorClass}`}
      role="application"
      aria-label="시뮬레이션 인원 및 위험구역 배치 캔버스"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => {
        if (!gestureRef.current && !panRef.current) {
          cursorRef.current = null;
          setCursor(null);
        }
      }}
      onWheel={onWheel}
    >
      {size.w > 0 && size.h > 0 && (
        <Stage width={size.w} height={size.h} listening={false}>
          <Layer x={-camera.panX * k} y={-camera.panY * k} scaleX={k} scaleY={k}>
            <GridLayer
              minX={camera.panX}
              minY={camera.panY}
              maxX={camera.panX + viewW}
              maxY={camera.panY + viewH}
              zoom={camera.zoom}
            />
            <Line
              points={boundaryPoints}
              closed
              fill="#ffffff"
              stroke="#355b55"
              strokeWidth={s(2)}
            />
            {drawing.walls.map((wall, index) => (
              <Line
                key={`${wall.name}-${index}`}
                points={[wall.startX, wall.startY, wall.endX, wall.endY]}
                stroke="#506663"
                strokeWidth={s(2)}
                lineCap="round"
              />
            ))}
            {drawing.pillars.map((pillar, index) => {
              const x = Math.min(pillar.startX, pillar.endX);
              const y = Math.min(pillar.startY, pillar.endY);
              const width = Math.abs(pillar.endX - pillar.startX);
              const height = Math.abs(pillar.endY - pillar.startY);
              return (
                <Rect
                  key={`${pillar.name}-${index}`}
                  x={x + width / 2}
                  y={y + height / 2}
                  width={width}
                  height={height}
                  offsetX={width / 2}
                  offsetY={height / 2}
                  rotation={pillar.rotation}
                  fill="#dce5e3"
                  stroke="#839793"
                  strokeWidth={s(1)}
                />
              );
            })}
            {drawing.fabrics.map((fabric, index) => {
              const x = Math.min(fabric.startX, fabric.endX);
              const y = Math.min(fabric.startY, fabric.endY);
              const width = Math.abs(fabric.endX - fabric.startX);
              const height = Math.abs(fabric.endY - fabric.startY);
              return (
                <Rect
                  key={`${fabric.name}-${index}`}
                  x={x + width / 2}
                  y={y + height / 2}
                  width={width}
                  height={height}
                  offsetX={width / 2}
                  offsetY={height / 2}
                  rotation={fabric.rotation}
                  fill="#e8efed"
                  stroke="#a0afac"
                  strokeWidth={s(1)}
                />
              );
            })}
            {drawing.layoutTexts.map((text, index) => (
              <KonvaText
                key={`${text.text}-${index}`}
                x={text.x}
                y={text.y}
                text={text.text}
                fontSize={s(11)}
                fill="#637773"
                listening={false}
              />
            ))}
            {drawing.exits.map((exit) => {
              const highlighted = exit.id === highlightedExitId;
              return (
                <Line
                  key={exit.id}
                  points={[exit.startX, exit.startY, exit.endX, exit.endY]}
                  stroke={highlighted ? '#f59e0b' : '#078f7e'}
                  strokeWidth={s(highlighted ? 8 : 5)}
                  lineCap="round"
                  shadowColor="#fbbf24"
                  shadowBlur={highlighted ? s(18) : 0}
                  shadowOpacity={highlighted ? 0.9 : 0}
                  shadowEnabled={highlighted}
                />
              );
            })}
          </Layer>
          <Layer x={-camera.panX * k} y={-camera.panY * k} scaleX={k} scaleY={k}>
            {agentShape}
          </Layer>
          <Layer x={-camera.panX * k} y={-camera.panY * k} scaleX={k} scaleY={k}>
            {hazards.map((hazard) => (
              <Circle
                key={hazard.clientId}
                x={hazard.centerX}
                y={hazard.centerY}
                radius={hazard.radius}
                fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                fillRadialGradientStartRadius={0}
                fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                fillRadialGradientEndRadius={hazard.radius}
                fillRadialGradientColorStops={[
                  0,
                  'rgba(177, 32, 32, 0.58)',
                  0.5,
                  'rgba(225, 75, 75, 0.28)',
                  1,
                  'rgba(239, 119, 119, 0.08)',
                ]}
                stroke={hazard.clientId === selectedHazardId ? '#d14343' : '#ef7777'}
                strokeWidth={s(hazard.clientId === selectedHazardId ? 2 : 1.3)}
                dash={[s(5), s(4)]}
              />
            ))}
            {showBrush && (
              <Circle
                x={cursor.x}
                y={cursor.y}
                radius={brushRadius}
                fill={tool === 'spray' ? 'rgba(22, 143, 128, 0.08)' : 'rgba(201, 79, 71, 0.08)'}
                stroke={tool === 'spray' ? '#168f80' : '#c94f47'}
                strokeWidth={s(1.5)}
                dash={[s(5), s(4)]}
              />
            )}
          </Layer>
        </Stage>
      )}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-line bg-white/90 px-3 py-2 text-xs font-bold text-text-muted shadow-sm">
        {Math.round(camera.zoom * 100)}%
      </div>
    </div>
  );
}
