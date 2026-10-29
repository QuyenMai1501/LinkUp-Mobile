export type ReportTargetType = 'post' | 'comment' | 'user' | 'community';

export interface ViolationRule {
  id: string;
  title: string;
  description: string;
  applicable_to: string;
  severity: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ViolationRuleListResponse {
  rules: ViolationRule[];
  total: number;
}

export interface CreateReportInput {
  target_type: ReportTargetType;
  target_id: string;
  report_type: string;
  violation_rule_id?: string;
  reason_detail: string;
}
