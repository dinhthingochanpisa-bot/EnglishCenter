'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckSquare,
  ChevronLeft,
  GraduationCap,
  History,
  Mail,
  MapPin,
  Phone,
  Pencil,
  PlusCircle,
  School,
  Target as TargetIcon,
  User,
  X,
} from 'lucide-react';
import { ModuleBoundary } from '@/components/common/ModuleBoundary';
import { AuditTrail } from '@/components/common/AuditTrail';
import { InternalThread } from '@/components/collaboration/InternalThread';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { apiFetch } from '@/lib/api';
import { useAppDialog } from '@/providers/AppDialogProvider';
import { useAuth } from '@/providers/AuthProvider';
import {
  leadPipelineStages,
  leadStatusLabels,
  opportunityPipelineStages,
  opportunityStatusLabels,
} from '@/lib/lead.constants';

const uniqueStrings = (items: any[]) => {
  const seen = new Set<string>();
  return (items || [])
    .map((item) => String(item || '').trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const sessionCountFromPackage = (value: string) => {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : 1;
};

const percentInputForApi = (value: string) => {
  const rawValue = String(value || '').trim();
  if (!rawValue) return undefined;
  return rawValue.includes('%') ? rawValue : `${rawValue}%`;
};

const percentInputToNumber = (value: string) => {
  const parsedValue = Number(String(value || '').replace('%', '').replace(',', '.'));
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

const formatMoney = (value: any) => `${Number(value || 0).toLocaleString('vi-VN')} đ`;

const taskPriorityMeta: Record<string, { label: string; className: string; stripeClass: string }> = {
  LOW: {
    label: 'Thấp',
    className: 'bg-slate-100 text-slate-600',
    stripeClass: 'bg-slate-300',
  },
  MEDIUM: {
    label: 'Trung bình',
    className: 'bg-blue-100 text-blue-700',
    stripeClass: 'bg-blue-400',
  },
  HIGH: {
    label: 'Cao',
    className: 'bg-orange-100 text-orange-700',
    stripeClass: 'bg-orange-500',
  },
  URGENT: {
    label: 'Khẩn cấp',
    className: 'bg-rose-100 text-rose-700',
    stripeClass: 'bg-rose-500',
  },
};

function getTaskDueMeta(task: any) {
  if (task.status === 'DONE') {
    return {
      label: 'Đã hoàn thành',
      badgeClass: 'bg-emerald-100 text-emerald-700',
      cardClass: 'border-emerald-100 bg-emerald-50/35',
    };
  }

  if (!task.dueDate) {
    return {
      label: 'Chưa có hạn',
      badgeClass: 'bg-slate-100 text-slate-600',
      cardClass: 'border-slate-100 bg-white',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(task.dueDate);
  dueDate.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);

  if (daysLeft < 0) {
    return {
      label: `Quá hạn ${Math.abs(daysLeft)} ngày`,
      badgeClass: 'bg-rose-100 text-rose-700',
      cardClass: 'border-rose-200 bg-rose-50/50',
    };
  }

  if (daysLeft === 0) {
    return {
      label: 'Đến hạn hôm nay',
      badgeClass: 'bg-orange-100 text-orange-700',
      cardClass: 'border-orange-200 bg-orange-50/45',
    };
  }

  if (daysLeft <= 3) {
    return {
      label: `Sắp đến hạn (${daysLeft} ngày)`,
      badgeClass: 'bg-amber-100 text-amber-700',
      cardClass: 'border-amber-200 bg-amber-50/40',
    };
  }

  return {
    label: `Còn ${daysLeft} ngày`,
    badgeClass: 'bg-sky-100 text-sky-700',
    cardClass: 'border-slate-100 bg-white',
  };
}

function getLeadContactRole(lead: any) {
  return lead.notes?.includes('[CONTACT_TYPE:STUDENT]')
    ? {
        label: 'Học sinh tự liên hệ',
        shortLabel: 'Học sinh',
      }
    : {
        label: 'Phụ huynh / người giám hộ',
        shortLabel: 'Phụ huynh',
      };
}

type LeadAssignee = {
  id: string;
  fullName: string;
  email?: string;
  role?: { code?: string; name?: string };
  centers?: Array<{ centerId: string; center?: { name?: string; code?: string } }>;
};

type SalesHandover = {
  id?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  profileConfirmed: boolean;
  profileNotes: string;
  paymentGuideSent: boolean;
  paymentReceiptConfirmed: boolean;
  paymentNotes: string;
  scheduleRequested: boolean;
  scheduleConfirmed: boolean;
  schedulePreference: string;
  scheduleNotes: string;
  academicHandoverSent: boolean;
  academicNotes: string;
  welcomeSent: boolean;
  groupsAdded: boolean;
  zaloGroupCreated: boolean;
  parentConfirmed: boolean;
  welcomeNotes: string;
};

type WonForm = {
  centerId: string;
  classId: string;
  amount: string;
  productName: string;
  productRank: string;
  feePackage: string;
  unitPrice: string;
  contractedSessions: string;
  discountPercent: string;
  discountSegmentCode: string;
  promotionCodes: string[];
};

const emptySalesHandover: SalesHandover = {
  status: 'PENDING',
  profileConfirmed: false,
  profileNotes: '',
  paymentGuideSent: false,
  paymentReceiptConfirmed: false,
  paymentNotes: '',
  scheduleRequested: false,
  scheduleConfirmed: false,
  schedulePreference: '',
  scheduleNotes: '',
  academicHandoverSent: false,
  academicNotes: '',
  welcomeSent: false,
  groupsAdded: false,
  zaloGroupCreated: false,
  parentConfirmed: false,
  welcomeNotes: '',
};

export default function LeadDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { confirm } = useAppDialog();
  const [lead, setLead] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingInteractionId, setEditingInteractionId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [interactionForm, setInteractionForm] = useState({ type: 'NOTE', content: '' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', dueDate: '', priority: 'MEDIUM' });
  const [assignees, setAssignees] = useState<LeadAssignee[]>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string; code: string; centerId: string; program?: { name?: string } }>>([]);
  const [showWonForm, setShowWonForm] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issues, setIssues] = useState<any[]>([]);
  const [availableCenters, setAvailableCenters] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [crmConfig, setCrmConfig] = useState<any>(null);
  const [wonQuote, setWonQuote] = useState<any>(null);
  const [wonQuoteError, setWonQuoteError] = useState<string | null>(null);
  const [isWonQuoteLoading, setIsWonQuoteLoading] = useState(false);
  const [testResultForm, setTestResultForm] = useState({ result: '', notes: '' });
  const [showEditLeadModal, setShowEditLeadModal] = useState(false);
  const [leadEditForm, setLeadEditForm] = useState({
    parentName: '',
    phone: '',
    email: '',
    address: '',
    prospectiveStudentName: '',
    studentPhone: '',
    productInterest: '',
    school: '',
    grade: '',
    target: '',
    fatherName: '',
    fatherPhone: '',
    motherName: '',
    motherPhone: '',
    notes: '',
  });
  const [trialClassId, setTrialClassId] = useState('');
  const [wonForm, setWonForm] = useState<WonForm>({
    centerId: '',
    classId: '',
    amount: '',
    productName: '',
    productRank: '',
    feePackage: '',
    unitPrice: '',
    contractedSessions: '',
    discountPercent: '',
    discountSegmentCode: '',
    promotionCodes: [],
  });
  const lastPricingKeyRef = useRef('');
  const [salesHandover, setSalesHandover] = useState<SalesHandover | null>(null);
  const [issueForm, setIssueForm] = useState({
    type: 'OBJECTION',
    category: 'PRICE',
    priority: 'MEDIUM',
    title: '',
    description: '',
    nextAction: '',
    dueDate: '',
  });
  const [checkinErrors, setCheckinErrors] = useState<Record<string, string>>({});
  const [checkinProfileForm, setCheckinProfileForm] = useState({
    parentFullName: '',
    parentPhone: '',
    parentEmail: '',
    parentAddress: '',
    relationship: 'Phụ huynh',
    studentFullName: '',
    birthday: '',
    gender: 'OTHER',
    school: '',
    grade: '',
    target: '',
    notes: '',
  });

  const fetchLead = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/leads/${id}`);
      setLead(data);
      apiFetch(`/leads/${id}/issues`).then(setIssues).catch(() => setIssues([]));
      const wonOpportunity = data.opportunities?.find((item: any) => item.status === 'WON') || data.opportunities?.[0];
      if (wonOpportunity?.status === 'WON') {
        const handover = await apiFetch(`/opportunities/${wonOpportunity.id}/handover`);
        setSalesHandover({ ...emptySalesHandover, ...(handover || {}) });
      } else {
        setSalesHandover(null);
      }
      setWonForm((prev) => ({ ...prev, centerId: data.centerId || '' }));
    } catch (err: any) {
      setError(err.message || 'Không thể tải Lead');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailableCenters = async () => {
    try {
      const data = await apiFetch<any[]>('/admin/centers');
      setAvailableCenters(data);
    } catch {
      if (user?.centers) {
        setAvailableCenters(user.centers.map((c: any) => ({ id: c.id, name: c.name, code: c.code })));
      }
    }
  };

  useEffect(() => {
    fetchLead();
    fetchAvailableCenters();
    apiFetch<LeadAssignee[]>('/leads/assignees')
      .then(setAssignees)
      .catch(() => setAssignees([]));
    apiFetch('/config/monbay-crm')
      .then(setCrmConfig)
      .catch(() => setCrmConfig(null));
  }, [id]);

  useEffect(() => {
    const classOpportunityId =
      lead?.opportunities?.find((item: any) => item.status !== 'LOST')?.id ||
      lead?.opportunities?.[0]?.id;

    if (wonForm.centerId && classOpportunityId) {
      apiFetch<any[]>(
        `/opportunities/${classOpportunityId}/classes?centerId=${wonForm.centerId}`,
      )
        .then((data) => {
          setClasses(data);
          // Reset classId if not in new center
          setWonForm((prev) => {
            const exists = data.some((c: any) => c.id === prev.classId);
            return exists ? prev : { ...prev, classId: '' };
          });
        })
        .catch(() => setClasses([]));
    }
  }, [wonForm.centerId, lead?.opportunities]);

  useEffect(() => {
    if (!lead) return;

    setCheckinProfileForm({
      parentFullName: lead.parent?.fullName || '',
      parentPhone: lead.parent?.phone || '',
      parentEmail: lead.parent?.email || '',
      parentAddress: lead.parent?.address || '',
      relationship: 'Phụ huynh',
      studentFullName: lead.prospectiveStudentName || '',
      birthday: '',
      gender: 'OTHER',
      school: lead.school || '',
      grade: lead.grade || '',
      target: lead.target || '',
      notes: '',
    });
  }, [lead?.id]);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/leads');
  };

  const openEditLeadModal = () => {
    if (!lead) return;
    setLeadEditForm({
      parentName: lead.parent?.fullName || '',
      phone: lead.parent?.phone || '',
      email: lead.parent?.email || '',
      address: lead.address || lead.parent?.address || '',
      prospectiveStudentName: lead.prospectiveStudentName || '',
      studentPhone: lead.studentPhone || '',
      productInterest: lead.productInterest || '',
      school: lead.school || '',
      grade: lead.grade || '',
      target: lead.target || lead.aim || '',
      fatherName: lead.fatherName || '',
      fatherPhone: lead.fatherPhone || '',
      motherName: lead.motherName || '',
      motherPhone: lead.motherPhone || '',
      notes: lead.notes || '',
    });
    setShowEditLeadModal(true);
  };

  const handleUpdateLeadInfo = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(leadEditForm),
      });
      setShowEditLeadModal(false);
      await fetchLead();
    } catch (err: any) {
      setError(err.message || 'Không thể cập nhật thông tin tiềm năng');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/leads/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchLead();
    } catch (err: any) {
      setError(err.message || 'Không thể cập nhật trạng thái');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignLead = async (ownerId: string) => {
    if (!ownerId) return;

    setIsSaving(true);
    setError(null);
    try {
      const updated = await apiFetch(`/leads/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ ownerId }),
      });
      setLead((current: any) => ({
        ...current,
        owner: (updated as any).owner || assignees.find((assignee) => assignee.id === ownerId),
      }));
      await fetchLead();
    } catch (err: any) {
      setError(err.message || 'Không thể gán nhân viên phụ trách');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpportunityStatusUpdate = async (opportunityId: string, newStatus: string) => {
    if (newStatus === 'WON') {
      setShowWonForm(true);
      setError('Vui lòng chọn lớp chính thức và bấm chốt thành công ở form bên dưới.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setShowWonForm(false);
    try {
      await apiFetch(`/crm/opportunities/${opportunityId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchLead();
    } catch (err: any) {
      setError(err.message || 'Không thể cập nhật trạng thái cơ hội');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConvert = async () => {
    const confirmed = await confirm({
      title: 'Chuyển Lead thành cơ hội?',
      message: 'Sau khi xác nhận, Lead này sẽ được đưa vào pipeline cơ hội để tiếp tục tư vấn và chốt.',
      confirmLabel: 'Chuyển thành cơ hội',
    });
    if (!confirmed) return;

    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/leads/${id}/convert`, {
        method: 'POST',
        body: JSON.stringify({ programId: lead.opportunities?.[0]?.programId || null, value: 0 }),
      });
      await fetchLead();
    } catch (err: any) {
      setError(err.message || 'Không thể chuyển đổi Lead');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateInteraction = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!interactionForm.content.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(
        editingInteractionId
          ? `/leads/${id}/interactions/${editingInteractionId}`
          : `/leads/${id}/interactions`,
        {
          method: editingInteractionId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          type: interactionForm.type,
          content: interactionForm.content.trim(),
        }),
        },
      );
      setInteractionForm({ type: 'NOTE', content: '' });
      setEditingInteractionId(null);
      setShowInteractionModal(false);
      await fetchLead();
    } catch (err: any) {
      setError(err.message || 'Không thể lưu tương tác');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskForm.title.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(
        editingTaskId ? `/leads/${id}/tasks/${editingTaskId}` : `/leads/${id}/tasks`,
        {
          method: editingTaskId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          title: taskForm.title.trim(),
          description: taskForm.description.trim() || undefined,
          dueDate: taskForm.dueDate || undefined,
          priority: taskForm.priority,
        }),
        },
      );
      setTaskForm({ title: '', description: '', dueDate: '', priority: 'MEDIUM' });
      setEditingTaskId(null);
      setShowTaskModal(false);
      await fetchLead();
    } catch (err: any) {
      setError(err.message || 'Không thể lưu việc cần theo dõi');
    } finally {
      setIsSaving(false);
    }
  };

  const validateCheckinForm = () => {
    const errors: Record<string, string> = {};
    if (!checkinProfileForm.parentFullName.trim()) errors.parentFullName = 'Vui lòng nhập họ tên phụ huynh';
    if (!checkinProfileForm.parentPhone.trim()) errors.parentPhone = 'Vui lòng nhập số điện thoại';
    if (!checkinProfileForm.relationship.trim()) errors.relationship = 'Vui lòng chọn vai trò';
    if (!checkinProfileForm.studentFullName.trim()) errors.studentFullName = 'Vui lòng nhập họ tên học sinh';

    setCheckinErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const updateCheckinProfileField = (
    field: keyof typeof checkinProfileForm,
    value: string,
  ) => {
    setCheckinProfileForm((form) => ({ ...form, [field]: value }));
    setCheckinErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const isCheckinIncomplete = useMemo(() => {
    if (!lead) return true;
    return (
      !lead.parent?.fullName?.trim() ||
      !lead.parent?.phone?.trim() ||
      !lead.prospectiveStudentName?.trim() ||
      !lead.centerId
    );
  }, [lead]);

  const handleSaveCheckinProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!primaryOpportunity) return;

    if (!validateCheckinForm()) {
      setError('Vui lòng hoàn thiện các trường bắt buộc trong hồ sơ check-in.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/opportunities/${primaryOpportunity.id}/checkin-profile`, {
        method: 'POST',
        body: JSON.stringify({
          parent: {
            fullName: checkinProfileForm.parentFullName.trim(),
            phone: checkinProfileForm.parentPhone.trim(),
            email: checkinProfileForm.parentEmail.trim() || undefined,
            address: checkinProfileForm.parentAddress.trim() || undefined,
            relationship: checkinProfileForm.relationship,
          },
          student: {
            fullName: checkinProfileForm.studentFullName.trim(),
            birthday: checkinProfileForm.birthday || undefined,
            gender: checkinProfileForm.gender,
            school: checkinProfileForm.school.trim() || undefined,
            grade: checkinProfileForm.grade.trim() || undefined,
            target: checkinProfileForm.target.trim() || undefined,
            notes: checkinProfileForm.notes.trim() || undefined,
          },
        }),
      });
      setCheckinErrors({});
      await fetchLead();
    } catch (err: any) {
      setError(err.message || 'Không thể lưu hồ sơ sau check-in');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTestResult = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!primaryOpportunity) return;

    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/opportunities/${primaryOpportunity.id}/test-result`, {
        method: 'POST',
        body: JSON.stringify({
          result: testResultForm.result.trim(),
          notes: testResultForm.notes.trim() || undefined,
        }),
      });
      setTestResultForm({ result: '', notes: '' });
      await fetchLead();
    } catch (err: any) {
      setError(err.message || 'Không thể lưu kết quả kiểm tra');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssignTrialClass = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!primaryOpportunity) return;

    if (isCheckinIncomplete) {
      setError('Vui lòng hoàn thiện hồ sơ check-in trước khi xếp lớp học thử.');
      const checkinSection = document.getElementById('checkin-section');
      if (checkinSection) checkinSection.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/opportunities/${primaryOpportunity.id}/trial-class`, {
        method: 'POST',
        body: JSON.stringify({ classId: trialClassId }),
      });
      await fetchLead();
    } catch (err: any) {
      setError(err.message || 'Không thể xếp lớp học thử');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkWon = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isCheckinIncomplete) {
      setError('Vui lòng hoàn thiện hồ sơ check-in trước khi chốt thành công.');
      const checkinSection = document.getElementById('checkin-section');
      if (checkinSection) checkinSection.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const activeOpportunity = lead.opportunities?.find((item: any) => item.status !== 'LOST');
      if (!activeOpportunity) throw new Error('Không tìm thấy cơ hội hoạt động.');

      await apiFetch(`/opportunities/${activeOpportunity.id}/won`, {
        method: 'POST',
        body: JSON.stringify({
          ...wonForm,
          waitForClass: !wonForm.classId,
          amount: Number(wonForm.amount || 0),
          pricingMode: 'CONFIG',
          productName: wonForm.productName || undefined,
          productRank: wonForm.productRank || undefined,
          feePackage: wonForm.feePackage || undefined,
          unitPrice: wonForm.unitPrice ? Number(wonForm.unitPrice) : undefined,
          contractedSessions: wonForm.contractedSessions
            ? Number(wonForm.contractedSessions)
            : undefined,
          discountPercent: percentInputForApi(wonForm.discountPercent),
          discountSegmentCode: wonForm.discountSegmentCode || undefined,
          promotionCodes: wonForm.promotionCodes,
          studentName: lead.prospectiveStudentName,
        }),
      });
      setShowWonForm(false);
      await fetchLead();
    } catch (err: any) {
      setError(err.message || 'Không thể chốt thành công');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSalesHandover = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!primaryOpportunity || !salesHandover) return;

    setIsSaving(true);
    setError(null);
    try {
      const updated = await apiFetch(`/opportunities/${primaryOpportunity.id}/handover`, {
        method: 'PATCH',
        body: JSON.stringify(salesHandover),
      });
      setSalesHandover({ ...emptySalesHandover, ...(updated || {}) });
      await fetchLead();
    } catch (err: any) {
      setError(err.message || 'Không thể lưu checklist bàn giao sau chốt');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateIssue = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/leads/${id}/issues`, {
        method: 'POST',
        body: JSON.stringify({
          ...issueForm,
          title: issueForm.title.trim(),
          description: issueForm.description.trim() || undefined,
          nextAction: issueForm.nextAction.trim() || undefined,
          dueDate: issueForm.dueDate || undefined,
        }),
      });
      setIssueForm({ type: 'OBJECTION', category: 'PRICE', priority: 'MEDIUM', title: '', description: '', nextAction: '', dueDate: '' });
      setShowIssueModal(false);
      await fetchLead();
    } catch (err: any) {
      setError(err.message || 'Không thể lưu phản đối/khiếu nại');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResolveIssue = async (issueId: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/leads/${id}/issues/${issueId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'RESOLVED', resolution: 'Đã xử lý và đóng case.' }),
      });
      await fetchLead();
    } catch (err: any) {
      setError(err.message || 'Không thể đóng case');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTaskDoneToggle = async (task: any) => {
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/leads/${id}/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: task.status === 'DONE' ? 'TODO' : 'DONE',
        }),
      });
      await fetchLead();
    } catch (err: any) {
      setError(err.message || 'Không thể cập nhật trạng thái công việc');
    } finally {
      setIsSaving(false);
    }
  };

  const openCreateInteractionModal = () => {
    setEditingInteractionId(null);
    setInteractionForm({ type: 'NOTE', content: '' });
    setShowInteractionModal(true);
  };

  const openEditInteractionModal = (interaction: any) => {
    setEditingInteractionId(interaction.id);
    setInteractionForm({
      type: interaction.type || 'NOTE',
      content: interaction.content || '',
    });
    setShowInteractionModal(true);
  };

  const openCreateTaskModal = () => {
    setEditingTaskId(null);
    setTaskForm({ title: '', description: '', dueDate: '', priority: 'MEDIUM' });
    setShowTaskModal(true);
  };

  const openEditTaskModal = (task: any) => {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title || '',
      description: task.description || '',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
      priority: task.priority || 'MEDIUM',
    });
    setShowTaskModal(true);
  };

  const primaryOpportunity = lead?.opportunities?.[0];
  const pricingRows = useMemo(
    () => (Array.isArray(crmConfig?.pricingMatrix) ? crmConfig.pricingMatrix : []),
    [crmConfig],
  );
  const discountSegments = useMemo(
    () => (Array.isArray(crmConfig?.discountSegments) ? crmConfig.discountSegments : []),
    [crmConfig],
  );
  const activePromotions = useMemo(
    () =>
      (Array.isArray(crmConfig?.promotions) ? crmConfig.promotions : []).filter(
        (item: any) => item.active !== false,
      ),
    [crmConfig],
  );
  const productOptions = useMemo(() => {
    const configured = uniqueStrings(pricingRows.map((item: any) => item.product));
    return configured.length ? configured : uniqueStrings(crmConfig?.products || []);
  }, [crmConfig, pricingRows]);
  const rankOptions = useMemo(() => {
    const rows = pricingRows.filter(
      (item: any) => !wonForm.productName || item.product === wonForm.productName,
    );
    const configured = uniqueStrings(rows.map((item: any) => item.rank));
    if (configured.length) return configured;
    return uniqueStrings([
      ...(crmConfig?.ranks?.all || []),
      ...(crmConfig?.ranks?.ielts || []),
      ...(crmConfig?.ranks?.sat || []),
      ...(crmConfig?.ranks?.junior || []),
    ]);
  }, [crmConfig, pricingRows, wonForm.productName]);
  const feePackageOptions = useMemo(() => {
    const rows = pricingRows.filter(
      (item: any) =>
        (!wonForm.productName || item.product === wonForm.productName) &&
        (!wonForm.productRank || item.rank === wonForm.productRank),
    );
    const configured = uniqueStrings(rows.map((item: any) => item.feePackage));
    if (configured.length) return configured;
    return uniqueStrings([
      ...(crmConfig?.feePackages?.all || []),
      ...(crmConfig?.feePackages?.ielts || []),
      ...(crmConfig?.feePackages?.sat || []),
      ...(crmConfig?.feePackages?.junior || []),
    ]);
  }, [crmConfig, pricingRows, wonForm.productName, wonForm.productRank]);
  const selectedPricing = useMemo(() => {
    const rowsForRank = pricingRows.filter(
      (item: any) =>
        item.product === wonForm.productName &&
        item.rank === wonForm.productRank,
    );

    if (!rowsForRank.length) return null;
    return (
      rowsForRank.find((item: any) => item.feePackage === wonForm.feePackage) ||
      rowsForRank[0]
    );
  }, [pricingRows, wonForm.feePackage, wonForm.productName, wonForm.productRank]);

  useEffect(() => {
    if (!selectedPricing) return;

    const nextUnitPrice = String(Number(selectedPricing.unitPrice || 0));
    const hasFeePackage = Boolean(wonForm.feePackage);
    const pricingKey = [
      selectedPricing.product,
      selectedPricing.rank,
      selectedPricing.feePackage,
    ].join('|');
    const shouldAutofillSessions =
      hasFeePackage &&
      (pricingKey !== lastPricingKeyRef.current || !wonForm.contractedSessions);
    const nextSessions = shouldAutofillSessions
      ? String(sessionCountFromPackage(selectedPricing.feePackage))
      : wonForm.contractedSessions;
    const nextDiscountPercent = hasFeePackage
      ? String(selectedPricing.discountPercent || '')
      : wonForm.discountPercent;
    const nextAmount = nextSessions
      ? String(Number(nextUnitPrice) * Number(nextSessions || 1))
      : wonForm.amount;

    setWonForm((current) => {
      lastPricingKeyRef.current = pricingKey;
      if (
        current.unitPrice === nextUnitPrice &&
        current.contractedSessions === nextSessions &&
        current.discountPercent === nextDiscountPercent &&
        current.amount === nextAmount
      ) {
        return current;
      }
      return {
        ...current,
        unitPrice: nextUnitPrice,
        contractedSessions: nextSessions,
        discountPercent: nextDiscountPercent,
        amount: nextAmount,
      };
    });
  }, [selectedPricing, wonForm.amount, wonForm.contractedSessions, wonForm.discountPercent, wonForm.feePackage]);

  useEffect(() => {
    const unitPrice = Number(wonForm.unitPrice || 0);
    const sessions = Number(wonForm.contractedSessions || 0);
    if (!unitPrice || !sessions) return;
    const nextAmount = String(unitPrice * sessions);
    setWonForm((current) =>
      current.amount === nextAmount ? current : { ...current, amount: nextAmount },
    );
  }, [wonForm.contractedSessions, wonForm.unitPrice]);

  useEffect(() => {
    if (!showWonForm || !Number(wonForm.amount)) {
      setWonQuote(null);
      setWonQuoteError(null);
      return;
    }

    let cancelled = false;
    setIsWonQuoteLoading(true);
    setWonQuoteError(null);

    apiFetch('/opportunities/pricing-quote', {
      method: 'POST',
      body: JSON.stringify({
        listPrice: Number(wonForm.amount),
        discountSegmentCode: wonForm.discountSegmentCode || undefined,
        promotionCodes: wonForm.promotionCodes,
        contractedSessions: wonForm.contractedSessions
          ? Number(wonForm.contractedSessions)
          : undefined,
        discountPercent: percentInputForApi(wonForm.discountPercent),
      }),
    })
      .then((data) => {
        if (!cancelled) setWonQuote(data);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setWonQuote(null);
          setWonQuoteError(err.message || 'Không thể tính giá từ cấu hình');
        }
      })
      .finally(() => {
        if (!cancelled) setIsWonQuoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    showWonForm,
    wonForm.amount,
    wonForm.contractedSessions,
    wonForm.discountPercent,
    wonForm.discountSegmentCode,
    wonForm.promotionCodes,
  ]);

  const toggleWonPromotion = (code: string, checked: boolean) => {
    setWonForm((current) => ({
      ...current,
      promotionCodes: checked
        ? uniqueStrings([...current.promotionCodes, code])
        : current.promotionCodes.filter((item) => item !== code),
    }));
  };

  const configuredListPrice = Number(wonQuote?.listPrice ?? wonForm.amount ?? 0);
  const quoteBreakdown = Array.isArray(wonQuote?.breakdown)
    ? wonQuote.breakdown
    : [];
  const configuredBaseDiscount = quoteBreakdown.length
    ? quoteBreakdown
        .filter((item: any) => !wonForm.promotionCodes.includes(item?.code))
        .reduce((sum: number, item: any) => sum + Number(item?.amount || 0), 0)
    : configuredListPrice * (percentInputToNumber(wonForm.discountPercent) / 100);
  const configuredTotalDiscount = Number(wonQuote?.totalDiscount ?? 0);
  const configuredPromotionDiscount = quoteBreakdown.length
    ? quoteBreakdown
        .filter((item: any) => wonForm.promotionCodes.includes(item?.code))
        .reduce(
        (sum: number, item: any) => sum + Number(item?.amount || 0),
        0,
      )
    : 0;
  const configuredFinalAmount = Number(wonQuote?.finalAmount ?? wonForm.amount ?? 0);

  if (isLoading && !lead) {
    return <div className="p-8 text-center text-slate-500">Đang tải chi tiết Lead...</div>;
  }

  if (error && !lead) {
    return <Card className="m-8 border-red-100 bg-red-50 text-red-600 p-4">{error}</Card>;
  }

  if (!lead) return null;

  const assigneesForLead = assignees.filter(
    (assignee) =>
      assignee.role?.code === 'SUPER_ADMIN' ||
      !lead.center?.id ||
      assignee.centers?.some((center) => center.centerId === lead.center?.id),
  );
  const statusOptions = leadPipelineStages;
  const classesForLead = classes.filter((item) => !lead.center?.id || item.centerId === lead.center.id);
  const selectedLeadStatus = (leadPipelineStages as readonly string[]).includes(lead.status) ? lead.status : 'CONTACTED';
  const selectedOpportunityStatus =
    primaryOpportunity && (opportunityPipelineStages as readonly string[]).includes(primaryOpportunity.status)
      ? primaryOpportunity.status
      : 'OPEN';
  const contactRole = getLeadContactRole(lead);

  return (
    <ModuleBoundary moduleCode="CRM_LEADS">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={handleBack} aria-label="Quay lại trang trước">
              <ChevronLeft size={18} />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{lead.parent?.fullName}</h1>
              <p className="text-slate-500 text-sm">Mã Lead: {lead.id}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openEditLeadModal} disabled={isSaving}>
              <Pencil size={18} className="mr-2" /> Chỉnh sửa thông tin
            </Button>
            <Button variant="secondary" onClick={openCreateInteractionModal}>
              <PlusCircle size={18} className="mr-2" /> Ghi nhận tương tác
            </Button>
            {lead.status !== 'CONVERTED' && (
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleConvert} disabled={isSaving}>
                Chuyển thành cơ hội <ArrowRight size={18} className="ml-2" />
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <History size={18} className="text-purple-500" /> Trạng thái Pipeline
                </h3>
              </div>
              <select
                className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50"
                value={selectedLeadStatus}
                onChange={(e) => handleStatusUpdate(e.target.value)}
                disabled={isSaving || lead.status === 'CONVERTED'}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {leadStatusLabels[status] || status}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-[10px] text-slate-400">
                Các trạng thái tại đây khớp với các cột Lead trên Pipeline.
              </p>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <User size={18} className="text-indigo-500" /> Nhân viên phụ trách
              </h3>
              <select
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-wait"
                value={lead.owner?.id || ''}
                onChange={(event) => handleAssignLead(event.target.value)}
                disabled={isSaving || assigneesForLead.length === 0}
              >
                <option value="">Chưa phân công</option>
                {assigneesForLead.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.fullName}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                Lead hiện do {lead.owner?.fullName || 'chưa có nhân viên'} phụ trách.
              </p>
            </Card>

            {primaryOpportunity && (
              <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <ArrowRight size={18} className="text-blue-500" /> Trạng thái cơ hội
                  </h3>
                </div>
                <select
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-slate-50"
                  value={selectedOpportunityStatus}
                  onChange={(e) => handleOpportunityStatusUpdate(primaryOpportunity.id, e.target.value)}
                  disabled={isSaving}
                >
                  {opportunityPipelineStages.map((status) => (
                    <option key={status} value={status}>
                      {opportunityStatusLabels[status] || status}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[10px] text-slate-400">
                  Dropdown này điều khiển các cột cơ hội trên Pipeline sau khi Lead đã chuyển đổi.
                </p>
              </Card>
            )}

            <Card className="p-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <User size={18} className="text-blue-500" /> Thông tin người liên hệ
              </h3>
              <div className="space-y-4">
                <InfoRow icon={<User size={16} className="text-slate-400 mt-1" />} label="Vai trò liên hệ" value={contactRole.label} />
                <InfoRow icon={<Phone size={16} className="text-slate-400 mt-1" />} label="Số điện thoại" value={lead.parent?.phone} />
                <InfoRow icon={<TargetIcon size={16} className="text-slate-400 mt-1" />} label="Nguồn lead" value={lead.source?.name || 'Chưa có'} />
                <InfoRow icon={<Mail size={16} className="text-slate-400 mt-1" />} label="Email" value={lead.parent?.email || 'Chưa có'} />
                <InfoRow icon={<MapPin size={16} className="text-slate-400 mt-1" />} label="Địa chỉ" value={lead.address || lead.parent?.address || 'Chưa có'} />
                <InfoRow icon={<User size={16} className="text-slate-400 mt-1" />} label="Bố" value={[lead.fatherName, lead.fatherPhone].filter(Boolean).join(' - ') || 'Chưa có'} />
                <InfoRow icon={<User size={16} className="text-slate-400 mt-1" />} label="Mẹ" value={[lead.motherName, lead.motherPhone].filter(Boolean).join(' - ') || 'Chưa có'} />
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <GraduationCap size={18} className="text-emerald-500" /> Học sinh tiềm năng
              </h3>
              <div className="space-y-4">
                <InfoRow icon={<User size={16} className="text-slate-400 mt-1" />} label="Họ tên" value={lead.prospectiveStudentName || 'Chưa có'} />
                <InfoRow icon={<Phone size={16} className="text-slate-400 mt-1" />} label="SĐT học sinh" value={lead.studentPhone || 'Chưa có'} />
                <InfoRow icon={<GraduationCap size={16} className="text-slate-400 mt-1" />} label="Sản phẩm" value={lead.productInterest || 'Chưa có'} />
                <InfoRow
                  icon={<School size={16} className="text-slate-400 mt-1" />}
                  label="Trường / lớp"
                  value={`${lead.school || 'Chưa có'} - ${lead.grade || 'Chưa có'}`}
                />
                <InfoRow icon={<TargetIcon size={16} className="text-slate-400 mt-1" />} label="Mục tiêu" value={lead.target || lead.aim || 'Chưa có'} />
                <InfoRow icon={<History size={16} className="text-slate-400 mt-1" />} label="Nguồn file" value={[lead.sourceSheet, lead.closeStatus].filter(Boolean).join(' - ') || 'Chưa có'} />
                <InfoRow icon={<TargetIcon size={16} className="text-slate-400 mt-1" />} label="Điểm test" value={[lead.scoreListening, lead.scoreReading, lead.scoreWriting, lead.scoreSpeaking, lead.scoreOverall].filter((item) => item != null && item !== '').join(' / ') || 'Chưa có'} />
              </div>
            </Card>
            <AuditTrail entityType="Lead" entityId={lead.id} />
          </div>

          <div className="lg:col-span-2 space-y-6">
            {primaryOpportunity?.status === 'CHECKIN_DONE' && (
              <Card id="checkin-section" className="p-6 border-blue-100 bg-blue-50/30">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">Thông tin hồ sơ sau check-in</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Bắt buộc hoàn thiện để đưa vào lộ trình học tập, xếp lớp hoặc chốt hợp đồng.
                    </p>
                  </div>
                  {isCheckinIncomplete ? (
                    <Badge variant="warning">Chưa hoàn thiện</Badge>
                  ) : (
                    <Badge variant="success">Đã hoàn thiện</Badge>
                  )}
                </div>

                <form onSubmit={handleSaveCheckinProfile} className="space-y-5">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700">Thông tin phụ huynh / người liên hệ</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <LabeledInput
                        label="Họ và tên *"
                        value={checkinProfileForm.parentFullName}
                        onChange={(value) => updateCheckinProfileField('parentFullName', value)}
                        error={checkinErrors.parentFullName}
                      />
                      <LabeledInput
                        label="Số điện thoại *"
                        value={checkinProfileForm.parentPhone}
                        onChange={(value) => updateCheckinProfileField('parentPhone', value)}
                        error={checkinErrors.parentPhone}
                      />
                      <LabeledInput
                        label="Email"
                        value={checkinProfileForm.parentEmail}
                        onChange={(value) => setCheckinProfileForm((form) => ({ ...form, parentEmail: value }))}
                        type="email"
                      />
                      <ConfigSelect
                        label="Quan hệ với học sinh *"
                        value={checkinProfileForm.relationship}
                        options={['Phụ huynh', 'Bố', 'Mẹ', 'Ông bà', 'Anh chị', 'Người giám hộ', 'Học sinh tự liên hệ']}
                        onChange={(value) => updateCheckinProfileField('relationship', value)}
                        error={checkinErrors.relationship}
                      />
                    </div>
                    <LabeledInput
                      label="Địa chỉ"
                      value={checkinProfileForm.parentAddress}
                      onChange={(value) => setCheckinProfileForm((form) => ({ ...form, parentAddress: value }))}
                    />
                  </div>

                  <div className="space-y-3 border-t border-blue-100 pt-4">
                    <h4 className="text-sm font-semibold text-slate-700">Thông tin học sinh</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <LabeledInput
                        label="Họ tên học sinh *"
                        value={checkinProfileForm.studentFullName}
                        onChange={(value) => updateCheckinProfileField('studentFullName', value)}
                        error={checkinErrors.studentFullName}
                      />
                      <LabeledInput
                        label="Ngày sinh"
                        type="date"
                        value={checkinProfileForm.birthday}
                        onChange={(value) => setCheckinProfileForm((form) => ({ ...form, birthday: value }))}
                      />
                      <div>
                        <label className="text-sm text-slate-500">Giới tính</label>
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          value={checkinProfileForm.gender}
                          onChange={(event) => setCheckinProfileForm((form) => ({ ...form, gender: event.target.value }))}
                        >
                          <option value="OTHER">Khác</option>
                          <option value="MALE">Nam</option>
                          <option value="FEMALE">Nữ</option>
                        </select>
                      </div>
                      <LabeledInput
                        label="Trường"
                        value={checkinProfileForm.school}
                        onChange={(value) => setCheckinProfileForm((form) => ({ ...form, school: value }))}
                      />
                      <LabeledInput
                        label="Lớp"
                        value={checkinProfileForm.grade}
                        onChange={(value) => setCheckinProfileForm((form) => ({ ...form, grade: value }))}
                      />
                      <LabeledInput
                        label="Mục tiêu học tập"
                        value={checkinProfileForm.target}
                        onChange={(value) => setCheckinProfileForm((form) => ({ ...form, target: value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-500">Ghi chú tư vấn</label>
                      <textarea
                        className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={checkinProfileForm.notes}
                        onChange={(event) => setCheckinProfileForm((form) => ({ ...form, notes: event.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-blue-100 pt-4">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? 'Đang lưu...' : 'Lưu hồ sơ học sinh'}
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {primaryOpportunity?.status === 'TEST_DONE' && (
              <Card className="border-cyan-100 bg-cyan-50/30 p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">Kết quả kiểm tra</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Nhập kết quả đánh giá và nhận xét tư vấn trước khi chuyển sang học thử.
                    </p>
                  </div>
                  <Badge variant="info">Đã kiểm tra</Badge>
                </div>
                <form onSubmit={handleSaveTestResult} className="space-y-4">
                  <LabeledInput
                    label="Kết quả *"
                    value={testResultForm.result}
                    onChange={(value) => setTestResultForm((form) => ({ ...form, result: value }))}
                    required
                  />
                  <div>
                    <label className="text-sm text-slate-500">Nhận xét</label>
                    <textarea
                      className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      value={testResultForm.notes}
                      onChange={(event) => setTestResultForm((form) => ({ ...form, notes: event.target.value }))}
                    />
                  </div>
                  <div className="flex justify-end border-t border-cyan-100 pt-4">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? 'Đang lưu...' : 'Lưu kết quả kiểm tra'}
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {(primaryOpportunity?.status === 'TRIAL_DONE' || showWonForm) && (
              <Card className="border-indigo-100 bg-indigo-50/30 p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-900">Xếp lớp học thử</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Chọn lớp để đưa học sinh vào lớp học thử. Trạng thái học sinh sẽ là Học thử.
                    </p>
                  </div>
                  <Badge variant="primary">Đã học thử</Badge>
                </div>
                <form onSubmit={handleAssignTrialClass} className="space-y-4">
                  <ClassSelect
                    label="Lớp học thử *"
                    value={trialClassId}
                    classes={classesForLead}
                    onChange={setTrialClassId}
                    required
                  />
                  <div className="flex justify-end border-t border-indigo-100 pt-4">
                    <Button type="submit" disabled={isSaving || !trialClassId}>
                      {isSaving ? 'Đang lưu...' : 'Xếp lớp học thử'}
                    </Button>
                  </div>
                </form>

                <form onSubmit={handleMarkWon} className="mt-6 space-y-4 border-t border-indigo-100 pt-5">
                  <h4 className="text-sm font-semibold text-slate-700">Chốt thành công</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <ConfigSelect
                      label="Trung tâm chính thức"
                      value={wonForm.centerId}
                      options={availableCenters.map((c) => `${c.id}|${c.name} (${c.code})`)}
                      onChange={(val) => setWonForm((prev) => ({ ...prev, centerId: val.split('|')[0] }))}
                      valueResolver={(opt) => opt.split('|')[0]}
                      labelResolver={(opt) => opt.split('|')[1]}
                    />
                    <ClassSelect
                      label="Lớp chính thức"
                      value={wonForm.classId}
                      classes={classes}
                      onChange={(value) => setWonForm((form) => ({ ...form, classId: value }))}
                      emptyLabel="Pending - Chờ xếp lớp"
                    />
                    <LabeledInput
                      label="Gia NY"
                      type="number"
                      value={wonForm.amount}
                      onChange={(value) => setWonForm((form) => ({ ...form, amount: value }))}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-2">
                    <ConfigSelect
                      label="San pham"
                      value={wonForm.productName}
                      options={productOptions}
                      onChange={(value) =>
                        setWonForm((form) => ({
                          ...form,
                          productName: value,
                          productRank: '',
                          feePackage: '',
                          unitPrice: '',
                          contractedSessions: '',
                          discountPercent: '',
                          amount: '',
                        }))
                      }
                    />
                    <ConfigSelect
                      label="Hang"
                      value={wonForm.productRank}
                      options={rankOptions}
                      onChange={(value) =>
                        setWonForm((form) => ({
                          ...form,
                          productRank: value,
                          feePackage: '',
                          unitPrice: '',
                          contractedSessions: '',
                          discountPercent: '',
                          amount: '',
                        }))
                      }
                    />
                    <ConfigSelect
                      label="Goi phi"
                      value={wonForm.feePackage}
                      options={feePackageOptions}
                      onChange={(value) =>
                        setWonForm((form) => ({
                          ...form,
                          feePackage: value,
                          unitPrice: '',
                          contractedSessions: '',
                          discountPercent: '',
                          amount: '',
                        }))
                      }
                    />
                    <LabeledInput
                      label="Don gia/buoi"
                      type="number"
                      value={wonForm.unitPrice}
                      onChange={(value) => setWonForm((form) => ({ ...form, unitPrice: value }))}
                    />
                    <LabeledInput
                      label="CK%"
                      value={wonForm.discountPercent}
                      onChange={(value) => setWonForm((form) => ({ ...form, discountPercent: value }))}
                    />
                    <LabeledInput
                      label="So buoi"
                      type="number"
                      value={wonForm.contractedSessions}
                      onChange={(value) => setWonForm((form) => ({ ...form, contractedSessions: value }))}
                    />
                    <ConfigSelect
                      label="Phan khuc CK"
                      value={wonForm.discountSegmentCode}
                      options={discountSegments.map((item: any) => `${item.code}|${item.name}`)}
                      onChange={(value) =>
                        setWonForm((form) => ({
                          ...form,
                          discountSegmentCode: value.split('|')[0] || '',
                        }))
                      }
                      emptyLabel="Khong ap dung"
                      valueResolver={(option) => option.split('|')[0]}
                      labelResolver={(option) => option.replace('|', ' - ')}
                    />
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-sm font-semibold text-slate-700">Khuyen mai active</p>
                    {activePromotions.length ? (
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {activePromotions.map((item: any) => (
                          <label key={item.code} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={wonForm.promotionCodes.includes(item.code)}
                              onChange={(event) => toggleWonPromotion(item.code, event.target.checked)}
                            />
                            <span>{item.code} - {item.name}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">Chưa có khuyến mãi đang áp dụng.</p>
                    )}
                  </div>
                  <div className="rounded-lg border border-indigo-100 bg-white p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Giá sau cấu hình (Thực đóng)</p>
                        <p className="mt-1 text-xl font-bold text-indigo-600">
                          {formatMoney(configuredFinalAmount)}
                        </p>
                      </div>
                      {isWonQuoteLoading ? <span className="text-slate-400">Đang tính...</span> : null}
                    </div>
                    {wonQuoteError ? (
                      <p className="mt-2 text-red-600">{wonQuoteError}</p>
                    ) : wonQuote ? (
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
                        <div>
                          <span className="text-slate-500">Giá niêm yết</span>
                          <div className="font-semibold">{formatMoney(configuredListPrice)}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Giảm CK%</span>
                          <div className="font-semibold">{formatMoney(configuredBaseDiscount)}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Khuyến mãi</span>
                          <div className="font-semibold">{formatMoney(configuredPromotionDiscount)}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Tổng giảm</span>
                          <div className="font-semibold">{formatMoney(configuredTotalDiscount)}</div>
                        </div>
                        <div>
                          <span className="text-slate-500">Giá thực đóng</span>
                          <div className="font-semibold text-emerald-700">{formatMoney(configuredFinalAmount)}</div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSaving || Boolean(wonQuoteError)}>
                      {isSaving ? 'Đang chốt...' : 'Chốt và chuyển học sinh hoạt động'}
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            {primaryOpportunity?.status === 'WON' && salesHandover && (
              <Card className="border-emerald-100 bg-emerald-50/30 p-6">
                <div className="mb-5 flex flex-col gap-3 border-b border-emerald-100 pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">Sales Handover sau chốt</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Checklist B01-B05 theo SIPOC Phòng Kinh doanh: hồ sơ, thu phí, xếp lịch, bàn giao đào tạo và welcome/add nhóm.
                    </p>
                  </div>
                  <Badge variant={salesHandover.status === 'COMPLETED' ? 'success' : 'info'}>
                    {salesHandover.status === 'COMPLETED' ? 'Hoàn tất' : 'Đang bàn giao'}
                  </Badge>
                </div>

                <form onSubmit={handleSaveSalesHandover} className="space-y-5">
                  <HandoverSection
                    code="B01"
                    title="Xác nhận chốt & hồ sơ học viên"
                    description="Xác nhận gói học, mục tiêu, thông tin học viên/phụ huynh, kênh liên hệ và ghi chú học thuật."
                  >
                    <HandoverCheckbox
                      label="Hồ sơ đủ để vào học"
                      checked={salesHandover.profileConfirmed}
                      onChange={(checked) => setSalesHandover((form) => form && { ...form, profileConfirmed: checked })}
                    />
                    <HandoverTextarea
                      label="Ghi chú hồ sơ"
                      value={salesHandover.profileNotes}
                      onChange={(value) => setSalesHandover((form) => form && { ...form, profileNotes: value })}
                    />
                  </HandoverSection>

                  <HandoverSection
                    code="B02"
                    title="Phối hợp kế toán"
                    description="Gửi hướng dẫn thanh toán, theo dõi trạng thái thu phí và xác nhận biên nhận."
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <HandoverCheckbox
                        label="Đã gửi hướng dẫn thanh toán"
                        checked={salesHandover.paymentGuideSent}
                        onChange={(checked) => setSalesHandover((form) => form && { ...form, paymentGuideSent: checked })}
                      />
                      <HandoverCheckbox
                        label="Đã xác nhận biên nhận/thu phí"
                        checked={salesHandover.paymentReceiptConfirmed}
                        onChange={(checked) => setSalesHandover((form) => form && { ...form, paymentReceiptConfirmed: checked })}
                      />
                    </div>
                    <HandoverTextarea
                      label="Ghi chú thu phí"
                      value={salesHandover.paymentNotes}
                      onChange={(value) => setSalesHandover((form) => form && { ...form, paymentNotes: value })}
                    />
                  </HandoverSection>

                  <HandoverSection
                    code="B03"
                    title="Phối hợp xếp lịch"
                    description="Ghi nhận ca học mong muốn, gửi yêu cầu xếp lịch và xác nhận lịch học với phụ huynh/học viên."
                  >
                    <HandoverTextarea
                      label="Ca học mong muốn"
                      value={salesHandover.schedulePreference}
                      onChange={(value) => setSalesHandover((form) => form && { ...form, schedulePreference: value })}
                    />
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <HandoverCheckbox
                        label="Đã gửi yêu cầu xếp lịch"
                        checked={salesHandover.scheduleRequested}
                        onChange={(checked) => setSalesHandover((form) => form && { ...form, scheduleRequested: checked })}
                      />
                      <HandoverCheckbox
                        label="Đã xác nhận lịch học"
                        checked={salesHandover.scheduleConfirmed}
                        onChange={(checked) => setSalesHandover((form) => form && { ...form, scheduleConfirmed: checked })}
                      />
                    </div>
                    <HandoverTextarea
                      label="Ghi chú xếp lịch"
                      value={salesHandover.scheduleNotes}
                      onChange={(value) => setSalesHandover((form) => form && { ...form, scheduleNotes: value })}
                    />
                  </HandoverSection>

                  <HandoverSection
                    code="B04"
                    title="Bàn giao đào tạo"
                    description="Bàn giao level, mục tiêu, kết quả test/học thử, tính cách học viên và các lưu ý tư vấn."
                  >
                    <HandoverCheckbox
                      label="Đã gửi bàn giao chuyên môn cho đào tạo"
                      checked={salesHandover.academicHandoverSent}
                      onChange={(checked) => setSalesHandover((form) => form && { ...form, academicHandoverSent: checked })}
                    />
                    <HandoverTextarea
                      label="Ghi chú bàn giao đào tạo"
                      value={salesHandover.academicNotes}
                      onChange={(value) => setSalesHandover((form) => form && { ...form, academicNotes: value })}
                    />
                  </HandoverSection>

                  <HandoverSection
                    code="B05"
                    title="Welcome + add nhóm"
                    description="Gửi welcome, nội quy, lịch học, quy định nghỉ/bù, tạo/add nhóm Zalo/Facebook và xác nhận phụ huynh đã nắm kênh liên hệ."
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <HandoverCheckbox
                        label="Đã gửi welcome/nội quy/lịch học"
                        checked={salesHandover.welcomeSent}
                        onChange={(checked) => setSalesHandover((form) => form && { ...form, welcomeSent: checked })}
                      />
                      <HandoverCheckbox
                        label="Đã add nhóm lớp/nhóm thông báo"
                        checked={salesHandover.groupsAdded}
                        onChange={(checked) => setSalesHandover((form) => form && { ...form, groupsAdded: checked })}
                      />
                      <HandoverCheckbox
                        label="Đã tạo nhóm Zalo phụ huynh"
                        checked={salesHandover.zaloGroupCreated}
                        onChange={(checked) => setSalesHandover((form) => form && { ...form, zaloGroupCreated: checked })}
                      />
                      <HandoverCheckbox
                        label="Phụ huynh đã xác nhận nhận thông tin"
                        checked={salesHandover.parentConfirmed}
                        onChange={(checked) => setSalesHandover((form) => form && { ...form, parentConfirmed: checked })}
                      />
                    </div>
                    <HandoverTextarea
                      label="Ghi chú welcome/add nhóm"
                      value={salesHandover.welcomeNotes}
                      onChange={(value) => setSalesHandover((form) => form && { ...form, welcomeNotes: value })}
                    />
                  </HandoverSection>

                  <div className="flex justify-end border-t border-emerald-100 pt-4">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? 'Đang lưu...' : 'Lưu checklist bàn giao'}
                    </Button>
                  </div>
                </form>
              </Card>
            )}

            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <History size={18} className="text-purple-500" /> Lịch sử tương tác
                </h3>
                <Badge variant="info">{leadStatusLabels[lead.status] || lead.status}</Badge>
              </div>

              <div className="space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                {lead.interactions?.map((interaction: any) => (
                  <div key={interaction.id} className="pl-8 relative">
                    <div className="absolute left-[9px] top-2 w-2 h-2 rounded-full bg-slate-400 ring-4 ring-white" />
                    <div className="bg-slate-50/50 rounded-lg p-4 border border-slate-100">
                      <div className="flex justify-between items-start gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {interaction.type}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(interaction.timestamp).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openEditInteractionModal(interaction)}
                          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-blue-600"
                          aria-label="Sửa tương tác"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                      <p className="text-sm text-slate-700">{interaction.content}</p>
                      <p className="text-[10px] text-slate-400 mt-2 italic">
                        Người ghi nhận: {interaction.actor?.fullName || 'Không rõ'}
                      </p>
                    </div>
                  </div>
                ))}
                {lead.interactions?.length === 0 && (
                  <p className="text-sm text-slate-500 pl-8 italic">Chưa có tương tác nào.</p>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <CheckSquare size={18} className="text-orange-500" /> Việc cần theo dõi
                </h3>
                <Button size="sm" variant="secondary" onClick={openCreateTaskModal}>
                  Thêm việc
                </Button>
              </div>

              <div className="space-y-3">
                {lead.tasks?.map((task: any) => {
                  const dueMeta = getTaskDueMeta(task);
                  const priorityMeta = taskPriorityMeta[task.priority] || taskPriorityMeta.MEDIUM;

                  return (
                    <div
                      key={task.id}
                      className={`relative flex items-center gap-4 overflow-hidden rounded-lg border p-3 transition-colors group hover:border-slate-300 ${dueMeta.cardClass}`}
                    >
                      <div className={`absolute inset-y-0 left-0 w-1 ${priorityMeta.stripeClass}`} />
                      <input
                        type="checkbox"
                        className="ml-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-wait"
                        checked={task.status === 'DONE'}
                        disabled={isSaving}
                        onChange={() => handleTaskDoneToggle(task)}
                        aria-label={task.status === 'DONE' ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành'}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${task.status === 'DONE' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                          {task.title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {task.dueDate ? `Hạn: ${new Date(task.dueDate).toLocaleDateString('vi-VN')}` : 'Chưa có hạn'}
                          {task.assignee?.fullName ? ` - Phụ trách: ${task.assignee.fullName}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityMeta.className}`}>
                          {priorityMeta.label}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${dueMeta.badgeClass}`}>
                          {dueMeta.label}
                        </span>
                        <Badge variant={task.status === 'DONE' ? 'success' : 'info'}>
                          {task.status}
                        </Badge>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEditTaskModal(task)}
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-blue-600"
                        aria-label="Sửa việc cần theo dõi"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  );
                })}
                {lead.tasks?.length === 0 && (
                  <p className="text-sm text-slate-500 italic">Chưa có việc cần xử lý.</p>
                )}
              </div>
            </Card>

            <InternalThread entityType="LEAD" entityId={id} />

            <Card className="p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <CheckSquare size={18} className="text-rose-500" /> Phản đối / Khiếu nại
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">Ghi nhận objection về giá, khuyến mại, lịch học, chương trình hoặc trải nghiệm tư vấn.</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setShowIssueModal(true)}>
                  Thêm case
                </Button>
              </div>
              <div className="space-y-3">
                {issues.slice(0, 4).map((issue) => (
                  <div key={issue.id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{issue.title}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getIssuePriorityClass(issue.priority)}`}>
                            {getIssuePriorityLabel(issue.priority)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{getIssueCategoryLabel(issue.category)} • {getIssueStatusLabel(issue.status)}</p>
                        {issue.nextAction && <p className="mt-2 text-xs text-blue-700">Bước xử lý: {issue.nextAction}</p>}
                      </div>
                      {issue.status !== 'RESOLVED' && issue.status !== 'CANCELLED' && (
                        <button type="button" className="text-xs font-semibold text-emerald-700" onClick={() => handleResolveIssue(issue.id)}>
                          Đóng
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!issues.length && <p className="text-sm italic text-slate-400">Chưa có case phản đối/khiếu nại.</p>}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {showEditLeadModal && (
        <Modal title="Chỉnh sửa thông tin tiềm năng" onClose={() => setShowEditLeadModal(false)}>
          <form onSubmit={handleUpdateLeadInfo} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <LabeledInput label="Họ tên phụ huynh" value={leadEditForm.parentName} onChange={(value) => setLeadEditForm((form) => ({ ...form, parentName: value }))} required />
              <LabeledInput label="SĐT phụ huynh" value={leadEditForm.phone} onChange={(value) => setLeadEditForm((form) => ({ ...form, phone: value }))} required />
              <LabeledInput label="Email" value={leadEditForm.email} onChange={(value) => setLeadEditForm((form) => ({ ...form, email: value }))} />
              <LabeledInput label="Địa chỉ" value={leadEditForm.address} onChange={(value) => setLeadEditForm((form) => ({ ...form, address: value }))} />
              <LabeledInput label="Họ tên học sinh" value={leadEditForm.prospectiveStudentName} onChange={(value) => setLeadEditForm((form) => ({ ...form, prospectiveStudentName: value }))} />
              <LabeledInput label="SĐT học sinh" value={leadEditForm.studentPhone} onChange={(value) => setLeadEditForm((form) => ({ ...form, studentPhone: value }))} />
              <LabeledInput label="San pham" value={leadEditForm.productInterest} onChange={(value) => setLeadEditForm((form) => ({ ...form, productInterest: value }))} />
              <LabeledInput label="Trường" value={leadEditForm.school} onChange={(value) => setLeadEditForm((form) => ({ ...form, school: value }))} />
              <LabeledInput label="Lớp/Khối" value={leadEditForm.grade} onChange={(value) => setLeadEditForm((form) => ({ ...form, grade: value }))} />
              <LabeledInput label="Mục tiêu" value={leadEditForm.target} onChange={(value) => setLeadEditForm((form) => ({ ...form, target: value }))} />
              <LabeledInput label="Tên bố" value={leadEditForm.fatherName} onChange={(value) => setLeadEditForm((form) => ({ ...form, fatherName: value }))} />
              <LabeledInput label="SĐT bố" value={leadEditForm.fatherPhone} onChange={(value) => setLeadEditForm((form) => ({ ...form, fatherPhone: value }))} />
              <LabeledInput label="Tên mẹ" value={leadEditForm.motherName} onChange={(value) => setLeadEditForm((form) => ({ ...form, motherName: value }))} />
              <LabeledInput label="SĐT mẹ" value={leadEditForm.motherPhone} onChange={(value) => setLeadEditForm((form) => ({ ...form, motherPhone: value }))} />
            </div>
            <div>
              <label className="text-sm text-slate-500">Ghi chú</label>
              <textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={leadEditForm.notes} onChange={(event) => setLeadEditForm((form) => ({ ...form, notes: event.target.value }))} />
            </div>
            <ModalActions isSaving={isSaving} onCancel={() => setShowEditLeadModal(false)} submitLabel="Lưu thông tin" />
          </form>
        </Modal>
      )}

      {showInteractionModal && (
        <Modal
          title={editingInteractionId ? 'Sửa tương tác' : 'Ghi nhận tương tác'}
          onClose={() => {
            setShowInteractionModal(false);
            setEditingInteractionId(null);
          }}
        >
          <form onSubmit={handleCreateInteraction} className="space-y-4">
            <div>
              <label className="text-sm text-slate-500">Loại tương tác</label>
              <select
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                value={interactionForm.type}
                onChange={(event) => setInteractionForm((form) => ({ ...form, type: event.target.value }))}
              >
                <option value="NOTE">Ghi chú</option>
                <option value="CALL">Cuộc gọi</option>
                <option value="MESSAGE">Tin nhắn</option>
                <option value="MEETING">Gặp trực tiếp</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-500">Nội dung *</label>
              <textarea
                className="mt-1 w-full min-h-28 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                value={interactionForm.content}
                onChange={(event) => setInteractionForm((form) => ({ ...form, content: event.target.value }))}
                required
              />
            </div>
            <ModalActions
              isSaving={isSaving}
              onCancel={() => {
                setShowInteractionModal(false);
                setEditingInteractionId(null);
              }}
              submitLabel={editingInteractionId ? 'Cập nhật tương tác' : 'Lưu tương tác'}
            />
          </form>
        </Modal>
      )}

      {showTaskModal && (
        <Modal
          title={editingTaskId ? 'Sửa việc cần theo dõi' : 'Thêm việc cần theo dõi'}
          onClose={() => {
            setShowTaskModal(false);
            setEditingTaskId(null);
          }}
        >
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div>
              <label className="text-sm text-slate-500">Tiêu đề *</label>
              <input
                className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                value={taskForm.title}
                onChange={(event) => setTaskForm((form) => ({ ...form, title: event.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm text-slate-500">Mô tả</label>
              <textarea
                className="mt-1 w-full min-h-24 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                value={taskForm.description}
                onChange={(event) => setTaskForm((form) => ({ ...form, description: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-500">Hạn xử lý</label>
                <input
                  type="date"
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  value={taskForm.dueDate}
                  onChange={(event) => setTaskForm((form) => ({ ...form, dueDate: event.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-slate-500">Ưu tiên</label>
                <select
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  value={taskForm.priority}
                  onChange={(event) => setTaskForm((form) => ({ ...form, priority: event.target.value }))}
                >
                  <option value="LOW">Thấp</option>
                  <option value="MEDIUM">Trung bình</option>
                  <option value="HIGH">Cao</option>
                </select>
              </div>
            </div>
            <ModalActions
              isSaving={isSaving}
              onCancel={() => {
                setShowTaskModal(false);
                setEditingTaskId(null);
              }}
              submitLabel={editingTaskId ? 'Cập nhật việc' : 'Thêm việc'}
            />
          </form>
        </Modal>
      )}

      {showIssueModal && (
        <Modal title="Thêm phản đối / khiếu nại" onClose={() => setShowIssueModal(false)}>
          <form onSubmit={handleCreateIssue} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm text-slate-500">Loại</label>
                <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={issueForm.type} onChange={(event) => setIssueForm((form) => ({ ...form, type: event.target.value }))}>
                  <option value="OBJECTION">Phản đối tư vấn</option>
                  <option value="COMPLAINT">Khiếu nại</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-500">Nhóm vấn đề</label>
                <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={issueForm.category} onChange={(event) => setIssueForm((form) => ({ ...form, category: event.target.value }))}>
                  {issueCategoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-500">Ưu tiên</label>
                <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={issueForm.priority} onChange={(event) => setIssueForm((form) => ({ ...form, priority: event.target.value }))}>
                  <option value="LOW">Thấp</option>
                  <option value="MEDIUM">Trung bình</option>
                  <option value="HIGH">Cao</option>
                  <option value="URGENT">Khẩn cấp</option>
                </select>
              </div>
            </div>
            <LabeledInput label="Tiêu đề *" value={issueForm.title} onChange={(value) => setIssueForm((form) => ({ ...form, title: value }))} required />
            <div>
              <label className="text-sm text-slate-500">Nội dung</label>
              <textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={issueForm.description} onChange={(event) => setIssueForm((form) => ({ ...form, description: event.target.value }))} />
            </div>
            <div>
              <label className="text-sm text-slate-500">Bước xử lý tiếp theo</label>
              <textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={issueForm.nextAction} onChange={(event) => setIssueForm((form) => ({ ...form, nextAction: event.target.value }))} />
            </div>
            <ModalActions isSaving={isSaving} onCancel={() => setShowIssueModal(false)} submitLabel="Lưu case" />
          </form>
        </Modal>
      )}
    </ModuleBoundary>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      {icon}
      <div>
        <p className="text-xs text-slate-500 uppercase font-bold">{label}</p>
        <p className="text-sm text-slate-900 font-medium">{value}</p>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div>
      <label className="text-sm text-slate-500">{label}</label>
      <input
        type={type}
        className={`mt-1 w-full rounded-lg border ${
          error ? 'border-red-500 ring-1 ring-red-100' : 'border-slate-200'
        } bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function ConfigSelect({
  label,
  value,
  options,
  onChange,
  emptyLabel = 'Chon',
  valueResolver = (option) => option,
  labelResolver = (option) => option,
  error,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  emptyLabel?: string;
  valueResolver?: (option: string) => string;
  labelResolver?: (option: string) => string;
  error?: string;
}) {
  return (
    <div>
      <label className="text-sm text-slate-500">{label}</label>
      <select
        className={`mt-1 w-full rounded-lg border ${
          error ? 'border-red-500 ring-1 ring-red-100' : 'border-slate-200'
        } bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => {
          const optionValue = valueResolver(option);
          return (
            <option key={optionValue || option} value={optionValue}>
              {labelResolver(option)}
            </option>
          );
        })}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

function ClassSelect({
  label,
  value,
  classes,
  onChange,
  required,
  emptyLabel = 'Chọn lớp',
}: {
  label: string;
  value: string;
  classes: Array<{
    id: string;
    name: string;
    code: string;
    center?: { code?: string; name?: string };
    program?: { name?: string };
    capacity?: number;
    _count?: { students: number };
  }>;
  onChange: (value: string) => void;
  required?: boolean;
  emptyLabel?: string;
}) {
  return (
    <div>
      <label className="text-sm text-slate-500">{label}</label>
      <select
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      >
        <option value="">{emptyLabel}</option>
        {classes.map((item) => {
          const current = item._count?.students ?? 0;
          const cap = item.capacity ?? 0;
          const isFull = cap > 0 && current >= cap;

          return (
            <option key={item.id} value={item.id} disabled={isFull}>
              {item.name} ({item.code}) • {item.program?.name || 'No Program'} [{current}/{cap}]
              {isFull ? ' - ĐÃ ĐỦ SĨ SỐ' : ''}
            </option>
          );
        })}
      </select>
    </div>
  );
}

function HandoverSection({
  code,
  title,
  description,
  children,
}: {
  code: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white bg-white/80 p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-3">
        <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
          {code}
        </span>
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function HandoverCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50/60">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function HandoverTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <textarea
        className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Đóng">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ isSaving, onCancel, submitLabel }: { isSaving: boolean; onCancel: () => void; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
      <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
        Hủy
      </Button>
      <Button type="submit" disabled={isSaving}>
        {isSaving ? 'Đang lưu...' : submitLabel}
      </Button>
    </div>
  );
}

const issueCategoryOptions = [
  { value: 'PRICE', label: 'Giá/học phí' },
  { value: 'DISCOUNT', label: 'Chiết khấu' },
  { value: 'PROMOTION', label: 'Khuyến mại' },
  { value: 'PRODUCT_PROGRAM', label: 'Sản phẩm/chương trình' },
  { value: 'SCHEDULE', label: 'Lịch học' },
  { value: 'CLASS_TRANSFER', label: 'Chuyển lớp' },
  { value: 'TEACHER_TRANSFER', label: 'Đổi giáo viên' },
  { value: 'ACADEMIC_QUALITY', label: 'Chất lượng học tập' },
  { value: 'SERVICE_EXPERIENCE', label: 'Trải nghiệm dịch vụ' },
  { value: 'PAYMENT', label: 'Thanh toán' },
  { value: 'FACILITY', label: 'Cơ sở vật chất' },
  { value: 'OTHER', label: 'Khác' },
];

function getIssueCategoryLabel(category: string) {
  return issueCategoryOptions.find((item) => item.value === category)?.label || category;
}

function getIssuePriorityLabel(priority: string) {
  const labels: Record<string, string> = {
    LOW: 'Thấp',
    MEDIUM: 'Trung bình',
    HIGH: 'Cao',
    URGENT: 'Khẩn cấp',
  };
  return labels[priority] || priority;
}

function getIssuePriorityClass(priority: string) {
  if (priority === 'URGENT') return 'bg-red-100 text-red-700';
  if (priority === 'HIGH') return 'bg-rose-100 text-rose-700';
  if (priority === 'MEDIUM') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

function getIssueStatusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: 'Mới mở',
    IN_PROGRESS: 'Đang xử lý',
    RESOLVED: 'Đã xử lý',
    ESCALATED: 'Đã escalated',
    CANCELLED: 'Đã hủy',
  };
  return labels[status] || status;
}
