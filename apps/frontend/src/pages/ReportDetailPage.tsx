import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

type ReportStatus = '초안' | '작성 중' | '완료';

interface SimulationResult {
  id: string;
  title: string;
  meta: string;
  tone: 'primary' | 'compare';
}

const simulations: SimulationResult[] = [
  { id: '#018', title: '배치 B', meta: '총 대피 264초 · 병목 2곳', tone: 'primary' },
  { id: '#014', title: '배치 A', meta: '총 대피 302초 · 병목 3곳', tone: 'compare' },
];

function ReportDetailPage() {
  const { reportId } = useParams();
  const [title, setTitle] = useState('더현대 서울 B2 팝업 안전 검토 보고서');
  const [status, setStatus] = useState<ReportStatus>('작성 중');
  const [reviewer, setReviewer] = useState('박운영 책임');
  const [summary, setSummary] = useState(
    '더현대 서울 B2 팝업 배치 변경에 따른 대피 안전성을 검토하였다.\n동일한 적산 조건에서 배치 A와 개선 배치 B를 비교하였다.',
  );
  const [improvements, setImprovements] = useState('팝업 가벽 2m 이동, 서측 안내 동선 분산, 현장 재점검을 권고한다.');
  const [isSaved, setIsSaved] = useState(false);

  function saveReport() {
    setIsSaved(true);
    window.setTimeout(() => setIsSaved(false), 2400);
  }

  return (
    <div className="mx-auto w-full max-w-[1392px] px-1 pt-2 sm:px-4 lg:px-8 lg:pt-4">
      <header className="flex flex-col gap-5 border-b border-line pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link to="/reports" className="text-sm font-bold text-primary hover:text-primary/80">
            보고서 목록
          </Link>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-4xl">보고서 상세·편집</h1>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            AI 초안을 검토하고 시뮬레이션 결과와 증빙 자료를 편집합니다.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" className="h-11 rounded-lg border border-line-strong bg-white px-7 text-sm font-bold text-text-strong hover:bg-surface">
            미리보기
          </button>
          <button type="button" onClick={() => window.print()} className="h-11 rounded-lg bg-primary px-7 text-sm font-bold text-white hover:bg-primary/85">
            PDF 출력
          </button>
        </div>
      </header>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <article className="rounded-2xl border border-line bg-white px-6 py-8 shadow-sm shadow-ink/5 sm:px-10 sm:py-12">
          <input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="보고서 제목" className="w-full border-0 bg-transparent p-0 text-2xl font-black tracking-tight text-ink outline-none focus:ring-0 sm:text-3xl" />
          <p className="mt-4 text-sm text-text-muted">작성자 김안전 · 2026.07.30 · 검토 건 #RV-20260730-03</p>

          <section className="mt-6 border-t border-line pt-6">
            <h2 className="text-lg font-black text-ink">1. 검토 개요</h2>
            <textarea value={summary} onChange={(event) => setSummary(event.target.value)} aria-label="검토 개요" rows={3} className="mt-3 w-full resize-none rounded-lg border border-transparent bg-transparent px-0 py-1 text-sm leading-7 text-text-strong outline-none focus:border-line focus:bg-surface focus:px-3" />
          </section>

          <section className="mt-7">
            <h2 className="text-lg font-black text-ink">2. 핵심 분석 결과</h2>
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary-soft p-5">
              <p className="text-xs font-black text-primary">AI 요약</p>
              <p className="mt-3 text-sm font-bold leading-7 text-text-strong">개선 배치 B의 총 대피 시간은 264초로 배치 A보다 38초 단축되었다.</p>
              <p className="mt-1 text-sm font-bold leading-7 text-text-strong">중앙 통로 최대 밀집도는 여전히 기준을 초과해 후속 조치가 필요하다.</p>
            </div>
          </section>

          <section className="mt-7">
            <h2 className="text-lg font-black text-ink">3. 첨부 시뮬레이션</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {simulations.map((simulation) => (
                <div key={simulation.id} className={`rounded-xl border p-5 ${simulation.tone === 'primary' ? 'border-primary/20 bg-primary-soft' : 'border-orange-200 bg-orange-50'}`}>
                  <p className="text-base font-black text-ink">결과 {simulation.id} · {simulation.title}</p>
                  <p className="mt-2 text-sm text-text-muted">{simulation.meta}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-7">
            <h2 className="text-lg font-black text-ink">4. 개선 조치</h2>
            <textarea value={improvements} onChange={(event) => setImprovements(event.target.value)} aria-label="개선 조치" rows={2} className="mt-3 w-full resize-none rounded-lg border border-transparent bg-transparent px-0 py-1 text-sm leading-7 text-text-strong outline-none focus:border-line focus:bg-surface focus:px-3" />
          </section>
        </article>

        <aside className="flex min-h-[500px] flex-col rounded-2xl border border-line bg-white p-6 shadow-sm shadow-ink/5">
          <h2 className="text-xl font-black text-ink">보고서 설정</h2>
          <label className="mt-5 text-xs font-bold text-text-muted">상태<select value={status} onChange={(event) => setStatus(event.target.value as ReportStatus)} className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm font-bold text-text-strong outline-none focus:border-primary"><option value="초안">초안</option><option value="작성 중">작성 중</option><option value="완료">완료</option></select></label>
          <label className="mt-4 text-xs font-bold text-text-muted">검토자<input value={reviewer} onChange={(event) => setReviewer(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-line px-3 text-sm font-bold text-text-strong outline-none focus:border-primary" /></label>
          <div className="mt-7"><p className="text-xs font-bold text-text-muted">첨부 결과</p><div className="mt-3 space-y-3">{simulations.map((simulation) => <div key={simulation.id} className={`rounded-xl border p-4 ${simulation.tone === 'primary' ? 'border-primary/20 bg-primary-soft' : 'border-orange-200 bg-orange-50'}`}><p className="font-black text-ink">{simulation.id} {simulation.title}</p><p className="mt-2 text-xs text-text-muted">{simulation.tone === 'primary' ? '대표 결과' : '비교 결과'}</p></div>)}</div></div>
          <div className="mt-auto pt-8"><button type="button" onClick={saveReport} className="h-11 w-full rounded-lg bg-primary text-sm font-bold text-white hover:bg-primary/85">{isSaved ? '저장되었습니다' : '저장'}</button>{isSaved && <p className="mt-3 text-center text-xs font-bold text-primary">보고서 #{reportId ?? '-'} 변경사항을 저장했습니다.</p>}</div>
        </aside>
      </div>
    </div>
  );
}

export default ReportDetailPage;
