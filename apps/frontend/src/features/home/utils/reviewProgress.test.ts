import { describe, expect, it } from 'vitest';
import { currentStageLabel, resumePath, reviewSteps } from './reviewProgress';
import type { LastActivity } from '../types/home';

function activity(activityType: LastActivity['activityType'], resourceId: number): LastActivity {
  return { activityType, resourceId, occurredAt: '2026-08-11T10:24:00' };
}

describe('resumePath', () => {
  it('도면 편집은 배치 편집기로 이동한다', () => {
    expect(resumePath(activity('LAYOUT_EDIT', 12))).toBe('/layout/12');
  });

  it('시뮬레이션 설정은 설정 화면으로 이동한다', () => {
    expect(resumePath(activity('SIMULATION_SETUP', 34))).toBe('/simulations/34/setup');
  });

  it('시뮬레이션 결과는 결과 분석 화면으로 이동한다', () => {
    expect(resumePath(activity('SIMULATION_RESULT', 56))).toBe('/simulations/56/results');
  });
});

describe('reviewSteps', () => {
  it('시뮬레이션이 없으면 도면 배치가 진행 중이다', () => {
    expect(reviewSteps(null).map((step) => step.state)).toEqual(['current', 'upcoming', 'upcoming']);
  });

  it('DRAFT는 도면 배치를 마치고 시뮬레이션 설정 중이다', () => {
    expect(reviewSteps('DRAFT').map((step) => step.state)).toEqual([
      'done',
      'current',
      'upcoming',
    ]);
  });

  it.each(['REQUESTED', 'RUNNING', 'COMPLETED', 'FAILED'] as const)(
    '%s는 결과 분석 단계에 있다',
    (status) => {
      expect(reviewSteps(status).map((step) => step.state)).toEqual(['done', 'done', 'current']);
    },
  );

  it('스텝 라벨 순서는 디자인과 같다', () => {
    expect(reviewSteps(null).map((step) => step.label)).toEqual([
      '도면 배치',
      '시뮬레이션 설정',
      '결과 분석',
    ]);
  });
});

describe('currentStageLabel', () => {
  it.each([
    [null, '도면 배치 중'],
    ['DRAFT', '시뮬레이션 설정 중'],
    ['REQUESTED', '시뮬레이션 실행 중'],
    ['RUNNING', '시뮬레이션 실행 중'],
    ['COMPLETED', '결과 분석 대기'],
    ['FAILED', '실행 실패'],
  ] as const)('%s 상태의 현재 단계 문구', (status, expected) => {
    expect(currentStageLabel(status)).toBe(expected);
  });
});
