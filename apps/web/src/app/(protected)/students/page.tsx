'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { apiFetch } from '@/lib/api';
import { ModuleBoundary } from '@/components/common/ModuleBoundary';
import { 
  UserCircle, 
  Search,
  MapPin,
  Phone,
  Calendar,
  GraduationCap,
  Building2,
  ChevronRight,
  Plus
} from 'lucide-react';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';
import { useAppDialog } from '@/providers/AppDialogProvider';

export default function StudentsPage() {
  const { notify } = useAppDialog();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    code: '',
    centerId: '',
    gender: 'FEMALE' as any,
    birthday: '',
  });

  useEffect(() => {
    fetchStudents();
    fetchCenters();
  }, []);

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
        setFormData(prev => ({ ...prev, centerId: data[0].id }));
      }
    } catch (err) {
      console.error('Failed to fetch centers:', err);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.centerId) return;

    setIsSubmitting(true);
    try {
      await apiFetch('/students', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setIsModalOpen(false);
      setFormData({
        fullName: '',
        code: '',
        centerId: centers[0]?.id || '',
        gender: 'FEMALE',
        birthday: '',
      });
      fetchStudents();
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Không thể tạo học viên',
        message: err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'PENDING': return 'primary';
      case 'HOLD': return 'warning';
      case 'DROPPED': return 'error';
      case 'COMPLETED': return 'info';
      case 'RENEWAL_CANDIDATE': return 'primary';
      default: return 'default';
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
        const primaryParent = student.relations?.find((r: any) => r.isPrimaryContact)?.parent || student.relations?.[0]?.parent;
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
        return searchable.filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
    : students;

  if (isLoading) return <LoadingState message="Đang tìm kiếm hồ sơ học sinh..." />;

  return (
    <ModuleBoundary moduleCode="STUDENT">
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <UserCircle size={24} />
            </div>
            Quản lý Học sinh
          </h1>
          <p className="text-slate-500 mt-1">Danh sách học sinh đang theo học và tiềm năng trên các chi nhánh.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Tìm tên, mã, SĐT..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none w-64"
            />
          </div>
          <Button className="flex gap-2" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            Thêm học sinh
          </Button>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Thêm học sinh mới"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Hủy</Button>
            <Button onClick={handleCreateStudent} isLoading={isSubmitting}>Lưu hồ sơ</Button>
          </>
        }
      >
        <form onSubmit={handleCreateStudent} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Họ và tên</label>
            <Input 
              required
              placeholder="Nguyễn Văn A" 
              value={formData.fullName}
              onChange={e => setFormData({ ...formData, fullName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Mã học sinh</label>
              <Input 
                placeholder="STU-001" 
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Giới tính</label>
              <select 
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-custom text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                value={formData.gender}
                onChange={e => setFormData({ ...formData, gender: e.target.value as any })}
              >
                <option value="FEMALE">Nữ</option>
                <option value="MALE">Nam</option>
                <option value="OTHER">Khác</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Trung tâm</label>
            <select 
              required
              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-custom text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              value={formData.centerId}
              onChange={e => setFormData({ ...formData, centerId: e.target.value })}
            >
              {centers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">Ngày sinh</label>
            <Input 
              type="date"
              value={formData.birthday}
              onChange={e => setFormData({ ...formData, birthday: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex gap-3 items-center">
            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredStudents.map((student) => {
          const primaryParent = student.relations?.find((r: any) => r.isPrimaryContact)?.parent || student.relations?.[0]?.parent;
          const address = student.address || primaryParent?.address || 'Chưa cập nhật địa chỉ';
          const classLabel = [student.productName, student.officialClassName || student.currentGrade].filter(Boolean).join(' - ') || 'Chưa có lớp';
          
          return (
            <Link key={student.id} href={`/students/${student.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-2xl">
            <Card className="p-5 hover:shadow-lg transition-all border-none shadow-sm shadow-slate-200/50 group cursor-pointer h-full">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary/5 group-hover:text-primary transition-colors">
                  <UserCircle size={32} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors">{student.fullName}</h3>
                    <Badge variant={getStatusVariant(student.status)} className="capitalize">
                      {getStatusLabel(student.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mb-3 flex items-center gap-1">
                    Mã: {student.code} • {student.gender === 'MALE' ? 'Nam' : 'Nữ'}
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
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        PH: {primaryParent?.fullName || 'N/A'}
                      </div>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Phone size={14} className="text-slate-400" />
                        <span>{primaryParent?.phone || student.studentPhone || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center p-2 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all">
                  <ChevronRight size={20} />
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-50 flex gap-4">
                <div className="flex items-center gap-1.5 text-[10px] bg-slate-50 px-2 py-1 rounded-md text-slate-500 font-bold uppercase tracking-wider">
                   <Calendar size={12} />
                   Born: {student.birthday ? new Date(student.birthday).toLocaleDateString('vi-VN') : 'N/A'}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] bg-slate-50 px-2 py-1 rounded-md text-slate-500 font-bold uppercase tracking-wider">
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
              description={normalizedSearch ? 'Thử tìm theo tên, mã học sinh, số điện thoại, phụ huynh, trung tâm hoặc lớp.' : 'Hiện tại chưa có học sinh nào trong phạm vi quản lý của bạn. Bạn có thể thêm học sinh bằng cách chuyển đổi Lead từ mục CRM.'}
              icon={UserCircle}
              actionLabel={normalizedSearch ? 'Xóa tìm kiếm' : 'Đến mục CRM Leads'}
              onAction={() => normalizedSearch ? setSearchTerm('') : window.location.href = '/leads'}
            />
          </div>
        )}
      </div>
    </div>
    </ModuleBoundary>
  );
}
