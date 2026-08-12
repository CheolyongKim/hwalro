import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { reportApi } from '../api/reportApi';
import AutoResizeTextarea from '../components/AutoResizeTextarea';
import { ReportSimulationCard } from '../components/ReportSimulationCard';
import type { ReportDetailResponse, ReportVisualContext } from '../types/report';
import { getReportErrorMessage } from '../utils/getReportErrorMessage';

type EditableReportStatus = ReportDetailResponse['status'];

function getErrorMessage(error: unknown): string {
  return getReportErrorMessage(error, '보고서를 불러오지 못했습니다.');
}

function formatDate(value: string): string {
  return value.replace('T', ' · ').slice(0, 18);
}

function ReportDetailPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<EditableReportStatus>('작성 중');
  const [summary, setSummary] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [improvements, setImprovements] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [simulationResultIds, setSimulationResultIds] = useState<number[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visualContexts, setVisualContexts] = useState<ReportVisualContext[]>([]);
  const [isVisualsLoading, setIsVisualsLoading] = useState(true);
  const [visualError, setVisualError] = useState<string | null>(null);

  function applyReport(report: ReportDetailResponse) {
    setTitle(report.title);
    setStatus(report.status);
    setSummary(report.content.overview);
    setAnalysis(report.content.analysis);
    setImprovements(report.content.improvements);
    setCreatedAt(report.createdAt);
    setSimulationResultIds(report.simulationResultIds);
  }

  useEffect(() => {
    if (!reportId) return;
    let active = true;
    setIsLoading(true);
    setError(null);
    void reportApi
      .get(reportId)
      .then((response) => {
        if (active) applyReport(response);
      })
      .catch((requestError: unknown) => {
        if (active) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reportId]);

  useEffect(() => {
    if (!reportId || isLoading || simulationResultIds.length === 0) {
      setIsVisualsLoading(false);
      return;
    }
    let active = true;
    setIsVisualsLoading(true);
    setVisualError(null);
    void reportApi
      .getVisualContexts(reportId)
      .then((response) => {
        if (active) setVisualContexts(response);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setVisualError(getReportErrorMessage(requestError, '미니맵을 불러오지 못했습니다.'));
        }
      })
      .finally(() => {
        if (active) setIsVisualsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isLoading, reportId, simulationResultIds]);

  async function saveReport() {
    if (!reportId) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await reportApi.update(reportId, {
        title,
        content: { overview: summary, analysis, improvements },
        status,
      });
      applyReport(response);
      setIsSaved(true);
      navigate('/reports');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsSaving(false);
    }
  }

  const simulationCards = simulationResultIds.map((id, index) => ({
    id,
    label: index === 0 ? '대표 결과' : '비교 결과',
    tone: index === 0 ? 'primary' : 'compare',
  }));

  const visualContextByResultId = new Map(
    visualContexts.map((context) => [context.simulationResultId, context]),
  );

  function renderSimulationCards(variant: 'document' | 'settings' | 'preview') {
    if (simulationCards.length === 0) {
      return (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-text-muted">
          첨부된 시뮬레이션 결과가 없습니다.
        </p>
      );
    }
    return simulationCards.map((simulation) => (
      <ReportSimulationCard
        key={simulation.id}
        resultId={simulation.id}
        label={simulation.label}
        tone={simulation.tone as 'primary' | 'compare'}
        context={visualContextByResultId.get(simulation.id)}
        isLoading={isVisualsLoading}
        error={visualError}
        variant={variant}
      />
    ));
  }

  if (isLoading)
    return (
      <div className="flex min-h-80 items-center justify-center text-sm text-text-muted">
        보고서를 불러오는 중입니다.
      </div>
    );
  if (error && !title)
    return (
      <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-sm text-danger">
        <p>{error}</p>
        <Link to="/reports" className="font-bold text-primary">
          목록으로 돌아가기
        </Link>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-[1360px] px-1 pt-2 sm:px-4 lg:pt-4">
      <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/reports" className="text-sm font-bold text-primary hover:text-primary/80">
            보고서 관리
          </Link>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">
            보고서 상세·편집
          </h1>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            AI 초안을 검토하고 시뮬레이션 결과와 증빙 자료를 편집합니다.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            disabled={isVisualsLoading}
            className="h-11 rounded-lg border border-line-strong bg-white px-7 text-sm font-bold text-text-strong hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isVisualsLoading ? '미니맵 준비 중...' : '미리보기'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={isVisualsLoading}
            className="h-11 rounded-lg bg-primary px-7 text-sm font-bold text-white hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            PDF 출력
          </button>
        </div>
      </header>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <article className="report-print-area rounded-2xl border border-line bg-white px-6 py-8 shadow-sm shadow-ink/5 sm:px-10 sm:py-12">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="보고서 제목"
            className="w-full border-0 bg-transparent p-0 text-2xl font-black tracking-tight text-ink outline-none focus:ring-0 sm:text-3xl"
          />
          <p className="mt-4 text-sm text-text-muted">
            작성일 {formatDate(createdAt)} · 보고서 #{reportId}
          </p>

          <section className="mt-6 border-t border-line pt-6">
            <h2 className="text-lg font-black text-ink">1. 검토 개요</h2>
            <AutoResizeTextarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              aria-label="검토 개요"
              rows={3}
              className="mt-3 w-full resize-none rounded-lg border border-transparent bg-transparent px-0 py-1 text-sm leading-7 text-text-strong outline-none focus:border-line focus:bg-surface focus:px-3"
            />
          </section>

          <section className="mt-7">
            <h2 className="text-lg font-black text-ink">2. 핵심 분석 결과</h2>
            <AutoResizeTextarea
              value={analysis}
              onChange={(event) => setAnalysis(event.target.value)}
              aria-label="핵심 분석 결과"
              rows={3}
              className="mt-3 w-full resize-none rounded-lg border border-transparent bg-transparent px-0 py-1 text-sm leading-7 text-text-strong outline-none focus:border-line focus:bg-surface focus:px-3"
            />
          </section>

          <section className="mt-7">
            <h2 className="text-lg font-black text-ink">3. 첨부 시뮬레이션</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {renderSimulationCards('document')}
            </div>
          </section>

          <section className="mt-7">
            <h2 className="text-lg font-black text-ink">4. 개선 조치</h2>
            <AutoResizeTextarea
              value={improvements}
              onChange={(event) => setImprovements(event.target.value)}
              aria-label="개선 조치"
              rows={2}
              className="mt-3 w-full resize-none rounded-lg border border-transparent bg-transparent px-0 py-1 text-sm leading-7 text-text-strong outline-none focus:border-line focus:bg-surface focus:px-3"
            />
          </section>
        </article>

        <aside className="flex min-h-[500px] flex-col rounded-2xl border border-line bg-white p-6 shadow-sm shadow-ink/5">
          <h2 className="text-xl font-black text-ink">보고서 설정</h2>
          <label className="mt-5 text-xs font-bold text-text-muted">
            상태
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as EditableReportStatus)}
              className="mt-2 h-11 w-full rounded-lg border border-line bg-white px-3 text-sm font-bold text-text-strong outline-none focus:border-primary"
            >
              <option value="작성 중">작성 중</option>
              <option value="완료">완료</option>
            </select>
          </label>
          <div className="mt-7">
            <p className="text-xs font-bold text-text-muted">첨부 시뮬레이션</p>
            <div className="mt-3 space-y-3">
              {renderSimulationCards('settings')}
            </div>
          </div>
          <div className="mt-auto pt-8">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void saveReport()}
              className="h-11 w-full rounded-lg bg-primary text-sm font-bold text-white hover:bg-primary/85 disabled:opacity-50"
            >
              {isSaving ? '저장 중...' : isSaved ? '저장되었습니다' : '저장'}
            </button>
            {(isSaved || error) && (
              <p
                className={`mt-3 text-center text-xs font-bold ${error ? 'text-danger' : 'text-primary'}`}
              >
                {error ?? `보고서 #${reportId ?? '-'} 변경사항을 저장했습니다.`}
              </p>
            )}
          </div>
        </aside>
      </div>

      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-preview-title"
        >
          <div className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 id="report-preview-title" className="text-lg font-black text-ink">
                보고서 미리보기
              </h2>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-bold text-text-muted hover:bg-surface hover:text-ink"
              >
                닫기
              </button>
            </div>
            <div className="overflow-y-auto px-8 py-10 sm:px-14">
              <h1 className="text-3xl font-black tracking-tight text-ink">{title}</h1>
              <p className="mt-4 text-sm text-text-muted">
                작성일 {formatDate(createdAt)} · 보고서 #{reportId}
              </p>
              <section className="mt-8 border-t border-line pt-6">
                <h3 className="text-lg font-black text-ink">1. 검토 개요</h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-text-strong">
                  {summary}
                </p>
              </section>
              <section className="mt-7">
                <h3 className="text-lg font-black text-ink">2. 핵심 분석 결과</h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-text-strong">
                  {analysis}
                </p>
              </section>
              <section className="mt-7">
                <h3 className="text-lg font-black text-ink">3. 첨부 시뮬레이션</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {renderSimulationCards('preview')}
                </div>
              </section>
              <section className="mt-7">
                <h3 className="text-lg font-black text-ink">4. 개선 조치</h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-text-strong">
                  {improvements}
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportDetailPage;
