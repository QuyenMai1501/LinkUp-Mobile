import { request } from './client';

import type {
  CreateReportInput,
  ReportTargetType,
  ViolationRuleListResponse,
} from '../types/report';

export const getViolationRules = (targetType: ReportTargetType) =>
  request<ViolationRuleListResponse>(`/violation-rules?target_type=${targetType}`);

export const createReport = (input: CreateReportInput) =>
  request<{ message: string }>('/reports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
