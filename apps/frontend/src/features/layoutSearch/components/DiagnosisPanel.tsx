import type { SearchDiagnosis } from '../api/layoutSearchApi';
import { findingLabel } from '../utils/searchLabels';

interface Props {
  diagnosis: SearchDiagnosis | null;
  loading: boolean;
}

export function DiagnosisPanel({ diagnosis, loading }: Props) {
  if (!diagnosis && loading) {
    return (
      <section className="diagnosis-panel is-empty" aria-label="진단 결과" role="status">
        <p>시뮬레이션 결과에서 위험 신호를 분석하고 있습니다.</p>
      </section>
    );
  }
  if (!diagnosis || diagnosis.findings.length === 0) {
    return (
      <section className="diagnosis-panel is-empty" aria-label="진단 결과">
        <p>분석할 수 있는 위험 신호를 찾지 못했습니다.</p>
      </section>
    );
  }
  return (
    <section className="diagnosis-panel" aria-label="진단 결과">
      <div className="workspace-section-heading">
        <span>진단 결과</span>
        <small>위험도는 0~100%, 높을수록 대피 흐름에 미치는 영향이 큽니다</small>
      </div>
      <ul className="diagnosis-findings">
        {diagnosis.findings.map((finding) => (
          <li key={`${finding.type}-${finding.severity}`}>
            <div className="diagnosis-finding__row">
              <span className={`finding-type is-${finding.type.toLowerCase()}`}>
                {findingLabel(finding.type)}
              </span>
              <strong>{Math.round(finding.severity * 100)}%</strong>
            </div>
            <div
              className="finding-severity"
              role="img"
              aria-label={`위험도 ${Math.round(finding.severity * 100)}%`}
            >
              <i style={{ width: `${Math.round(finding.severity * 100)}%` }} />
            </div>
            <p>{finding.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
