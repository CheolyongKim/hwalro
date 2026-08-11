import { useState } from 'react';
import type { RiskCreateRequest, RiskUpdateRequest } from '../types/risks';

export interface RiskFormValues {
  title: string;
  severity: string;
  status: string;
  description: string;
}

export function useRiskForm(initial: RiskFormValues) {
  const [title, setTitle] = useState(initial.title);
  const [severity, setSeverity] = useState(initial.severity);
  const [status, setStatus] = useState(initial.status);
  const [description, setDescription] = useState(initial.description);

  const toCreateRequest = (): RiskCreateRequest => ({
    simulationResultId: null,
    startX: null,
    startY: null,
    endX: null,
    endY: null,
    title: title.trim(),
    severity: severity.trim(),
    status: status.trim(),
    description: description.trim() === '' ? null : description.trim(),
  });

  const toUpdateRequest = (): RiskUpdateRequest => ({
    title: title.trim(),
    severity: severity.trim(),
    status: status.trim(),
    description: description.trim() === '' ? null : description.trim(),
  });

  return {
    title,
    setTitle,
    severity,
    setSeverity,
    status,
    setStatus,
    description,
    setDescription,
    toCreateRequest,
    toUpdateRequest,
  };
}
