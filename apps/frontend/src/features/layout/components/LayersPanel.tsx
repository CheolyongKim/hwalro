import { useState, type Dispatch, type DragEvent, type KeyboardEvent, type MouseEvent } from 'react';
import type { LayoutZone } from '../api/layoutMetadataApi';
import type { EditorAction } from '../state/editorReducer';
import type { EditorState } from '../types';
import type { LayerElement } from '../utils/zoneMembership';
import { groupElementsByZone } from '../utils/zoneMembership';
import { LayerContextMenu, type MenuItem } from './LayerContextMenu';

const DND_MIME = 'application/x-hwalro-layer';
const DND_ZONE_MIME = 'application/x-hwalro-zone';

interface LayersPanelProps {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  zones: LayoutZone[];
  selectedZoneId: number | null;
  onSelectZone: (zoneId: number | null) => void;
  employeeNameById: Record<number, string>;
  /** 잠긴 도면 버전에서는 순서가 도면 저장으로만 바뀌므로 드래그를 막고 이유를 표시한다. */
  orderLocked: boolean;
  onChangeMembership: (element: LayerElement, targetZoneId: number | null) => void;
  onGroupSelectionIntoZone: () => void;
  onSwapZoneOrder: (draggedZoneId: number, targetZoneId: number) => void;
}

const groupClassName = 'mt-3 first:mt-0';
const groupTitleClassName =
  'px-1 text-[11px] font-bold tracking-[0.08em] text-text-muted uppercase';
const rowClassName =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-panel-text transition-colors hover:bg-panel-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';
const activeRowClassName = 'bg-panel-soft font-bold';

interface DraggedLayer {
  kind: LayerElement['kind'];
  backendId: number | null;
  clientId: string;
}

function dragPayload(element: LayerElement): string {
  return JSON.stringify({ kind: element.kind, id: element.backendId, clientId: element.id });
}

function parseDragPayload(event: DragEvent): DraggedLayer | null {
  const raw = event.dataTransfer.getData(DND_MIME);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as DraggedLayer;
    return { kind: parsed.kind, backendId: parsed.backendId, clientId: parsed.clientId };
  } catch {
    return null;
  }
}

interface RowOptions {
  label: string;
  detail?: string;
  selected: boolean;
  indent?: boolean;
  ariaLabel: string;
  onSelect: (additive: boolean) => void;
  draggable?: boolean;
  onDragStart?: (event: DragEvent) => void;
  droppable?: boolean;
  onDrop?: (event: DragEvent) => void;
  menuItems?: Array<MenuItem | { label: string; children: MenuItem[] }>;
}

function Row({
  label,
  detail,
  selected,
  indent,
  ariaLabel,
  onSelect,
  draggable = false,
  onDragStart,
  droppable = false,
  onDrop,
  menuItems,
}: RowOptions) {
  const [dropHint, setDropHint] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);

  const openMenu = (x: number, y: number) => {
    if (menuItems && menuItems.length > 0) {
      setMenuAnchor({ x, y });
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'F10' && event.shiftKey) {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      openMenu(rect.left, rect.bottom);
    }
  };

  return (
    <li>
      <div className={`flex items-center ${dropHint ? 'rounded-md ring-2 ring-focus-ring' : ''}`}>
        <button
          type="button"
          aria-label={ariaLabel}
          aria-current={selected}
          onClick={(event) =>
            onSelect(event.shiftKey || event.ctrlKey || event.metaKey)
          }
          onContextMenu={(event: MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            openMenu(event.clientX, event.clientY);
          }}
          onKeyDown={onKeyDown}
          draggable={draggable}
          onDragStart={onDragStart}
          onDragOver={(event) => {
            if (droppable) {
              event.preventDefault();
              setDropHint(true);
            }
          }}
          onDragLeave={() => setDropHint(false)}
          onDrop={(event) => {
            setDropHint(false);
            onDrop?.(event);
          }}
          className={`${rowClassName} ${selected ? activeRowClassName : ''} ${indent ? 'pl-6' : ''}`}
        >
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {detail ? <span className="shrink-0 text-[11px] text-text-muted">{detail}</span> : null}
        </button>
        {menuItems && menuItems.length > 0 ? (
          <button
            type="button"
            aria-label={`${label} 작업 메뉴`}
            onClick={(event) => {
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              openMenu(rect.left, rect.bottom);
            }}
            className="shrink-0 rounded px-1 py-1 text-xs text-text-muted hover:bg-panel-soft hover:text-panel-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            ⋯
          </button>
        ) : null}
      </div>
      {menuAnchor !== null && menuItems ? (
        <LayerContextMenu
          anchor={menuAnchor}
          items={menuItems}
          onClose={() => setMenuAnchor(null)}
        />
      ) : null}
    </li>
  );
}

/** 도면의 모든 요소를 Figma식 계층으로 보여준다. 소속은 드래그 앤 드롭과 컨텍스트 메뉴로 정한다. */
export function LayersPanel({
  state,
  dispatch,
  zones,
  selectedZoneId,
  onSelectZone,
  employeeNameById,
  orderLocked,
  onChangeMembership,
  onGroupSelectionIntoZone,
  onSwapZoneOrder,
}: LayersPanelProps) {
  const { doc, selection } = state;
  const grouped = groupElementsByZone(doc.walls, doc.pillars, doc.fabrics, zones);
  const allMembers = [...grouped.zones.flatMap((group) => group.members), ...grouped.common];
  const ownerZoneByClientId = new Map<string, number>();
  for (const group of grouped.zones) {
    for (const member of group.members) {
      ownerZoneByClientId.set(member.id, group.zone.zoneId);
    }
  }

  const resolveDragged = (event: DragEvent): { parsed: DraggedLayer; element: LayerElement } | null => {
    const parsed = parseDragPayload(event);
    if (!parsed) {
      return null;
    }
    const element = allMembers.find((member) => member.id === parsed.clientId);
    return element ? { parsed, element } : null;
  };

  const selectedMembers = grouped.zones
    .flatMap((group) => group.members)
    .concat(grouped.common)
    .filter(
      (member) =>
        (member.kind === 'WALL' && selection.wallIds.includes(member.id)) ||
        (member.kind === 'PILLAR' && selection.pillarIds.includes(member.id)) ||
        (member.kind === 'FABRIC' && selection.fabricIds.includes(member.id)),
    );
  const canGroupSelected =
    selectedMembers.length > 0 &&
    selectedMembers.every((member) =>
      doc.walls.concat(doc.pillars, doc.fabrics).some(
        (element) => element.id === member.id && element.backendId !== null,
      ),
    );

  const selectElement = (element: LayerElement, additive: boolean) => {
    dispatch({
      type: 'selectAt',
      wallId: element.kind === 'WALL' ? element.id : null,
      outsideWallId: null,
      exitId: null,
      textId: null,
      pillarId: element.kind === 'PILLAR' ? element.id : null,
      fabricId: element.kind === 'FABRIC' ? element.id : null,
      additive,
    });
  };

  const memberMenu = (element: LayerElement): Array<
    MenuItem | { label: string; children: MenuItem[] }
  > => {
    const items: Array<MenuItem | { label: string; children: MenuItem[] }> = [];
    if (element.backendId === null) {
      items.push({
        label: '선택 요소를 구역으로 묶기',
        disabled: !canGroupSelected,
        onSelect: onGroupSelectionIntoZone,
      });
      return items;
    }
    const ownerZone = grouped.zones.find((group) =>
      group.members.some((candidate) => candidate.kind === element.kind && candidate.backendId === element.backendId),
    );
    if (zones.length > 0) {
      items.push({
        label: '구역으로 이동 ▸',
        children: [
          ...zones.map((zone) => ({
            label: zone.name,
            disabled: ownerZone?.zone.zoneId === zone.zoneId,
            onSelect: () => onChangeMembership(element, zone.zoneId),
          })),
          ...(ownerZone
            ? [
                {
                  label: '구역에서 빼기',
                  onSelect: () => onChangeMembership(element, null),
                },
              ]
            : []),
        ],
      });
    }
    items.push({
      label: '선택 요소를 구역으로 묶기',
      disabled: !canGroupSelected,
      onSelect: onGroupSelectionIntoZone,
    });
    return items;
  };

  const commonGroupDrop = (event: DragEvent) => {
    const dragged = resolveDragged(event);
    if (dragged) {
      onChangeMembership(dragged.element, null);
    }
  };

  const facilityRow = (label: string, selected: boolean, ariaLabel: string, onSelect: () => void) => (
    <Row
      key={label}
      label={label}
      selected={selected}
      ariaLabel={ariaLabel}
      onSelect={() => onSelect()}
    />
  );

  return (
    <section aria-label="도면 계층" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      {orderLocked ? (
        <p className="mb-2 rounded-md border border-panel-divider bg-panel-soft px-2 py-1.5 text-xs text-text-muted">
          잠긴 버전에서는 소속만 바꿀 수 있고 표시 순서는 도면 저장으로만 바뀝니다.
        </p>
      ) : null}

      <div className={groupClassName}>
        <h3 className={groupTitleClassName}>구역</h3>
        {grouped.zones.length === 0 ? (
          <p className="px-2 py-2 text-xs text-text-muted">
            아직 구역이 없습니다. 구역 도구로 사각형을 그리거나 요소를 묶어 만드세요.
          </p>
        ) : (
          <ul className="mt-1">
            {grouped.zones.map(({ zone, members }) => (
              <li key={zone.zoneId}>
                <ul>
                  <Row
                    label={zone.name}
                    detail={
                      zone.assignedUserId === null
                        ? '미배정'
                        : (employeeNameById[zone.assignedUserId] ?? `직원 #${zone.assignedUserId}`)
                    }
                    selected={zone.zoneId === selectedZoneId}
                    ariaLabel={`${zone.name} 구역 선택`}
                    onSelect={(additive) => {
                      if (!additive) {
                        onSelectZone(zone.zoneId);
                      }
                    }}
                    draggable={!orderLocked}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(DND_ZONE_MIME, String(zone.zoneId));
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    droppable
                    onDrop={(event) => {
                      const draggedZoneId = Number(event.dataTransfer.getData(DND_ZONE_MIME));
                      if (draggedZoneId > 0 && draggedZoneId !== zone.zoneId) {
                        onSwapZoneOrder(draggedZoneId, zone.zoneId);
                        return;
                      }
                      const dragged = resolveDragged(event);
                      if (dragged) {
                        onChangeMembership(dragged.element, zone.zoneId);
                      }
                    }}
                  />
                  {members.map((member) => (
                    <Row
                      key={member.id}
                      label={member.name}
                      selected={
                        (member.kind === 'WALL' && selection.wallIds.includes(member.id)) ||
                        (member.kind === 'PILLAR' && selection.pillarIds.includes(member.id)) ||
                        (member.kind === 'FABRIC' && selection.fabricIds.includes(member.id))
                      }
                      indent
                      ariaLabel={`${member.name} 선택`}
                      onSelect={(additive) => selectElement(member, additive)}
                      draggable={member.backendId !== null && !orderLocked}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(DND_MIME, dragPayload(member));
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      droppable
                      onDrop={(event) => {
                        const dragged = resolveDragged(event);
                        if (!dragged) {
                          return;
                        }
                        if (dragged.parsed.kind === member.kind) {
                          dispatch({
                            type: 'reorderElements',
                            draggedKind: member.kind === 'WALL' ? 'wall' : member.kind === 'PILLAR' ? 'pillar' : 'fabric',
                            draggedId: dragged.parsed.clientId,
                            targetKind: member.kind === 'WALL' ? 'wall' : member.kind === 'PILLAR' ? 'pillar' : 'fabric',
                            targetId: member.id,
                          });
                          const ownerZoneId = ownerZoneByClientId.get(member.id);
                          if (ownerZoneId !== undefined) {
                            onChangeMembership(dragged.element, ownerZoneId);
                          }
                          return;
                        }
                        onChangeMembership(
                          dragged.element,
                          ownerZoneByClientId.get(member.id) ?? null,
                        );
                      }}
                      menuItems={memberMenu(member)}
                    />
                  ))}
                  {members.length === 0 ? (
                    <li className="pl-6 pr-2 py-1 text-[11px] text-text-muted">비어 있음</li>
                  ) : null}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={groupClassName}>
        <h3 className={groupTitleClassName}>공통</h3>
        {grouped.common.length === 0 ? (
          <p className="px-2 py-2 text-xs text-text-muted">
            구역에 속하지 않은 벽·기둥·구조물이 없습니다.
          </p>
        ) : (
          <ul
            className="mt-1 rounded-md"
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes(DND_MIME)) {
                event.preventDefault();
              }
            }}
            onDrop={commonGroupDrop}
          >
            {grouped.common.map((member) => (
              <Row
                key={member.id}
                label={member.name}
                selected={
                  (member.kind === 'WALL' && selection.wallIds.includes(member.id)) ||
                  (member.kind === 'PILLAR' && selection.pillarIds.includes(member.id)) ||
                  (member.kind === 'FABRIC' && selection.fabricIds.includes(member.id))
                }
                ariaLabel={`${member.name} 선택`}
                onSelect={(additive) => selectElement(member, additive)}
                draggable={member.backendId !== null && !orderLocked}
                onDragStart={(event) => {
                  event.dataTransfer.setData(DND_MIME, dragPayload(member));
                  event.dataTransfer.effectAllowed = 'move';
                }}
                menuItems={memberMenu(member)}
              />
            ))}
          </ul>
        )}
      </div>

      <div className={groupClassName}>
        <h3 className={groupTitleClassName}>공용 시설</h3>
        <ul className="mt-1">
          {doc.exits.map((exit) =>
            facilityRow(
              exit.name,
              selection.exitIds.includes(exit.id),
              `${exit.name} 선택`,
              () =>
                dispatch({
                  type: 'selectAt',
                  wallId: null,
                  outsideWallId: null,
                  exitId: exit.id,
                  textId: null,
                  pillarId: null,
                  fabricId: null,
                  additive: false,
                }),
            ),
          )}
          {doc.outsideWalls.map((wall) =>
            facilityRow(
              wall.name,
              selection.outsideWallIds.includes(wall.id),
              `${wall.name} 선택`,
              () =>
                dispatch({
                  type: 'selectAt',
                  wallId: null,
                  outsideWallId: wall.id,
                  exitId: null,
                  textId: null,
                  pillarId: null,
                  fabricId: null,
                  additive: false,
                }),
            ),
          )}
          {doc.layoutTexts.map((text) =>
            facilityRow(
              text.text.split('\n')[0] || '텍스트',
              selection.textIds.includes(text.id),
              `텍스트 ${text.text.slice(0, 10)} 선택`,
              () =>
                dispatch({
                  type: 'selectAt',
                  wallId: null,
                  outsideWallId: null,
                  exitId: null,
                  textId: text.id,
                  pillarId: null,
                  fabricId: null,
                  additive: false,
                }),
            ),
          )}
        </ul>
      </div>
    </section>
  );
}
