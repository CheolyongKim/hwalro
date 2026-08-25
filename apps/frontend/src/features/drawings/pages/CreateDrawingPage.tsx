import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRecordLastActivity } from '../../home/hooks/useRecordLastActivity';
import { useCreateDrawing } from '../hooks/useDrawingMutations';
import {
  Button,
  buttonClassName,
  Card,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Textarea,
} from '../../../components/ui';
import { getDrawingErrorMessage } from '../utils/getDrawingErrorMessage';

function CreateDrawingPage() {
  const navigate = useNavigate();
  const createDrawing = useCreateDrawing();
  const recordLastActivity = useRecordLastActivity();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [withDefaultData, setWithDefaultData] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    createDrawing.mutate(
      {
        title: title.trim() === '' ? null : title.trim(),
        description: description.trim() === '' ? null : description.trim(),
        withDefaultData,
      },
      {
        onSuccess: (drawing) => {
          recordLastActivity('LAYOUT_EDIT', drawing.id);
          navigate(`/layout/${drawing.id}`);
        },
        onError: (error) => setErrorMessage(getDrawingErrorMessage(error)),
      },
    );
  };

  return (
    <main className="min-h-full bg-background">
      <div className="mx-auto w-full max-w-[1360px] px-1 pt-2 pb-10 sm:px-4 lg:pt-4">
        <div className="mx-auto w-full max-w-[920px]">
          <div className="border-b border-line pb-6">
            <PageHeader
              eyebrow="도면"
              title="도면 등록"
              description="도면의 시작 방식과 기본 정보를 설정합니다. 등록한 도면은 편집 화면에서 바로 수정할 수 있습니다."
            />
          </div>

          <form onSubmit={handleSubmit} className="mt-6">
            <Card padded={false} className="overflow-hidden" aria-label="도면 정보 입력">
              <section className="px-5 py-5 sm:px-7 sm:py-6" aria-labelledby="drawing-start-title">
                <div>
                  <h2 id="drawing-start-title" className="text-base font-bold text-ink">
                    시작 방식
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-text-muted">
                    예시 배치를 활용하거나 빈 도면에서 직접 시작할 수 있습니다.
                  </p>
                </div>
                <div
                  role="radiogroup"
                  aria-label="시작 방식"
                  className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
                >
                  <label className="flex min-h-28 cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-4 transition-colors has-checked:border-primary has-checked:bg-primary-faint has-checked:ring-1 has-checked:ring-primary/20 hover:border-line-strong">
                    <input
                      type="radio"
                      name="drawing-init"
                      checked={withDefaultData}
                      onChange={() => setWithDefaultData(true)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink">기본 도면으로 시작</span>
                      <span className="mt-1.5 block text-sm leading-relaxed text-text-muted">
                        벽·출구·기둥 등 예시 배치가 포함된 도면으로 시작합니다. 참고해 수정하기
                        좋습니다.
                      </span>
                    </span>
                  </label>
                  <label className="flex min-h-28 cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-4 transition-colors has-checked:border-primary has-checked:bg-primary-faint has-checked:ring-1 has-checked:ring-primary/20 hover:border-line-strong">
                    <input
                      type="radio"
                      name="drawing-init"
                      checked={!withDefaultData}
                      onChange={() => setWithDefaultData(false)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink">빈 도면으로 시작</span>
                      <span className="mt-1.5 block text-sm leading-relaxed text-text-muted">
                        벽과 출구 없이 빈 캔버스로 시작합니다. 처음부터 직접 배치를 그립니다.
                      </span>
                    </span>
                  </label>
                </div>
              </section>

              <section
                className="border-t border-line px-5 py-5 sm:px-7 sm:py-6"
                aria-labelledby="drawing-info-title"
              >
                <div>
                  <h2 id="drawing-info-title" className="text-base font-bold text-ink">
                    도면 정보
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-text-muted">
                    목록에서 도면을 쉽게 구분할 수 있도록 이름과 설명을 입력해 주세요.
                  </p>
                </div>
                <div className="mt-5 space-y-5">
                  <Field label="도면명" htmlFor="drawing-title">
                    <Input
                      id="drawing-title"
                      type="text"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="기본 도면 이름이 사용됩니다"
                      maxLength={200}
                    />
                  </Field>
                  <Field label="설명" htmlFor="drawing-description">
                    <Textarea
                      id="drawing-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="도면에 대한 설명을 입력해 주세요. (선택)"
                      maxLength={10000}
                      rows={3}
                    />
                  </Field>
                </div>

                {errorMessage !== null && <ErrorState message={errorMessage} className="mt-5" />}
              </section>

              <div className="flex flex-col-reverse gap-3 border-t border-line bg-surface-subtle px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-7">
                <Link
                  to="/drawings"
                  className={`${buttonClassName({ variant: 'secondary', size: 'lg' })} w-full sm:w-auto`}
                >
                  취소
                </Link>
                <Button
                  type="submit"
                  size="lg"
                  isLoading={createDrawing.isPending}
                  disabled={createDrawing.isPending}
                  className="w-full sm:w-auto"
                >
                  {createDrawing.isPending ? '등록 중...' : '도면 등록'}
                </Button>
              </div>
            </Card>
          </form>
        </div>
      </div>
    </main>
  );
}

export default CreateDrawingPage;
