import type { LayoutZone } from '../api/layoutMetadataApi';
import type { Fabric } from '../types';

export interface ZoneGroup {
  zone: LayoutZone;
  fabrics: Fabric[];
}

export interface GroupedStructures {
  zones: ZoneGroup[];
  /** 어떤 구역에도 속하지 않은 구조물. 공용 시설로 취급한다. */
  common: Fabric[];
}

/**
 * 구조물을 구역별로 묶는다.
 *
 * 멤버십은 서버 ID(`backendId`) 기준이므로, 아직 저장되지 않은 구조물은 항상 공용으로 분류된다.
 * 사라진 구역을 가리키는 멤버십도 공용으로 떨어진다.
 */
export function groupStructuresByZone(fabrics: Fabric[], zones: LayoutZone[]): GroupedStructures {
  const zoneByFabricId = new Map<number, number>();
  const knownZoneIds = new Set(zones.map((zone) => zone.zoneId));
  for (const zone of zones) {
    for (const fabricId of zone.structureFabricIds) {
      if (knownZoneIds.has(zone.zoneId)) {
        zoneByFabricId.set(fabricId, zone.zoneId);
      }
    }
  }

  const byZone = new Map<number, Fabric[]>(zones.map((zone) => [zone.zoneId, []]));
  const common: Fabric[] = [];
  for (const fabric of fabrics) {
    const zoneId = fabric.backendId === null ? undefined : zoneByFabricId.get(fabric.backendId);
    if (zoneId === undefined) {
      common.push(fabric);
    } else {
      byZone.get(zoneId)?.push(fabric);
    }
  }

  return {
    zones: zones.map((zone) => ({ zone, fabrics: byZone.get(zone.zoneId) ?? [] })),
    common,
  };
}

/** 구조물이 속한 구역. 공용 구조물이면 null. */
export function zoneOfFabric(fabric: Fabric, zones: LayoutZone[]): LayoutZone | null {
  if (fabric.backendId === null) {
    return null;
  }
  return zones.find((zone) => zone.structureFabricIds.includes(fabric.backendId!)) ?? null;
}
