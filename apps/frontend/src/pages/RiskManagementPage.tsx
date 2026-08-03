import { useState } from 'react';
import type { ReactNode } from 'react';

type Severity = '높음' | '보통' | '낮음';

interface RiskItem {
  id: string;
  name: string;
  severity: Severity;
  owner: string;
  dueDate: string;
  resultId: string;
  location: string;
  metric: string;
  actionDueDate: string;
  evidence: string;
}

const RISK_ITEMS: RiskItem[] = [
  {
    id: 'risk-1',
    name: '중앙 통로 최대 밀집도 초과',
    severity: '높음',
    owner: '김안전',
    dueDate: '07.31',
    resultId: 'SIM-20260730-018',
    location: 'B2 중앙 통로 C-04',
    metric: '최대 4.8명/㎡, 72초 지속',
    actionDueDate: '2026.07.31',
    evidence: 'result_heatmap_018.png',
  },
  {
    id: 'risk-2',
    name: '서측 비상구 이용 편중',
    severity: '보통',
    owner: '박운영',
    dueDate: '08.01',
    resultId: 'SIM-20260730-021',
    location: 'B1 서측 비상구 A-02',
    metric: '비상구별 이용률 편차 2.3배',
    actionDueDate: '2026.08.01',
    evidence: 'result_flow_021.png',
  },
  {
    id: 'risk-3',
    name: '팝업 가벽 주변 폭 미달',
    severity: '높음',
    owner: '이검토',
    dueDate: '07.31',
    resultId: 'SIM-20260730-025',
    location: '1F 팝업 존 P-03',
    metric: '최소 통과 폭 0.8m 미달',
    actionDueDate: '2026.07.31',
    evidence: 'result_density_025.png',
  },
  {
    id: 'risk-4',
    name: '주 출입구 대기열 간섭',
    severity: '낮음',
    owner: '최담당',
    dueDate: '08.03',
    resultId: 'SIM-20260730-030',
    location: '1F 주 출입구 G-01',
    metric: '대기열 최대 41명, 15분 지속',
    actionDueDate: '2026.08.03',
    evidence: 'result_queue_030.png',
  },
  {
    id: 'risk-5',
    name: '안내 표지 시야 방해',
    severity: '보통',
    owner: '박운영',
    dueDate: '08.04',
    resultId: 'SIM-20260731-003',
    location: 'B2 엘리베이터 홀 E-07',
    metric: '표지 가림 구간 2곳 확인',
    actionDueDate: '2026.08.04',
    evidence: 'result_sign_003.png',
  },
];

const SEVERITY_BADGE_STYLE: Record<Severity, string> = {
  높음: 'bg-danger-soft text-danger',
  보통: 'bg-surface text-text-strong',
  낮음: 'bg-primary-soft text-primary',
};

const TABLE_HEADERS = ['위험 예상 항목', '심각도', '담당자', '기한'] as const;

const TABLE_COLUMNS = 'grid-cols-[minmax(0,2.5fr)_1fr_1fr_2fr]';

function RiskItemTable({
  items,
  selectedId,
  onSelect,
}: {
  items: RiskItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className={`grid ${TABLE_COLUMNS} items-center gap-x-6 rounded-lg bg-surface px-5 py-3.5`}>
        {TABLE_HEADERS.map((header) => (
          <span key={header} className="text-sm font-bold text-text-muted">
            {header}
          </span>
        ))}
      </div>

      <ul className="mt-2.5 space-y-2.5">
        {items.map((item) => {
          const isSelected = item.id === selectedId;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-pressed={isSelected}
                className={`grid w-full ${TABLE_COLUMNS} items-center gap-x-6 border px-5 py-4 text-left transition-colors ${
                  isSelected
                    ? 'border-line bg-primary-soft'
                    : 'border-line bg-white hover:bg-surface'
                }`}
              >
                <span className="text-sm font-bold text-ink">{item.name}</span>
                <span className="text-sm font-bold text-text-strong">{item.severity}</span>
                <span className="text-sm text-text-strong">{item.owner}</span>
                <span className="text-sm text-text-strong">{item.dueDate}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function InfoBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-bold text-text-muted">{label}</p>
      <div className="mt-2 rounded-lg border border-line bg-white px-5 py-3 text-sm font-bold text-text-strong">
        {children}
      </div>
    </div>
  );
}

function RiskDetailPanel({ item }: { item: RiskItem }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-bold ${SEVERITY_BADGE_STYLE[item.severity]}`}
        >
          {item.severity}
        </span>
      </div>

      <h3 className="mt-4 text-lg font-bold text-ink">{item.name}</h3>

      <div className="mt-5 space-y-2.5 text-sm text-text-strong">
        <p>결과 {item.resultId}</p>
        <p>{item.location}</p>
        <p>{item.metric}</p>
      </div>

      <div className="mt-8 border-t border-line" />

      <div className="mt-7 grid grid-cols-2 gap-5">
        <InfoBox label="담당자">{item.owner}</InfoBox>
        <InfoBox label="조치 기한">{item.actionDueDate}</InfoBox>
      </div>

      <div className="mt-8">
        <p className="text-sm font-bold text-text-muted">증빙</p>
        <div className="mt-2 rounded-lg border border-line bg-surface px-5 py-4 text-sm text-ink">
          {item.evidence}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 pb-1">
        <button
          type="button"
          className="rounded-lg border border-line-strong bg-white px-4 py-3 text-sm font-bold text-text-strong transition-colors hover:bg-surface"
        >
          임시 저장
        </button>
        <button
          type="button"
          className="rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-primary/85"
        >
          삭제
        </button>
      </div>
    </div>
  );
}

function RiskManagementPage() {
  const [selectedId, setSelectedId] = useState(RISK_ITEMS[0].id);
  const selectedItem = RISK_ITEMS.find((item) => item.id === selectedId) ?? RISK_ITEMS[0];

  return (
    <main className="min-h-[100dvh] bg-background">
      <div className="mx-auto w-full max-w-[1392px] px-10 pb-10 pt-20 lg:px-12">
        <header className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-ink">위험 예상 항목 관리</h1>
            <p className="mt-3 text-sm text-text-muted">
              시뮬레이션과 현장 점검에서 발견한 위험을 담당자와 기한으로 관리합니다.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary/85"
          >
            위험 예상 항목 등록
          </button>
        </header>

        <div className="mt-11 grid grid-cols-1 gap-11 lg:grid-cols-[722fr_342fr]">
          <section className="rounded-lg border border-line bg-white px-5 pb-5 pt-11">
            <h2 className="px-2 text-2xl font-bold text-ink">위험 예상 목록</h2>
            <div className="mt-6">
              <RiskItemTable items={RISK_ITEMS} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white px-7 pb-7 pt-9">
            <h2 className="text-2xl font-bold text-ink">위험 상세</h2>
            <div className="mt-12">
              <RiskDetailPanel item={selectedItem} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default RiskManagementPage;
