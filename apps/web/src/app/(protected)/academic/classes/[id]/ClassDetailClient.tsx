'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  ChevronLeft,
  Calendar,
  Users,
  CheckCircle2,
  GraduationCap,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Clock,
  MapPin,
  Save,
  X,
  Pencil,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppDialog } from '@/providers/AppDialogProvider';
import { AuditTrail } from '@/components/common/AuditTrail';

type Tab = 'overview' | 'roster' | 'attendance' | 'results';

export default function ClassDetailClient({ id }: { id: string }) {
  const { notify } = useAppDialog();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [editForm, setEditForm] = useState({ name: '', code: '', status: 'PLANNING', capacity: '20' });
  const router = useRouter();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const resp = await apiFetch(`/academic/classes/${id}`);
      setData(resp);
      
      // Initialize attendance records based on students
      if (resp.students) {
        setAttendanceRecords(resp.students.map((s: any) => ({
          studentId: s.student.id,
          fullName: s.student.fullName,
          status: 'PRESENT'
        })));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const openEnrollModal = async () => {
    setShowEnrollModal(true);
    setSelectedStudentId('');
    try {
      const students = await apiFetch(`/academic/classes/${id}/available-students`);
      setAvailableStudents(students as any[]);
    } catch (err: any) {
      setAvailableStudents([]);
      notify({
        type: 'error',
        title: 'Không thể tải danh sách học sinh',
        message: err.message,
      });
    }
  };

  const openEditModal = () => {
    setEditForm({
      name: data.name || '',
      code: data.code || '',
      status: data.status || 'PLANNING',
      capacity: String(data.capacity || 20),
    });
    setShowEditModal(true);
  };

  const handleUpdateClass = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await apiFetch(`/academic/classes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editForm.name.trim(),
          code: editForm.code.trim(),
          status: editForm.status,
          capacity: Number(editForm.capacity || 20),
        }),
      });
      setShowEditModal(false);
      await fetchData();
      notify({ type: 'success', title: 'Đã cập nhật thông tin lớp' });
    } catch (err: any) {
      notify({ type: 'error', title: 'Không thể cập nhật lớp', message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEnrollStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedStudentId) return;

    setIsSaving(true);
    try {
      await apiFetch(`/academic/classes/${id}/enroll`, {
        method: 'POST',
        body: JSON.stringify({ studentId: selectedStudentId }),
      });
      setShowEnrollModal(false);
      await fetchData();
      notify({ type: 'success', title: 'Đã thêm học sinh vào lớp' });
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Không thể thêm học sinh',
        message: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnenrollStudent = async (studentId: string) => {
    setIsSaving(true);
    try {
      await apiFetch(`/academic/classes/${id}/unenroll/${studentId}`, { method: 'DELETE' });
      await fetchData();
      notify({ type: 'success', title: 'Đã xóa học sinh khỏi lớp' });
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Không thể xóa học sinh',
        message: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAttendance = async () => {
    try {
      await apiFetch('/academic/attendance/batch', {
        method: 'POST',
        body: JSON.stringify({
          classId: id,
          date: attendanceDate,
          records: attendanceRecords.map(r => ({
            studentId: r.studentId,
            status: r.status,
          }))
        })
      });
      notify({ type: 'success', title: 'Đã lưu điểm danh' });
    } catch (err: any) {
      notify({
        type: 'error',
        title: 'Không thể lưu điểm danh',
        message: err.message,
      });
    }
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 gap-3">
      <Loader2 className="animate-spin" size={40} />
      <p className="font-medium">Đang tải chi tiết lớp học...</p>
    </div>
  );

  if (error || !data) return (
    <div className="p-10 text-center">
      <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
      <h2 className="text-xl font-bold text-slate-900 mb-2">Lỗi tải dữ liệu</h2>
      <p className="text-slate-500 mb-6">{error || 'Không tìm thấy lớp học'}</p>
      <Button onClick={() => router.back()}>Quay lại</Button>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Link href="/academic/classes">
          <Button variant="ghost" size="sm" className="p-2 h-auto rounded-full hover:bg-slate-100">
            <ChevronLeft size={20} />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{data.name}</h1>
            <Badge variant="success">{getClassStatusLabel(data.status)}</Badge>
          </div>
          <p className="text-sm text-slate-500 font-medium">{data.program?.name} • {data.code}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={openEditModal}>
            <Pencil size={18} /> Chỉnh sửa
          </Button>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
        {[
          { id: 'overview', label: 'Tổng quan', icon: Calendar },
          { id: 'roster', label: 'Danh sách lớp', icon: Users },
          { id: 'attendance', label: 'Điểm danh', icon: CheckCircle2 },
          { id: 'results', label: 'Kết quả học tập', icon: GraduationCap },
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
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-6 space-y-8">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
                  <Clock size={16} className="text-primary" /> Lịch học
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.schedules?.map((s: any) => (
                    <div key={s.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-primary font-bold">
                        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][s.dayOfWeek - 1]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{s.startTime} - {s.endTime}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin size={10} /> Phòng: {s.room || 'Chưa xếp'}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!data.schedules?.length && <p className="text-sm text-slate-400 italic">Chưa có lịch học.</p>}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-wider">
                  Giáo viên & Quản lý
                </h3>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 w-full md:w-1/2">
                   <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                      {data.teacher?.fullName?.charAt(0) || 'GV'}
                   </div>
                   <div>
                      <p className="text-sm font-bold text-slate-900">{data.teacher?.fullName || 'Chưa phân công'}</p>
                      <p className="text-xs text-slate-500">Giáo viên chủ nhiệm</p>
                   </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 h-fit bg-slate-900 text-white border-none shadow-xl shadow-slate-200">
               <h3 className="text-xs font-bold uppercase tracking-[0.2em] opacity-60 mb-6">Trạng thái vận hành</h3>
               <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-sm opacity-80">Sĩ số hiện tại</span>
                    <span className="text-lg font-bold">{data._count?.students || 0} / {data.capacity}</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)] transition-all duration-1000" 
                      style={{ width: `${(data._count?.students / data.capacity) * 100}%` }} 
                    />
                  </div>
                  <div className="pt-4 space-y-3">
                    <div className="flex items-center justify-between text-xs opacity-70">
                       <span>Tỷ lệ lấp đầy</span>
                       <span>{Math.round((data._count?.students / data.capacity) * 100)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs opacity-70">
                       <span>Ngày bắt đầu</span>
                       <span>24/04/2026</span>
                    </div>
                  </div>
               </div>
            </Card>
            <AuditTrail entityType="Class" entityId={id} />
          </div>
        )}

        {activeTab === 'roster' && (
          <Card className="p-0 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
               <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Danh sách học sinh ({data.students?.length || 0})</h3>
               <Button size="sm" className="gap-2" onClick={openEnrollModal}>
                 <Plus size={16} /> Thêm học sinh
               </Button>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/30 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Học sinh</th>
                  <th className="px-6 py-4">Mã số</th>
                  <th className="px-6 py-4">Trạng thái</th>
                  <th className="px-6 py-4">Ngày vào lớp</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.students?.map((s: any) => (
                  <tr key={s.student.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <Link href={`/students/${s.student.id}`} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold">
                          {s.student.fullName?.charAt(0)}
                        </div>
                        <span className="text-sm font-bold text-slate-700 group-hover:text-primary transition-colors">{s.student.fullName}</span>
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500 uppercase">{s.student.code}</td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tighter">{getStudentStatusLabel(s.student.status)}</Badge>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">{new Date(s.joinedAt).toLocaleDateString('vi-VN')}</td>
                    <td className="px-6 py-4 text-right">
                       <button
                         className="text-slate-300 hover:text-red-500 transition-colors"
                         onClick={() => handleUnenrollStudent(s.student.id)}
                         disabled={isSaving}
                       >
                         <Trash2 size={16} />
                       </button>
                    </td>
                  </tr>
                ))}
                {!data.students?.length && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-sm italic">
                      Chưa có học sinh nào trong danh sách.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}

        {activeTab === 'attendance' && (
          <Card className="p-6">
            <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-100">
               <div className="space-y-1">
                 <h3 className="text-lg font-bold text-slate-900">Điểm danh lớp học</h3>
                 <p className="text-xs text-slate-500">Ghi nhận sự tham gia của học sinh theo buổi học</p>
               </div>
               <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Ngày điểm danh</label>
                    <input 
                      type="date" 
                      value={attendanceDate}
                      onChange={(e) => setAttendanceDate(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <Button className="gap-2" onClick={handleSaveAttendance}>
                    <Save size={18} /> Lưu kết quả
                  </Button>
               </div>
            </div>

            <div className="space-y-3">
              {attendanceRecords.map((r, idx) => (
                <div key={r.studentId} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white hover:border-primary/20 transition-all shadow-sm">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center font-bold border border-slate-100">
                        {r.fullName?.charAt(0)}
                      </div>
                      <span className="text-sm font-bold text-slate-700">{r.fullName}</span>
                   </div>
                   <div className="flex gap-2">
                      {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((status) => (
                        <button
                          key={status}
                          onClick={() => {
                            const newRecords = [...attendanceRecords];
                            newRecords[idx].status = status;
                            setAttendanceRecords(newRecords);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                            r.status === status 
                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                            : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          {status === 'PRESENT' ? 'Có mặt' : status === 'ABSENT' ? 'Vắng' : status === 'LATE' ? 'Muộn' : 'Có phép'}
                        </button>
                      ))}
                   </div>
                </div>
              ))}
            </div>
          </Card>
        )}
        
        {activeTab === 'results' && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <GraduationCap size={48} className="mb-4 opacity-50" />
            <p className="text-sm font-medium">Tính năng ghi nhận kết quả và báo cáo học tập đang được hoàn thiện.</p>
            <Button variant="outline" className="mt-6">Nhập điểm thủ công</Button>
          </div>
        )}
      </div>
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={handleUpdateClass} className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Chỉnh sửa thông tin lớp</h2>
              <button type="button" onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
              <ClassEditField label="Tên lớp" value={editForm.name} onChange={(value) => setEditForm((form) => ({ ...form, name: value }))} required />
              <ClassEditField label="Mã lớp" value={editForm.code} onChange={(value) => setEditForm((form) => ({ ...form, code: value }))} required />
              <ClassEditField label="Sĩ số tối đa" type="number" value={editForm.capacity} onChange={(value) => setEditForm((form) => ({ ...form, capacity: value }))} required />
              <label className="text-sm text-slate-600">
                Trạng thái
                <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20" value={editForm.status} onChange={(event) => setEditForm((form) => ({ ...form, status: event.target.value }))}>
                  <option value="PLANNING">Đang lên kế hoạch</option>
                  <option value="ACTIVE">Đang học</option>
                  <option value="FINISHED">Đã kết thúc</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>Hủy</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? 'Đang lưu...' : 'Lưu thông tin'}</Button>
            </div>
          </form>
        </div>
      )}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={handleEnrollStudent} className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Thêm học sinh vào lớp</h2>
              <button type="button" onClick={() => setShowEnrollModal(false)} className="text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <label className="text-sm text-slate-600">
                Học sinh
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20"
                  value={selectedStudentId}
                  onChange={(event) => setSelectedStudentId(event.target.value)}
                  required
                >
                  <option value="">Chọn học sinh</option>
                  {availableStudents.map((student: any) => (
                    <option key={student.id} value={student.id}>
                      {student.code} - {student.fullName}
                    </option>
                  ))}
                </select>
              </label>
              {!availableStudents.length && (
                <p className="mt-3 text-sm text-slate-400">Không còn học sinh phù hợp để thêm vào lớp này.</p>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setShowEnrollModal(false)}>Hủy</Button>
              <Button type="submit" disabled={isSaving || !selectedStudentId}>
                {isSaving ? 'Đang lưu...' : 'Thêm học sinh'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ClassEditField({
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
    <label className="text-sm text-slate-600">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function getClassStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PLANNING: 'Đang lên kế hoạch',
    ACTIVE: 'Đang học',
    FINISHED: 'Đã kết thúc',
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
