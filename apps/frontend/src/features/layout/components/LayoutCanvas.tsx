import { useCallback, useRef, useState } from 'react';
import type { Dispatch, PointerEvent as ReactPointerEvent } from 'react';
import type { Camera, EditorState, Vec2 } from '../types';
import type { EditorAction } from '../state/editorReducer';
import { clampPan, formatMeters, PX_PER_METER, screenToWorld } from '../utils/geometry';
import { hitTestElements, hitTestExitHandle, hitTestHandle } from '../utils/hitTest';
import type { HandleHit } from '../utils/hitTest';
import { ExitView, GridLayer, TextView, WallView, BackgroundLayer } from './layers';
import { useCanvasListeners } from './useCanvasListeners';

interface LayoutCanvasProps {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  size: { w: number; h: number };
  onSizeChange: (size: { w: number; h: number }) => void;
}

interface PanSession {
  startScreen: Vec2;
  startCamera: Camera;
}

export function LayoutCanvas({ state, dispatch, size, onSizeChange }: LayoutCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const panRef = useRef<PanSession | null>(null);
  const [panning, setPanning] = useState(false);

  const { containerRef, spaceDown } = useCanvasListeners({
    dispatch,
    onSizeChange,
    camera: state.camera,
    doc: state.doc,
    size,
    cameraFitNonce: state.cameraFitNonce,
  });

  const { doc, camera, tool, selection, draft, snapHint, cursor } = state;

  const startPan = useCallback((screen: Vec2, cameraStart: Camera) => {
    panRef.current = { startScreen: screen, startCamera: cameraStart };
    setPanning(true);
  }, []);

  const stopPan = useCallback(() => {
    panRef.current = null;
    setPanning(false);
  }, []);

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button === 1 || (event.button === 0 && spaceDown)) {
      startPan({ x: event.clientX, y: event.clientY }, camera);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) {
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
    if (tool === 'exit') {
      if (state.draft) {
        dispatch({ type: 'exitUpdate', point: world });
        dispatch({ type: 'exitCommit' });
      } else {
        dispatch({ type: 'exitStart', point: world });
      }
      return;
    }
    if (tool === 'text') {
      dispatch({ type: 'textPlace', point: world });
      return;
    }
    if (tool === 'erase') {
      const hit = hitTestElements(world, doc.walls, doc.layoutTexts, doc.exits, camera.zoom);
      if (hit.wallId !== null || hit.exitId !== null || hit.textId !== null) {
        dispatch({
          type: 'selectAt',
          wallId: hit.wallId,
          exitId: hit.exitId,
          textId: hit.textId,
          additive: false,
        });
        dispatch({ type: 'deleteSelection' });
      }
      return;
    }
    if (tool === 'background') {
      const bg = doc.background;
      const onImage =
        bg !== null &&
        world.x >= bg.x &&
        world.x <= bg.x + bg.width &&
        world.y >= bg.y &&
        world.y <= bg.y + bg.height;
      if (onImage) {
        dispatch({ type: 'backgroundDragStart', point: world });
      } else {
        startPan({ x: event.clientX, y: event.clientY }, camera);
      }
      return;
    }

    let handleHit: HandleHit | null = null;
    for (const wall of doc.walls) {
      if (selection.wallIds.includes(wall.id)) {
        const hit = hitTestHandle(world, wall, camera.zoom);
        if (hit) {
          handleHit = hit;
          break;
        }
      }
    }
    if (handleHit) {
      dispatch({
        type: 'reshapeStart',
        wallId: handleHit.wallId,
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

    const hit = hitTestElements(world, doc.walls, doc.layoutTexts, doc.exits, camera.zoom);
    if (hit.wallId !== null || hit.exitId !== null || hit.textId !== null) {
      const wasSelected =
        hit.wallId !== null
          ? selection.wallIds.includes(hit.wallId)
          : hit.exitId !== null
            ? selection.exitIds.includes(hit.exitId)
            : selection.textIds.includes(hit.textId as string);
      dispatch({
        type: 'selectAt',
        wallId: hit.wallId,
        exitId: hit.exitId,
        textId: hit.textId,
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
      exitId: null,
      textId: null,
      additive: event.shiftKey,
    });
    startPan({ x: event.clientX, y: event.clientY }, camera);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
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
    if (state.drag) {
      dispatch({ type: 'dragUpdate', point: world });
      return;
    }
    if (state.draft) {
      dispatch({ type: tool === 'exit' ? 'exitUpdate' : 'wallUpdate', point: world });
    }
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (panRef.current) {
      stopPan();
      event.currentTarget.releasePointerCapture(event.pointerId);
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
      : tool === 'wall'
        ? 'layout-cursor-wall'
        : tool === 'exit'
          ? 'layout-cursor-exit'
          : tool === 'erase'
            ? 'layout-cursor-erase'
          : tool === 'text'
            ? 'layout-cursor-text'
            : 'layout-cursor-default';

  const viewW = size.w > 0 ? size.w / (camera.zoom * PX_PER_METER) : 1;
  const viewH = size.h > 0 ? size.h / (camera.zoom * PX_PER_METER) : 1;
  const s = useCallback((px: number) => px / (camera.zoom * PX_PER_METER), [camera.zoom]);
  const draftColor = tool === 'exit' ? 'var(--layout-exit)' : 'var(--layout-accent)';

  return (
    <div ref={containerRef} className={`layout-canvas-wrap ${cursorClass}`}>
      <svg
        ref={svgRef}
        className="layout-canvas-svg"
        viewBox={`${camera.panX} ${camera.panY} ${viewW} ${viewH}`}
        role="application"
        aria-label="도면 캔버스"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
      >
        {size.w > 0 && (
          <g pointerEvents="none">
            {doc.background && <BackgroundLayer bg={doc.background} />}
            <GridLayer
              minX={camera.panX}
              minY={camera.panY}
              maxX={camera.panX + viewW}
              maxY={camera.panY + viewH}
              zoom={camera.zoom}
            />
            <rect
              x={0}
              y={0}
              width={doc.width}
              height={doc.height}
              fill="none"
              stroke="var(--layout-grid-boundary)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            {doc.walls.map((wall) => (
              <WallView
                key={wall.id}
                wall={wall}
                selected={selection.wallIds.includes(wall.id)}
                s={s}
              />
            ))}
            {doc.exits.map((exit) => (
              <ExitView
                key={exit.id}
                exit={exit}
                selected={selection.exitIds.includes(exit.id)}
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
            {draft && (
              <g>
                <line
                  x1={draft.start.x}
                  y1={draft.start.y}
                  x2={draft.end.x}
                  y2={draft.end.y}
                  stroke={draftColor}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={draft.start.x}
                  cy={draft.start.y}
                  r={s(3.5)}
                  fill={draftColor}
                />
                {draft.snappedToEndpoint && (
                  <circle
                    cx={draft.snappedToEndpoint.x}
                    cy={draft.snappedToEndpoint.y}
                    r={s(7)}
                    fill="none"
                    stroke={draftColor}
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {cursor && (draft.end.x !== draft.start.x || draft.end.y !== draft.start.y) && (
                  <text
                    x={(draft.start.x + draft.end.x) / 2}
                    y={(draft.start.y + draft.end.y) / 2 - s(6)}
                    fontSize={11 / (camera.zoom * PX_PER_METER)}
                    fill={draftColor}
                    fontFamily="var(--layout-mono)"
                    textAnchor="middle"
                  >
                    {formatMeters(
                      Math.hypot(draft.end.x - draft.start.x, draft.end.y - draft.start.y),
                    )}{' '}
                    m
                  </text>
                )}
              </g>
            )}
            {snapHint && (
              <circle
                cx={snapHint.x}
                cy={snapHint.y}
                r={s(7)}
                fill="none"
                stroke="var(--layout-accent)"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
