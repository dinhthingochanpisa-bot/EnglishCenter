export const leadPipelineStages = ['NEW', 'CONTACTED'] as const;

export const opportunityPipelineStages = ['OPEN', 'CHECKIN_DONE', 'TEST_DONE', 'TRIAL_DONE', 'WON', 'LOST'] as const;

export const leadStatusLabels: Record<string, string> = {
  NEW: 'Mới',
  CONTACTED: 'Đã liên hệ',
  LOST: 'Không tiềm năng',
  CONVERTED: 'Đã chuyển đổi',
};

export const leadStatusVariants: Record<string, 'info' | 'primary' | 'success' | 'warning' | 'error' | 'outline'> = {
  NEW: 'info',
  CONTACTED: 'primary',
  LOST: 'error',
  CONVERTED: 'success',
};

export const opportunityStatusLabels: Record<string, string> = {
  OPEN: 'Cơ hội',
  CHECKIN_DONE: 'Đã check-in',
  TEST_DONE: 'Đã kiểm tra',
  TRIAL_DONE: 'Đã học thử',
  WON: 'Chốt thành công',
  LOST: 'Thất bại',
};

export const opportunityStatusVariants: Record<string, 'info' | 'primary' | 'success' | 'warning' | 'error' | 'outline'> = {
  OPEN: 'warning',
  CHECKIN_DONE: 'primary',
  TEST_DONE: 'info',
  TRIAL_DONE: 'primary',
  WON: 'success',
  LOST: 'error',
};

export const salesPipelineStages = [
  { id: 'NEW', label: leadStatusLabels.NEW, entity: 'LEAD', color: 'bg-slate-100' },
  { id: 'CONTACTED', label: leadStatusLabels.CONTACTED, entity: 'LEAD', color: 'bg-blue-50' },
  { id: 'OPEN', label: opportunityStatusLabels.OPEN, entity: 'OPPORTUNITY', color: 'bg-amber-50' },
  { id: 'CHECKIN_DONE', label: opportunityStatusLabels.CHECKIN_DONE, entity: 'OPPORTUNITY', color: 'bg-emerald-50' },
  { id: 'TEST_DONE', label: opportunityStatusLabels.TEST_DONE, entity: 'OPPORTUNITY', color: 'bg-cyan-50' },
  { id: 'TRIAL_DONE', label: opportunityStatusLabels.TRIAL_DONE, entity: 'OPPORTUNITY', color: 'bg-indigo-50' },
  { id: 'WON', label: opportunityStatusLabels.WON, entity: 'OPPORTUNITY', color: 'bg-green-100' },
] as const;

export function normalizeLeadStatus(status?: string) {
  if (status && leadStatusLabels[status]) return status;
  return 'CONTACTED';
}
