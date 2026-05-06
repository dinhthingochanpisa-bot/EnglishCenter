import { apiFetch } from '../api';

export interface DashboardSummary {
  leadsTotal: number;
  contractsThisMonth: number;
  cashInThisMonth: number;
  totalOutstanding: number;
  activeStudents: number;
  activeClasses: number;
  refireStudents: number;
  renewalCandidates: number;
  renewalDueStudents: number;
  centerCapacityRate: number;
  scheduleFillRate: number;
  activeClassCapacity: number;
  activeClassSeatsFilled: number;
}

export interface LeadByStage {
  stage: string;
  count: number;
}

export interface CenterBreakdown {
  id: string;
  name: string;
  code: string;
  activeStudents: number;
  activeContracts: number;
}

export interface ExecutiveDashboardData {
  summary: DashboardSummary;
  leadsByStage: LeadByStage[];
  centerBreakdown: CenterBreakdown[];
  monthlyTrend: Array<{
    month: string;
    leads: number;
    contracts: number;
    contractValue: number;
    cashIn: number;
  }>;
  examMonthlyTrend: Array<{
    month: string;
    realExamStudents: number;
    mockTestStudents: number;
  }>;
  receivablesByStatus: Array<{
    status: string;
    count: number;
    amount: number;
  }>;
}

export interface NotificationItem {
  type: 'OVERDUE_RECEIVABLE' | 'COURSE_END_WARNING';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  body: string;
  centerId: string;
  centerName: string;
  contractId: string;
  dueDate: string;
}

export interface NotificationData {
  total: number;
  items: NotificationItem[];
}

export const reportingApi = {
  getExecutive: () => apiFetch<ExecutiveDashboardData>('/reporting/executive'),
  getSales: () => apiFetch<any>('/reporting/sales'),
  getAcademic: () => apiFetch<any>('/reporting/academic'),
  getFamilyInsights: () => apiFetch<any>('/reporting/family-insights'),
  getNotifications: () => apiFetch<NotificationData>('/reporting/notifications'),
};
