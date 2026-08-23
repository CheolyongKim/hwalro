import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CanvasWorkspacePanel } from '../../../components/workspace';

interface SearchStartPanelProps {
  /** 제약을 편집할 도면. 알 수 없으면 링크를 숨긴다. */
  drawingId: number | null;
  onStart: (verify: boolean) => void;
  starting: boolean;
}

/**
 * 탐색 시작 패널.
 *
 * 제약 편집 UI는 여기 없다. 구조물 제약과 배치 제외 영역은 도면에 저장되며 도면 편집기에서 관리한다 -
 * 실행마다 다시 입력하면 같은 값이 두 곳에 살게 된다. 실행마다 달라지는 값은 실측 확인 여부뿐이다.
 */
export function SearchStartPanel({ drawingId, onStart, starting }: SearchStartPanelProps) {
  const [verify, setVerify] = useState(false);

  return (
    <CanvasWorkspacePanel ariaLabel="배치 개선안 탐색 시작">
      <div className="search-start-panel">
        <h2 className="search-start-panel__title">배치 개선안 탐색</h2>
        <p className="search-start-panel__description">
          도면에 저장된 구조물 제약과 배치 제외 영역을 그대로 사용합니다. 제약을 바꾸려면 도면
          편집기에서 수정한 뒤 다시 탐색하세요.
        </p>
        {drawingId !== null && (
          <Link to={`/layout/${drawingId}`} className="search-start-panel__link">
            도면 편집기에서 제약 설정
          </Link>
        )}
        <label className="search-start-panel__verify">
          <input
            type="checkbox"
            checked={verify}
            onChange={(event) => setVerify(event.target.checked)}
          />
          <span>후보마다 시뮬레이션으로 실측 확인 (정확하지만 오래 걸립니다)</span>
        </label>
        <button
          type="button"
          className="search-start-panel__start"
          disabled={starting}
          onClick={() => onStart(verify)}
        >
          {starting ? '시작하는 중...' : '배치 개선안 탐색 시작'}
        </button>
      </div>
    </CanvasWorkspacePanel>
  );
}
