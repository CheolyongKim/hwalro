// @vitest-environment happy-dom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { drawingApi } from '../../drawings/api/drawingApi';
import { layoutMetadataApi } from '../../layout/api/layoutMetadataApi';
import { zoneApi } from '../api/zoneApi';
import EvacuationRoutesPage from './EvacuationRoutesPage';

// 캔버스 도형은 DOM으로 검증할 수 없다. 여기서 확인할 것은 '캔버스가 그려지기는 하는가'이므로
// Stage만 흔적을 남기고 나머지 도형은 자식만 통과시킨다.
vi.mock('react-konva', async () => {
  const { createElement } = await import('react');
  const shape = ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children ?? null);
  return {
    Stage: ({ children }: { children?: ReactNode }) =>
      createElement('div', { 'data-testid': 'stage' }, children ?? null),
    Layer: shape,
    Line: shape,
    Rect: shape,
    Circle: shape,
    Text: shape,
  };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * 실제 브라우저처럼 "관찰을 시작한 요소에만" 크기를 알려준다.
 *
 * 크기를 무조건 통보하는 스텁을 쓰면 관찰이 아예 붙지 않는 버그를 놓친다. 이 화면이 바로 그 버그로
 * 캔버스가 통째로 비어 있었다.
 */
class TestResizeObserver {
  static observedCount = 0;
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    TestResizeObserver.observedCount += 1;
    this.callback(
      [{ target, contentRect: { width: 1200, height: 560 } } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  disconnect() {}
  unobserve() {}
}

globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  TestResizeObserver.observedCount = 0;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const drawing = {
  id: 2,
  title: '더현대 지하 2층',
  description: '',
  width: 170,
  height: 100,
  walls: [{ id: 1, name: '벽 1', startX: 0, startY: 0, endX: 10, endY: 0 }],
  outsideWalls: [{ name: '외벽', startX: 0, startY: 0, endX: 170, endY: 0 }],
  pillars: [],
  fabrics: [],
  exits: [{ id: 9, name: '비상구 1', startX: 169, startY: 40, endX: 169, endY: 42 }],
  layoutTexts: [],
  version: 0,
  layoutVersionId: 7,
  layoutVersionNumber: 1,
  layoutVersionStatus: '초안',
  createdBy: 1,
  createdAt: '2026-08-25T00:00:00',
};

const route = {
  zoneId: 11,
  zoneName: 'MLB',
  origin: { x: 20, y: 25 },
  routeOrigin: { x: 20, y: 25 },
  originAdjusted: false,
  status: 'AVAILABLE' as const,
  unavailableReason: null,
  defaultExit: null,
  recommendedExitId: 9,
  recommendedExitName: '비상구 1',
  exitChoice: 'NEAREST' as const,
  distanceMeters: 42,
  narrowestMeters: 1.4,
  waypoints: [
    { x: 20, y: 25 },
    { x: 100, y: 30 },
    { x: 169, y: 41 },
  ],
  partitions: [],
};

async function renderPage() {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/drawings/2/evacuation-routes']}>
        <Routes>
          <Route path="/drawings/:drawingId/evacuation-routes" element={<EvacuationRoutesPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await Promise.resolve();
  });
  // 로딩이 끝나고 캔버스 자리가 실제로 붙을 때까지 이펙트를 흘려보낸다.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('EvacuationRoutesPage', () => {
  beforeEach(() => {
    vi.spyOn(drawingApi, 'get').mockResolvedValue(drawing as never);
    vi.spyOn(zoneApi, 'evacuationRoutes').mockResolvedValue([route] as never);
    vi.spyOn(layoutMetadataApi, 'get').mockResolvedValue({
      layoutId: 2,
      layoutVersionId: 7,
      zones: [
        {
          zoneId: 11,
          name: 'MLB',
          zoneType: 'WORK',
          rect: { x: 10, y: 20, width: 20, height: 10 },
          assignedUserId: null,
          defaultExitId: null,
          displayOrder: 0,
          members: [],
        },
      ],
      structureConstraints: [],
    } as never);
  });

  it('도면을 불러온 뒤 캔버스를 그린다', async () => {
    await renderPage();

    // 캔버스는 로딩이 끝난 뒤에야 DOM에 붙는다. 그때 크기 관찰이 시작되지 않으면
    // 폭이 0으로 남아 도면이 통째로 보이지 않는다.
    expect(TestResizeObserver.observedCount).toBeGreaterThan(0);
    expect(container.querySelector('[data-testid="stage"]')).not.toBeNull();
  });

  it('구역 목록은 함께 표시된다', async () => {
    await renderPage();

    expect(container.textContent).toContain('MLB');
    expect(container.textContent).toContain('비상구 1');
  });

  it('구역이 여러 비상구로 갈리면 색 범례를 함께 보여준다', async () => {
    vi.spyOn(zoneApi, 'evacuationRoutes').mockResolvedValue([
      {
        ...route,
        partitions: [
          {
            exitId: 9,
            exitName: '비상구 1',
            tiles: [{ x: 10, y: 20, width: 5, height: 0.25 }],
            waypoints: [
              { x: 12, y: 21 },
              { x: 169, y: 41 },
            ],
            distanceMeters: 40,
            narrowestMeters: 1.2,
          },
          {
            exitId: 10,
            exitName: '비상구 2',
            tiles: [{ x: 15, y: 20, width: 5, height: 0.25 }],
            waypoints: [
              { x: 18, y: 21 },
              { x: 1, y: 41 },
            ],
            distanceMeters: 25,
            narrowestMeters: 1.1,
          },
        ],
      },
    ] as never);

    await renderPage();

    expect(container.textContent).toContain('비상구가 갈리는 영역 2곳');
    expect(container.textContent).toContain('비상구 2');
  });
});
