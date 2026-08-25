import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('도면 등록 페이지 시각 계약', () => {
  it('좁은 작업 폭과 구분된 입력 섹션을 사용한다', () => {
    const source = readFileSync(new URL('./CreateDrawingPage.tsx', import.meta.url), 'utf8');

    expect(source).toContain('max-w-[920px]');
    expect(source).toContain('aria-labelledby="drawing-start-title"');
    expect(source).toContain('aria-labelledby="drawing-info-title"');
    expect(source).toContain('className="mt-5 space-y-5"');
    expect(source).not.toContain('lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]');
  });

  it('모바일 전체 폭과 데스크톱 우측 정렬 액션을 제공한다', () => {
    const source = readFileSync(new URL('./CreateDrawingPage.tsx', import.meta.url), 'utf8');

    expect(source).toContain('sm:justify-end');
    expect(source.match(/w-full sm:w-auto/g)).toHaveLength(2);
  });
});
