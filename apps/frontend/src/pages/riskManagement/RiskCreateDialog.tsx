import { Button, ErrorState, Field, Input, Modal, Select, Textarea } from '../../components/ui';
import { SEVERITY_OPTIONS, STATUS_OPTIONS } from '../../features/risks/constants/riskOptions';
import { useRiskForm } from '../../features/risks/hooks/useRiskForm';
import { useCreateRisk } from '../../features/risks/hooks/useRiskMutations';
import { getRiskErrorMessage } from '../../features/risks/utils/getRiskErrorMessage';

function RiskCreateDialog({ onClose }: { onClose: () => void }) {
  const {
    title,
    setTitle,
    severity,
    setSeverity,
    status,
    setStatus,
    description,
    setDescription,
    toCreateRequest,
  } = useRiskForm({
    title: '',
    severity: '보통',
    status: '임시저장',
    description: '',
  });

  const createMutation = useCreateRisk();

  const errorMessage = createMutation.isError ? getRiskErrorMessage(createMutation.error) : null;

  const handleSubmit = () => {
    createMutation.mutate(toCreateRequest(), { onSuccess: onClose });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="위험 예상 항목 등록"
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={createMutation.isPending || !title.trim()}
          >
            {createMutation.isPending ? '등록 중...' : '등록'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="위험 항목명" htmlFor="risk-create-name" required>
          <Input
            id="risk-create-name"
            required
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="예: 중앙 통로 밀집도 초과"
          />
        </Field>
        <Field label="심각도" htmlFor="risk-create-severity">
          <Select
            id="risk-create-severity"
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
          >
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="상태" htmlFor="risk-create-status">
          <Select
            id="risk-create-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="설명" htmlFor="risk-create-description">
          <Textarea
            id="risk-create-description"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="선택"
          />
        </Field>
        {errorMessage && <ErrorState message={errorMessage} />}
      </div>
    </Modal>
  );
}

export default RiskCreateDialog;
