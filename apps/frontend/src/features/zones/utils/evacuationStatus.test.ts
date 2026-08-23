import { describe, expect, it } from 'vitest';
import { evacuationStatusPresentation } from './evacuationStatus';

describe('evacuationStatusPresentation', () => {
  it('AVAILABLE만 경로를 그린다', () => {
    expect(evacuationStatusPresentation('AVAILABLE').hasRoute).toBe(true);
    expect(evacuationStatusPresentation('UNREACHABLE').hasRoute).toBe(false);
    expect(evacuationStatusPresentation('NOT_CONFIGURED').hasRoute).toBe(false);
  });

  it('비상구 미지정과 도달 불가를 다른 문구로 구분한다', () => {
    expect(evacuationStatusPresentation('NOT_CONFIGURED').message).toContain('지정되지 않았습니다');
    expect(evacuationStatusPresentation('UNREACHABLE').message).toContain('찾을 수 없습니다');
  });

  it('도달 불가는 경고 톤이다', () => {
    expect(evacuationStatusPresentation('UNREACHABLE').tone).toBe('warning');
    expect(evacuationStatusPresentation('AVAILABLE').tone).toBe('ok');
  });
});
