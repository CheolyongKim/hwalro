// @vitest-environment happy-dom

import { act, type PropsWithChildren } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../state/editorReducer';
import { LayoutCanvas } from './LayoutCanvas';

vi.mock('react-konva', () => {
  const Shape = ({ children }: PropsWithChildren) => children ?? null;
  return {
    Circle: Shape,
    Group: Shape,
    Layer: Shape,
    Line: Shape,
    Rect: Shape,
    Stage: Shape,
    Text: Shape,
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('LayoutCanvas risk mode', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('allows drawing a risk zone on a locked layout', () => {
    const onRiskZoneDrawn = vi.fn();
    act(() => {
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
    if (!canvas) return;
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn();
    canvas.hasPointerCapture = vi.fn(() => true);

    act(() => {
      canvas.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: 40,
          clientY: 40,
          pointerId: 1,
        }),
      );
    });
    act(() => {
      canvas.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 43,
          clientY: 43,
          pointerId: 1,
        }),
      );
    });
    act(() => {
      canvas.dispatchEvent(
        new PointerEvent('pointerup', { bubbles: true, clientX: 43, clientY: 43, pointerId: 1 }),
      );
    });

    expect(onRiskZoneDrawn).toHaveBeenCalledOnce();
    expect(onRiskZoneDrawn.mock.calls[0][0].width).toBeLessThan(0.5);
  });
});
