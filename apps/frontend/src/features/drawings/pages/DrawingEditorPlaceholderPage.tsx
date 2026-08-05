import { Link } from 'react-router-dom';

interface DrawingEditorPlaceholderPageProps {
  mode: 'create' | 'edit';
}

function DrawingEditorPlaceholderPage({ mode }: DrawingEditorPlaceholderPageProps) {
  const isCreate = mode === 'create';

  return (
    <main className="bg-background">
      <div className="mx-auto w-full max-w-[1360px] px-1 pt-2 pb-10 sm:px-4 lg:pt-4">
        <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-primary">시뮬레이션 검토</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">
              {isCreate ? '도면 등록' : '도면 수정'}
            </h1>
            <p className="mt-3 text-sm leading-6 text-text-muted">
              공간의 도면을 등록하고 배치를 편집하는 화면입니다.
            </p>
          </div>
        </header>
        <section className="mt-5 flex min-h-96 flex-col items-center justify-center gap-3 rounded-xl border border-line bg-white px-6 text-center shadow-sm shadow-ink/5">
          <p className="font-bold text-ink">도면 작성 화면은 준비 중입니다.</p>
          <p className="text-sm text-text-muted">도면 작성 API와 함께 이 화면이 제공될 예정입니다.</p>
          <Link
            to="/drawings"
            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-line-strong bg-white px-4 py-2.5 text-sm font-bold text-text-strong transition-colors hover:bg-surface"
          >
            <span aria-hidden="true">←</span>
            도면 목록으로 돌아가기
          </Link>
        </section>
      </div>
    </main>
  );
}

export default DrawingEditorPlaceholderPage;
