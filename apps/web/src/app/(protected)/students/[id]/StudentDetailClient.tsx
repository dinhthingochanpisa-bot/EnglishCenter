'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  User,
  GraduationCap,
  FileText,
  MessageSquare,
  ChevronLeft,
  Calendar,
  CheckCircle2,
  Trophy,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ClipboardList,
  Clock,
  Mail,
  Phone,
  MapPin,
  Plus,
  Pencil,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuditTrail } from '@/components/common/AuditTrail';

type Tab = 'info' | 'contracts' | 'academic' | 'care' | 'exam' | 'issues' | 'notes';

const parseScoreInput = (value: string) => {
  const normalizedValue = value.trim().replace(',', '.');
  if (!normalizedValue) return undefined;

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : Number.NaN;
};

const isHalfStepScore = (value?: number) => {
  if (value === undefined) return true;
  return Math.abs(value * 2 - Math.round(value * 2)) < 1e-9;
};

export default function StudentDetailClient({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [student, setStudent] = useState<any>(null);
  const [academic, setAcademic] = useState<any>(null);
  const [care, setCare] = useState<any>(null);
  const [examJourney, setExamJourney] = useState<any>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCareModal, setShowCareModal] = useState(false);
  const [showExamModal, setShowExamModal] = useState(false);
  const [showWarrantyModal, setShowWarrantyModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]);
  const [editForm, setEditForm] = useState({
    fullName: '',
    birthday: '',
    gender: 'OTHER',
    status: 'ACTIVE',
    currentGrade: '',
    school: '',
    target: '',
    aim: '',
    expectedExamTime: '',
    studentPhone: '',
    address: '',
    notes: '',
    parentFullName: '',
    parentPhone: '',
    parentEmail: '',
    parentRelationship: 'Phụ huynh',
    parentAddress: '',
  });
  const [resultForm, setResultForm] = useState({
    type: 'PLACEMENT',
    score: '',
    date: new Date().toISOString().slice(0, 10),
    comments: '',
  });
  const [careForm, setCareForm] = useState({
    type: 'FIRST_LESSON',
    title: '',
    content: '',
    actionPlan: '',
    riskLevel: 'MEDIUM',
    dueDate: '',
  });
  const [examForm, setExamForm] = useState({
    type: 'MOCK_TEST',
    scheduledAt: new Date().toISOString().slice(0, 10),
    score: '',
    targetScore: '',
    notes: '',
    actionPlan: '',
    markCompleted: true,
    registrationStatus: 'NOT_STARTED',
    examFeeConfirmed: false,
    documentsChecked: false,
    reminderTMinus7Sent: false,
    reminderTMinus3Sent: false,
    reminderTMinus1Sent: false,
    arrivalConfirmed: false,
    registrationNotes: '',
  });
  const [warrantyForm, setWarrantyForm] = useState({
    contractId: '',
    examEventId: '',
    reason: '',
    plan: '',
    dueDate: '',
  });
  const [renewalForm, setRenewalForm] = useState({
    planId: '',
    amount: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    notes: '',
  });
  const [issueForm, setIssueForm] = useState({
    type: 'COMPLAINT',
    category: 'SERVICE_EXPERIENCE',
    priority: 'MEDIUM',
    title: '',
    description: '',
    nextAction: '',
    dueDate: '',
  });
  const router = useRouter();
  const renewalPlans = programs.flatMap((program) =>
    (program.plans || []).map((plan: any) => ({ ...plan, program })),
  );
  const studentContracts = student?.contracts?.length ? student.contracts : examJourney?.contracts || [];
  const activeStudentContract = studentContracts.find((contract: any) => contract.status === 'ACTIVE') || studentContracts[0] || null;
  const warrantyContractOptions = studentContracts.length ? studentContracts : examJourney?.contracts || [];
  const activeContractCount = studentContracts.filter((contract: any) => contract.status === 'ACTIVE').length;
  const totalContractValue = studentContracts.reduce((sum: number, contract: any) => sum + Number(contract.finalAmount || 0), 0);
  const totalPaidAmount = studentContracts.reduce((sum: number, contract: any) => sum + getContractPaidAmount(contract), 0);
  const totalDebtAmount = studentContracts.reduce((sum: number, contract: any) => sum + getContractDebtAmount(contract), 0);
  const primaryRelation = student?.relations?.find((rel: any) => rel.isPrimaryContact) || student?.relations?.[0] || null;

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [sResp, aResp, careResp, examResp, issueResp] = await Promise.all([
        apiFetch(`/students/${id}`),
        apiFetch(`/academic/assessments/student/${id}`).catch(() => ({ results: [], notes: [] })),
        apiFetch(`/students/${id}/care-timeline`).catch(() => ({ summary: {}, timeline: [] })),
        apiFetch(`/students/${id}/exam-journey`).catch(() => ({ summary: {}, examEvents: [], warrantyCases: [], contracts: [] })),
        apiFetch(`/students/${id}/issues`).catch(() => []),
      ]);
      setStudent(sResp);
      setAcademic(aResp);
      setCare(careResp);
      setExamJourney(examResp);
      setIssues(issueResp);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    apiFetch('/academic/programs')
      .then(setPrograms)
      .catch(() => setPrograms([]));
  }, [id]);

  const openEditModal = () => {
    setEditForm({
      fullName: student.fullName || '',
      birthday: student.birthday ? new Date(student.birthday).toISOString().slice(0, 10) : '',
      gender: student.gender || 'OTHER',
      status: student.status || 'ACTIVE',
      currentGrade: student.currentGrade || '',
      school: student.school || '',
      target: student.target || '',
      aim: student.aim || '',
      expectedExamTime: student.expectedExamTime || '',
      studentPhone: student.studentPhone || '',
      address: student.address || '',
      notes: student.notes || '',
      parentFullName: primaryRelation?.parent?.fullName || '',
      parentPhone: primaryRelation?.parent?.phone || '',
      parentEmail: primaryRelation?.parent?.email || '',
      parentRelationship: primaryRelation?.relationship || 'Phụ huynh',
      parentAddress: primaryRelation?.parent?.address || '',
    });
    setShowEditModal(true);
  };

  const handleUpdateStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/students/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...editForm,
          primaryParent: {
            fullName: editForm.parentFullName,
            phone: editForm.parentPhone,
            email: editForm.parentEmail,
            relationship: editForm.parentRelationship,
            address: editForm.parentAddress,
          },
        }),
      });
      setShowEditModal(false);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Không thể cập nhật thông tin học sinh');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateAcademicResult = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch('/academic/assessments/results', {
        method: 'POST',
        body: JSON.stringify({
          studentId: id,
          type: resultForm.type,
          score: Number(resultForm.score),
          date: resultForm.date,
          comments: resultForm.comments.trim() || undefined,
        }),
      });
      setResultForm({ type: 'PLACEMENT', score: '', date: new Date().toISOString().slice(0, 10), comments: '' });
      setShowResultModal(false);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Không thể lưu kết quả học tập');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCareEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/students/${id}/care-timeline`, {
        method: 'POST',
        body: JSON.stringify({
          type: careForm.type,
          title: careForm.title.trim() || undefined,
          content: careForm.content.trim() || undefined,
          actionPlan: careForm.actionPlan.trim() || undefined,
          riskLevel: careForm.type === 'RISK_WARNING' ? careForm.riskLevel : undefined,
          dueDate: careForm.dueDate || undefined,
        }),
      });
      setCareForm({ type: 'FIRST_LESSON', title: '', content: '', actionPlan: '', riskLevel: 'MEDIUM', dueDate: '' });
      setShowCareModal(false);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Không thể lưu timeline chăm sóc');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResolveCareEvent = async (eventId: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/students/${id}/care-timeline/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'RESOLVED' }),
      });
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Không thể đóng cảnh báo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateExamEvent = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const score = parseScoreInput(examForm.score);
    const targetScore = parseScoreInput(examForm.targetScore);
    if (
      Number.isNaN(score) ||
      Number.isNaN(targetScore) ||
      !isHalfStepScore(score) ||
      !isHalfStepScore(targetScore)
    ) {
      setError('Diem thi va muc tieu phai la so theo buoc 0.5.');
      return;
    }

    setIsSaving(true);
    try {
      await apiFetch(`/students/${id}/exam-events`, {
        method: 'POST',
        body: JSON.stringify({
          type: examForm.type,
          scheduledAt: examForm.scheduledAt,
          score,
          targetScore,
          notes: examForm.notes.trim() || undefined,
          actionPlan: examForm.actionPlan.trim() || undefined,
          markCompleted: examForm.markCompleted,
          registrationStatus: examForm.type === 'REAL_EXAM' ? examForm.registrationStatus : undefined,
          examFeeConfirmed: examForm.type === 'REAL_EXAM' ? examForm.examFeeConfirmed : undefined,
          documentsChecked: examForm.type === 'REAL_EXAM' ? examForm.documentsChecked : undefined,
          reminderTMinus7Sent: examForm.type === 'REAL_EXAM' ? examForm.reminderTMinus7Sent : undefined,
          reminderTMinus3Sent: examForm.type === 'REAL_EXAM' ? examForm.reminderTMinus3Sent : undefined,
          reminderTMinus1Sent: examForm.type === 'REAL_EXAM' ? examForm.reminderTMinus1Sent : undefined,
          arrivalConfirmed: examForm.type === 'REAL_EXAM' ? examForm.arrivalConfirmed : undefined,
          registrationNotes: examForm.type === 'REAL_EXAM' ? examForm.registrationNotes.trim() || undefined : undefined,
          contractId: activeStudentContract?.id || undefined,
        }),
      });
      setShowExamModal(false);
      setExamForm({
        type: 'MOCK_TEST',
        scheduledAt: new Date().toISOString().slice(0, 10),
        score: '',
        targetScore: '',
        notes: '',
        actionPlan: '',
        markCompleted: true,
        registrationStatus: 'NOT_STARTED',
        examFeeConfirmed: false,
        documentsChecked: false,
        reminderTMinus7Sent: false,
        reminderTMinus3Sent: false,
        reminderTMinus1Sent: false,
        arrivalConfirmed: false,
        registrationNotes: '',
      });
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Không thể lưu kết quả thi');
    } finally {
      setIsSaving(false);
    }
  };

  const openWarrantyModal = (examEvent?: any) => {
    setWarrantyForm({
      contractId: activeStudentContract?.id || '',
      examEventId: examEvent?.id || '',
      reason: examEvent?.outcome === 'BELOW_TARGET' ? 'Học viên chưa đạt mục tiêu sau kỳ thi thật.' : '',
      plan: '',
      dueDate: '',
    });
    setShowWarrantyModal(true);
  };

  const handleCreateWarrantyCase = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/students/${id}/warranty-cases`, {
        method: 'POST',
        body: JSON.stringify({
          contractId: warrantyForm.contractId || undefined,
          examEventId: warrantyForm.examEventId || undefined,
          reason: warrantyForm.reason.trim(),
          plan: warrantyForm.plan.trim() || undefined,
          dueDate: warrantyForm.dueDate || undefined,
        }),
      });
      setShowWarrantyModal(false);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Không thể tạo hồ sơ bảo hành');
    } finally {
      setIsSaving(false);
    }
  };

  const openRenewalModal = () => {
    const firstPlan = renewalPlans[0];
    setRenewalForm({
      planId: firstPlan?.id || '',
      amount: firstPlan?.price ? String(firstPlan.price) : '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      notes: '',
    });
    setShowRenewalModal(true);
  };

  const handleCreateRenewal = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/students/${id}/renewals/complete`, {
        method: 'POST',
        body: JSON.stringify({
          contractId: activeStudentContract?.id || undefined,
          planId: renewalForm.planId,
          amount: renewalForm.amount === '' ? undefined : Number(renewalForm.amount),
          startDate: renewalForm.startDate || undefined,
          endDate: renewalForm.endDate || undefined,
          notes: renewalForm.notes.trim() || 'Tái ký từ luồng thi thật / hậu khóa học.',
        }),
      });
      setShowRenewalModal(false);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Không thể hoàn tất tái ký');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateIssue = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/students/${id}/issues`, {
        method: 'POST',
        body: JSON.stringify({
          ...issueForm,
          title: issueForm.title.trim(),
          description: issueForm.description.trim() || undefined,
          nextAction: issueForm.nextAction.trim() || undefined,
          dueDate: issueForm.dueDate || undefined,
        }),
      });
      setIssueForm({
        type: 'COMPLAINT',
        category: 'SERVICE_EXPERIENCE',
        priority: 'MEDIUM',
        title: '',
        description: '',
        nextAction: '',
        dueDate: '',
      });
      setShowIssueModal(false);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Không thể lưu phản hồi/khiếu nại');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResolveIssue = async (issueId: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/students/${id}/issues/${issueId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'RESOLVED', resolution: 'Đã xử lý và đóng case.' }),
      });
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Không thể đóng phản hồi/khiếu nại');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 gap-3">
      <Loader2 className="animate-spin" size={40} />
      <p className="font-medium">Đang tải hồ sơ học sinh...</p>
    </div>
  );

  if (error || !student) return (
    <div className="p-10 text-center">
      <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
      <h2 className="text-xl font-bold text-slate-900 mb-2">Lỗi tải hồ sơ</h2>
      <p className="text-slate-500 mb-6">{error || 'Không tìm thấy học sinh'}</p>
      <Button onClick={() => router.back()}>Quay lại</Button>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Link href="/students">
          <Button variant="ghost" size="sm" className="p-2 h-auto rounded-full hover:bg-slate-100">
            <ChevronLeft size={20} />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{student.fullName}</h1>
            <Badge variant="outline" className="font-bold uppercase tracking-widest">{getStudentStatusLabel(student.status)}</Badge>
          </div>
          <p className="text-sm text-slate-500 font-medium">Mã học sinh: {student.code} • {student.center?.name}</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={openEditModal}>
          <Pencil size={16} /> Chỉnh sửa
        </Button>
      </div>

      <div className="flex border-b border-slate-200">
        {[
          { id: 'info', label: 'Thông tin chung', icon: User },
          { id: 'contracts', label: 'Hợp đồng & HP', icon: FileText },
          { id: 'academic', label: 'Học tập', icon: GraduationCap },
          { id: 'care', label: 'Chăm sóc', icon: ClipboardList },
          { id: 'exam', label: 'Thi & Gia hạn', icon: Trophy },
          { id: 'issues', label: 'Phản hồi', icon: AlertTriangle },
          { id: 'notes', label: 'Nhật ký & Feedback', icon: MessageSquare },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all relative ${
              activeTab === tab.id ? 'text-primary' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === 'info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 space-y-6">
               <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Thông tin cá nhân</h3>
               <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar size={16} className="text-slate-400" />
                    <span className="text-slate-500 w-24">Ngày sinh:</span>
                    <span className="font-medium text-slate-700">{student.birthday ? new Date(student.birthday).toLocaleDateString('vi-VN') : 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <User size={16} className="text-slate-400" />
                    <span className="text-slate-500 w-24">Giới tính:</span>
                    <span className="font-medium text-slate-700">{student.gender}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <GraduationCap size={16} className="text-slate-400" />
                    <span className="text-slate-500 w-24">Trường/lớp:</span>
                    <span className="font-medium text-slate-700">{[student.currentGrade, student.school].filter(Boolean).join(' - ') || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Trophy size={16} className="text-slate-400" />
                    <span className="text-slate-500 w-24">Mục tiêu:</span>
                    <span className="font-medium text-slate-700">{student.aim || student.target || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar size={16} className="text-slate-400" />
                    <span className="text-slate-500 w-24">Tháng thi:</span>
                    <span className="font-medium text-slate-700">{student.expectedExamTime || student.examMonth || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone size={16} className="text-slate-400" />
                    <span className="text-slate-500 w-24">SĐT HS:</span>
                    <span className="font-medium text-slate-700">{student.studentPhone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin size={16} className="text-slate-400" />
                    <span className="text-slate-500 w-24">Địa chỉ:</span>
                    <span className="font-medium text-slate-700">{student.address || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <FileText size={16} className="text-slate-400" />
                    <span className="text-slate-500 w-24">Sản phẩm:</span>
                    <span className="font-medium text-slate-700">{[student.productName, student.productRank, student.feePackage].filter(Boolean).join(' - ') || 'N/A'}</span>
                  </div>
               </div>
            </Card>

            <div className="space-y-6">
              <Card className="p-6 space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Liên hệ & Phụ huynh</h3>
                {student.relations?.map((rel: any) => (
                    <div key={rel.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                      <div className="flex justify-between items-center">
                          <p className="text-sm font-bold text-slate-900">{rel.parent.fullName}</p>
                          <Badge variant="secondary" className="text-[10px]">{rel.relationship}</Badge>
                      </div>
                      <div className="flex flex-col gap-1">
                          <p className="text-xs text-slate-500 flex items-center gap-2"><Phone size={12} /> {rel.parent.phone}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-2"><Mail size={12} /> {rel.parent.email}</p>
                      </div>
                    </div>
                ))}
              </Card>

              <Card className="p-6 space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Anh/chị/em ruột</h3>
                <div className="space-y-4">
                    {student.siblings?.map((sib: any) => (
                      <Link key={sib.id} href={`/students/${sib.id}`} className="block">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-primary/30 hover:bg-white transition-all group">
                          <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                                    {sib.fullName.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">{sib.fullName}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">{sib.code}</p>
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-[9px] uppercase tracking-tighter whitespace-nowrap">
                                {getStudentStatusLabel(sib.status)}
                              </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200/50 text-[11px]">
                              <div className="space-y-1">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Lớp học</p>
                                <p className="font-medium text-slate-700 truncate">{sib.className || 'Chưa vào lớp'}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Sản phẩm</p>
                                <p className="font-medium text-slate-700 truncate">{sib.productName || sib.feePackage || 'N/A'}</p>
                              </div>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                              <p className="text-[9px] text-slate-400 italic">
                                {sib.familyName ? `Cùng gia đình: ${sib.familyName}` : `Chung phụ huynh: ${sib.sharedParentName}`}
                              </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {!student.siblings?.length && (
                      <p className="text-sm text-slate-400 italic py-2">Chưa ghi nhận anh/chị/em ruột tại trung tâm.</p>
                    )}
                </div>
              </Card>
            </div>

            <div className="md:col-span-2">
              <AuditTrail entityType="STUDENT" entityId={id} />
            </div>
          </div>
        )}

        {activeTab === 'contracts' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <CareSummaryCard icon={<FileText size={22} />} label="Tổng hợp đồng" value={`${studentContracts.length}`} tone="blue" />
              <CareSummaryCard icon={<CheckCircle2 size={22} />} label="Đang hiệu lực" value={`${activeContractCount}`} tone={activeContractCount > 0 ? 'green' : 'slate'} />
              <CareSummaryCard icon={<Trophy size={22} />} label="Giá trị HĐ" value={formatCurrency(totalContractValue)} tone="amber" />
              <CareSummaryCard icon={<CheckCircle2 size={22} />} label="Đã thu" value={formatCurrency(totalPaidAmount)} tone="green" />
              <CareSummaryCard icon={<AlertCircle size={22} />} label="Còn nợ" value={formatCurrency(totalDebtAmount)} tone={totalDebtAmount > 0 ? 'rose' : 'green'} />
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Hợp đồng của học sinh</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Dữ liệu này dùng cùng bảng Contract với trang quản lý hợp đồng và được tải từ hồ sơ học sinh.
                </p>
              </div>
              <Link href="/academic/contracts">
                <Button variant="secondary" className="gap-2">
                  <FileText size={16} /> Mở quản lý hợp đồng
                </Button>
              </Link>
            </div>

            {studentContracts.length === 0 ? (
              <Card className="p-10 text-center text-slate-400">
                <FileText size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-sm">Chưa có hợp đồng nào được map với học sinh này.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {studentContracts.map((contract: any) => (
                  <Card key={contract.id} className="p-6">
                    <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-base font-black text-slate-900">{contract.code}</p>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${getContractStatusClass(contract.status)}`}>
                            {getContractStatusLabel(contract.status)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-semibold text-slate-700">{getContractProductLabel(contract)}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {contract.center?.name || student.center?.name || 'N/A'}
                          {contract.salesperson?.fullName ? ` • TVV: ${contract.salesperson.fullName}` : ''}
                        </p>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Giá trị sau CK</p>
                        <p className="text-xl font-black text-slate-900">{formatCurrency(contract.finalAmount)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Đã thu {formatCurrency(getContractPaidAmount(contract))} • Còn nợ {formatCurrency(getContractDebtAmount(contract))}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
                      <ContractInfoItem label="Ngày bắt đầu" value={contract.startDate ? new Date(contract.startDate).toLocaleDateString('vi-VN') : 'N/A'} />
                      <ContractInfoItem label="Ngày kết thúc" value={contract.endDate ? new Date(contract.endDate).toLocaleDateString('vi-VN') : 'N/A'} />
                      <ContractInfoItem label="Loại hợp đồng" value={contract.contractType || 'N/A'} />
                      <ContractInfoItem label="Số buổi" value={contract.contractedSessions || contract.totalLearningSessions || 'N/A'} />
                    </div>

                    {contract.details?.length > 0 && (
                      <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Gói học</p>
                        <div className="mt-3 space-y-2">
                          {contract.details.map((detail: any) => (
                            <div key={detail.id} className="flex flex-col gap-1 text-sm md:flex-row md:items-center md:justify-between">
                              <span className="font-semibold text-slate-700">{detail.plan?.program?.name || detail.plan?.name || 'N/A'}{detail.plan?.name ? ` - ${detail.plan.name}` : ''}</span>
                              <span className="text-slate-500">{detail.quantity || 1} x {formatCurrency(detail.unitPrice)} = {formatCurrency(detail.totalPrice)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {contract.paymentSchedule?.length > 0 && (
                      <div className="mt-5 rounded-xl border border-slate-100 p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Lịch thanh toán</p>
                        <div className="mt-3 divide-y divide-slate-100">
                          {contract.paymentSchedule.map((schedule: any) => (
                            <div key={schedule.id} className="grid grid-cols-1 gap-2 py-3 text-sm md:grid-cols-4">
                              <span className="font-medium text-slate-700">{schedule.dueDate ? new Date(schedule.dueDate).toLocaleDateString('vi-VN') : 'N/A'}</span>
                              <span className="text-slate-500">Phải thu: {formatCurrency(schedule.amount)}</span>
                              <span className="text-slate-500">Đã thu: {formatCurrency(schedule.paidAmount)}</span>
                              <span className="font-semibold text-slate-700">{getPaymentScheduleStatusLabel(schedule.status)} • còn {formatCurrency(schedule.remainingAmount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'academic' && (
          <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-5 flex items-center gap-4 border-l-4 border-l-primary">
                   <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <GraduationCap size={24} />
                   </div>
                   <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lớp học hiện tại</p>
                      <p className="text-lg font-bold text-slate-900">1 Lớp</p>
                   </div>
                </Card>
                <Card className="p-5 flex items-center gap-4 border-l-4 border-l-green-500">
                   <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                      <CheckCircle2 size={24} />
                   </div>
                   <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tỷ lệ chuyên cần</p>
                      <p className="text-lg font-bold text-slate-900">95%</p>
                   </div>
                </Card>
                <Card className="p-5 flex items-center gap-4 border-l-4 border-l-amber-500">
                   <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Trophy size={24} />
                   </div>
                   <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Điểm trung bình</p>
                      <p className="text-lg font-bold text-slate-900">8.5</p>
                   </div>
                </Card>
             </div>

             <Card className="p-6">
                <div className="mb-6 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Kết quả học tập (Assessment)</h3>
                  <Button size="sm" className="gap-2" onClick={() => setShowResultModal(true)}>
                    <Plus size={16} /> Nhập kết quả
                  </Button>
                </div>
                <div className="space-y-4">
                   {academic?.results?.map((res: any) => (
                      <div key={res.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold">
                               {res.type?.charAt(0)}
                            </div>
                            <div>
                               <p className="text-sm font-bold text-slate-900">{getAcademicResultTypeLabel(res.type)}</p>
                               <p className="text-xs text-slate-500">{res.class?.name || 'Global'}</p>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="text-lg font-black text-primary">{res.score}</p>
                            <p className="text-[10px] text-slate-400">{new Date(res.date).toLocaleDateString('vi-VN')}</p>
                         </div>
                      </div>
                   ))}
                   {!academic?.results?.length && (
                      <p className="text-sm text-slate-400 italic py-10 text-center">Chưa có kết quả học tập.</p>
                   )}
                </div>
             </Card>
          </div>
        )}

        {activeTab === 'care' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <CareSummaryCard icon={<GraduationCap size={22} />} label="Lớp hiện tại" value={care?.summary?.currentClass?.name || 'Chưa xếp lớp'} tone="blue" />
              <CareSummaryCard icon={<CheckCircle2 size={22} />} label="Tỷ lệ chuyên cần" value={care?.summary?.attendanceRate == null ? 'N/A' : `${care.summary.attendanceRate}%`} tone={(care?.summary?.attendanceRate ?? 100) < 80 ? 'amber' : 'green'} />
              <CareSummaryCard icon={<Clock size={22} />} label="Vắng / đi muộn" value={`${care?.summary?.absentCount || 0} vắng, ${care?.summary?.lateCount || 0} muộn`} tone={(care?.summary?.absentCount || 0) > 0 ? 'amber' : 'slate'} />
              <CareSummaryCard icon={<AlertTriangle size={22} />} label="Cảnh báo mở" value={`${care?.summary?.openRisks || 0}`} tone={(care?.summary?.openRisks || 0) > 0 ? 'rose' : 'green'} />
            </div>

            <Card className="p-6">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Customer Care Timeline</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Theo dõi buổi đầu, chuyên cần, nhận xét giáo viên và cảnh báo rủi ro sau khi học viên vào lớp.
                  </p>
                </div>
                <Button size="sm" className="gap-2" onClick={() => setShowCareModal(true)}>
                  <Plus size={16} /> Ghi nhận chăm sóc
                </Button>
              </div>

              <div className="mt-6 space-y-4">
                {care?.timeline?.map((item: any) => (
                  <div key={item.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex gap-3">
                        <div className={`mt-1 flex h-10 w-10 items-center justify-center rounded-xl ${getCareTone(item).iconClass}`}>
                          {getCareIcon(item.type)}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900">{item.title}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getCareTone(item).badgeClass}`}>
                              {getCareTypeLabel(item.type)}
                            </span>
                            {item.riskLevel && (
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getRiskClass(item.riskLevel)}`}>
                                {getRiskLabel(item.riskLevel)}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-slate-400">
                            {new Date(item.occurredAt).toLocaleString('vi-VN')}
                            {item.class?.name ? ` • ${item.class.name}` : ''}
                            {item.actor?.fullName ? ` • ${item.actor.fullName}` : ''}
                          </p>
                          {item.content && <p className="mt-3 text-sm leading-6 text-slate-600">{item.content}</p>}
                          {item.actionPlan && (
                            <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                              <span className="font-semibold">Kế hoạch xử lý: </span>{item.actionPlan}
                            </div>
                          )}
                          {item.dueDate && (
                            <p className="mt-2 text-xs font-medium text-slate-500">Hạn xử lý: {new Date(item.dueDate).toLocaleDateString('vi-VN')}</p>
                          )}
                        </div>
                      </div>
                      {!item.readonly && item.status === 'OPEN' && (
                        <Button size="sm" variant="secondary" disabled={isSaving} onClick={() => handleResolveCareEvent(item.id)}>
                          Đóng việc
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {!care?.timeline?.length && (
                  <p className="py-10 text-center text-sm italic text-slate-400">Chưa có dữ liệu chăm sóc học viên.</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'exam' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <CareSummaryCard icon={<Trophy size={22} />} label="Mock gần nhất" value={formatExamScore(examJourney?.summary?.latestMock)} tone="blue" />
              <CareSummaryCard icon={<AlertCircle size={22} />} label="Thi thật gần nhất" value={formatExamScore(examJourney?.summary?.latestRealExam)} tone={examJourney?.summary?.latestRealExam?.outcome === 'BELOW_TARGET' ? 'rose' : 'green'} />
              <CareSummaryCard icon={<AlertTriangle size={22} />} label="Bảo hành mở" value={`${examJourney?.summary?.openWarrantyCount || 0}`} tone={(examJourney?.summary?.openWarrantyCount || 0) > 0 ? 'amber' : 'green'} />
              <CareSummaryCard icon={<FileText size={22} />} label="Gia hạn" value={examJourney?.summary?.pendingRenewal ? 'Đang xử lý' : 'Chưa tạo'} tone={examJourney?.summary?.pendingRenewal ? 'amber' : 'slate'} />
            </div>

            <Card className="p-6">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Mock Test / Thi thật / Bảo hành / Gia hạn</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Theo SIPOC: lên lịch mock, ghi nhận điểm thi thật, phân loại đạt/chưa đạt/vượt mục tiêu, mở bảo hành hoặc tạo gia hạn.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={openWarrantyModal}>
                    Mở bảo hành
                  </Button>
                  <Button size="sm" variant="secondary" disabled={isSaving || !activeStudentContract || examJourney?.summary?.pendingRenewal || renewalPlans.length === 0} onClick={openRenewalModal}>
                    Tạo gia hạn
                  </Button>
                  <Button size="sm" className="gap-2" onClick={() => setShowExamModal(true)}>
                    <Plus size={16} /> Thêm kỳ thi
                  </Button>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Lịch sử thi</h4>
                  <div className="space-y-3">
                    {examJourney?.examEvents?.map((item: any) => (
                      <div key={item.id} className="rounded-xl border border-slate-100 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-900">{item.type === 'MOCK_TEST' ? 'Mock Test' : 'Thi thật'}</p>
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getExamOutcomeClass(item.outcome)}`}>
                                {getExamOutcomeLabel(item.outcome || item.status)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-400">
                              {new Date(item.scheduledAt).toLocaleDateString('vi-VN')}
                              {item.class?.name ? ` • ${item.class.name}` : ''}
                              {item.contract?.code ? ` • HĐ ${item.contract.code}` : ''}
                            </p>
                            <p className="mt-2 text-sm text-slate-600">
                              Điểm: <span className="font-bold text-slate-900">{item.score ?? 'N/A'}</span>
                              {item.targetScore ? ` / Mục tiêu ${item.targetScore}` : ''}
                            </p>
                            {item.notes && <p className="mt-2 text-sm text-slate-600">{item.notes}</p>}
                            {item.actionPlan && (
                              <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                                {item.actionPlan}
                              </p>
                            )}
                            {item.type === 'REAL_EXAM' && (
                              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">B10-B11 đăng ký & nhắc thi</p>
                                <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-600 md:grid-cols-2">
                                  <ChecklistLine label="Trạng thái đăng ký" value={getExamRegistrationLabel(item.registrationStatus)} />
                                  <ChecklistLine label="Đã xác nhận lệ phí" value={item.examFeeConfirmed ? 'Có' : 'Chưa'} />
                                  <ChecklistLine label="Đã kiểm giấy tờ" value={item.documentsChecked ? 'Có' : 'Chưa'} />
                                  <ChecklistLine label="Nhắc T-7/T-3/T-1" value={`${item.reminderTMinus7Sent ? 'T-7' : '--'} / ${item.reminderTMinus3Sent ? 'T-3' : '--'} / ${item.reminderTMinus1Sent ? 'T-1' : '--'}`} />
                                  <ChecklistLine label="Xác nhận giờ đến" value={item.arrivalConfirmed ? 'Có' : 'Chưa'} />
                                </div>
                                {item.registrationNotes && <p className="mt-2 text-xs text-slate-500">{item.registrationNotes}</p>}
                              </div>
                            )}
                          </div>
                          {item.type === 'REAL_EXAM' && item.outcome === 'BELOW_TARGET' && (
                            <Button size="sm" variant="secondary" onClick={() => openWarrantyModal(item)}>
                              Bảo hành
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {!examJourney?.examEvents?.length && (
                      <p className="py-8 text-center text-sm italic text-slate-400">Chưa có lịch sử mock test / thi thật.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Bảo hành & Gia hạn</h4>
                  <div className="space-y-3">
                    {examJourney?.warrantyCases?.map((item: any) => (
                      <div key={item.id} className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">Bảo hành học viên</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.contract?.code ? `HĐ ${item.contract.code} • ` : ''}{getWarrantyStatusLabel(item.status)}
                            </p>
                            <p className="mt-2 text-sm text-slate-700">{item.reason}</p>
                            {item.plan && <p className="mt-2 text-sm text-amber-800">Kế hoạch: {item.plan}</p>}
                          </div>
                          <Badge variant={item.status === 'COMPLETED' ? 'success' : 'warning'}>{item.status}</Badge>
                        </div>
                      </div>
                    ))}
                    {!examJourney?.warrantyCases?.length && (
                      <p className="py-8 text-center text-sm italic text-slate-400">Chưa có hồ sơ bảo hành.</p>
                    )}

                    <div className="rounded-xl border border-slate-100 p-4">
                      <p className="text-sm font-semibold text-slate-900">Hợp đồng hiện tại</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {activeStudentContract
                          ? `${activeStudentContract.code} • hết hạn ${new Date(activeStudentContract.endDate).toLocaleDateString('vi-VN')}`
                          : 'Chưa có hợp đồng active'}
                      </p>
                      {examJourney?.summary?.pendingRenewal && (
                        <p className="mt-2 text-sm font-medium text-amber-700">Đã có bản ghi gia hạn đang xử lý.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'issues' && (
          <Card className="p-6">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Complaint & Objection Handling</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Ghi nhận phản đối/khiếu nại về học phí, khuyến mại, lịch học, chuyển lớp, giáo viên, chất lượng học tập và trải nghiệm dịch vụ.
                </p>
              </div>
              <Button size="sm" className="gap-2" onClick={() => setShowIssueModal(true)}>
                <Plus size={16} /> Thêm phản hồi
              </Button>
            </div>

            <div className="mt-6 space-y-3">
              {issues.map((issue) => (
                <div key={issue.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{issue.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getIssuePriorityClass(issue.priority)}`}>
                          {getIssuePriorityLabel(issue.priority)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {getIssueCategoryLabel(issue.category)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {issue.type === 'OBJECTION' ? 'Phản đối tư vấn' : 'Khiếu nại/phản hồi'} • {getIssueStatusLabel(issue.status)}
                        {issue.owner?.fullName ? ` • Phụ trách: ${issue.owner.fullName}` : ''}
                      </p>
                      {issue.description && <p className="mt-3 text-sm leading-6 text-slate-600">{issue.description}</p>}
                      {issue.nextAction && (
                        <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                          Bước xử lý: {issue.nextAction}
                        </p>
                      )}
                      {issue.resolution && <p className="mt-2 text-sm text-emerald-700">Kết quả: {issue.resolution}</p>}
                    </div>
                    {issue.status !== 'RESOLVED' && issue.status !== 'CANCELLED' && (
                      <Button size="sm" variant="secondary" disabled={isSaving} onClick={() => handleResolveIssue(issue.id)}>
                        Đóng case
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {!issues.length && (
                <p className="py-10 text-center text-sm italic text-slate-400">Chưa có phản hồi/khiếu nại nào.</p>
              )}
            </div>
          </Card>
        )}

        {activeTab === 'notes' && (
          <Card className="p-6">
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Nhật ký học tập & Feedback</h3>
                <Button size="sm" className="gap-2">
                   <Plus size={16} /> Ghi chú mới
                </Button>
             </div>
             <div className="space-y-8">
                {academic?.notes?.map((note: any) => (
                   <div key={note.id} className="relative pl-8 border-l-2 border-slate-100 space-y-2">
                      <div className="absolute -left-2.5 top-0 w-5 h-5 rounded-full bg-white border-2 border-primary flex items-center justify-center">
                         <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      </div>
                      <div className="flex items-center gap-2">
                         <span className="text-xs font-bold text-slate-900">{note.teacher?.fullName}</span>
                         <span className="text-[10px] text-slate-400">• {new Date(note.date).toLocaleDateString('vi-VN')}</span>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-600 leading-relaxed">
                         {note.content}
                      </div>
                   </div>
                ))}
                {!academic?.notes?.length && (
                  <p className="text-sm text-slate-400 italic py-10 text-center">Chưa có nhật ký học tập.</p>
                )}
             </div>
          </Card>
        )}
      </div>

      {showResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={handleCreateAcademicResult} className="w-full max-w-xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-semibold text-slate-900">Nhap ket qua hoc tap</h3>
              <button type="button" onClick={() => setShowResultModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <label className="text-sm text-slate-500">
                Loai ket qua
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={resultForm.type}
                  onChange={(event) => setResultForm((form) => ({ ...form, type: event.target.value }))}
                >
                  <option value="PLACEMENT">Test dau vao</option>
                  <option value="MOCK">Mock test</option>
                  <option value="MIDTERM">Giua khoa</option>
                  <option value="FINAL">Cuoi khoa</option>
                </select>
              </label>
              <StudentEditField label="Diem" type="number" value={resultForm.score} onChange={(value) => setResultForm((form) => ({ ...form, score: value }))} required />
              <StudentEditField label="Ngay ghi nhan" type="date" value={resultForm.date} onChange={(value) => setResultForm((form) => ({ ...form, date: value }))} required />
              <label className="text-sm text-slate-500">
                Nhan xet
                <textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={resultForm.comments} onChange={(event) => setResultForm((form) => ({ ...form, comments: event.target.value }))} />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setShowResultModal(false)}>Hủy</Button>
              <Button type="submit" disabled={isSaving || !resultForm.score}>{isSaving ? 'Đang lưu...' : 'Lưu kết quả'}</Button>
            </div>
          </form>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={handleUpdateStudent} className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-semibold text-slate-900">Chỉnh sửa thông tin học sinh</h3>
              <button type="button" onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto p-6 md:grid-cols-2">
              <StudentEditField label="Họ tên" value={editForm.fullName} onChange={(value) => setEditForm((form) => ({ ...form, fullName: value }))} required />
              <StudentEditField label="Ngày sinh" type="date" value={editForm.birthday} onChange={(value) => setEditForm((form) => ({ ...form, birthday: value }))} />
              <label className="text-sm text-slate-500">
                Giới tính
                <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={editForm.gender} onChange={(event) => setEditForm((form) => ({ ...form, gender: event.target.value }))}>
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                </select>
              </label>
              <label className="text-sm text-slate-500">
                Trạng thái
                <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={editForm.status} onChange={(event) => setEditForm((form) => ({ ...form, status: event.target.value }))}>
                  <option value="PENDING">Chờ xử lý</option>
                  <option value="TRIAL">Học thử</option>
                  <option value="ACTIVE">Đang học</option>
                  <option value="HOLD">Tạm dừng</option>
                  <option value="COMPLETED">Hoàn thành</option>
                  <option value="DROPPED">Đã nghỉ</option>
                  <option value="RENEWAL_CANDIDATE">Cần tái phí</option>
                </select>
              </label>
              <StudentEditField label="Lớp/Khối" value={editForm.currentGrade} onChange={(value) => setEditForm((form) => ({ ...form, currentGrade: value }))} />
              <StudentEditField label="Trường" value={editForm.school} onChange={(value) => setEditForm((form) => ({ ...form, school: value }))} />
              <StudentEditField label="Mục tiêu" value={editForm.aim} onChange={(value) => setEditForm((form) => ({ ...form, aim: value, target: value }))} />
              <StudentEditField label="Tháng thi dự kiến" value={editForm.expectedExamTime} onChange={(value) => setEditForm((form) => ({ ...form, expectedExamTime: value }))} />
              <StudentEditField label="SĐT học sinh" value={editForm.studentPhone} onChange={(value) => setEditForm((form) => ({ ...form, studentPhone: value }))} />
              <label className="text-sm text-slate-500 md:col-span-2">
                Địa chỉ
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={editForm.address} onChange={(event) => setEditForm((form) => ({ ...form, address: event.target.value }))} />
              </label>
              <div className="border-t border-slate-100 pt-4 md:col-span-2">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Thông tin phụ huynh chính</p>
              </div>
              <StudentEditField label="Họ tên phụ huynh" value={editForm.parentFullName} onChange={(value) => setEditForm((form) => ({ ...form, parentFullName: value }))} />
              <StudentEditField label="SĐT phụ huynh" value={editForm.parentPhone} onChange={(value) => setEditForm((form) => ({ ...form, parentPhone: value }))} />
              <StudentEditField label="Email phu huynh" value={editForm.parentEmail} onChange={(value) => setEditForm((form) => ({ ...form, parentEmail: value }))} />
              <StudentEditField label="Quan he" value={editForm.parentRelationship} onChange={(value) => setEditForm((form) => ({ ...form, parentRelationship: value }))} />
              <label className="text-sm text-slate-500 md:col-span-2">
                Địa chỉ phụ huynh
                <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={editForm.parentAddress} onChange={(event) => setEditForm((form) => ({ ...form, parentAddress: event.target.value }))} />
              </label>
              <label className="text-sm text-slate-500 md:col-span-2">
                Ghi chú
                <textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={editForm.notes} onChange={(event) => setEditForm((form) => ({ ...form, notes: event.target.value }))} />
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>Hủy</Button>
              <Button type="submit" disabled={isSaving || !editForm.fullName}>{isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}</Button>
            </div>
          </form>
        </div>
      )}

      {showExamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-semibold text-slate-900">Thêm Mock Test / Thi thật</h3>
              <button type="button" onClick={() => setShowExamModal(false)} className="text-2xl leading-none text-slate-400 hover:text-slate-600">×</button>
            </div>
            <form onSubmit={handleCreateExamEvent} className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-500">Loại kỳ thi</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={examForm.type}
                    onChange={(event) => setExamForm((form) => ({ ...form, type: event.target.value }))}
                  >
                    <option value="MOCK_TEST">Mock Test</option>
                    <option value="REAL_EXAM">Thi thật</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-500">Ngày thi</label>
                  <input
                    type="date"
                    required
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={examForm.scheduledAt}
                    onChange={(event) => setExamForm((form) => ({ ...form, scheduledAt: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-500">Điểm đạt được</label>
                  <input
                    type="number"
                    step="0.5"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={examForm.score}
                    onChange={(event) => setExamForm((form) => ({ ...form, score: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-500">Mục tiêu</label>
                  <input
                    type="number"
                    step="0.5"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={examForm.targetScore}
                    onChange={(event) => setExamForm((form) => ({ ...form, targetScore: event.target.value }))}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={examForm.markCompleted}
                  onChange={(event) => setExamForm((form) => ({ ...form, markCompleted: event.target.checked }))}
                />
                Đánh dấu đã hoàn thành
              </label>
              {examForm.type === 'REAL_EXAM' && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-700">B10-B11 đăng ký & nhắc thi thật</p>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm text-slate-500">Trạng thái đăng ký</label>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={examForm.registrationStatus}
                        onChange={(event) => setExamForm((form) => ({ ...form, registrationStatus: event.target.value }))}
                      >
                        <option value="NOT_STARTED">Chưa bắt đầu</option>
                        <option value="PROPOSED">Đã tư vấn lịch thi</option>
                        <option value="CONFIRMED">PH/HV đã xác nhận</option>
                        <option value="REGISTERED">Đã đăng ký thành công</option>
                        <option value="CANCELLED">Đã hủy</option>
                      </select>
                    </div>
                    <ExamChecklistCheckbox
                      label="Đã xác nhận lệ phí thi"
                      checked={examForm.examFeeConfirmed}
                      onChange={(checked) => setExamForm((form) => ({ ...form, examFeeConfirmed: checked }))}
                    />
                    <ExamChecklistCheckbox
                      label="Đã kiểm giấy tờ/checklist"
                      checked={examForm.documentsChecked}
                      onChange={(checked) => setExamForm((form) => ({ ...form, documentsChecked: checked }))}
                    />
                    <ExamChecklistCheckbox
                      label="Đã nhắc T-7"
                      checked={examForm.reminderTMinus7Sent}
                      onChange={(checked) => setExamForm((form) => ({ ...form, reminderTMinus7Sent: checked }))}
                    />
                    <ExamChecklistCheckbox
                      label="Đã nhắc T-3"
                      checked={examForm.reminderTMinus3Sent}
                      onChange={(checked) => setExamForm((form) => ({ ...form, reminderTMinus3Sent: checked }))}
                    />
                    <ExamChecklistCheckbox
                      label="Đã nhắc T-1"
                      checked={examForm.reminderTMinus1Sent}
                      onChange={(checked) => setExamForm((form) => ({ ...form, reminderTMinus1Sent: checked }))}
                    />
                    <ExamChecklistCheckbox
                      label="Đã xác nhận giờ đến/phòng thi"
                      checked={examForm.arrivalConfirmed}
                      onChange={(checked) => setExamForm((form) => ({ ...form, arrivalConfirmed: checked }))}
                    />
                  </div>
                  <div className="mt-4">
                    <label className="text-sm text-slate-500">Ghi chú đăng ký/nhắc thi</label>
                    <textarea
                      className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      value={examForm.registrationNotes}
                      onChange={(event) => setExamForm((form) => ({ ...form, registrationNotes: event.target.value }))}
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm text-slate-500">Nhận xét</label>
                <textarea
                  className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={examForm.notes}
                  onChange={(event) => setExamForm((form) => ({ ...form, notes: event.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-slate-500">Kế hoạch sau kỳ thi</label>
                <textarea
                  className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={examForm.actionPlan}
                  onChange={(event) => setExamForm((form) => ({ ...form, actionPlan: event.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <Button type="button" variant="secondary" onClick={() => setShowExamModal(false)} disabled={isSaving}>Hủy</Button>
                <Button type="submit" disabled={isSaving}>{isSaving ? 'Đang lưu...' : 'Lưu kỳ thi'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRenewalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-semibold text-slate-900">Tái ký / Upsell</h3>
              <button type="button" onClick={() => setShowRenewalModal(false)} className="text-2xl leading-none text-slate-400 hover:text-slate-600">×</button>
            </div>
            <form onSubmit={handleCreateRenewal} className="space-y-4 p-6">
              <div>
                <label className="text-sm text-slate-500">Gói học tái ký *</label>
                <select
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={renewalForm.planId}
                  onChange={(event) => {
                    const selected = renewalPlans.find((plan) => plan.id === event.target.value);
                    setRenewalForm((form) => ({
                      ...form,
                      planId: event.target.value,
                      amount: selected?.price ? String(selected.price) : form.amount,
                    }));
                  }}
                >
                  <option value="">Chọn gói học</option>
                  {renewalPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.program?.name} - {plan.name} ({Number(plan.price).toLocaleString('vi-VN')} đ)
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm text-slate-500">Giá trị hợp đồng *</label>
                  <input
                    required
                    type="number"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={renewalForm.amount}
                    onChange={(event) => setRenewalForm((form) => ({ ...form, amount: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-500">Ngày bắt đầu</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={renewalForm.startDate}
                    onChange={(event) => setRenewalForm((form) => ({ ...form, startDate: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-500">Ngày kết thúc</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={renewalForm.endDate}
                    onChange={(event) => setRenewalForm((form) => ({ ...form, endDate: event.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-500">Ghi chú mục tiêu mới / upsell</label>
                <textarea
                  className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={renewalForm.notes}
                  onChange={(event) => setRenewalForm((form) => ({ ...form, notes: event.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <Button type="button" variant="secondary" onClick={() => setShowRenewalModal(false)} disabled={isSaving}>Hủy</Button>
                <Button type="submit" disabled={isSaving || !renewalForm.planId || renewalForm.amount === ''}>
                  {isSaving ? 'Đang tạo...' : 'Tạo hợp đồng tái ký'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-semibold text-slate-900">Thêm phản hồi/khiếu nại</h3>
              <button type="button" onClick={() => setShowIssueModal(false)} className="text-2xl leading-none text-slate-400 hover:text-slate-600">×</button>
            </div>
            <form onSubmit={handleCreateIssue} className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm text-slate-500">Loại</label>
                  <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={issueForm.type} onChange={(event) => setIssueForm((form) => ({ ...form, type: event.target.value }))}>
                    <option value="COMPLAINT">Khiếu nại/phản hồi</option>
                    <option value="OBJECTION">Phản đối tư vấn</option>
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
              <div>
                <label className="text-sm text-slate-500">Tiêu đề *</label>
                <input required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={issueForm.title} onChange={(event) => setIssueForm((form) => ({ ...form, title: event.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-slate-500">Nội dung</label>
                <textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={issueForm.description} onChange={(event) => setIssueForm((form) => ({ ...form, description: event.target.value }))} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-500">Bước xử lý tiếp theo</label>
                  <textarea className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={issueForm.nextAction} onChange={(event) => setIssueForm((form) => ({ ...form, nextAction: event.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-slate-500">Hạn xử lý</label>
                  <input type="date" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={issueForm.dueDate} onChange={(event) => setIssueForm((form) => ({ ...form, dueDate: event.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <Button type="button" variant="secondary" onClick={() => setShowIssueModal(false)} disabled={isSaving}>Hủy</Button>
                <Button type="submit" disabled={isSaving}>{isSaving ? 'Đang lưu...' : 'Lưu phản hồi'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showWarrantyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-semibold text-slate-900">Mở hồ sơ bảo hành</h3>
              <button type="button" onClick={() => setShowWarrantyModal(false)} className="text-2xl leading-none text-slate-400 hover:text-slate-600">×</button>
            </div>
            <form onSubmit={handleCreateWarrantyCase} className="space-y-4 p-6">
              <div>
                <label className="text-sm text-slate-500">Hợp đồng áp dụng</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={warrantyForm.contractId}
                  onChange={(event) => setWarrantyForm((form) => ({ ...form, contractId: event.target.value }))}
                >
                  <option value="">Không gắn hợp đồng</option>
                  {warrantyContractOptions.map((contract: any) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.code} - {contract.status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-500">Lý do bảo hành *</label>
                <textarea
                  required
                  className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={warrantyForm.reason}
                  onChange={(event) => setWarrantyForm((form) => ({ ...form, reason: event.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-slate-500">Kế hoạch bảo hành</label>
                <textarea
                  className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={warrantyForm.plan}
                  onChange={(event) => setWarrantyForm((form) => ({ ...form, plan: event.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm text-slate-500">Hạn xử lý</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={warrantyForm.dueDate}
                  onChange={(event) => setWarrantyForm((form) => ({ ...form, dueDate: event.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <Button type="button" variant="secondary" onClick={() => setShowWarrantyModal(false)} disabled={isSaving}>Hủy</Button>
                <Button type="submit" disabled={isSaving}>{isSaving ? 'Đang lưu...' : 'Tạo bảo hành'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="font-semibold text-slate-900">Ghi nhận chăm sóc học viên</h3>
              <button type="button" onClick={() => setShowCareModal(false)} className="text-2xl leading-none text-slate-400 hover:text-slate-600">
                ×
              </button>
            </div>
            <form onSubmit={handleCreateCareEvent} className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm text-slate-500">Loại ghi nhận</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={careForm.type}
                    onChange={(event) => setCareForm((form) => ({ ...form, type: event.target.value }))}
                  >
                    <option value="FIRST_LESSON">Buổi học đầu tiên</option>
                    <option value="TEACHER_COMMENT">Nhận xét giáo viên</option>
                    <option value="RISK_WARNING">Cảnh báo rủi ro</option>
                    <option value="GENERAL">Ghi chú chăm sóc</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-500">Tiêu đề</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    value={careForm.title}
                    onChange={(event) => setCareForm((form) => ({ ...form, title: event.target.value }))}
                    placeholder="Để trống sẽ tự đặt theo loại ghi nhận"
                  />
                </div>
              </div>

              {careForm.type === 'RISK_WARNING' && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-slate-500">Mức độ rủi ro</label>
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      value={careForm.riskLevel}
                      onChange={(event) => setCareForm((form) => ({ ...form, riskLevel: event.target.value }))}
                    >
                      <option value="LOW">Thấp</option>
                      <option value="MEDIUM">Trung bình</option>
                      <option value="HIGH">Cao</option>
                      <option value="CRITICAL">Khẩn cấp</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">Hạn xử lý</label>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      value={careForm.dueDate}
                      onChange={(event) => setCareForm((form) => ({ ...form, dueDate: event.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm text-slate-500">Nội dung</label>
                <textarea
                  className="mt-1 min-h-28 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={careForm.content}
                  onChange={(event) => setCareForm((form) => ({ ...form, content: event.target.value }))}
                />
              </div>

              <div>
                <label className="text-sm text-slate-500">Kế hoạch xử lý / bước tiếp theo</label>
                <textarea
                  className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  value={careForm.actionPlan}
                  onChange={(event) => setCareForm((form) => ({ ...form, actionPlan: event.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <Button type="button" variant="secondary" onClick={() => setShowCareModal(false)} disabled={isSaving}>
                  Hủy
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Đang lưu...' : 'Lưu ghi nhận'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CareSummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'blue' | 'green' | 'amber' | 'rose' | 'slate';
}) {
  const tones = {
    blue: 'border-l-blue-500 bg-blue-50 text-blue-600',
    green: 'border-l-green-500 bg-green-50 text-green-600',
    amber: 'border-l-amber-500 bg-amber-50 text-amber-600',
    rose: 'border-l-rose-500 bg-rose-50 text-rose-600',
    slate: 'border-l-slate-400 bg-slate-50 text-slate-600',
  };

  return (
    <Card className={`flex items-center gap-4 border-l-4 p-5 ${tones[tone]}`}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/70">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
        <p className="truncate text-base font-bold text-slate-900">{value}</p>
      </div>
    </Card>
  );
}

function ContractInfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function formatCurrency(value: any) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '0 ₫';
  return `${amount.toLocaleString('vi-VN')} ₫`;
}

function getContractPaidAmount(contract: any) {
  if (contract?.paidAmount != null) return Number(contract.paidAmount || 0);
  const paymentTotal = (contract?.payments || []).reduce((sum: number, payment: any) => {
    if (payment.status && payment.status !== 'COMPLETED') return sum;
    return sum + Number(payment.amount || 0);
  }, 0);
  if (paymentTotal > 0) return paymentTotal;
  return (contract?.paymentSchedule || []).reduce((sum: number, schedule: any) => sum + Number(schedule.paidAmount || 0), 0);
}

function getContractDebtAmount(contract: any) {
  if (contract?.debtAmount != null) return Number(contract.debtAmount || 0);
  const scheduleDebt = (contract?.paymentSchedule || []).reduce((sum: number, schedule: any) => sum + Number(schedule.remainingAmount || 0), 0);
  if (scheduleDebt > 0) return scheduleDebt;
  return Math.max(Number(contract?.finalAmount || 0) - getContractPaidAmount(contract), 0);
}

function getContractProductLabel(contract: any) {
  const directLabel = [contract?.productName, contract?.productRank, contract?.feePackage].filter(Boolean).join(' - ');
  if (directLabel) return directLabel;
  const detailLabels = (contract?.details || [])
    .map((detail: any) => [detail.plan?.program?.product?.name, detail.plan?.program?.name, detail.plan?.name].filter(Boolean).join(' - '))
    .filter(Boolean);
  return detailLabels.join(', ') || 'N/A';
}

function getContractStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: 'Nháp',
    PENDING: 'Chờ duyệt',
    ACTIVE: 'Đang hiệu lực',
    EXPIRED: 'Hết hạn',
    TERMINATED: 'Đã chấm dứt',
    CANCELLED: 'Đã hủy',
  };
  return labels[status] || status;
}

function getStudentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: 'Chờ xử lý',
    TRIAL: 'Học thử',
    ACTIVE: 'Đang học',
    HOLD: 'Tạm dừng',
    COMPLETED: 'Hoàn thành',
    DROPPED: 'Đã nghỉ',
    RENEWAL_CANDIDATE: 'Cần tái phí',
  };
  return labels[status] || status;
}

function getContractStatusClass(status: string) {
  if (status === 'ACTIVE') return 'bg-emerald-100 text-emerald-700';
  if (status === 'PENDING' || status === 'DRAFT') return 'bg-amber-100 text-amber-700';
  if (status === 'EXPIRED' || status === 'TERMINATED' || status === 'CANCELLED') return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-700';
}

function getPaymentScheduleStatusLabel(status: string) {
  const labels: Record<string, string> = {
    UNPAID: 'Chưa thu',
    PARTIAL: 'Thu một phần',
    PAID: 'Đã thu',
    OVERDUE: 'Quá hạn',
    WAIVED: 'Miễn thu',
    CANCELLED: 'Đã hủy',
  };
  return labels[status] || status;
}

function getCareIcon(type: string) {
  if (type === 'FIRST_LESSON') return <GraduationCap size={18} />;
  if (type === 'ATTENDANCE') return <CheckCircle2 size={18} />;
  if (type === 'TEACHER_COMMENT') return <MessageSquare size={18} />;
  if (type === 'RISK_WARNING') return <AlertTriangle size={18} />;
  return <ClipboardList size={18} />;
}

function getCareTypeLabel(type: string) {
  const labels: Record<string, string> = {
    FIRST_LESSON: 'Buổi đầu',
    ATTENDANCE: 'Chuyên cần',
    TEACHER_COMMENT: 'Nhận xét GV',
    RISK_WARNING: 'Cảnh báo',
    GENERAL: 'Chăm sóc',
  };
  return labels[type] || type;
}

function getCareTone(item: any) {
  if (item.type === 'RISK_WARNING' || item.riskLevel) {
    return { iconClass: 'bg-rose-50 text-rose-600', badgeClass: 'bg-rose-100 text-rose-700' };
  }
  if (item.type === 'ATTENDANCE') {
    return { iconClass: 'bg-amber-50 text-amber-600', badgeClass: 'bg-amber-100 text-amber-700' };
  }
  if (item.type === 'TEACHER_COMMENT') {
    return { iconClass: 'bg-blue-50 text-blue-600', badgeClass: 'bg-blue-100 text-blue-700' };
  }
  if (item.type === 'FIRST_LESSON') {
    return { iconClass: 'bg-emerald-50 text-emerald-600', badgeClass: 'bg-emerald-100 text-emerald-700' };
  }
  return { iconClass: 'bg-slate-50 text-slate-600', badgeClass: 'bg-slate-100 text-slate-700' };
}

function getRiskLabel(risk: string) {
  const labels: Record<string, string> = {
    LOW: 'Rủi ro thấp',
    MEDIUM: 'Rủi ro TB',
    HIGH: 'Rủi ro cao',
    CRITICAL: 'Khẩn cấp',
  };
  return labels[risk] || risk;
}

function getRiskClass(risk: string) {
  if (risk === 'CRITICAL') return 'bg-red-100 text-red-700';
  if (risk === 'HIGH') return 'bg-rose-100 text-rose-700';
  if (risk === 'MEDIUM') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

function formatExamScore(exam: any) {
  if (!exam) return 'Chưa có';
  if (exam.score == null) return exam.status === 'SCHEDULED' ? 'Đã lên lịch' : 'N/A';
  return exam.targetScore ? `${exam.score}/${exam.targetScore}` : `${exam.score}`;
}

function getExamOutcomeLabel(value: string) {
  const labels: Record<string, string> = {
    BELOW_TARGET: 'Chưa đạt',
    MEET_TARGET: 'Đạt mục tiêu',
    EXCEED_TARGET: 'Vượt mục tiêu',
    SCHEDULED: 'Đã lên lịch',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
  };
  return labels[value] || value;
}

function getExamOutcomeClass(value?: string) {
  if (value === 'BELOW_TARGET') return 'bg-rose-100 text-rose-700';
  if (value === 'MEET_TARGET' || value === 'EXCEED_TARGET') return 'bg-emerald-100 text-emerald-700';
  if (value === 'SCHEDULED') return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-600';
}

function getWarrantyStatusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: 'Đang mở',
    APPROVED: 'Đã duyệt',
    COMPLETED: 'Hoàn tất',
    CANCELLED: 'Đã hủy',
  };
  return labels[status] || status;
}

function getExamRegistrationLabel(status?: string) {
  const labels: Record<string, string> = {
    NOT_STARTED: 'Chưa bắt đầu',
    PROPOSED: 'Đã tư vấn lịch thi',
    CONFIRMED: 'PH/HV đã xác nhận',
    REGISTERED: 'Đã đăng ký thành công',
    CANCELLED: 'Đã hủy',
  };
  return labels[status || 'NOT_STARTED'] || status || 'Chưa bắt đầu';
}

function ChecklistLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-white px-2 py-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function StudentEditField({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-sm text-slate-500">
      {label}
      <input
        type={type}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  );
}

function ExamChecklistCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
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

function getAcademicResultTypeLabel(type: string) {
  const labels: Record<string, string> = {
    PLACEMENT: 'Test đầu vào',
    MOCK: 'Mock test',
    MIDTERM: 'Giữa khóa',
    FINAL: 'Cuối khóa',
  };
  return labels[type] || type;
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
