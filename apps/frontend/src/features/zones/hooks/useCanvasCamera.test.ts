// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useCanvasCamera } from './useCanvasCamera';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let api: ReturnType<typeof useCanvasCamera>;

function Probe() {
  api = useCanvasCamera({
    docWidth: 170,
    docHeight: 100,
    viewWidth: 800,
    viewHeight: 560,
    fitKey: 'drawing-2',
  });
  return null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(createElement(Probe)));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const rect = { left: 0, top: 0 };

describe('useCanvasCamera', () => {
  it('도면 전체가 보이는 배율에서 시작한다', () => {
    expect(api.camera.zoom).toBeGreaterThan(0);
  });

  it('휠을 올리면 확대되고 내리면 축소된다', () => {
    const initial = api.camera.zoom;
    act(() => api.zoomBy(1.1, { x: 400, y: 280 }, rect));
    const zoomedIn = api.camera.zoom;
    expect(zoomedIn).toBeGreaterThan(initial);

    act(() => api.zoomBy(1 / 1.1, { x: 400, y: 280 }, rect));
    expect(api.camera.zoom).toBeLessThan(zoomedIn);
  });

  it('끌면 시야가 따라 움직인다', () => {
    act(() => api.zoomBy(4, { x: 400, y: 280 }, rect));
    const before = { ...api.camera };

    act(() => api.startPan({ x: 400, y: 280 }));
    act(() => api.movePan({ x: 340, y: 280 }));

    // 오른쪽 내용을 보려고 왼쪽으로 끌었으므로 시야가 오른쪽으로 간다.
    expect(api.camera.panX).toBeGreaterThan(before.panX);
    act(() => api.endPan());
  });

  it('전체 보기로 처음 배율로 되돌린다', () => {
    const initial = api.camera.zoom;
    act(() => api.zoomBy(4, { x: 400, y: 280 }, rect));
    expect(api.camera.zoom).not.toBe(initial);

    act(() => api.fit());
    expect(api.camera.zoom).toBe(initial);
  });

  it('아무리 끌어도 도면에서 멀리 벗어나지 않는다', () => {
    act(() => api.startPan({ x: 0, y: 0 }));
    act(() => api.movePan({ x: -100000, y: -100000 }));

    // clampPan이 도면 크기 기준으로 제한한다. 도면 밖 허공만 보이는 상태가 되면 안 된다.
    expect(api.camera.panX).toBeLessThan(300);
    expect(api.camera.panY).toBeLessThan(200);
    act(() => api.endPan());
  });
});
