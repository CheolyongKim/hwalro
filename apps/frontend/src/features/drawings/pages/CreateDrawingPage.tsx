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
        onSuccess: (drawing) => {
          recordLastActivity('LAYOUT_EDIT', drawing.id);
          navigate(`/layout/${drawing.id}`);
        },
        onError: (error) => setErrorMessage(getDrawingErrorMessage(error)),
      },
    );
  };

  return (
    <main className="bg-background">
      <div className="mx-auto w-full max-w-[1360px] px-1 pt-2 pb-10 sm:px-4 lg:pt-4">
        <PageHeader
          eyebrow="도면"
          title="도면 등록"
          description="기본 도면 데이터로 시작합니다. 등록 후 편집 화면에서 배치를 수정할 수 있습니다."
        />

        <form onSubmit={handleSubmit} className="mt-5">
          <Card className="sm:p-6" aria-label="도면 정보 입력">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <Field label="도면명">
                <Input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="기본 도면 이름이 사용됩니다"
                  maxLength={200}
                />
              </Field>
              <Field label="설명">
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="도면에 대한 설명을 입력해 주세요. (선택)"
                  maxLength={10000}
                  rows={3}
                />
              </Field>
            </div>

            {errorMessage !== null && <ErrorState message={errorMessage} className="mt-5" />}

            <div className="mt-6 flex items-center gap-3 border-t border-line pt-5">
              <Button
                type="submit"
                size="lg"
                isLoading={createDrawing.isPending}
                disabled={createDrawing.isPending}
              >
                {createDrawing.isPending ? '등록 중...' : '도면 등록'}
              </Button>
              <Link
                to="/drawings"
                className={buttonClassName({ variant: 'secondary', size: 'lg' })}
              >
                취소
              </Link>
            </div>
          </Card>
        </form>
      </div>
    </main>
  );
}

export default CreateDrawingPage;
