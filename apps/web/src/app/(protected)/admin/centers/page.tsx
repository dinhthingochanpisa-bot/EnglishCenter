
'use client';

import React, { useEffect, useState } from 'react';
import { Building2, Check, Edit2, MapPin, Phone, Plus, Trash2, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { apiFetch } from '@/lib/api';
import { useAppDialog } from '@/providers/AppDialogProvider';

export default function CentersPage() {
  const { confirm } = useAppDialog();
  const [centers, setCenters] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
  });

  useEffect(() => {
    fetchCenters();
  }, []);

  const fetchCenters = async () => {
    try {
      const data = await apiFetch('/admin/centers');
      setCenters(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách trung tâm');
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = (center: any = null) => {
    setFormError(null);
    setEditingCenter(center);
    setFormData({
      name: center?.name || '',
      code: center?.code || '',
      address: center?.address || '',
      phone: center?.phone || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setFormError(null);

    try {
      const savedCenter = await apiFetch(
        editingCenter ? `/admin/centers/${editingCenter.id}` : '/admin/centers',
        {
          method: editingCenter ? 'PATCH' : 'POST',
          body: JSON.stringify(formData),
        },
      );

      setCenters((current) => {
        if (editingCenter) {
          return current.map((center) => (center.id === savedCenter.id ? savedCenter : center));
        }
        return [savedCenter, ...current];
      });
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Không thể lưu trung tâm');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await confirm({
      title: 'Xóa trung tâm?',
      message: `Trung tâm "${name}" sẽ bị xóa khỏi hệ thống. Thao tác này không thể hoàn tác.`,
      confirmLabel: 'Xóa trung tâm',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await apiFetch(`/admin/centers/${id}`, { method: 'DELETE' });
      setCenters((current) => current.filter((center) => center.id !== id));
    } catch (err: any) {
      setError(err.message || 'Không thể xóa trung tâm');
    }
  };

  if (isLoading) {
    return <div className="py-20 text-center text-slate-500">Đang tải danh sách trung tâm...</div>;
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý trung tâm</h1>
          <p className="mt-1 text-slate-500">Quản lý chi nhánh, địa chỉ, liên hệ và quy mô vận hành.</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2">
          <Plus size={18} />
          Thêm trung tâm
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {centers.map((center) => (
          <Card key={center.id} className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 size={24} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-slate-900">{center.name}</h2>
                    <Badge variant="info">{center.code}</Badge>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-500">
                    <p className="flex items-center gap-2">
                      <MapPin size={15} /> {center.address || 'Chưa có địa chỉ'}
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone size={15} /> {center.phone || 'Chưa có số điện thoại'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openModal(center)} className="h-8 w-8 p-0">
                  <Edit2 size={14} />
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(center.id, center.name)} className="h-8 w-8 p-0">
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-5">
              <CenterMetric icon={<Users size={16} />} label="Người dùng" value={center._count?.users || 0} />
              <CenterMetric icon={<Check size={16} />} label="Học viên" value={center._count?.students || 0} />
              <CenterMetric icon={<Building2 size={16} />} label="Hợp đồng" value={center._count?.contracts || 0} />
            </div>
          </Card>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-6">
              <h2 className="text-xl font-bold text-slate-900">
                {editingCenter ? 'Chỉnh sửa trung tâm' : 'Thêm trung tâm mới'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 transition hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 p-6">
              {formError && (
                <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase text-slate-500">Tên trung tâm</span>
                  <input
                    required
                    value={formData.name}
                    onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase text-slate-500">Mã trung tâm</span>
                  <input
                    required
                    value={formData.code}
                    onChange={(event) => setFormData({ ...formData, code: event.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </label>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Địa chỉ</span>
                <input
                  value={formData.address}
                  onChange={(event) => setFormData({ ...formData, address: event.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-slate-500">Số điện thoại</span>
                <input
                  value={formData.phone}
                  onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <div className="flex justify-end gap-3 border-t border-slate-50 pt-6">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Hủy
                </Button>
                <Button type="submit" isLoading={isSaving} className="min-w-[120px]">
                  Lưu thay đổi
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CenterMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-slate-400">{icon}</div>
      <p className="mt-2 text-lg font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
