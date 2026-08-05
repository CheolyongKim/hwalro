import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCreateDrawing } from '../hooks/useDrawingMutations';
import { getDrawingErrorMessage } from '../utils/getDrawingErrorMessage';

function CreateDrawingPage() {
  const navigate = useNavigate();
  const createDrawing = useCreateDrawing();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    createDrawing.mutate(
      {
        title: title.trim() === '' ? null : title.trim(),
        description: description.trim() === '' ? null : description.trim(),
      },
      {
        onSuccess: (drawing) => navigate(`/layout/${drawing.id}`),
        onError: (error) => setErrorMessage(getDrawingErrorMessage(error)),
      },
    );
  };

  return (
    <main className="bg-background">
      <div className="mx-auto w-full max-w-[1360px] px-1 pt-2 pb-10 sm:px-4 lg:pt-4">
        <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-primary">시뮬레이션 검토</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-ink sm:text-4xl">
              도면 등록
            </h1>
            <p className="mt-3 text-sm leading-6 text-text-muted">
              기본 도면 데이터로 시작합니다. 등록 후 편집 화면에서 배치를 수정할 수 있습니다.
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="mt-5">
          <section
            className="rounded-xl border border-line bg-white p-5 shadow-sm shadow-ink/5 sm:p-6"
            aria-label="도면 정보 입력"
          >
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <label className="block min-w-0">
                <span className="text-sm font-bold text-text-strong">도면명</span>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="기본 도면 이름이 사용됩니다"
                  maxLength={200}
                  className="mt-2 h-11 w-full rounded-lg border border-line bg-surface px-4 text-sm text-ink outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
              <label className="block min-w-0">
                <span className="text-sm font-bold text-text-strong">설명</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="도면에 대한 설명을 입력해 주세요. (선택)"
                  maxLength={10000}
                  rows={3}
                  className="mt-2 w-full resize-y rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink outline-none placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
            </div>

            {errorMessage !== null && (
              <p
                role="alert"
                className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-600"
              >
                {errorMessage}
              </p>
            )}

            <div className="mt-6 flex items-center gap-3 border-t border-line pt-5">
              <button
                type="submit"
                disabled={createDrawing.isPending}
                className="inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-bold text-white transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createDrawing.isPending ? '등록 중...' : '도면 등록'}
              </button>
              <Link
                to="/drawings"
                className="inline-flex h-11 items-center rounded-lg border border-line-strong bg-white px-5 text-sm font-bold text-text-strong transition-colors hover:bg-surface"
              >
                취소
              </Link>
            </div>
          </section>
        </form>
      </div>
    </main>
  );
}

export default CreateDrawingPage;
