// @vitest-environment happy-dom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../state/editorReducer';
import { PX_PER_METER } from '../utils/geometry';
import { LayoutCanvas } from './LayoutCanvas';

vi.mock('react-konva', () => ({
  Circle: () => null,
  Group: ({ children }: { children?: ReactNode }) => children,
  Layer: ({ children }: { children?: ReactNode }) => children,
  Line: () => null,
  Rect: () => null,
  Stage: ({ children }: { children?: ReactNode }) => children,
  Text: () => null,
}));

vi.mock('./useCanvasListeners', async () => {
  const React = await import('react');
  return {
    useCanvasListeners: () => ({
      containerRef: React.useRef<HTMLDivElement>(null),
      spaceDown: false,
    }),
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('LayoutCanvas 주의 구역 드래그', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('잠긴 도면에서도 주의 구역을 드래그해 범위를 전달한다', async () => {
    const onRiskZoneDrawn = vi.fn();

    await act(async () => {
      root.render(
        <LayoutCanvas
          state={createInitialState()}
          dispatch={vi.fn()}
          size={{ w: 800, h: 600 }}
          onSizeChange={vi.fn()}
          readOnly
          riskMode
          onRiskZoneDrawn={onRiskZoneDrawn}
        />,
      );
    });

    const canvas = container.querySelector<HTMLElement>('[aria-label="도면 캔버스"]');
    expect(canvas).not.toBeNull();

    await act(async () => {
      canvas?.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: 50,
          clientY: 50,
          pointerId: 1,
        }),
      );
    });
    await act(async () => {
      canvas?.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 150,
          clientY: 150,
          pointerId: 1,
        }),
      );
    });
    await act(async () => {
      canvas?.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          button: 0,
          clientX: 150,
          clientY: 150,
          pointerId: 1,
        }),
      );
    });

    expect(onRiskZoneDrawn).toHaveBeenCalledOnce();
    const [bounds] = onRiskZoneDrawn.mock.calls[0];
    expect(bounds.x).toBeCloseTo(50 / PX_PER_METER);
    expect(bounds.y).toBeCloseTo(50 / PX_PER_METER);
    expect(bounds.width).toBeCloseTo(100 / PX_PER_METER);
    expect(bounds.height).toBeCloseTo(100 / PX_PER_METER);
  });
});
