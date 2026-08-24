import type { LayoutZone, ZoneElementKind, ZoneMember } from '../api/layoutMetadataApi';
import type { Fabric, Pillar, Wall } from '../types';

export interface LayerElement {
  kind: ZoneElementKind;
  id: string;
  /** 서버 ID. 저장 전 요소는 null이며 소속 변경 대상이 될 수 없다. */
  backendId: number | null;
  name: string;
}

export interface ZoneGroup {
  zone: LayoutZone;
  members: LayerElement[];
}

export interface GroupedElements {
  zones: ZoneGroup[];
  /** 어떤 구역에도 속하지 않은 요소. 공용으로 취급한다. */
  common: LayerElement[];
}

function toLayerElements(
  kind: ZoneElementKind,
  elements: Array<Fabric | Pillar | Wall>,
): LayerElement[] {
  return elements.map((element) => ({
    kind,
    id: element.id,
    backendId: element.backendId,
    name: element.name,
  }));
}

/**
 * 벽·기둥·구조물을 구역별로 묶는다.
 *
 * 멤버십은 서버 ID(`backendId`) 기준이므로, 아직 저장되지 않은 요소는 항상 공용으로 분류된다.
 * 사라진 구역·요소를 가리키는 멤버십도 공용으로 떨어진다. 비상구·외각벽·텍스트는 구역 구성원이 아니다.
 */
export function groupElementsByZone(
  walls: Wall[],
  pillars: Pillar[],
  fabrics: Fabric[],
  zones: LayoutZone[],
): GroupedElements {
  const zoneKeyByMember = new Map<string, number>();
  const knownZoneIds = new Set(zones.map((zone) => zone.zoneId));
  for (const zone of zones) {
    for (const member of zone.members) {
      if (knownZoneIds.has(zone.zoneId)) {
        zoneKeyByMember.set(`${member.kind}:${member.id}`, zone.zoneId);
      }
    }
  }

  const byZone = new Map<number, LayerElement[]>(zones.map((zone) => [zone.zoneId, []]));
  const common: LayerElement[] = [];
  for (const element of [
    ...toLayerElements('WALL', walls),
    ...toLayerElements('PILLAR', pillars),
    ...toLayerElements('FABRIC', fabrics),
  ]) {
    const zoneId = zoneKeyByMember.get(`${element.kind}:${element.backendId}`);
    if (zoneId === undefined) {
      common.push(element);
    } else {
      byZone.get(zoneId)?.push(element);
    }
  }

  return {
    zones: zones.map((zone) => ({ zone, members: byZone.get(zone.zoneId) ?? [] })),
    common,
  };
}

/** 구조물이 속한 구역. 공용 구조물이면 null. 배치 제약은 구조물 전용이라 fabric 멤버십만 본다. */
export function zoneOfFabric(fabric: Fabric, zones: LayoutZone[]): LayoutZone | null {
  if (fabric.backendId === null) {
    return null;
  }
  return (
    zones.find((zone) =>
      zone.members.some((member) => member.kind === 'FABRIC' && member.id === fabric.backendId),
    ) ?? null
  );
}

export function memberOf(
  element: Pick<LayerElement, 'kind' | 'backendId'>,
): (member: ZoneMember) => boolean {
  return (member) => member.kind === element.kind && member.id === element.backendId;
}
