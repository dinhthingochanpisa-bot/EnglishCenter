'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ModuleBoundary } from '@/components/common/ModuleBoundary';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Plus,
  Search,
} from 'lucide-react';
import { ContractsClient } from '@/lib/api/commercial';
import { Badge } from '@/components/ui/Badge';
import { format } from 'date-fns';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { apiFetch } from '@/lib/api';

type PricingMode = 'CONFIG' | 'MANUAL';

type ContractFormData = {
  studentId: string;
  centerId: string;
  planId: string;
  pricingMode: PricingMode;
  productName: string;
  productRank: string;
  feePackage: string;
  unitPrice: string;
  contractedSessions: string;
  discountSegmentCode: string;
  promotionCodes: string[];
  listPrice: string;
  discountPercent: string;
  discountAmount: string;
  startDate: string;
  endDate: string;
};

const emptyFormData = (): ContractFormData => ({
  studentId: '',
  centerId: '',
  planId: '',
  pricingMode: 'CONFIG',
  productName: '',
  productRank: '',
  feePackage: '',
  unitPrice: '',
  contractedSessions: '',
  discountSegmentCode: '',
  promotionCodes: [],
  listPrice: '',
  discountPercent: '0',
  discountAmount: '0',
  startDate: format(new Date(), 'yyyy-MM-dd'),
  endDate: format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd'),
});

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

const money = (value: any) => `${Number(value || 0).toLocaleString('vi-VN')} đ`;

export default function ContractsPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [crmConfig, setCrmConfig] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ContractFormData>(emptyFormData);

  const pricingRows = useMemo(
    () => (Array.isArray(crmConfig?.pricingMatrix) ? crmConfig.pricingMatrix : []),
    [crmConfig],
  );
  const discountSegments = useMemo(
    () => (Array.isArray(crmConfig?.discountSegments) ? crmConfig.discountSegments : []),
    [crmConfig],
  );
  const promotions = useMemo(
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
      (item: any) => !formData.productName || item.product === formData.productName,
    );
    const configured = uniqueStrings(rows.map((item: any) => item.rank));
    if (configured.length) return configured;
    return uniqueStrings([
      ...(crmConfig?.ranks?.all || []),
      ...(crmConfig?.ranks?.ielts || []),
      ...(crmConfig?.ranks?.sat || []),
      ...(crmConfig?.ranks?.junior || []),
    ]);
  }, [crmConfig, formData.productName, pricingRows]);

  const feePackageOptions = useMemo(() => {
    const rows = pricingRows.filter(
      (item: any) =>
        (!formData.productName || item.product === formData.productName) &&
        (!formData.productRank || item.rank === formData.productRank),
    );
    const configured = uniqueStrings(rows.map((item: any) => item.feePackage));
    if (configured.length) return configured;
    return uniqueStrings([
      ...(crmConfig?.feePackages?.all || []),
      ...(crmConfig?.feePackages?.ielts || []),
      ...(crmConfig?.feePackages?.sat || []),
      ...(crmConfig?.feePackages?.junior || []),
    ]);
  }, [crmConfig, formData.productName, formData.productRank, pricingRows]);

  const selectedPricing = useMemo(
    () =>
      pricingRows.find(
        (item: any) =>
          item.product === formData.productName &&
          item.rank === formData.productRank &&
          item.feePackage === formData.feePackage,
      ),
    [formData.feePackage, formData.productName, formData.productRank, pricingRows],
  );

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const data = await ContractsClient.findAll();
      setContracts(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách hợp đồng');
    } finally {
      setLoading(false);
    }
  };

  const fetchReferenceData = async () => {
    const [configResult, studentsResult, centersResult] = await Promise.allSettled([
      apiFetch('/config/monbay-crm'),
      apiFetch('/students'),
      apiFetch('/centers'),
    ]);

    if (configResult.status === 'fulfilled') setCrmConfig(configResult.value);
    if (studentsResult.status === 'fulfilled') setStudents(studentsResult.value);
    if (centersResult.status === 'fulfilled') setCenters(centersResult.value);
  };

  useEffect(() => {
    fetchContracts();
    fetchReferenceData();
  }, []);

  useEffect(() => {
    if (formData.pricingMode !== 'CONFIG' || !selectedPricing) return;

    const nextUnitPrice = String(Number(selectedPricing.unitPrice || 0));
    const nextSessions = String(sessionCountFromPackage(selectedPricing.feePackage));
    const nextListPrice = String(Number(nextUnitPrice) * Number(nextSessions || 1));

    setFormData((current) => {
      if (
        current.unitPrice === nextUnitPrice &&
        current.contractedSessions === nextSessions &&
        current.listPrice === nextListPrice
      ) {
        return current;
      }
      return {
        ...current,
        unitPrice: nextUnitPrice,
        contractedSessions: nextSessions,
        listPrice: nextListPrice,
      };
    });
  }, [formData.pricingMode, selectedPricing]);

  useEffect(() => {
    if (formData.pricingMode !== 'CONFIG') return;
    const unitPrice = Number(formData.unitPrice || 0);
    const sessions = Number(formData.contractedSessions || 0);
    const nextListPrice = unitPrice && sessions ? String(unitPrice * sessions) : '';

    setFormData((current) =>
      current.listPrice === nextListPrice
        ? current
        : {
            ...current,
            listPrice: nextListPrice,
          },
    );
  }, [formData.pricingMode, formData.unitPrice, formData.contractedSessions]);

  useEffect(() => {
    if (!isModalOpen || formData.pricingMode !== 'CONFIG' || !Number(formData.listPrice)) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    let cancelled = false;
    setIsQuoteLoading(true);
    setQuoteError(null);

    ContractsClient.quote({
      listPrice: Number(formData.listPrice),
      discountSegmentCode: formData.discountSegmentCode || undefined,
      promotionCodes: formData.promotionCodes,
      contractedSessions: formData.contractedSessions
        ? Number(formData.contractedSessions)
        : undefined,
    })
      .then((data) => {
        if (!cancelled) setQuote(data);
      })
      .catch((err: any) => {
        if (!cancelled) {
          setQuote(null);
          setQuoteError(err.message || 'Không thể tính giá từ cấu hình');
        }
      })
      .finally(() => {
        if (!cancelled) setIsQuoteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    formData.contractedSessions,
    formData.discountSegmentCode,
    formData.listPrice,
    formData.pricingMode,
    formData.promotionCodes,
    isModalOpen,
  ]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (!formData.studentId || !formData.centerId) {
        throw new Error('Vui lòng chọn học sinh và trung tâm.');
      }

      if (
        formData.pricingMode === 'CONFIG' &&
        (!formData.productName ||
          !formData.productRank ||
          !formData.feePackage ||
          !Number(formData.unitPrice) ||
          !Number(formData.contractedSessions) ||
          !Number(formData.listPrice))
      ) {
        throw new Error('Vui lòng chọn đủ sản phẩm, hạng, gói phí và số buổi.');
      }

      if (formData.pricingMode === 'MANUAL' && (!formData.planId || !Number(formData.listPrice))) {
        throw new Error('Vui lòng nhập planId và giá gốc.');
      }

      const basePayload: any = {
        studentId: formData.studentId,
        centerId: formData.centerId,
        startDate: formData.startDate,
        endDate: formData.endDate,
      };

      const payload =
        formData.pricingMode === 'CONFIG'
          ? {
              ...basePayload,
              planId: formData.planId || undefined,
              pricingMode: 'CONFIG',
              productName: formData.productName,
              productRank: formData.productRank,
              feePackage: formData.feePackage,
              unitPrice: Number(formData.unitPrice),
              contractedSessions: Number(formData.contractedSessions),
              listPrice: Number(formData.listPrice),
              discountSegmentCode: formData.discountSegmentCode || undefined,
              promotionCodes: formData.promotionCodes,
            }
          : {
              ...basePayload,
              pricingMode: 'MANUAL',
              planId: formData.planId,
              listPrice: Number(formData.listPrice),
              discountPercent: Number(formData.discountPercent),
              discountAmount: Number(formData.discountAmount),
            };

      await ContractsClient.create(payload);
      setSuccess('Tạo hợp đồng thành công.');
      setIsModalOpen(false);
      setFormData(emptyFormData());
      setQuote(null);
      fetchContracts();
    } catch (err: any) {
      setError(err.message || 'Không thể tạo hợp đồng');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-700 border-none">Đang hiệu lực</Badge>;
      case 'DRAFT':
        return <Badge className="bg-slate-100 text-slate-700 border-none">Nháp</Badge>;
      case 'EXPIRED':
        return <Badge className="bg-red-100 text-red-700 border-none">Hết hạn</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const openContractDetail = async (contract: any) => {
    setIsDetailModalOpen(true);
    setSelectedContract(contract);
    setIsDetailLoading(true);
    setError(null);
    try {
      const detail = await ContractsClient.findOne(contract.id);
      setSelectedContract(detail);
    } catch (err: any) {
      setError(err.message || 'Không thể tải chi tiết hợp đồng');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredContracts = normalizedSearch
    ? contracts.filter((contract) => {
        const searchable = [
          contract.code,
          contract.status,
          contract.contractType,
          contract.productName,
          contract.productRank,
          contract.feePackage,
          contract.student?.fullName,
          contract.student?.code,
          contract.center?.name,
          contract.salesperson?.fullName,
        ];
        return searchable
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      })
    : contracts;

  const togglePromotion = (code: string, checked: boolean) => {
    setFormData((current) => ({
      ...current,
      promotionCodes: checked
        ? uniqueStrings([...current.promotionCodes, code])
        : current.promotionCodes.filter((item) => item !== code),
    }));
  };

  return (
    <ModuleBoundary moduleCode="CONTRACT">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FileText className="text-primary" />
              Quản lý hợp đồng
            </h1>
            <p className="text-slate-500">Tính giá hợp đồng theo bảng đơn giá, phân khúc và khuyến mãi đã cấu hình.</p>
          </div>
          <Button className="flex gap-2" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            Tạo hợp đồng mới
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-1">
            <AlertCircle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-600 animate-in fade-in slide-in-from-top-1">
            <CheckCircle2 size={20} />
            <p className="text-sm font-medium">{success}</p>
          </div>
        )}

        <Card className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Tìm theo mã hợp đồng, tên học sinh, sản phẩm..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-full outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p>Đang tải danh sách hợp đồng...</p>
            </div>
          ) : filteredContracts.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <FileText size={48} className="mx-auto mb-4 opacity-20" />
              <p>{normalizedSearch ? 'Không tìm thấy hợp đồng phù hợp.' : 'Chưa có hợp đồng nào.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Mã HĐ</th>
                    <th className="px-4 py-3">Học sinh</th>
                    <th className="px-4 py-3">Gói</th>
                    <th className="px-4 py-3">Trung tâm</th>
                    <th className="px-4 py-3">Giá trị</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Ngày hết hạn</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.map((contract) => (
                    <tr
                      key={contract.id}
                      className="cursor-pointer border-b border-slate-50 text-sm transition-colors hover:bg-slate-50"
                      onClick={() => openContractDetail(contract)}
                    >
                      <td className="px-4 py-4 font-mono font-bold text-slate-700">{contract.code}</td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-900">{contract.student.fullName}</div>
                        <div className="text-xs text-slate-400">{contract.student.code}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        <div>{contract.productName || 'N/A'}</div>
                        <div className="text-xs text-slate-400">
                          {[contract.productRank, contract.feePackage].filter(Boolean).join(' - ') || 'Chưa map'}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{contract.center?.name || 'N/A'}</td>
                      <td className="px-4 py-4 font-bold text-slate-900">{money(contract.finalAmount)}</td>
                      <td className="px-4 py-4">{getStatusBadge(contract.status)}</td>
                      <td className="px-4 py-4 text-slate-500">{format(new Date(contract.endDate), 'dd/MM/yyyy')}</td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          variant="outline"
                          className="gap-2"
                          onClick={(event) => {
                            event.stopPropagation();
                            openContractDetail(contract);
                          }}
                        >
                          <Eye size={16} /> Xem
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={selectedContract?.code ? `Chi tiết hợp đồng ${selectedContract.code}` : 'Chi tiết hợp đồng'}
          size="xl"
          footer={
            <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
              Đóng
            </Button>
          }
        >
          {isDetailLoading ? (
            <div className="flex items-center justify-center gap-3 py-12 text-slate-500">
              <Loader2 className="animate-spin" size={22} />
              Đang tải chi tiết hợp đồng...
            </div>
          ) : selectedContract ? (
            <div className="space-y-6 text-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <DetailItem label="Học sinh" value={`${selectedContract.student?.fullName || 'N/A'} (${selectedContract.student?.code || 'N/A'})`} />
                <DetailItem label="Trung tâm" value={selectedContract.center?.name || 'N/A'} />
                <DetailItem label="Trạng thái" value={selectedContract.status || 'N/A'} />
                <DetailItem label="Ngày bắt đầu" value={selectedContract.startDate ? format(new Date(selectedContract.startDate), 'dd/MM/yyyy') : 'N/A'} />
                <DetailItem label="Ngày kết thúc" value={selectedContract.endDate ? format(new Date(selectedContract.endDate), 'dd/MM/yyyy') : 'N/A'} />
                <DetailItem label="Tư vấn viên" value={selectedContract.salesperson?.fullName || 'N/A'} />
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Gói học</p>
                <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-bold text-slate-900">
                      {[selectedContract.productName, selectedContract.productRank, selectedContract.feePackage].filter(Boolean).join(' - ') || 'Chưa map gói học'}
                    </p>
                    <p className="mt-1 text-slate-500">
                      {selectedContract.contractedSessions || selectedContract.details?.[0]?.quantity || 0} buổi
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500">Giá trị sau CK</p>
                    <p className="text-xl font-black text-slate-900">{money(selectedContract.finalAmount)}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <DetailItem label="HP niêm yết" value={money(selectedContract.listPrice)} />
                <DetailItem label="CK%" value={`${Number(selectedContract.discountPercent || 0)}%`} />
                <DetailItem label="Giảm giá" value={money(selectedContract.discountAmount)} />
                <DetailItem label="HP thực đóng" value={money(selectedContract.finalAmount)} />
              </div>

              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Lịch thanh toán</p>
                <div className="overflow-hidden rounded-xl border border-slate-100">
                  {(selectedContract.paymentSchedule || []).map((schedule: any) => (
                    <div key={schedule.id} className="grid grid-cols-1 gap-2 border-b border-slate-100 p-4 last:border-b-0 md:grid-cols-4">
                      <span>{schedule.dueDate ? format(new Date(schedule.dueDate), 'dd/MM/yyyy') : 'N/A'}</span>
                      <span>Phải thu: {money(schedule.amount)}</span>
                      <span>Đã thu: {money(schedule.paidAmount)}</span>
                      <span className="font-bold">Còn: {money(schedule.remainingAmount)}</span>
                    </div>
                  ))}
                  {selectedContract.paymentSchedule?.length ? null : (
                    <div className="p-4 text-slate-400">Chưa có lịch thanh toán.</div>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">Thanh toán đã ghi nhận</p>
                <div className="overflow-hidden rounded-xl border border-slate-100">
                  {(selectedContract.payments || []).map((payment: any) => (
                    <div key={payment.id} className="grid grid-cols-1 gap-2 border-b border-slate-100 p-4 last:border-b-0 md:grid-cols-4">
                      <span>{payment.paidAt ? format(new Date(payment.paidAt), 'dd/MM/yyyy') : 'N/A'}</span>
                      <span className="font-bold">{money(payment.amount)}</span>
                      <span>{payment.method || 'N/A'}</span>
                      <span className="text-slate-500">{payment.notes || ''}</span>
                    </div>
                  ))}
                  {selectedContract.payments?.length ? null : (
                    <div className="p-4 text-slate-400">Chưa ghi nhận thanh toán.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-400">Chưa chọn hợp đồng.</p>
          )}
        </Modal>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Tạo hợp đồng mới"
          size="xl"
          footer={
            <>
              <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                Hủy
              </Button>
              <Button onClick={handleCreate} disabled={isSubmitting || Boolean(quoteError)}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                Lưu hợp đồng
              </Button>
            </>
          }
        >
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Học sinh</label>
                {students.length ? (
                  <select
                    required
                    value={formData.studentId}
                    onChange={(event) => {
                      const selected = students.find((item) => item.id === event.target.value);
                      setFormData({
                        ...formData,
                        studentId: event.target.value,
                        centerId: selected?.centerId || formData.centerId,
                      });
                    }}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-custom text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Chọn học sinh</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.fullName} - {student.code}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    required
                    placeholder="Nhập studentId..."
                    value={formData.studentId}
                    onChange={(event) => setFormData({ ...formData, studentId: event.target.value })}
                  />
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Trung tâm</label>
                {centers.length ? (
                  <select
                    required
                    value={formData.centerId}
                    onChange={(event) => setFormData({ ...formData, centerId: event.target.value })}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-custom text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Chọn trung tâm</option>
                    {centers.map((center) => (
                      <option key={center.id} value={center.id}>
                        {center.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    required
                    placeholder="Nhập centerId..."
                    value={formData.centerId}
                    onChange={(event) => setFormData({ ...formData, centerId: event.target.value })}
                  />
                )}
              </div>
            </div>

            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              {(['CONFIG', 'MANUAL'] as PricingMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFormData({ ...formData, pricingMode: mode })}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                    formData.pricingMode === mode
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {mode === 'CONFIG' ? 'Theo cấu hình CRM' : 'Nhập thủ công'}
                </button>
              ))}
            </div>

            {formData.pricingMode === 'CONFIG' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sản phẩm</label>
                    <select
                      required
                      value={formData.productName}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          productName: event.target.value,
                          productRank: '',
                          feePackage: '',
                          unitPrice: '',
                          contractedSessions: '',
                          listPrice: '',
                        })
                      }
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-custom text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Chọn sản phẩm</option>
                      {productOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hạng</label>
                    <select
                      required
                      value={formData.productRank}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          productRank: event.target.value,
                          feePackage: '',
                          unitPrice: '',
                          contractedSessions: '',
                          listPrice: '',
                        })
                      }
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-custom text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Chọn hạng</option>
                      {rankOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gói phí</label>
                    <select
                      required
                      value={formData.feePackage}
                      onChange={(event) =>
                        setFormData({
                          ...formData,
                          feePackage: event.target.value,
                          unitPrice: '',
                          contractedSessions: '',
                          listPrice: '',
                        })
                      }
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-custom text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Chọn gói phí</option>
                      {feePackageOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đơn giá/buổi</label>
                    <Input
                      required
                      type="number"
                      value={formData.unitPrice}
                      onChange={(event) => setFormData({ ...formData, unitPrice: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Số buổi</label>
                    <Input
                      required
                      type="number"
                      min="1"
                      value={formData.contractedSessions}
                      onChange={(event) => setFormData({ ...formData, contractedSessions: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Giá gốc</label>
                    <Input readOnly value={money(formData.listPrice)} className="bg-slate-50" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Plan ID tùy chọn</label>
                    <Input
                      placeholder="Để trống để tự map"
                      value={formData.planId}
                      onChange={(event) => setFormData({ ...formData, planId: event.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phân khúc chiết khấu</label>
                    <select
                      value={formData.discountSegmentCode}
                      onChange={(event) => setFormData({ ...formData, discountSegmentCode: event.target.value })}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-custom text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Không áp dụng</option>
                      {discountSegments.map((item: any) => (
                        <option key={item.code} value={item.code}>
                          {item.code} - {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Khuyến mãi đang bật</label>
                    <div className="min-h-[42px] rounded-custom border border-slate-200 p-2">
                      {promotions.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {promotions.map((item: any) => (
                            <label key={item.code} className="flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={formData.promotionCodes.includes(item.code)}
                                onChange={(event) => togglePromotion(item.code, event.target.checked)}
                              />
                              <span>{item.code} - {item.name}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400">Chưa có khuyến mãi active.</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Giá trị tính từ cấu hình</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{money(quote?.finalAmount || formData.listPrice)}</p>
                    </div>
                    {isQuoteLoading ? <Loader2 className="animate-spin text-slate-400" size={22} /> : null}
                  </div>
                  {quoteError ? (
                    <p className="mt-3 text-sm text-red-600">{quoteError}</p>
                  ) : quote ? (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-slate-500">Giá gốc</span>
                        <div className="font-semibold text-slate-900">{money(quote.listPrice)}</div>
                      </div>
                      <div>
                        <span className="text-slate-500">Tổng chiết khấu</span>
                        <div className="font-semibold text-slate-900">{money(quote.totalDiscount)}</div>
                      </div>
                      <div>
                        <span className="text-slate-500">Còn phải thu</span>
                        <div className="font-semibold text-emerald-700">{money(quote.finalAmount)}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">ID gói phí</label>
                  <Input
                    required
                    placeholder="Nhập planId..."
                    value={formData.planId}
                    onChange={(event) => setFormData({ ...formData, planId: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Giá gốc (VND)</label>
                  <Input
                    required
                    type="number"
                    placeholder="Ví dụ: 10000000"
                    value={formData.listPrice}
                    onChange={(event) => setFormData({ ...formData, listPrice: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chiết khấu (%)</label>
                  <Input
                    type="number"
                    value={formData.discountPercent}
                    onChange={(event) => setFormData({ ...formData, discountPercent: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chiết khấu tiền mặt (VND)</label>
                  <Input
                    type="number"
                    value={formData.discountAmount}
                    onChange={(event) => setFormData({ ...formData, discountAmount: event.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ngày bắt đầu</label>
                <Input
                  required
                  type="date"
                  value={formData.startDate}
                  onChange={(event) => setFormData({ ...formData, startDate: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ngày kết thúc</label>
                <Input
                  required
                  type="date"
                  value={formData.endDate}
                  onChange={(event) => setFormData({ ...formData, endDate: event.target.value })}
                />
              </div>
            </div>
          </form>
        </Modal>
      </div>
    </ModuleBoundary>
  );
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <div className="mt-2 font-semibold text-slate-900">{value}</div>
    </div>
  );
}
