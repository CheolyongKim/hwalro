import type { Dispatch } from 'react';
import type { LayoutZone } from '../api/layoutMetadataApi';
import type { EditorAction } from '../state/editorReducer';
import type { EditorState, Fabric } from '../types';
import { groupStructuresByZone } from '../utils/zoneMembership';

interface LayersPanelProps {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  zones: LayoutZone[];
  selectedZoneId: number | null;
  onSelectZone: (zoneId: number | null) => void;
  employeeNameById: Record<number, string>;
}

const groupClassName = 'mt-3 first:mt-0';
const groupTitleClassName =
  'px-1 text-[11px] font-bold tracking-[0.08em] text-text-muted uppercase';
const rowClassName =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-panel-text transition-colors hover:bg-panel-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';
const activeRowClassName = 'bg-panel-soft font-bold';

function Row({
  label,
  detail,
  selected,
  indent,
  ariaLabel,
  onSelect,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  indent?: boolean;
  ariaLabel: string;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-current={selected}
        onClick={onSelect}
        className={`${rowClassName} ${selected ? activeRowClassName : ''} ${indent ? 'pl-6' : ''}`}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {detail ? <span className="shrink-0 text-[11px] text-text-muted">{detail}</span> : null}
      </button>
    </li>
  );
}

function selectFabric(dispatch: Dispatch<EditorAction>, fabric: Fabric) {
  dispatch({
    type: 'selectAt',
    wallId: null,
    outsideWallId: null,
    exitId: null,
    textId: null,
    pillarId: null,
    fabricId: fabric.id,
    additive: false,
  });
}

/** 도면 요소를 구역 계층으로 보여주고, 클릭하면 캔버스 선택과 동기화한다. */
export function LayersPanel({
  state,
  dispatch,
  zones,
  selectedZoneId,
  onSelectZone,
  employeeNameById,
}: LayersPanelProps) {
  const { doc, selection } = state;
  const grouped = groupStructuresByZone(doc.fabrics, zones);

  return (
    <section aria-label="도면 계층" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <div className={groupClassName}>
        <h3 className={groupTitleClassName}>구역</h3>
        {grouped.zones.length === 0 ? (
          <p className="px-2 py-2 text-xs text-text-muted">
            아직 구역이 없습니다. 구역 도구로 사각형을 그려 만드세요.
          </p>
        ) : (
          <ul className="mt-1">
            {grouped.zones.map(({ zone, fabrics }) => (
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
                    onSelect={() => onSelectZone(zone.zoneId)}
                  />
                  {fabrics.map((fabric) => (
                    <Row
                      key={fabric.id}
                      label={fabric.name}
                      selected={selection.fabricIds.includes(fabric.id)}
                      indent
                      ariaLabel={`${fabric.name} 선택`}
                      onSelect={() => selectFabric(dispatch, fabric)}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={groupClassName}>
        <h3 className={groupTitleClassName}>공통 구조물</h3>
        {grouped.common.length === 0 ? (
          <p className="px-2 py-2 text-xs text-text-muted">모든 구조물이 구역에 속해 있습니다.</p>
        ) : (
          <ul className="mt-1">
            {grouped.common.map((fabric) => (
              <Row
                key={fabric.id}
                label={fabric.name}
                selected={selection.fabricIds.includes(fabric.id)}
                ariaLabel={`${fabric.name} 선택`}
                onSelect={() => selectFabric(dispatch, fabric)}
              />
            ))}
          </ul>
        )}
      </div>

      <div className={groupClassName}>
        <h3 className={groupTitleClassName}>비상구</h3>
        <ul className="mt-1">
          {doc.exits.map((exit) => (
            <Row
              key={exit.id}
              label={exit.name}
              selected={selection.exitIds.includes(exit.id)}
              ariaLabel={`${exit.name} 선택`}
              onSelect={() =>
                dispatch({
                  type: 'selectAt',
                  wallId: null,
                  outsideWallId: null,
                  exitId: exit.id,
                  textId: null,
                  pillarId: null,
                  fabricId: null,
                  additive: false,
                })
              }
            />
          ))}
        </ul>
      </div>

      <div className={groupClassName}>
        <h3 className={groupTitleClassName}>기타</h3>
        <dl className="mt-1 px-2 text-xs text-text-muted">
          <div className="flex justify-between py-0.5">
            <dt>벽</dt>
            <dd className="tabular-nums">{doc.walls.length}개</dd>
          </div>
          <div className="flex justify-between py-0.5">
            <dt>외각벽</dt>
            <dd className="tabular-nums">{doc.outsideWalls.length}개</dd>
          </div>
          <div className="flex justify-between py-0.5">
            <dt>기둥</dt>
            <dd className="tabular-nums">{doc.pillars.length}개</dd>
          </div>
          <div className="flex justify-between py-0.5">
            <dt>텍스트</dt>
            <dd className="tabular-nums">{doc.layoutTexts.length}개</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
