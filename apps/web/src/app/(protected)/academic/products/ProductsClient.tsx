'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import {
  Plus,
  ChevronRight,
  Package,
  Loader2,
  AlertCircle,
  FolderTree,
  Pencil,
  Banknote,
} from 'lucide-react';
import { ModuleBoundary } from '@/components/common/ModuleBoundary';

type ModalMode = 'product' | 'program' | 'plan';

const emptyProduct = { name: '', description: '', isActive: true };
const emptyProgram = { productId: '', name: '', code: '', description: '' };
const emptyPlan = { programId: '', name: '', price: '', durationMonths: '3', sessionCount: '' };

export default function ProductsClient() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [programForm, setProgramForm] = useState(emptyProgram);
  const [planForm, setPlanForm] = useState(emptyPlan);

  const programs = useMemo(
    () => data.flatMap((product) => (product.programs || []).map((program: any) => ({ ...program, product }))),
    [data],
  );

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const resp = await apiFetch('/academic/products');
      setData(resp);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh mục sản phẩm');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const openProductModal = () => {
    setFormError(null);
    setProductForm(emptyProduct);
    setModalMode('product');
  };

  const openProgramModal = (productId?: string) => {
    setFormError(null);
    setProgramForm({ ...emptyProgram, productId: productId || data[0]?.id || '' });
    setModalMode('program');
  };

  const openPlanModal = (programId?: string) => {
    setFormError(null);
    setPlanForm({ ...emptyPlan, programId: programId || programs[0]?.id || '' });
    setModalMode('plan');
  };

  const closeModal = () => {
    if (isSaving) return;
    setModalMode(null);
    setFormError(null);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);
    try {
      await apiFetch('/academic/products', {
        method: 'POST',
        body: JSON.stringify(productForm),
      });
      setModalMode(null);
      await fetchProducts();
    } catch (err: any) {
      setFormError(err.message || 'Không thể tạo sản phẩm');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);
    try {
      await apiFetch('/academic/programs', {
        method: 'POST',
        body: JSON.stringify(programForm),
      });
      setModalMode(null);
      await fetchProducts();
    } catch (err: any) {
      setFormError(err.message || 'Không thể tạo chương trình');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError(null);
    try {
      await apiFetch('/academic/plans', {
        method: 'POST',
        body: JSON.stringify({
          programId: planForm.programId,
          name: planForm.name,
          price: Number(planForm.price),
          durationMonths: Number(planForm.durationMonths),
          sessionCount: planForm.sessionCount ? Number(planForm.sessionCount) : undefined,
        }),
      });
      setModalMode(null);
      await fetchProducts();
    } catch (err: any) {
      setFormError(err.message || 'Không thể tạo gói phí');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModuleBoundary moduleCode="PROGRAM_PRODUCT">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Sản phẩm & Chương trình</h1>
            <p className="text-sm text-slate-500">Quản lý danh mục đào tạo, chương trình và gói phí.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => openPlanModal()} disabled={programs.length === 0}>
              <Banknote size={18} /> Thêm gói phí
            </Button>
            <Button variant="secondary" className="gap-2" onClick={() => openProgramModal()} disabled={data.length === 0}>
              <FolderTree size={18} /> Thêm chương trình
            </Button>
            <Button className="gap-2" onClick={openProductModal}>
              <Plus size={18} /> Thêm sản phẩm
            </Button>
          </div>
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
            <p className="text-sm font-medium">Đang tải danh mục...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.map((product) => (
              <Card key={product.id} className="p-0 overflow-hidden border-slate-200 hover:border-primary/30 transition-all shadow-sm hover:shadow-md">
                <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Package size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{product.name}</h3>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Sản phẩm</p>
                    </div>
                  </div>
                  <Badge variant={product.isActive ? 'success' : 'secondary'}>
                    {product.isActive ? 'Đang mở' : 'Tạm dừng'}
                  </Badge>
                </div>

                <div className="p-5 space-y-4">
                  <p className="text-xs text-slate-600 line-clamp-2 min-h-[32px]">
                    {product.description || 'Không có mô tả sản phẩm.'}
                  </p>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <FolderTree size={10} /> Chương trình ({product.programs?.length || 0})
                    </p>
                    <div className="space-y-1">
                      {product.programs?.map((program: any) => (
                        <button
                          key={program.id}
                          type="button"
                          onClick={() => openPlanModal(program.id)}
                          className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100 hover:bg-slate-50 hover:border-primary/30 transition-colors group text-left"
                        >
                          <span>
                            <span className="block text-xs font-medium text-slate-700">{program.name}</span>
                            <span className="block text-[10px] text-slate-400">{program.code}</span>
                          </span>
                          <ChevronRight size={14} className="text-slate-300 group-hover:text-primary transition-colors" />
                        </button>
                      ))}
                      {!product.programs?.length && (
                        <p className="text-[10px] text-slate-400 italic py-2">Chưa có chương trình.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-[11px] font-bold uppercase" onClick={() => openProgramModal(product.id)}>
                    <Pencil size={14} className="mr-1" /> Thêm chương trình
                  </Button>
                  <Button variant="ghost" size="sm" className="px-2" onClick={() => openProgramModal(product.id)} title="Thêm chương trình">
                    <Plus size={16} className="text-slate-500" />
                  </Button>
                </div>
              </Card>
            ))}

            {data.length === 0 && (
              <Card className="col-span-full p-10 text-center text-slate-500">
                Chưa có sản phẩm đào tạo. Bấm "Thêm sản phẩm" để bắt đầu cấu hình danh mục.
              </Card>
            )}
          </div>
        )}

        <Modal isOpen={modalMode === 'product'} onClose={closeModal} title="Thêm sản phẩm đào tạo">
          <form onSubmit={handleCreateProduct} className="space-y-4">
            {formError && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{formError}</div>}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Tên sản phẩm</label>
              <Input required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="VD: Tiếng Anh thiếu nhi" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Mô tả</label>
              <textarea className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20" rows={3} value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeModal} disabled={isSaving}>Hủy</Button>
              <Button type="submit" isLoading={isSaving}>Tạo sản phẩm</Button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={modalMode === 'program'} onClose={closeModal} title="Thêm chương trình">
          <form onSubmit={handleCreateProgram} className="space-y-4">
            {formError && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{formError}</div>}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Thuộc sản phẩm</label>
              <select required className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20" value={programForm.productId} onChange={(e) => setProgramForm({ ...programForm, productId: e.target.value })}>
                {data.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Tên chương trình</label>
                <Input required value={programForm.name} onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })} placeholder="VD: Starters" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Mã chương trình</label>
                <Input required value={programForm.code} onChange={(e) => setProgramForm({ ...programForm, code: e.target.value })} placeholder="VD: STARTERS" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Mô tả</label>
              <textarea className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20" rows={3} value={programForm.description} onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeModal} disabled={isSaving}>Hủy</Button>
              <Button type="submit" isLoading={isSaving}>Tạo chương trình</Button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={modalMode === 'plan'} onClose={closeModal} title="Thêm gói phí">
          <form onSubmit={handleCreatePlan} className="space-y-4">
            {formError && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">{formError}</div>}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Thuộc chương trình</label>
              <select required className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20" value={planForm.programId} onChange={(e) => setPlanForm({ ...planForm, programId: e.target.value })}>
                {programs.map((program) => <option key={program.id} value={program.id}>{program.product.name} - {program.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Tên gói</label>
              <Input required value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="VD: Gói 3 tháng" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Học phí</label>
                <Input required type="number" min="0" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Tháng</label>
                <Input required type="number" min="1" value={planForm.durationMonths} onChange={(e) => setPlanForm({ ...planForm, durationMonths: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Số buổi</label>
                <Input type="number" min="0" value={planForm.sessionCount} onChange={(e) => setPlanForm({ ...planForm, sessionCount: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={closeModal} disabled={isSaving}>Hủy</Button>
              <Button type="submit" isLoading={isSaving}>Tạo gói phí</Button>
            </div>
          </form>
        </Modal>
      </div>
    </ModuleBoundary>
  );
}
