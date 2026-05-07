'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Calendar,
  ChevronRight,
  GraduationCap,
  MapPin,
  Phone,
  Plus,
  Search,
  UserCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/LoadingState';
import { Modal } from '@/components/ui/Modal';
import { ModuleBoundary } from '@/components/common/ModuleBoundary';
import { useAppDialog } from '@/providers/AppDialogProvider';
import { apiFetch } from '@/lib/api';

type StudentForm = {
  fullName: string;
  code: string;
  centerId: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  birthday: string;
};

export default function StudentsPage() {
  const { notify } = useAppDialog();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isCodeTouched, setIsCodeTouched] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<StudentForm>({
    fullName: '',
    code: '',
    centerId: '',
    gender: 'FEMALE',
    birthday: '',
  });

  useEffect(() => {
    fetchStudents();
    fetchCenters();
  }, []);

  useEffect(() => {
    if (isModalOpen && formData.centerId && !isCodeTouched) {
      generateStudentCode(formData.centerId);
    }
  }, [isModalOpen, formData.centerId, isCodeTouched]);

  const fetchStudents = async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch('/students');
      setStudents(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCenters = async () => {
    try {
      const data = await apiFetch('/centers');
      setCenters(data);
      if (data.length > 0) {
        setFormData((prev) => ({ ...prev, centerId: data[0].id }));
      }
    } catch (err) {
      console.error('Failed to fetch centers:', err);
    }
  };

  const getErrorMessage = (err: any) => {
    if (Array.isArray(err?.message)) return err.message.join(', ');
    return err?.message || 'Không thể tạo học sinh, vui lòng kiểm tra lại thông tin';
  };

  const clearFieldError = (field: string) => {
    setFormErrors((errors) => {
      if (!errors[field]) return errors;
      const next = { ...errors };
      delete next[field];
      return next;
    });
  };

  const generateStudentCode = async (centerId: string) => {
    if (!centerId) return;
    setIsGeneratingCode(true);
    try {
      const response = await apiFetch(`/students/generate-code?centerId=${encodeURIComponent(centerId)}`);
      if (!isCodeTouched) {
        setFormData((prev) => ({ ...prev, code: response.code || '' }));
        clearFieldError('code');
      }
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Không thể sinh mã học sinh',
        message: getErrorMessage(err),
      });
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const openCreateModal = () => {
    const centerId = formData.centerId || centers[0]?.id || '';
    setFormErrors({});
    setIsCodeTouched(false);
    setFormData({
      fullName: '',
      code: '',
      centerId,
      gender: 'FEMALE',
      birthday: '',
    });
    setIsModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsModalOpen(false);
    setFormErrors({});
  };

  const validateCreateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên học sinh';
    if (!formData.code.trim()) errors.code = 'Vui lòng nhập mã học sinh';
    if (!formData.centerId) errors.centerId = 'Vui lòng chọn trung tâm';
    if (formData.birthday && Number.isNaN(new Date(formData.birthday).getTime())) {
      errors.birthday = 'Ngày sinh không hợp lệ';
    }
    setFormErrors(errors);
    if (errors.code) codeInputRef.current?.focus();
    return Object.keys(errors).length === 0;
  };

  const handleCreateStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateCreateForm()) return;

    setIsSubmitting(true);
    try {
      await apiFetch('/students', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          fullName: formData.fullName.trim(),
          code: formData.code.trim(),
        }),
      });
      closeCreateModal();
      setIsCodeTouched(false);
      setFormData({
        fullName: '',
        code: '',
        centerId: centers[0]?.id || '',
        gender: 'FEMALE',
        birthday: '',
      });
      fetchStudents();
    } catch (err: any) {
      const message = getErrorMessage(err);
      if (message.includes('Mã học sinh') || message.includes('mã học sinh')) {
        setFormErrors((errors) => ({ ...errors, code: message }));
        codeInputRef.current?.focus();
      }
      notify({ type: 'error', title: 'Không thể tạo học sinh', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'PENDING':
        return 'primary';
      case 'HOLD':
        return 'warning';
      case 'DROPPED':
        return 'error';
      case 'COMPLETED':
        return 'info';
      case 'RENEWAL_CANDIDATE':
        return 'primary';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
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
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredStudents = normalizedSearch
    ? students.filter((student) => {
        const primaryParent =
          student.relations?.find((relation: any) => relation.isPrimaryContact)?.parent ||
          student.relations?.[0]?.parent;
        const searchable = [
          student.fullName,
          student.code,
          student.studentPhone,
          student.status,
          student.center?.name,
          student.school,
          student.currentGrade,
          student.productName,
          student.officialClassName,
          student.address,
          primaryParent?.fullName,
          primaryParent?.phone,
          primaryParent?.email,
          primaryParent?.address,
        ];
        return searchable
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
    : students;

  if (isLoading) return <LoadingState message="Đang tìm kiếm hồ sơ học sinh..." />;

  return (
    <ModuleBoundary moduleCode="STUDENT">
      <div className="space-y-8 pb-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <UserCircle size={24} />
              </div>
              Quản lý Học sinh
            </h1>
            <p className="mt-1 text-slate-500">
              Danh sách học sinh đang theo học và tiềm năng trên các chi nhánh.
            </p>
          </div>
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Tìm tên, mã, SĐT..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-64 rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <Button className="flex gap-2" onClick={openCreateModal}>
              <Plus size={18} />
              Thêm học sinh
            </Button>
          </div>
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={closeCreateModal}
          title="Thêm học sinh mới"
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={closeCreateModal} disabled={isSubmitting}>
                Hủy
              </Button>
              <Button onClick={handleCreateStudent} isLoading={isSubmitting}>
                Lưu hồ sơ
              </Button>
            </>
          }
        >
          <form onSubmit={handleCreateStudent} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-slate-500">Họ và tên</label>
              <Input
                placeholder="Nguyễn Văn A"
                value={formData.fullName}
                className={formErrors.fullName ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : ''}
                onChange={(event) => {
                  clearFieldError('fullName');
                  setFormData({ ...formData, fullName: event.target.value });
                }}
              />
              {formErrors.fullName && <p className="text-xs font-medium text-red-600">{formErrors.fullName}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-500">Mã học sinh</label>
                <div className="relative">
                  <Input
                    ref={codeInputRef}
                    placeholder={isGeneratingCode ? 'Đang sinh mã...' : 'HV260001'}
                    value={formData.code}
                    className={`${formErrors.code ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : ''} ${isGeneratingCode ? 'pr-10' : ''}`}
                    onChange={(event) => {
                      setIsCodeTouched(true);
                      clearFieldError('code');
                      setFormData({ ...formData, code: event.target.value });
                    }}
                  />
                  {isGeneratingCode && (
                    <span className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
                  )}
                </div>
                <p className="text-[11px] text-slate-400">Hệ thống tự đề xuất, có thể chỉnh sửa.</p>
                {formErrors.code && <p className="text-xs font-medium text-red-600">{formErrors.code}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-500">Giới tính</label>
                <select
                  className="w-full rounded-custom border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  value={formData.gender}
                  onChange={(event) => setFormData({ ...formData, gender: event.target.value as StudentForm['gender'] })}
                >
                  <option value="FEMALE">Nữ</option>
                  <option value="MALE">Nam</option>
                  <option value="OTHER">Khác</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-slate-500">Trung tâm</label>
              <select
                className={`w-full rounded-custom border bg-white px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 ${formErrors.centerId ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : 'border-slate-200'}`}
                value={formData.centerId}
                onChange={(event) => {
                  clearFieldError('centerId');
                  setFormData({ ...formData, centerId: event.target.value });
                }}
              >
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name} ({center.code})
                  </option>
                ))}
              </select>
              {formErrors.centerId && <p className="text-xs font-medium text-red-600">{formErrors.centerId}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase text-slate-500">Ngày sinh</label>
              <Input
                type="date"
                value={formData.birthday}
                className={formErrors.birthday ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : ''}
                onChange={(event) => {
                  clearFieldError('birthday');
                  setFormData({ ...formData, birthday: event.target.value });
                }}
              />
              {formErrors.birthday && <p className="text-xs font-medium text-red-600">{formErrors.birthday}</p>}
            </div>
          </form>
        </Modal>

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
            <div className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredStudents.map((student) => {
            const primaryParent =
              student.relations?.find((relation: any) => relation.isPrimaryContact)?.parent ||
              student.relations?.[0]?.parent;
            const address = student.address || primaryParent?.address || 'Chưa cập nhật địa chỉ';
            const classLabel =
              [student.productName, student.officialClassName || student.currentGrade].filter(Boolean).join(' - ') ||
              'Chưa có lớp';

            return (
              <Link
                key={student.id}
                href={`/students/${student.id}`}
                className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Card className="h-full cursor-pointer border-none p-5 shadow-sm shadow-slate-200/50 transition-all hover:shadow-lg group">
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 transition-colors group-hover:bg-primary/5 group-hover:text-primary">
                      <UserCircle size={32} />
                    </div>
                    <div className="flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 transition-colors group-hover:text-primary">
                          {student.fullName}
                        </h3>
                        <Badge variant={getStatusVariant(student.status)} className="capitalize">
                          {getStatusLabel(student.status)}
                        </Badge>
                      </div>
                      <p className="mb-3 flex items-center gap-1 text-xs font-medium text-slate-500">
                        Mã: {student.code} • {student.gender === 'MALE' ? 'Nam' : student.gender === 'FEMALE' ? 'Nữ' : 'Khác'}
                      </p>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Building2 size={14} className="text-slate-400" />
                            <span className="font-semibold">{student.center?.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600">
                            <MapPin size={14} className="text-slate-400" />
                            <span className="truncate">{address}</span>
                          </div>
                        </div>
                        <div className="space-y-1.5 border-l border-slate-100 pl-3">
                          <div className="flex items-center gap-2 font-medium text-slate-700">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            PH: {primaryParent?.fullName || 'N/A'}
                          </div>
                          <div className="flex items-center gap-2 text-slate-600">
                            <Phone size={14} className="text-slate-400" />
                            <span>{primaryParent?.phone || student.studentPhone || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center p-2 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-primary">
                      <ChevronRight size={20} />
                    </div>
                  </div>

                  <div className="mt-4 flex gap-4 border-t border-slate-50 pt-4">
                    <div className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <Calendar size={12} />
                      Born: {student.birthday ? new Date(student.birthday).toLocaleDateString('vi-VN') : 'N/A'}
                    </div>
                    <div className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <GraduationCap size={12} />
                      {classLabel}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}

          {filteredStudents.length === 0 && !isLoading && (
            <div className="col-span-full">
              <EmptyState
                title={normalizedSearch ? 'Không tìm thấy học sinh' : 'Danh sách học sinh trống'}
                description={
                  normalizedSearch
                    ? 'Thử tìm theo tên, mã học sinh, số điện thoại, phụ huynh, trung tâm hoặc lớp.'
                    : 'Hiện tại chưa có học sinh nào trong phạm vi quản lý của bạn. Bạn có thể thêm học sinh bằng cách chuyển đổi Lead từ mục CRM.'
                }
                icon={UserCircle}
                actionLabel={normalizedSearch ? 'Xóa tìm kiếm' : 'Đến mục CRM Leads'}
                onAction={() => (normalizedSearch ? setSearchTerm('') : (window.location.href = '/leads'))}
              />
            </div>
          )}
        </div>
      </div>
    </ModuleBoundary>
  );
}
