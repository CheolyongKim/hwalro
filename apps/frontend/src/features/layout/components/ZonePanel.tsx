import { useEffect, useState } from 'react';
import type { LayoutZone, StructureConstraint, ZoneType } from '../api/layoutMetadataApi';
import type { Exit } from '../types';
import { round1 } from '../utils/geometry';

const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
  WORK: '작업',
  STORAGE: '보관',
  PASSAGE: '통로',
  OTHER: '기타',
};

const fieldLabelClassName = 'block text-xs text-panel-muted';
const controlClassName =
  'mt-1 h-9 w-full rounded-md border border-panel-divider bg-panel-soft px-2 text-sm text-panel-text outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:opacity-50';
const checkboxRowClassName = 'flex items-center gap-2 py-1.5 text-sm text-panel-text';

function NumberInput({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(round1(value)));
  useEffect(() => setDraft(String(round1(value))), [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) {
      onCommit(round1(parsed));
    } else {
      setDraft(String(round1(value)));
    }
  };

  return (
    <label>
      <span className={fieldLabelClassName}>{label}</span>
      <input
        type="number"
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
        className={`${controlClassName} font-mono`}
      />
    </label>
  );
}

interface ZonePanelProps {
  zone: LayoutZone;
  exits: Exit[];
  employees: Array<{ id: number; name: string }>;
  readOnly: boolean;
  onRename: (name: string) => void;
  onChangeType: (zoneType: ZoneType) => void;
  onChangeRect: (patch: { x?: number; y?: number; width?: number; height?: number }) => void;
  onAssign: (userId: number | null) => void;
  onChangeExit: (exitBackendId: number | null) => void;
  onDelete: () => void;
}

export function ZonePanel({
  zone,
  exits,
  employees,
  readOnly,
  onRename,
  onChangeType,
  onChangeRect,
  onAssign,
  onChangeExit,
  onDelete,
}: ZonePanelProps) {
  const [nameDraft, setNameDraft] = useState(zone.name);
  useEffect(() => setNameDraft(zone.name), [zone.name, zone.zoneId]);

  const savedExits = exits.filter((exit) => exit.backendId !== null);

  return (
    <section aria-label="구역 속성">
      <h3 className="text-sm font-bold text-panel-text">구역</h3>

      <label className="mt-3 block">
        <span className={fieldLabelClassName}>이름</span>
        <input
          type="text"
          value={nameDraft}
          disabled={readOnly}
          onChange={(event) => setNameDraft(event.target.value)}
          onBlur={() => {
            const trimmed = nameDraft.trim();
            if (trimmed && trimmed !== zone.name) {
              onRename(trimmed);
            } else {
              setNameDraft(zone.name);
            }
          }}
          className={controlClassName}
        />
      </label>

      <label className="mt-3 block">
        <span className={fieldLabelClassName}>유형</span>
        <select
          value={zone.zoneType}
          disabled={readOnly}
          onChange={(event) => onChangeType(event.target.value as ZoneType)}
          className={controlClassName}
        >
          {(Object.keys(ZONE_TYPE_LABELS) as ZoneType[]).map((type) => (
            <option key={type} value={type}>
              {ZONE_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <NumberInput
          label="X"
          value={zone.rect.x}
          disabled={readOnly}
          onCommit={(x) => onChangeRect({ x })}
        />
        <NumberInput
          label="Y"
          value={zone.rect.y}
          disabled={readOnly}
          onCommit={(y) => onChangeRect({ y })}
        />
        <NumberInput
          label="너비"
          value={zone.rect.width}
          disabled={readOnly}
          onCommit={(width) => onChangeRect({ width })}
        />
        <NumberInput
          label="높이"
          value={zone.rect.height}
          disabled={readOnly}
          onCommit={(height) => onChangeRect({ height })}
        />
      </div>

      <label className="mt-3 block">
        <span className={fieldLabelClassName}>담당 직원</span>
        <select
          value={zone.assignedUserId ?? ''}
          disabled={readOnly}
          onChange={(event) =>
            onAssign(event.target.value === '' ? null : Number(event.target.value))
          }
          className={controlClassName}
        >
          <option value="">미배정</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block">
        <span className={fieldLabelClassName}>기본 비상구</span>
        <select
          value={zone.defaultExitId ?? ''}
          disabled={readOnly}
          onChange={(event) =>
            onChangeExit(event.target.value === '' ? null : Number(event.target.value))
          }
          className={controlClassName}
        >
          <option value="">지정 안 함</option>
          {savedExits.map((exit) => (
            <option key={exit.id} value={exit.backendId ?? undefined}>
              {exit.name}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 border-t border-panel-divider pt-3">
        <h4 className="text-xs font-bold text-panel-text">
          구성 요소 {zone.members.length}개
        </h4>
        <p className="mt-1 text-xs text-panel-muted">
          소속은 왼쪽 계층 패널에서 드래그로 정합니다.
        </p>
      </div>

      {readOnly ? null : (
        <button
          type="button"
          onClick={onDelete}
          className="mt-4 flex h-8 w-full items-center justify-center rounded-md border border-danger/40 bg-panel-soft text-sm font-bold text-danger transition-colors hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          구역 삭제
        </button>
      )}
    </section>
  );
}

interface StructureConstraintPanelProps {
  fabricName: string;
  zoneName: string | null;
  constraint: StructureConstraint | null;
  editable: boolean;
  saved: boolean;
  onChange: (patch: {
    movable?: boolean;
    maxMovementDistance?: number | null;
    clearMaxMovementDistance?: boolean;
    rotationLocked?: boolean;
    keepAgainstWall?: boolean;
  }) => void;
}

/** 구조물의 배치 제약. 도면 기하와 별개로 저장되며 잠긴 버전에서도 수정할 수 있다. */
export function StructureConstraintPanel({
  fabricName,
  zoneName,
  constraint,
  editable,
  saved,
  onChange,
}: StructureConstraintPanelProps) {
  const movable = constraint?.movable ?? true;
  const disabled = !editable;

  return (
    <section aria-label="배치 제약" className="mt-4 border-t border-panel-divider pt-4">
      <h3 className="text-sm font-bold text-panel-text">배치 제약</h3>
      <p className="mt-0.5 text-xs text-panel-muted">
        {fabricName} · 구역: {zoneName ?? '공통 구조물'}
      </p>

      {!saved ? (
        <p className="mt-2 text-xs text-panel-muted">
          새로 그린 구조물입니다. 도면을 저장하면 제약을 설정할 수 있습니다.
        </p>
      ) : (
        <>
          {disabled ? (
            <p className="mt-2 text-xs text-panel-muted">
              {zoneName === null
                ? '공통 구조물은 안전 담당자만 수정할 수 있습니다.'
                : '다른 구역의 구조물입니다.'}
            </p>
          ) : null}

          <label className={`${checkboxRowClassName} mt-2`}>
            <input
              type="checkbox"
              checked={movable}
              disabled={disabled}
              onChange={(event) => onChange({ movable: event.target.checked })}
            />
            이동 가능
          </label>

          <NumberInput
            label="최대 이동 거리 (m, 비우면 제한 없음)"
            value={constraint?.maxMovementDistance ?? 0}
            disabled={disabled || !movable}
            onCommit={(value) =>
              onChange(
                value > 0
                  ? { maxMovementDistance: value }
                  : { clearMaxMovementDistance: true, maxMovementDistance: null },
              )
            }
          />

          <label className={checkboxRowClassName}>
            <input
              type="checkbox"
              checked={constraint?.rotationLocked ?? false}
              disabled={disabled}
              onChange={(event) => onChange({ rotationLocked: event.target.checked })}
            />
            회전 금지
          </label>

          <label className={checkboxRowClassName}>
            <input
              type="checkbox"
              checked={constraint?.keepAgainstWall ?? false}
              disabled={disabled}
              onChange={(event) => onChange({ keepAgainstWall: event.target.checked })}
            />
            벽에 붙여 유지
          </label>
        </>
      )}
    </section>
  );
}
