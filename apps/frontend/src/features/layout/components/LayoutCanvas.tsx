import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  Dispatch,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { Circle, Group, Layer, Line, Rect, Stage, Text as KonvaText } from 'react-konva';
import type {
  Camera,
  EditorState,
  RectHandle,
  ValidationProblem,
  ValidationProblemKind,
  Vec2,
} from '../types';
import type { EditorAction } from '../state/editorReducer';
import {
  clampPan,
  estimateTextWidthPx,
  formatMeters,
  PX_PER_METER,
  screenToWorld,
} from '../utils/geometry';
import {
  hitTestElements,
  hitTestExitHandle,
  hitTestHandle,
  hitTestRectHandle,
  hitTestRotateHandle,
} from '../utils/hitTest';
import type { ElementHit, HandleHit } from '../utils/hitTest';
import { ACCENT_ALPHA_8, CANVAS_COLORS, FONT_MONO } from '../utils/colors';
import {
  ExitView,
  FabricView,
  GridLayer,
  OutsideWallView,
  PillarView,
  TextView,
  WallView,
} from './layers';
import { useCanvasListeners } from './useCanvasListeners';

interface LayoutCanvasProps {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  size: { w: number; h: number };
  onSizeChange: (size: { w: number; h: number }) => void;
  readOnly?: boolean;
  riskZones?: LayoutRiskZone[];
  riskMode?: boolean;
  onRiskZoneDrawn?: (bounds: { x: number; y: number; width: number; height: number }) => void;
}

export interface LayoutRiskZone {
  id: number;
  title: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface RiskRectDraft {
  start: Vec2;
  end: Vec2;
}

interface PanSession {
  startScreen: Vec2;
  startCamera: Camera;
}

interface RectHandleHit {
  elementKind: 'pillar' | 'fabric';
  elementId: string;
  handle: RectHandle;
}

const LINE_DRAFT_UPDATE: Record<
  'wall' | 'outsideWall' | 'exit',
  'wallUpdate' | 'outsideWallUpdate' | 'exitUpdate'
> = {
  wall: 'wallUpdate',
  outsideWall: 'outsideWallUpdate',
  exit: 'exitUpdate',
};

export function LayoutCanvas({
  state,
  dispatch,
  size,
  onSizeChange,
  readOnly = false,
  riskZones = [],
  riskMode = false,
  onRiskZoneDrawn,
}: LayoutCanvasProps) {
  const panRef = useRef<PanSession | null>(null);
  const suppressClickRef = useRef(false);
  const [panning, setPanning] = useState(false);
  const [riskDraft, setRiskDraft] = useState<RiskRectDraft | null>(null);

  const { containerRef, spaceDown } = useCanvasListeners({
    dispatch,
    onSizeChange,
    camera: state.camera,
    doc: state.doc,
    size,
    cameraFitNonce: state.cameraFitNonce,
  });

  const { doc, camera, tool, selection, draft, snapHint, cursor, validationProblems } = state;

  const problemNames = useMemo(() => {
    const byKind = (kind: ValidationProblemKind) =>
      new Set(
        validationProblems
          .filter((problem: ValidationProblem) => problem.kind === kind)
          .map((problem) => problem.name),
      );
    return {
      wall: byKind('wall'),
      outsideWall: byKind('outsideWall'),
      exit: byKind('exit'),
      pillar: byKind('pillar'),
      fabric: byKind('fabric'),
    };
  }, [validationProblems]);

  const hitAt = useCallback(
    (world: Vec2) =>
      hitTestElements(
        world,
        doc.walls,
        doc.outsideWalls,
        doc.layoutTexts,
        doc.pillars,
        doc.fabrics,
        doc.exits,
        camera.zoom,
      ),
    [doc, camera.zoom],
  );

  const hasHit = (hit: ElementHit) =>
    hit.wallId !== null ||
    hit.outsideWallId !== null ||
    hit.exitId !== null ||
    hit.textId !== null ||
    hit.pillarId !== null ||
    hit.fabricId !== null;

  const startPan = useCallback((screen: Vec2, cameraStart: Camera) => {
    panRef.current = { startScreen: screen, startCamera: cameraStart };
    setPanning(true);
  }, []);

  const stopPan = useCallback(() => {
    panRef.current = null;
    setPanning(false);
  }, []);

  const onDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (readOnly || tool !== 'select') {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const world = screenToWorld({ x: event.clientX, y: event.clientY }, rect, camera);
    const hit = hitAt(world);
    if (hit.textId !== null) {
      dispatch({ type: 'textEditStart', textId: hit.textId });
    }
  };

  const onClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (readOnly || tool !== 'text') {
      return;
    }
    if (event.target instanceof HTMLTextAreaElement) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const world = screenToWorld({ x: event.clientX, y: event.clientY }, rect, camera);
    dispatch({ type: 'textPlace', point: world });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    suppressClickRef.current = false;
    if (event.button === 1 || (event.button === 0 && spaceDown)) {
      startPan({ x: event.clientX, y: event.clientY }, camera);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) {
      return;
    }
    if (readOnly) {
      return;
    }
    if (riskMode) {
      const rect = event.currentTarget.getBoundingClientRect();
      const world = screenToWorld({ x: event.clientX, y: event.clientY }, rect, camera);
      setRiskDraft({ start: world, end: world });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const world = screenToWorld({ x: event.clientX, y: event.clientY }, rect, camera);
    dispatch({ type: 'cursorMove', world });
    event.currentTarget.setPointerCapture(event.pointerId);

    if (tool === 'wall') {
      if (state.draft) {
        dispatch({ type: 'wallUpdate', point: world });
        dispatch({ type: 'wallCommit' });
      } else {
        dispatch({ type: 'wallStart', point: world });
      }
      return;
    }
    if (tool === 'outsideWall') {
      if (state.draft) {
        dispatch({ type: 'outsideWallUpdate', point: world });
        dispatch({ type: 'outsideWallCommit' });
      } else {
        dispatch({ type: 'outsideWallStart', point: world });
      }
      return;
    }
    if (tool === 'exit') {
      if (state.draft) {
        dispatch({ type: 'exitUpdate', point: world });
        dispatch({ type: 'exitCommit' });
      } else {
        dispatch({ type: 'exitStart', point: world });
      }
      return;
    }
    if (tool === 'pillar') {
      if (state.draft) {
        dispatch({ type: 'pillarUpdate', point: world });
        dispatch({ type: 'pillarCommit' });
      } else {
        dispatch({ type: 'pillarStart', point: world });
      }
      return;
    }
    if (tool === 'fabric') {
      if (state.draft) {
        dispatch({ type: 'fabricUpdate', point: world });
        dispatch({ type: 'fabricCommit' });
      } else {
        dispatch({ type: 'fabricStart', point: world });
      }
      return;
    }
    if (tool === 'text') {
      return;
    }
    if (tool === 'erase') {
      dispatch({ type: 'eraseStart', point: world, hit: hitAt(world) });
      return;
    }
    let handleHit: HandleHit | null = null;
    let handleElementKind: 'wall' | 'outsideWall' = 'wall';
    for (const wall of doc.walls) {
      if (selection.wallIds.includes(wall.id)) {
        const hit = hitTestHandle(world, wall, camera.zoom);
        if (hit) {
          handleHit = hit;
          break;
        }
      }
    }
    if (!handleHit) {
      handleElementKind = 'outsideWall';
      for (const wall of doc.outsideWalls) {
        if (selection.outsideWallIds.includes(wall.id)) {
          const hit = hitTestHandle(world, wall, camera.zoom);
          if (hit) {
            handleHit = hit;
            break;
          }
        }
      }
    }
    if (handleHit) {
      dispatch({
        type: 'reshapeStart',
        elementKind: handleElementKind,
        elementId: handleHit.wallId,
        handle: handleHit.handle,
        point: world,
      });
      return;
    }
    for (const exit of doc.exits) {
      if (selection.exitIds.includes(exit.id)) {
        const hit = hitTestExitHandle(world, exit, camera.zoom);
        if (hit) {
          dispatch({
            type: 'reshapeExitStart',
            exitId: hit.exitId,
            handle: hit.handle,
            point: world,
          });
          return;
        }
      }
    }

    let rectHandleHit: RectHandleHit | null = null;
    for (const pillar of doc.pillars) {
      if (selection.pillarIds.includes(pillar.id)) {
        const hit = hitTestRectHandle(pillar, world, camera.zoom);
        if (hit) {
          rectHandleHit = { elementKind: 'pillar', elementId: hit.elementId, handle: hit.handle };
          break;
        }
      }
    }
    if (!rectHandleHit) {
      for (const fabric of doc.fabrics) {
        if (selection.fabricIds.includes(fabric.id)) {
          const hit = hitTestRectHandle(fabric, world, camera.zoom);
          if (hit) {
            rectHandleHit = { elementKind: 'fabric', elementId: hit.elementId, handle: hit.handle };
            break;
          }
        }
      }
    }
    if (rectHandleHit) {
      dispatch({
        type: 'reshapeStart',
        elementKind: rectHandleHit.elementKind,
        elementId: rectHandleHit.elementId,
        handle: rectHandleHit.handle,
        point: world,
      });
      return;
    }

    for (const pillar of doc.pillars) {
      if (
        selection.pillarIds.includes(pillar.id) &&
        hitTestRotateHandle(pillar, world, camera.zoom)
      ) {
        dispatch({
          type: 'rotateStart',
          elementKind: 'pillar',
          elementId: pillar.id,
          point: world,
        });
        return;
      }
    }
    for (const fabric of doc.fabrics) {
      if (
        selection.fabricIds.includes(fabric.id) &&
        hitTestRotateHandle(fabric, world, camera.zoom)
      ) {
        dispatch({
          type: 'rotateStart',
          elementKind: 'fabric',
          elementId: fabric.id,
          point: world,
        });
        return;
      }
    }

    const hit = hitTestElements(
      world,
      doc.walls,
      doc.outsideWalls,
      doc.layoutTexts,
      doc.pillars,
      doc.fabrics,
      doc.exits,
      camera.zoom,
    );
    if (
      hit.wallId !== null ||
      hit.outsideWallId !== null ||
      hit.exitId !== null ||
      hit.textId !== null ||
      hit.pillarId !== null ||
      hit.fabricId !== null
    ) {
      let wasSelected = false;
      if (hit.wallId !== null) {
        wasSelected = selection.wallIds.includes(hit.wallId);
      } else if (hit.outsideWallId !== null) {
        wasSelected = selection.outsideWallIds.includes(hit.outsideWallId);
      } else if (hit.exitId !== null) {
        wasSelected = selection.exitIds.includes(hit.exitId);
      } else if (hit.textId !== null) {
        wasSelected = selection.textIds.includes(hit.textId);
      } else if (hit.pillarId !== null) {
        wasSelected = selection.pillarIds.includes(hit.pillarId);
      } else if (hit.fabricId !== null) {
        wasSelected = selection.fabricIds.includes(hit.fabricId);
      }
      dispatch({
        type: 'selectAt',
        wallId: hit.wallId,
        outsideWallId: hit.outsideWallId,
        exitId: hit.exitId,
        textId: hit.textId,
        pillarId: hit.pillarId,
        fabricId: hit.fabricId,
        additive: event.shiftKey,
      });
      const willBeSelected = event.shiftKey ? !wasSelected : true;
      if (willBeSelected) {
        dispatch({ type: 'dragStartMove', point: world });
      }
      return;
    }

    dispatch({
      type: 'selectAt',
      wallId: null,
      outsideWallId: null,
      exitId: null,
      textId: null,
      pillarId: null,
      fabricId: null,
      additive: event.shiftKey,
    });
    startPan({ x: event.clientX, y: event.clientY }, camera);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (riskDraft) {
      const rect = event.currentTarget.getBoundingClientRect();
      setRiskDraft({
        ...riskDraft,
        end: screenToWorld({ x: event.clientX, y: event.clientY }, rect, camera),
      });
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const world = screenToWorld({ x: event.clientX, y: event.clientY }, rect, camera);
    if (state.draft) {
      dispatch({ type: 'cursorMove', world });
    }

    if (panRef.current) {
      const dx = event.clientX - panRef.current.startScreen.x;
      const dy = event.clientY - panRef.current.startScreen.y;
      const start = panRef.current.startCamera;
      const next: Camera = {
        zoom: start.zoom,
        panX: start.panX - dx / (start.zoom * PX_PER_METER),
        panY: start.panY - dy / (start.zoom * PX_PER_METER),
      };
      dispatch({
        type: 'setCamera',
        camera: clampPan(
          next,
          doc.width,
          doc.height,
          size.w / (start.zoom * PX_PER_METER),
          size.h / (start.zoom * PX_PER_METER),
        ),
      });
      return;
    }
    if (state.drag?.kind === 'erase') {
      const hit = hitAt(world);
      if (hasHit(hit)) {
        dispatch({ type: 'eraseUpdate', hit });
      }
      return;
    }
    if (state.drag) {
      dispatch({ type: 'dragUpdate', point: world });
      return;
    }
    if (state.draft) {
      if (tool === 'wall' || tool === 'outsideWall' || tool === 'exit') {
        dispatch({ type: LINE_DRAFT_UPDATE[tool], point: world });
      } else if (tool === 'pillar') {
        dispatch({ type: 'pillarUpdate', point: world });
      } else if (tool === 'fabric') {
        dispatch({ type: 'fabricUpdate', point: world });
      }
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (riskDraft) {
      const width = Math.abs(riskDraft.end.x - riskDraft.start.x);
      const height = Math.abs(riskDraft.end.y - riskDraft.start.y);
      setRiskDraft(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (width > 0.5 && height > 0.5) {
        onRiskZoneDrawn?.({
          x: Math.min(riskDraft.start.x, riskDraft.end.x),
          y: Math.min(riskDraft.start.y, riskDraft.end.y),
          width,
          height,
        });
      }
      return;
    }
    if (panRef.current) {
      suppressClickRef.current = true;
      stopPan();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
    dispatch({ type: 'dragEnd' });
  };

  const onPointerLeave = () => {
    if (!panRef.current && !state.drag) {
      dispatch({ type: 'cursorMove', world: null });
    }
  };

  const cursorClass =
    spaceDown || panning
      ? panning
        ? 'layout-cursor-grabbing'
        : 'layout-cursor-grab'
      : riskMode && !readOnly
        ? 'cursor-crosshair'
        : tool === 'wall'
          ? 'layout-cursor-wall'
          : tool === 'outsideWall'
            ? 'layout-cursor-outside-wall'
            : tool === 'exit'
              ? 'layout-cursor-exit'
              : tool === 'pillar'
                ? 'layout-cursor-pillar'
                : tool === 'fabric'
                  ? 'layout-cursor-fabric'
                  : tool === 'erase'
                    ? 'layout-cursor-erase'
                    : tool === 'text'
                      ? 'layout-cursor-text'
                      : 'layout-cursor-default';

  const viewW = size.w > 0 ? size.w / (camera.zoom * PX_PER_METER) : 1;
  const viewH = size.h > 0 ? size.h / (camera.zoom * PX_PER_METER) : 1;
  const s = useCallback((px: number) => px / (camera.zoom * PX_PER_METER), [camera.zoom]);
  const draftColor =
    tool === 'exit'
      ? CANVAS_COLORS.exit
      : tool === 'outsideWall'
        ? CANVAS_COLORS.outsideWall
        : CANVAS_COLORS.accent;
  const isWallDraft = draft !== null && 'axisSnapped' in draft;
  const draftLabel =
    draft !== null && cursor && (draft.end.x !== draft.start.x || draft.end.y !== draft.start.y)
      ? isWallDraft
        ? `${formatMeters(Math.hypot(draft.end.x - draft.start.x, draft.end.y - draft.start.y))} m`
        : `${formatMeters(Math.abs(draft.end.x - draft.start.x))} × ${formatMeters(
            Math.abs(draft.end.y - draft.start.y),
          )} m`
      : null;
  const k = camera.zoom * PX_PER_METER;
  const draftLabelWidth = draftLabel !== null ? estimateTextWidthPx(draftLabel, s(11)) : 0;

  return (
    <div
      ref={containerRef}
      className={`layout-canvas-wrap ${cursorClass}`}
      role="application"
      aria-label="도면 캔버스"
      onDoubleClick={onDoubleClick}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
    >
      {size.w > 0 && size.h > 0 && (
        <Stage width={size.w} height={size.h}>
          <Layer listening={false} x={-camera.panX * k} y={-camera.panY * k} scaleX={k} scaleY={k}>
            <Rect x={0} y={0} width={doc.width} height={doc.height} fill={CANVAS_COLORS.canvas} />
            <GridLayer
              minX={camera.panX}
              minY={camera.panY}
              maxX={camera.panX + viewW}
              maxY={camera.panY + viewH}
              zoom={camera.zoom}
            />
            <Rect
              x={0}
              y={0}
              width={doc.width}
              height={doc.height}
              stroke={CANVAS_COLORS.gridBoundary}
              strokeWidth={s(1)}
            />
            {doc.walls.map((wall) => (
              <WallView
                key={wall.id}
                wall={wall}
                selected={selection.wallIds.includes(wall.id)}
                problem={problemNames.wall.has(wall.name)}
                s={s}
              />
            ))}
            {doc.outsideWalls.map((wall) => (
              <OutsideWallView
                key={wall.id}
                wall={wall}
                selected={selection.outsideWallIds.includes(wall.id)}
                problem={problemNames.outsideWall.has(wall.name)}
                s={s}
              />
            ))}
            {doc.exits.map((exit) => (
              <ExitView
                key={exit.id}
                exit={exit}
                selected={selection.exitIds.includes(exit.id)}
                problem={problemNames.exit.has(exit.name)}
                s={s}
              />
            ))}
            {doc.pillars.map((pillar) => (
              <PillarView
                key={pillar.id}
                pillar={pillar}
                selected={selection.pillarIds.includes(pillar.id)}
                problem={problemNames.pillar.has(pillar.name)}
                s={s}
              />
            ))}
            {doc.fabrics.map((fabric) => (
              <FabricView
                key={fabric.id}
                fabric={fabric}
                selected={selection.fabricIds.includes(fabric.id)}
                problem={problemNames.fabric.has(fabric.name)}
                s={s}
              />
            ))}
            {doc.layoutTexts.map((text) => (
              <TextView
                key={text.id}
                text={text}
                selected={selection.textIds.includes(text.id)}
                zoom={camera.zoom}
              />
            ))}
            {riskZones.map((zone) => {
              const x = Math.min(zone.startX, zone.endX);
              const y = Math.min(zone.startY, zone.endY);
              const w = Math.abs(zone.endX - zone.startX);
              const h = Math.abs(zone.endY - zone.startY);
              const labelWidth = estimateTextWidthPx(zone.title, s(11));
              return (
                <Group key={`risk-zone-${zone.id}`}>
                  <Rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill="rgba(201, 79, 71, 0.18)"
                    stroke="#c94f47"
                    strokeWidth={s(1.5)}
                  />
                  <KonvaText
                    x={x}
                    y={y - s(14)}
                    width={labelWidth}
                    text={zone.title}
                    fontSize={s(11)}
                    fill="#c94f47"
                    fontFamily={FONT_MONO}
                  />
                </Group>
              );
            })}
            {riskDraft && (
              <Rect
                x={Math.min(riskDraft.start.x, riskDraft.end.x)}
                y={Math.min(riskDraft.start.y, riskDraft.end.y)}
                width={Math.abs(riskDraft.end.x - riskDraft.start.x)}
                height={Math.abs(riskDraft.end.y - riskDraft.start.y)}
                fill="rgba(201, 79, 71, 0.12)"
                stroke="#c94f47"
                strokeWidth={s(1.5)}
                dash={[s(6), s(4)]}
              />
            )}
            {draft && (
              <Group>
                {isWallDraft ? (
                  <Line
                    points={[draft.start.x, draft.start.y, draft.end.x, draft.end.y]}
                    stroke={draftColor}
                    strokeWidth={s(1.5)}
                    dash={[s(6), s(4)]}
                  />
                ) : (
                  <Rect
                    x={Math.min(draft.start.x, draft.end.x)}
                    y={Math.min(draft.start.y, draft.end.y)}
                    width={Math.abs(draft.end.x - draft.start.x)}
                    height={Math.abs(draft.end.y - draft.start.y)}
                    fill={ACCENT_ALPHA_8}
                    stroke={draftColor}
                    strokeWidth={s(1.5)}
                    dash={[s(6), s(4)]}
                  />
                )}
                <Circle x={draft.start.x} y={draft.start.y} radius={s(3.5)} fill={draftColor} />
                {isWallDraft && 'snappedToEndpoint' in draft && draft.snappedToEndpoint && (
                  <Circle
                    x={draft.snappedToEndpoint.x}
                    y={draft.snappedToEndpoint.y}
                    radius={s(7)}
                    stroke={draftColor}
                    strokeWidth={s(1.5)}
                  />
                )}
                {draftLabel !== null && (
                  <KonvaText
                    x={(draft.start.x + draft.end.x) / 2 - draftLabelWidth / 2}
                    y={(draft.start.y + draft.end.y) / 2 - s(6)}
                    width={draftLabelWidth}
                    align="center"
                    text={draftLabel}
                    fontSize={s(11)}
                    fill={draftColor}
                    fontFamily={FONT_MONO}
                  />
                )}
              </Group>
            )}
            {snapHint && (
              <Circle
                x={snapHint.x}
                y={snapHint.y}
                radius={s(7)}
                stroke={CANVAS_COLORS.accent}
                strokeWidth={s(1.5)}
              />
            )}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
