import { useEffect, useState } from 'react';
import type { Dispatch } from 'react';
import type { EditorState, LayoutText, Wall } from '../types';
import type { EditorAction } from '../state/editorReducer';
import { round1 } from '../utils/geometry';

interface SettingsPanelProps {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
}

function selectedWall(state: EditorState): Wall | null {
  const id = state.selection.wallIds[0];
  if (!id) {
    return null;
  }
  return state.doc.walls.find((wall) => wall.id === id) ?? null;
}

function selectedText(state: EditorState): LayoutText | null {
  const id = state.selection.textIds[0];
  if (!id) {
    return null;
  }
  return state.doc.layoutTexts.find((text) => text.id === id) ?? null;
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
}

function NumberField({ label, value, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(round1(value)));

  useEffect(() => {
    setDraft(String(round1(value)));
  }, [value]);

  const commitDraft = () => {
    const num = Number(draft);
    if (Number.isFinite(num)) {
      onChange(round1(num));
    } else {
      setDraft(String(round1(value)));
    }
  };

  return (
    <label className="block min-w-0">
      <span className="block text-[11px] text-text-muted">{label}</span>
      <span className="mt-1 flex h-8 items-center rounded-md border border-line bg-white">
        <input
          type="number"
          step={0.1}
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commitDraft();
            }
          }}
          className="h-full w-full min-w-0 bg-transparent px-2 font-mono text-[13px] text-text-strong outline-none"
        />
        <span className="shrink-0 pr-2 font-mono text-[11px] text-text-muted">m</span>
      </span>
    </label>
  );
}

interface WallFieldsProps {
  wall: Wall;
  dispatch: Dispatch<EditorAction>;
}

function WallFields({ wall, dispatch }: WallFieldsProps) {
  const update = (patch: Partial<Pick<Wall, 'startX' | 'startY' | 'endX' | 'endY'>>) =>
    dispatch({ type: 'updateWall', wallId: wall.id, patch });
  return (
    <section>
      <h3 className="text-[13px] font-bold text-text-strong">선택 요소</h3>
      <p className="mt-0.5 text-[13px] text-text-strong">{wall.name}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <NumberField
          label="시작점 X"
          value={wall.startX}
          onChange={(x) => update({ startX: x })}
        />
        <NumberField
          label="시작점 Y"
          value={wall.startY}
          onChange={(y) => update({ startY: y })}
        />
        <NumberField label="끝점 X" value={wall.endX} onChange={(x) => update({ endX: x })} />
        <NumberField label="끝점 Y" value={wall.endY} onChange={(y) => update({ endY: y })} />
      </div>
    </section>
  );
}

interface TextFieldsProps {
  text: LayoutText;
  dispatch: Dispatch<EditorAction>;
}

function TextFields({ text, dispatch }: TextFieldsProps) {
  const update = (patch: Partial<Pick<LayoutText, 'x' | 'y'>>) =>
    dispatch({ type: 'updateText', textId: text.id, patch });
  return (
    <section>
      <h3 className="text-[13px] font-bold text-text-strong">선택 요소</h3>
      <p className="mt-0.5 truncate text-[13px] text-text-strong">{text.text}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <NumberField label="X 위치" value={text.x} onChange={(x) => update({ x })} />
        <NumberField label="Y 위치" value={text.y} onChange={(y) => update({ y })} />
      </div>
    </section>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="shrink-0 text-[11px] text-text-muted">{label}</span>
      <span className="truncate font-mono text-[13px] text-text-strong">{value}</span>
    </div>
  );
}

export function SettingsPanel({ state, dispatch }: SettingsPanelProps) {
  const wall = selectedWall(state);
  const text = wall === null ? selectedText(state) : null;
  const { doc } = state;

  return (
    <aside className="flex w-[330px] shrink-0 flex-col overflow-y-auto rounded-md border border-line bg-white">
      <h2 className="shrink-0 border-b border-line px-4 py-3 text-sm font-bold text-text-strong">
        배치 설정
      </h2>
      <div className="flex-1 px-4 py-4">
        {wall === null && text === null ? (
          <section>
            <h3 className="text-[13px] font-bold text-text-strong">도면 정보</h3>
            <div className="mt-2">
              <InfoRow label="도면명" value={doc.name} />
              <InfoRow
                label="크기"
                value={`${doc.width.toLocaleString('ko-KR')}m × ${doc.height.toLocaleString('ko-KR')}m`}
              />
              <InfoRow label="벽" value={`${doc.walls.length}개`} />
              <InfoRow label="텍스트" value={`${doc.layoutTexts.length}개`} />
            </div>
          </section>
        ) : wall !== null ? (
          <WallFields wall={wall} dispatch={dispatch} />
        ) : (
          <TextFields text={text as LayoutText} dispatch={dispatch} />
        )}
        <section className="mt-6 border-t border-line pt-4">
          <h3 className="text-[13px] font-bold text-text-strong">레이어</h3>
          <div className="mt-2">
            <InfoRow label="벽" value={`${doc.walls.length}개`} />
            <InfoRow label="텍스트" value={`${doc.layoutTexts.length}개`} />
          </div>
        </section>
      </div>
    </aside>
  );
}
