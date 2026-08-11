import type { Risk } from '../../risks/types/risks';

export const PRIORITY_RISK_LIMIT = 3;

const PRIORITY_SEVERITY = '높음';
const RESOLVED_STATUS = '완료';

/**
 * 우선 확인할 항목: 심각도가 높고 아직 완료되지 않은 위험 항목을 최신순으로.
 * 심각도·상태 값은 features/risks/constants/riskOptions.ts와 같은 한글 문자열이다.
 */
export function selectPriorityRisks(risks: Risk[], limit = PRIORITY_RISK_LIMIT): Risk[] {
  return risks
    .filter((risk) => risk.severity === PRIORITY_SEVERITY && risk.status !== RESOLVED_STATUS)
    .slice()
    .sort((a, b) => {
      const byCreatedAt = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return byCreatedAt !== 0 ? byCreatedAt : b.id - a.id;
    })
    .slice(0, limit);
}
