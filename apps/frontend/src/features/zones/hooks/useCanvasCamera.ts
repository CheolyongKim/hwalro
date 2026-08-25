import { useCallback, useEffect, useRef, useState } from 'react';
import type { Camera } from '../../layout/types';
import { clampPan, fitCamera, PX_PER_METER, zoomAtPoint } from '../../layout/utils/geometry';

/** 휠 한 칸이 바꾸는 배율. 편집기와 같은 감각을 유지한다. */
const WHEEL_ZOOM_STEP = 1.1;

interface Options {
  docWidth: number;
  docHeight: number;
  viewWidth: number;
  viewHeight: number;
  /** 이 값이 바뀌면 카메라를 도면 전체가 보이도록 되돌린다. */
  fitKey: unknown;
}

/**
 * 조회 전용 캔버스의 줌·팬.
 *
 * 편집기는 도구·선택·드래그가 얽혀 있어 리스너가 복잡하지만, 보기만 하는 화면에 필요한 것은 휠 확대와
 * 끌어서 이동뿐이다. 도면 밖으로 시야가 새지 않도록 편집기와 같은 clampPan 규칙을 쓴다.
 */
export function useCanvasCamera({ docWidth, docHeight, viewWidth, viewHeight, fitKey }: Options) {
  const [camera, setCamera] = useState<Camera>(() =>
    fitCamera(docWidth, docHeight, Math.max(viewWidth, 1), Math.max(viewHeight, 1)),
  );
  const panSession = useRef<{ x: number; y: number; camera: Camera } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const viewSize = useCallback(
    (zoom: number) => ({
      width: viewWidth / (zoom * PX_PER_METER),
      height: viewHeight / (zoom * PX_PER_METER),
    }),
    [viewWidth, viewHeight],
  );

  const fit = useCallback(() => {
    if (viewWidth <= 0 || viewHeight <= 0) return;
    setCamera(fitCamera(docWidth, docHeight, viewWidth, viewHeight));
  }, [docWidth, docHeight, viewWidth, viewHeight]);

  // 도면이 바뀌거나 캔버스 크기가 정해지면 전체가 보이는 위치에서 시작한다.
  useEffect(() => {
    fit();
  }, [fit, fitKey]);

  const zoomBy = useCallback(
    (factor: number, screen: { x: number; y: number }, rect: { left: number; top: number }) => {
      setCamera((current) => {
        const next = zoomAtPoint(current, screen, rect, factor);
        const size = viewSize(next.zoom);
        return clampPan(next, docWidth, docHeight, size.width, size.height);
      });
    },
    [docWidth, docHeight, viewSize],
  );

  const onWheel = useCallback(
    (event: { deltaY: number; clientX: number; clientY: number; currentTarget: HTMLElement }) => {
      const rect = event.currentTarget.getBoundingClientRect();
      zoomBy(
        event.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP,
        { x: event.clientX, y: event.clientY },
        rect,
      );
    },
    [zoomBy],
  );

  const startPan = useCallback((screen: { x: number; y: number }) => {
    setIsPanning(true);
    setCamera((current) => {
      panSession.current = { x: screen.x, y: screen.y, camera: current };
      return current;
    });
  }, []);

  const movePan = useCallback(
    (screen: { x: number; y: number }) => {
      const session = panSession.current;
      if (session === null) return;
      setCamera(() => {
        const scale = session.camera.zoom * PX_PER_METER;
        const next = {
          zoom: session.camera.zoom,
          panX: session.camera.panX - (screen.x - session.x) / scale,
          panY: session.camera.panY - (screen.y - session.y) / scale,
        };
        const size = viewSize(next.zoom);
        return clampPan(next, docWidth, docHeight, size.width, size.height);
      });
    },
    [docWidth, docHeight, viewSize],
  );

  const endPan = useCallback(() => {
    panSession.current = null;
    setIsPanning(false);
  }, []);

  return { camera, isPanning, onWheel, startPan, movePan, endPan, fit, zoomBy };
}
