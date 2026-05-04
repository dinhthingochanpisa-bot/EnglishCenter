'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Clock3,
  GraduationCap,
  Loader2,
  Megaphone,
  Package,
  Pencil,
  Plus,
  Save,
  Settings2,
  Shield,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ModuleBoundary } from '@/components/common/ModuleBoundary';
import { apiFetch } from '@/lib/api';
import { useAppDialog } from '@/providers/AppDialogProvider';

type TabKey = 'roles' | 'shifts' | 'leadSources' | 'studentStatuses' | 'catalog' | 'pricing' | 'discountSegments' | 'promotions';

const tabs: Array<{ key: TabKey; label: string; icon: React.ElementType }> = [
  { key: 'roles', label: 'Vai trò', icon: Shield },
  { key: 'shifts', label: 'Ca học', icon: Clock3 },
  { key: 'leadSources', label: 'Nguồn lead', icon: Megaphone },
  { key: 'studentStatuses', label: 'Trạng thái HS', icon: GraduationCap },
  { key: 'catalog', label: 'Sản phẩm & hạng', icon: Package },
  { key: 'pricing', label: 'Gói phí & đơn giá', icon: Tag },
  { key: 'discountSegments', label: 'Phân khúc CK', icon: Tag },
  { key: 'promotions', label: 'Khuyến mãi', icon: Megaphone },
];

const emptyRoleForm = { code: '', name: '', permissionIds: [] as string[] };

export default function BusinessConfigPage() {
  const { confirm, notify } = useAppDialog();
  const [activeTab, setActiveTab] = useState<TabKey>('roles');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [consultSlots, setConsultSlots] = useState<Array<{ code: string; time: string }>>([]);
  const [studentStatuses, setStudentStatuses] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [ranks, setRanks] = useState<any>({ ielts: [], sat: [], junior: [], all: [] });
  const [feePackages, setFeePackages] = useState<any>({ ielts: [], sat: [], junior: [], all: [] });
  const [pricing, setPricing] = useState<any[]>([]);
  const [discountSegments, setDiscountSegments] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);

  const [sourceName, setSourceName] = useState('');
  const [editingSource, setEditingSource] = useState<any>(null);

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [roleForm, setRoleForm] = useState(emptyRoleForm);

  const applyBusinessData = (payload: any) => {
    const config = payload?.config || {};
    setData(payload);
    setConsultSlots(config.consultSlots || []);
    setStudentStatuses(config.officialStudentStatuses || []);
    setProducts(uniqueStrings([...(config.products || []), ...(payload?.products || []).map((item: any) => item.name)]));
    setRanks({
      ielts: config.ranks?.ielts || [],
      sat: config.ranks?.sat || [],
      junior: config.ranks?.junior || [],
      all: config.ranks?.all || [],
    });
    setFeePackages({
      ielts: config.feePackages?.ielts || [],
      sat: config.feePackages?.sat || [],
      junior: config.feePackages?.junior || [],
      all: config.feePackages?.all || [],
    });
    setPricing(config.pricingMatrix || []);
    setDiscountSegments(config.discountSegments || []);
    setPromotions(config.promotions || []);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const resp = await apiFetch('/admin/business-config');
      applyBusinessData(resp);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Không thể tải cấu hình hệ thống');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const permissionGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const permission of data?.permissions || []) {
      const moduleCode = permission.code.split('.')[0] || 'OTHER';
      groups[moduleCode] = groups[moduleCode] || [];
      groups[moduleCode].push(permission);
    }
    return groups;
  }, [data?.permissions]);

  const saveConfigSection = async (section: string, body: any, successTitle: string) => {
    setIsSaving(true);
    try {
      const resp = await apiFetch(`/admin/business-config/${section}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      applyBusinessData(resp);
      notify({ type: 'success', title: successTitle });
    } catch (err: any) {
      notify({ type: 'error', title: 'Không thể lưu cấu hình', message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const openRoleModal = (role: any = null) => {
    setEditingRole(role);
    setRoleForm(
      role
        ? {
            code: role.code,
            name: role.name,
            permissionIds: role.permissions?.map((item: any) => item.permissionId) || [],
          }
        : emptyRoleForm,
    );
    setIsRoleModalOpen(true);
  };

  const saveRole = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await apiFetch(editingRole ? `/admin/roles/${editingRole.id}` : '/admin/roles', {
        method: editingRole ? 'PATCH' : 'POST',
        body: JSON.stringify(roleForm),
      });
      setIsRoleModalOpen(false);
      await fetchData();
    } catch (err: any) {
      notify({ type: 'error', title: 'Không thể lưu vai trò', message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRole = async (role: any) => {
    const ok = await confirm({
      title: 'Xóa vai trò?',
      message: `Vai trò "${role.name}" sẽ bị xóa nếu chưa có người dùng sử dụng.`,
      confirmLabel: 'Xóa vai trò',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await apiFetch(`/admin/roles/${role.id}`, { method: 'DELETE' });
      await fetchData();
    } catch (err: any) {
      notify({ type: 'error', title: 'Không thể xóa vai trò', message: err.message });
    }
  };

  const saveLeadSource = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!sourceName.trim()) return;
    setIsSaving(true);
    try {
      await apiFetch(editingSource ? `/admin/lead-sources/${editingSource.id}` : '/admin/lead-sources', {
        method: editingSource ? 'PATCH' : 'POST',
        body: JSON.stringify({ name: sourceName.trim() }),
      });
      setSourceName('');
      setEditingSource(null);
      await fetchData();
    } catch (err: any) {
      notify({ type: 'error', title: 'Không thể lưu nguồn lead', message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteLeadSource = async (source: any) => {
    const ok = await confirm({
      title: 'Xóa nguồn lead?',
      message: `Nguồn "${source.name}" chỉ xóa được khi chưa có lead sử dụng.`,
      confirmLabel: 'Xóa nguồn',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await apiFetch(`/admin/lead-sources/${source.id}`, { method: 'DELETE' });
      await fetchData();
    } catch (err: any) {
      notify({ type: 'error', title: 'Không thể xóa nguồn lead', message: err.message });
    }
  };

  const updatePricingRow = (index: number, patch: any) => {
    setPricing((current) => current.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const updateDiscountSegmentRow = (index: number, patch: any) => {
    setDiscountSegments((current) => current.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const updatePromotionRow = (index: number, patch: any) => {
    setPromotions((current) => current.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="mb-3 animate-spin" size={32} />
        <p>Đang tải cấu hình...</p>
      </div>
    );
  }

  return (
    <ModuleBoundary moduleCode="SETTINGS_ADMIN">
      <div className="space-y-6 pb-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="rounded-xl bg-primary/10 p-2 text-primary">
                <Settings2 size={24} />
              </span>
              Cấu hình nghiệp vụ
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý các danh mục lấy từ sheet CONFIG của CRM Monbay và đồng bộ vào luồng nghiệp vụ.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">{pricing.length} dòng bảng giá</Badge>
            <Badge variant="outline">{discountSegments.length} phân khúc CK</Badge>
            <Badge variant="outline">{promotions.length} khuyến mãi</Badge>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                  activeTab === tab.key
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'roles' && (
          <Card className="p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Vai trò & quyền</h2>
                <p className="text-sm text-slate-500">Tạo vai trò, đặt mã role và gán permission theo module.</p>
              </div>
              <Button type="button" className="gap-2" onClick={() => openRoleModal()}>
                <Plus size={16} /> Thêm vai trò
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                    <th className="px-3 py-3">Mã</th>
                    <th className="px-3 py-3">Tên vai trò</th>
                    <th className="px-3 py-3">Quyền</th>
                    <th className="px-3 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data?.roles?.map((role: any) => (
                    <tr key={role.id}>
                      <td className="px-3 py-4 font-mono font-bold text-slate-700">{role.code}</td>
                      <td className="px-3 py-4 font-semibold text-slate-900">{role.name}</td>
                      <td className="px-3 py-4">
                        <Badge variant="outline">{role.permissions?.length || 0} quyền</Badge>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => openRoleModal(role)}>
                            <Pencil size={14} />
                          </Button>
                          <Button type="button" variant="danger" size="sm" onClick={() => deleteRole(role)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'shifts' && (
          <Card className="p-6">
            <ConfigHeader
              title="Ca học / ca tư vấn"
              description="Lưu danh sách CA và khung giờ từ sheet CONFIG."
              onSave={() => saveConfigSection('consult-slots', { items: consultSlots }, 'Đã lưu ca học')}
              isSaving={isSaving}
              action={
                <Button type="button" variant="outline" className="gap-2" onClick={() => setConsultSlots((current) => [...current, { code: '', time: '' }])}>
                  <Plus size={16} /> Thêm ca
                </Button>
              }
            />
            <div className="space-y-3">
              {consultSlots.map((slot, index) => (
                <div key={`${slot.code}-${index}`} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr_auto]">
                  <Input value={slot.code} onChange={(event) => setConsultSlots((current) => current.map((item, idx) => idx === index ? { ...item, code: event.target.value } : item))} placeholder="Ca 1" />
                  <Input value={slot.time} onChange={(event) => setConsultSlots((current) => current.map((item, idx) => idx === index ? { ...item, time: event.target.value } : item))} placeholder="8:00 - 10:00" />
                  <Button type="button" variant="ghost" onClick={() => setConsultSlots((current) => current.filter((_, idx) => idx !== index))}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'leadSources' && (
          <Card className="p-6">
            <div className="mb-5">
              <h2 className="font-bold text-slate-900">Nguồn lead</h2>
              <p className="text-sm text-slate-500">Nguồn được lưu vào bảng LeadSource và dùng trực tiếp khi tạo lead.</p>
            </div>
            <form onSubmit={saveLeadSource} className="mb-5 flex flex-col gap-3 md:flex-row">
              <Input value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="VD: Page, Google Ads, Hotline..." />
              <Button type="submit" isLoading={isSaving} className="gap-2">
                <Save size={16} /> {editingSource ? 'Cập nhật' : 'Thêm nguồn'}
              </Button>
              {editingSource && (
                <Button type="button" variant="ghost" onClick={() => { setEditingSource(null); setSourceName(''); }}>
                  <X size={16} />
                </Button>
              )}
            </form>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data?.leadSources?.map((source: any) => (
                <div key={source.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <span className="font-medium text-slate-700">{source.name}</span>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingSource(source); setSourceName(source.name); }}>
                      <Pencil size={14} />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => deleteLeadSource(source)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'studentStatuses' && (
          <Card className="p-6">
            <ConfigHeader
              title="Trạng thái học sinh chính thức"
              description="Danh mục trạng thái theo sheet CONFIG, dùng cho đối soát và mapping dữ liệu nhập."
              onSave={() => saveConfigSection('student-statuses', { items: studentStatuses }, 'Đã lưu trạng thái học sinh')}
              isSaving={isSaving}
            />
            <TagEditor items={studentStatuses} onChange={setStudentStatuses} placeholder="Active, Refire, Bảo lưu..." />
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Enum hệ thống hiện có</p>
              <div className="flex flex-wrap gap-2">
                {data?.enums?.studentStatusEnums?.map((status: string) => <Badge key={status} variant="outline">{status}</Badge>)}
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'catalog' && (
          <Card className="p-6">
            <ConfigHeader
              title="Sản phẩm, hạng và gói phí"
              description="Lưu danh mục lấy từ CONFIG. Sản phẩm sẽ được đồng bộ vào Product/Program."
              onSave={() => saveConfigSection('catalog', { products, ranks, feePackages }, 'Đã lưu danh mục sản phẩm')}
              isSaving={isSaving}
            />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <div>
                <h3 className="mb-3 text-sm font-bold text-slate-900">Sản phẩm</h3>
                <TagEditor items={products} onChange={setProducts} placeholder="IELTS, SAT, JUNIOR..." />
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Hạng</h3>
                <BucketEditors value={ranks} onChange={setRanks} />
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Gói phí</h3>
                <BucketEditors value={feePackages} onChange={setFeePackages} />
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'pricing' && (
          <Card className="p-6">
            <ConfigHeader
              title="Bảng gói phí & đơn giá"
              description="Mỗi dòng sẽ được đồng bộ thành Plan theo dạng: sản phẩm + hạng + gói phí."
              onSave={() => saveConfigSection('pricing', { items: pricing }, 'Đã lưu bảng giá')}
              isSaving={isSaving}
              action={
                <Button type="button" variant="outline" className="gap-2" onClick={() => setPricing((current) => [...current, { product: products[0] || '', rank: ranks.all?.[0] || '', feePackage: feePackages.all?.[0] || '', unitPrice: '' }])}>
                  <Plus size={16} /> Thêm dòng giá
                </Button>
              }
            />
            <datalist id="config-products">{products.map((item) => <option key={item} value={item} />)}</datalist>
            <datalist id="config-ranks">{ranks.all?.map((item: string) => <option key={item} value={item} />)}</datalist>
            <datalist id="config-fee-packages">{feePackages.all?.map((item: string) => <option key={item} value={item} />)}</datalist>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                    <th className="px-2 py-3">Sản phẩm</th>
                    <th className="px-2 py-3">Hạng</th>
                    <th className="px-2 py-3">Gói phí</th>
                    <th className="px-2 py-3">Đơn giá/buổi</th>
                    <th className="px-2 py-3">CK%</th>
                    <th className="px-2 py-3">CK VND</th>
                    <th className="px-2 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {pricing.map((row, index) => (
                    <tr key={`${row.priceKey || index}`}>
                      <td className="px-2 py-3"><input list="config-products" className="w-full rounded-lg border border-slate-200 px-3 py-2" value={row.product || ''} onChange={(event) => updatePricingRow(index, { product: event.target.value })} /></td>
                      <td className="px-2 py-3"><input list="config-ranks" className="w-full rounded-lg border border-slate-200 px-3 py-2" value={row.rank || ''} onChange={(event) => updatePricingRow(index, { rank: event.target.value })} /></td>
                      <td className="px-2 py-3"><input list="config-fee-packages" className="w-full rounded-lg border border-slate-200 px-3 py-2" value={row.feePackage || ''} onChange={(event) => updatePricingRow(index, { feePackage: event.target.value })} /></td>
                      <td className="px-2 py-3"><input type="number" min="0" className="w-full rounded-lg border border-slate-200 px-3 py-2" value={row.unitPrice ?? ''} onChange={(event) => updatePricingRow(index, { unitPrice: event.target.value })} /></td>
                      <td className="px-2 py-3"><input className="w-full rounded-lg border border-slate-200 px-3 py-2" value={row.discountPercent || ''} onChange={(event) => updatePricingRow(index, { discountPercent: event.target.value })} /></td>
                      <td className="px-2 py-3"><input type="number" min="0" className="w-full rounded-lg border border-slate-200 px-3 py-2" value={row.discountAmount ?? ''} onChange={(event) => updatePricingRow(index, { discountAmount: event.target.value })} /></td>
                      <td className="px-2 py-3 text-right">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setPricing((current) => current.filter((_, idx) => idx !== index))}>
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'discountSegments' && (
          <Card className="p-6">
            <ConfigHeader
              title="Phân khúc chiết khấu"
              description="Quản lý các cột SEG_CODE, SEG_NAME, MODE, PCT, VND, MIN_BUOI từ sheet CONFIG."
              onSave={() => saveConfigSection('discount-segments', { items: discountSegments }, 'Đã lưu phân khúc chiết khấu')}
              isSaving={isSaving}
              action={
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setDiscountSegments((current) => [...current, { code: '', name: '', mode: 'BASE', percent: '', amount: 0, minSessions: 0 }])}
                >
                  <Plus size={16} /> Thêm phân khúc
                </Button>
              }
            />
            <ConfigTable
              columns={[
                { key: 'code', label: 'SEG_CODE', placeholder: 'NEW' },
                { key: 'name', label: 'SEG_NAME', placeholder: 'Học sinh mới' },
                { key: 'mode', label: 'MODE', placeholder: 'BASE / ADD_PCT' },
                { key: 'percent', label: 'PCT', placeholder: '0.15 hoặc 15%' },
                { key: 'amount', label: 'VND', placeholder: '0', type: 'number' },
                { key: 'minSessions', label: 'MIN_BUOI', placeholder: '64', type: 'number' },
              ]}
              rows={discountSegments}
              onChange={updateDiscountSegmentRow}
              onDelete={(index) => setDiscountSegments((current) => current.filter((_, idx) => idx !== index))}
            />
          </Card>
        )}

        {activeTab === 'promotions' && (
          <Card className="p-6">
            <ConfigHeader
              title="Khuyến mãi / ưu đãi cộng thêm"
              description="Quản lý PROMO_CODE, PROMO_NAME, MODE, PCT, VND và ACTIVE từ sheet CONFIG."
              onSave={() => saveConfigSection('promotions', { items: promotions }, 'Đã lưu khuyến mãi')}
              isSaving={isSaving}
              action={
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => setPromotions((current) => [...current, { code: '', name: '', mode: 'ADD_PCT', percent: '', amount: 0, active: true }])}
                >
                  <Plus size={16} /> Thêm khuyến mãi
                </Button>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                    <th className="px-2 py-3">PROMO_CODE</th>
                    <th className="px-2 py-3">PROMO_NAME</th>
                    <th className="px-2 py-3">MODE</th>
                    <th className="px-2 py-3">PCT</th>
                    <th className="px-2 py-3">VND</th>
                    <th className="px-2 py-3">ACTIVE</th>
                    <th className="px-2 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {promotions.map((row, index) => (
                    <tr key={`${row.code || index}`}>
                      <td className="px-2 py-3"><input className="w-full rounded-lg border border-slate-200 px-3 py-2" value={row.code || ''} onChange={(event) => updatePromotionRow(index, { code: event.target.value })} /></td>
                      <td className="px-2 py-3"><input className="w-full rounded-lg border border-slate-200 px-3 py-2" value={row.name || ''} onChange={(event) => updatePromotionRow(index, { name: event.target.value })} /></td>
                      <td className="px-2 py-3"><input className="w-full rounded-lg border border-slate-200 px-3 py-2" value={row.mode || ''} onChange={(event) => updatePromotionRow(index, { mode: event.target.value })} /></td>
                      <td className="px-2 py-3"><input className="w-full rounded-lg border border-slate-200 px-3 py-2" value={row.percent ?? ''} onChange={(event) => updatePromotionRow(index, { percent: event.target.value })} /></td>
                      <td className="px-2 py-3"><input type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2" value={row.amount ?? ''} onChange={(event) => updatePromotionRow(index, { amount: event.target.value })} /></td>
                      <td className="px-2 py-3">
                        <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
                          <input type="checkbox" checked={row.active !== false} onChange={(event) => updatePromotionRow(index, { active: event.target.checked })} />
                          Bật
                        </label>
                      </td>
                      <td className="px-2 py-3 text-right">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setPromotions((current) => current.filter((_, idx) => idx !== index))}>
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <Modal isOpen={isRoleModalOpen} onClose={() => setIsRoleModalOpen(false)} title={editingRole ? 'Chỉnh sửa vai trò' : 'Thêm vai trò'} size="lg">
          <form onSubmit={saveRole} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase text-slate-500">Mã vai trò</span>
                <Input required value={roleForm.code} onChange={(event) => setRoleForm((form) => ({ ...form, code: event.target.value }))} placeholder="SALES_LEADER" />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase text-slate-500">Tên vai trò</span>
                <Input required value={roleForm.name} onChange={(event) => setRoleForm((form) => ({ ...form, name: event.target.value }))} placeholder="Sales Leader" />
              </label>
            </div>
            <div className="max-h-[420px] space-y-4 overflow-y-auto rounded-xl border border-slate-100 p-4">
              {Object.entries(permissionGroups).map(([moduleCode, permissions]) => (
                <div key={moduleCode}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{moduleCode}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        const ids = (permissions as any[]).map((item) => item.id);
                        const hasAll = ids.every((id) => roleForm.permissionIds.includes(id));
                        setRoleForm((form) => ({
                          ...form,
                          permissionIds: hasAll
                            ? form.permissionIds.filter((id) => !ids.includes(id))
                            : uniqueStrings([...form.permissionIds, ...ids]),
                        }));
                      }}
                    >
                      Chọn module
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {(permissions as any[]).map((permission) => (
                      <label key={permission.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={roleForm.permissionIds.includes(permission.id)}
                          onChange={(event) => {
                            setRoleForm((form) => ({
                              ...form,
                              permissionIds: event.target.checked
                                ? [...form.permissionIds, permission.id]
                                : form.permissionIds.filter((id) => id !== permission.id),
                            }));
                          }}
                        />
                        {permission.code}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsRoleModalOpen(false)}>Hủy</Button>
              <Button type="submit" isLoading={isSaving}>Lưu vai trò</Button>
            </div>
          </form>
        </Modal>
      </div>
    </ModuleBoundary>
  );
}

function ConfigHeader({
  title,
  description,
  onSave,
  isSaving,
  action,
}: {
  title: string;
  description: string;
  onSave: () => void;
  isSaving: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {action}
        <Button type="button" className="gap-2" isLoading={isSaving} onClick={onSave}>
          <Save size={16} /> Lưu cấu hình
        </Button>
      </div>
    </div>
  );
}

function TagEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [value, setValue] = useState('');
  const addItem = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onChange(uniqueStrings([...items, trimmed]));
    setValue('');
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addItem(); } }} placeholder={placeholder} />
        <Button type="button" variant="outline" onClick={addItem}>
          <Plus size={16} />
        </Button>
      </div>
      <div className="flex min-h-20 flex-wrap gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
        {items.map((item) => (
          <span key={item} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-700 shadow-sm">
            {item}
            <button type="button" className="text-slate-400 hover:text-red-500" onClick={() => onChange(items.filter((current) => current !== item))}>
              <X size={13} />
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-sm italic text-slate-400">Chưa có dữ liệu</span>}
      </div>
    </div>
  );
}

function BucketEditors({ value, onChange }: { value: any; onChange: (value: any) => void }) {
  const buckets = [
    { key: 'all', label: 'Tất cả' },
    { key: 'ielts', label: 'IELTS' },
    { key: 'sat', label: 'SAT' },
    { key: 'junior', label: 'Junior' },
  ];

  return (
    <div className="space-y-4">
      {buckets.map((bucket) => (
        <div key={bucket.key}>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">{bucket.label}</p>
          <TagEditor
            items={value?.[bucket.key] || []}
            onChange={(items) => onChange({ ...value, [bucket.key]: items })}
            placeholder={`Thêm ${bucket.label}`}
          />
        </div>
      ))}
    </div>
  );
}

function ConfigTable({
  columns,
  rows,
  onChange,
  onDelete,
}: {
  columns: Array<{ key: string; label: string; placeholder?: string; type?: string }>;
  rows: any[];
  onChange: (index: number, patch: any) => void;
  onDelete: (index: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
            {columns.map((column) => (
              <th key={column.key} className="px-2 py-3">{column.label}</th>
            ))}
            <th className="px-2 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row, index) => (
            <tr key={`${row.code || index}`}>
              {columns.map((column) => (
                <td key={column.key} className="px-2 py-3">
                  <input
                    type={column.type || 'text'}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={row[column.key] ?? ''}
                    placeholder={column.placeholder}
                    onChange={(event) => onChange(index, { [column.key]: event.target.value })}
                  />
                </td>
              ))}
              <td className="px-2 py-3 text-right">
                <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(index)}>
                  <Trash2 size={14} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function uniqueStrings(items: string[]) {
  const seen = new Set<string>();
  return (items || [])
    .map((item) => String(item || '').trim())
    .filter((item) => {
      if (!item || seen.has(item.toLowerCase())) return false;
      seen.add(item.toLowerCase());
      return true;
    });
}
