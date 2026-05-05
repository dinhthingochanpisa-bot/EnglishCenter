'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Plus,
  Search,
  Filter,
  Users,
  Calendar,
  User,
  MoreVertical,
  Loader2,
  AlertCircle,
  Building2,
  BookOpen,
  X,
} from 'lucide-react';
import { ModuleBoundary } from '@/components/common/ModuleBoundary';
import Link from 'next/link';

export default function ClassesClient() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [programs, setPrograms] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [classForm, setClassForm] = useState({
    name: '',
    code: '',
    programId: '',
    centerId: '',
    capacity: '20',
    status: 'PLANNING',
  });

  const fetchClasses = async () => {
    setIsLoading(true);
    try {
      const resp = await apiFetch('/academic/classes');
      setData(resp);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
    apiFetch('/academic/programs').then(setPrograms).catch(() => setPrograms([]));
    apiFetch('/centers').then(setCenters).catch(() => setCenters([]));
  }, []);

  useEffect(() => {
    setClassForm((current) => ({
      ...current,
      programId: current.programId || programs[0]?.id || '',
      centerId: current.centerId || centers[0]?.id || '',
    }));
  }, [centers, programs]);

  const handleCreateClass = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch('/academic/classes', {
        method: 'POST',
        body: JSON.stringify({ ...classForm, capacity: Number(classForm.capacity || 20) }),
      });
      setShowCreateModal(false);
      setClassForm({
        name: '',
        code: '',
        programId: programs[0]?.id || '',
        centerId: centers[0]?.id || '',
        capacity: '20',
        status: 'PLANNING',
      });
      await fetchClasses();
    } catch (err: any) {
      setError(err.message || 'Khong the mo lop moi');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PLANNING': return 'secondary';
      case 'ACTIVE': return 'success';
      case 'FINISHED': return 'info';
      case 'CANCELLED': return 'error';
      default: return 'secondary';
    }
  };

  const filteredData = data.filter(cls => 
    cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cls.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ModuleBoundary moduleCode="CLASS_ACADEMIC">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Quản lý lớp học</h1>
            <p className="text-sm text-slate-500">Tổ chức lớp, xếp lịch và theo dõi học tập</p>
          </div>
          <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} /> Mở lớp mới
          </Button>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm kiếm theo mã lớp, tên lớp..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="secondary" className="gap-2 shadow-sm">
            <Filter size={18} /> Bộ lọc
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 flex items-center gap-3">
            <AlertCircle size={20} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="animate-spin" size={32} />
            <p className="text-sm font-medium">Đang tải danh sách lớp...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredData.map((cls) => (
              <Link key={cls.id} href={`/academic/classes/${cls.id}`}>
                <Card className="p-5 hover:border-primary/30 transition-all cursor-pointer group shadow-sm hover:shadow-md">
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors">{cls.name}</h3>
                        <Badge variant={getStatusColor(cls.status)} className="text-[10px] py-0">
                          {cls.status}
                        </Badge>
                      </div>
                      <p className="text-xs font-mono text-slate-400 uppercase">{cls.code}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="p-1 h-auto">
                      <MoreVertical size={16} />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <BookOpen size={14} className="text-slate-400" />
                      <span>{cls.program?.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <Building2 size={14} className="text-slate-400" />
                      <span>{cls.center?.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <User size={14} className="text-slate-400" />
                      <span>GV: {cls.teacher?.fullName || 'Chưa phân công'}</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                      <Users size={14} />
                      <span>{cls._count.students} / {cls.capacity}</span>
                    </div>
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500" 
                        style={{ width: `${Math.min((cls._count.students / cls.capacity) * 100, 100)}%` }} 
                      />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <form onSubmit={handleCreateClass} className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2 className="text-lg font-bold text-slate-900">Mo lop moi</h2>
                <button type="button" onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700">
                  <X size={20} />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                <label className="text-sm text-slate-600">
                  Ten lop *
                  <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20" value={classForm.name} onChange={(event) => setClassForm((form) => ({ ...form, name: event.target.value }))} required />
                </label>
                <label className="text-sm text-slate-600">
                  Ma lop
                  <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20" value={classForm.code} onChange={(event) => setClassForm((form) => ({ ...form, code: event.target.value }))} placeholder="Tu sinh neu de trong" />
                </label>
                <label className="text-sm text-slate-600">
                  Chuong trinh *
                  <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20" value={classForm.programId} onChange={(event) => setClassForm((form) => ({ ...form, programId: event.target.value }))} required>
                    <option value="">Chon chuong trinh</option>
                    {programs.map((program: any) => (
                      <option key={program.id} value={program.id}>{program.product?.name ? `${program.product.name} - ` : ''}{program.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-600">
                  Trung tam *
                  <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20" value={classForm.centerId} onChange={(event) => setClassForm((form) => ({ ...form, centerId: event.target.value }))} required>
                    <option value="">Chon trung tam</option>
                    {centers.map((center: any) => (
                      <option key={center.id} value={center.id}>{center.code} - {center.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-600">
                  Si so toi da
                  <input type="number" min="1" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20" value={classForm.capacity} onChange={(event) => setClassForm((form) => ({ ...form, capacity: event.target.value }))} />
                </label>
                <label className="text-sm text-slate-600">
                  Trang thai
                  <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20" value={classForm.status} onChange={(event) => setClassForm((form) => ({ ...form, status: event.target.value }))}>
                    <option value="PLANNING">PLANNING</option>
                    <option value="ACTIVE">ACTIVE</option>
                  </select>
                </label>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>Huy</Button>
                <Button type="submit" disabled={isSaving || !classForm.name || !classForm.programId || !classForm.centerId}>
                  {isSaving ? 'Dang luu...' : 'Mo lop'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </ModuleBoundary>
  );
}
