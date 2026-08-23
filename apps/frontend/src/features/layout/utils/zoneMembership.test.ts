import { describe, expect, it } from 'vitest';
import type { LayoutZone } from '../api/layoutMetadataApi';
import type { Fabric } from '../types';
import { groupStructuresByZone, zoneOfFabric } from './zoneMembership';

function fabric(id: string, backendId: number | null): Fabric {
  return {
    id,
    backendId,
    name: id,
    startX: 0,
    startY: 0,
    endX: 1,
    endY: 1,
    rotation: 0,
  };
}

function zone(zoneId: number, structureFabricIds: number[]): LayoutZone {
  return {
    zoneId,
    name: `구역 ${zoneId}`,
    zoneType: 'WORK',
    rect: { x: 0, y: 0, width: 10, height: 10 },
    assignedUserId: null,
    defaultExitId: null,
    alternateExitId: null,
    structureFabricIds,
  };
}

describe('groupStructuresByZone', () => {
  it('구조물을 구역별로 묶는다', () => {
    const grouped = groupStructuresByZone(
      [fabric('a', 20), fabric('b', 21)],
      [zone(30, [20]), zone(31, [21])],
    );

    expect(grouped.zones.map((entry) => entry.fabrics.map((f) => f.id))).toEqual([['a'], ['b']]);
    expect(grouped.common).toHaveLength(0);
  });

  it('멤버십이 없는 구조물과 저장 전 구조물은 공용으로 분류한다', () => {
    const grouped = groupStructuresByZone(
      [fabric('a', 20), fabric('b', 21), fabric('new', null)],
      [zone(30, [20])],
    );

    expect(grouped.zones[0].fabrics.map((f) => f.id)).toEqual(['a']);
    expect(grouped.common.map((f) => f.id)).toEqual(['b', 'new']);
  });

  it('구역이 하나도 없으면 전부 공용이다', () => {
    const grouped = groupStructuresByZone([fabric('a', 20)], []);

    expect(grouped.zones).toHaveLength(0);
    expect(grouped.common.map((f) => f.id)).toEqual(['a']);
  });

  it('zoneOfFabric은 소속 구역을 찾고 공용이면 null을 준다', () => {
    const zones = [zone(30, [20])];

    expect(zoneOfFabric(fabric('a', 20), zones)?.zoneId).toBe(30);
    expect(zoneOfFabric(fabric('b', 21), zones)).toBeNull();
    expect(zoneOfFabric(fabric('new', null), zones)).toBeNull();
  });
});
