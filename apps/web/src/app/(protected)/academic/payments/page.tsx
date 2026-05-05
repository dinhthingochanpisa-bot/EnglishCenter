'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ModuleBoundary } from '@/components/common/ModuleBoundary';
import { Wallet, Plus, Search, ArrowUpRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PaymentsClient } from '@/lib/api/commercial';
import { Badge } from '@/components/ui/Badge';
import { format } from 'date-fns';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [receivables, setReceivables] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contractSearch, setContractSearch] = useState('');
  const [formData, setFormData] = useState({
    contractId: '',
    amount: '',
    method: 'TRANSFER',
    notes: 'Đặt cọc',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [paymentsData, receivablesData, contractsData] = await Promise.all([
        PaymentsClient.findAll(),
        PaymentsClient.getReceivables(),
        PaymentsClient.getContracts(),
      ]);
      setPayments(paymentsData);
      setReceivables(receivablesData);
      setContracts(contractsData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch payment data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await PaymentsClient.create({
        ...formData,
        amount: Number(formData.amount),
      });
      setSuccess('Ghi nhận thanh toán thành công!');
      setIsModalOpen(false);
      fetchData();
      // Reset form
      setFormData({
        contractId: '',
        amount: '',
        method: 'TRANSFER',
        notes: 'Đặt cọc',
      });
      setContractSearch('');
    } catch (err: any) {
      setError(err.message || 'Không thể ghi nhận thanh toán');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalOutstanding = receivables.reduce((sum, r) => sum + Number(r.remainingAmount || r.amount), 0);
  const accountingNoteOptions = [
    'Đặt cọc',
    'Hoàn thành học phí',
    'Nộp phí test đầu vào',
    'Nộp lệ phí thi thật',
    'Nộp phí mock test',
  ];
  const contractOptions = contracts.map((contract) => {
    const receivable = receivables.find((item) => item.contractId === contract.id);
    const student = contract.student || {};
    return {
      id: contract.id,
      amount: receivable ? String(receivable.remainingAmount || receivable.amount || '') : '',
      receivable,
      contract,
      student,
      label: `${contract.code || contract.id} - ${student.fullName || 'N/A'}`,
      subLabel: [student.code, contract.productName, contract.productRank, contract.feePackage, contract.center?.name].filter(Boolean).join(' • '),
      searchText: [contract.id, contract.code, student.fullName, student.code, contract.productName, contract.productRank, contract.feePackage, contract.center?.name].filter(Boolean).join(' ').toLowerCase(),
    };
  });
  const filteredContractOptions = contractOptions
    .filter((option) => !contractSearch.trim() || option.searchText.includes(contractSearch.trim().toLowerCase()))
    .slice(0, 8);

  const selectContract = (option: { id: string; amount: string; label: string }) => {
    setFormData((current) => ({ ...current, contractId: option.id, amount: option.amount || '' }));
    setContractSearch(option.label);
  };
  const selectedContractOption = contractOptions.find((option) => option.id === formData.contractId);
  const handleContractInputChange = (value: string) => {
    setContractSearch(value);
    const normalizedValue = value.trim().toLowerCase();
    const exactMatch = contractOptions.find((option) => {
      const contractCode = String(option.contract?.code || '').toLowerCase();
      return option.id.toLowerCase() === normalizedValue || contractCode === normalizedValue;
    });

    if (exactMatch) {
      selectContract(exactMatch);
      return;
    }

    setFormData((current) => ({ ...current, contractId: value }));
  };

  return (
    <ModuleBoundary moduleCode="PAYMENT_RECEIVABLE">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Wallet className="text-primary" />
              Thanh toán & Công nợ
            </h1>
            <p className="text-slate-500">Theo dõi lịch sử đóng phí và các khoản công nợ chưa hoàn thành.</p>
          </div>
          <Button className="flex gap-2" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            Ghi nhận thanh toán
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 bg-primary/5 border-primary/10">
            <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Tổng nợ chưa thu</p>
            <p className="text-2xl font-black text-primary">{totalOutstanding.toLocaleString()} ₫</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Thanh toán gần đây</p>
            <p className="text-2xl font-black text-slate-900">{payments.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Schedules chờ xử lý</p>
            <p className="text-2xl font-black text-slate-900">{receivables.length}</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                Lịch sử thanh toán
                <ArrowUpRight size={16} className="text-slate-400" />
              </h3>
            </div>
            
            {loading && payments.length === 0 ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-300" /></div>
            ) : payments.length === 0 ? (
              <p className="text-center py-10 text-slate-400 text-sm">Chưa có giao dịch nào.</p>
            ) : (
              <div className="space-y-4">
                {payments.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 rounded-xl border border-slate-50 hover:border-slate-100 transition-all">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{p.contract?.student?.fullName || 'N/A'}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-mono">{p.contract?.code}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-emerald-600 text-sm">+{Number(p.amount).toLocaleString()} ₫</div>
                      <div className="text-[10px] text-slate-400">{format(new Date(p.paidAt), 'dd/MM/yyyy HH:mm')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                Công nợ hiện tại (Receivables)
                <ArrowUpRight size={16} className="text-slate-400" />
              </h3>
            </div>
            
            {loading && receivables.length === 0 ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-300" /></div>
            ) : receivables.length === 0 ? (
              <p className="text-center py-10 text-slate-400 text-sm">Không có công nợ tồn đọng.</p>
            ) : (
              <div className="space-y-4">
                {receivables.map(r => (
                  <div 
                    key={r.id} 
                    className="flex justify-between items-center p-3 rounded-xl border border-slate-50 hover:border-slate-100 transition-all cursor-pointer"
                    onClick={() => {
                        setFormData({...formData, contractId: r.contractId, amount: String(r.remainingAmount || r.amount)});
                        setContractSearch(`${r.contract?.code || r.contractId} - ${r.contract?.student?.fullName || 'N/A'}`);
                        setIsModalOpen(true);
                    }}
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{r.contract?.student?.fullName || 'N/A'}</div>
                      <Badge variant="outline" className="text-[10px] py-0">{r.status}</Badge>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-red-500 text-sm">{Number(r.remainingAmount || r.amount).toLocaleString()} ₫</div>
                      <div className="text-[10px] text-slate-400">Hạn: {format(new Date(r.dueDate), 'dd/MM/yyyy')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Create Modal */}
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title="Ghi Nhận Thanh Toán"
          footer={
            <>
              <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Hủy</Button>
              <Button onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                Xác nhận thanh toán
              </Button>
            </>
          }
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hợp đồng</label>
              <div className="relative">
                <Input
                  required
                  placeholder="Tim theo ten hoc sinh, ma HD, ma HS, goi phi..."
                  value={contractSearch || formData.contractId}
                  onChange={e => handleContractInputChange(e.target.value)}
                />
                {contractSearch && filteredContractOptions.length > 0 && (
                  <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    {filteredContractOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50"
                        onClick={() => selectContract(option)}
                      >
                        <div className="text-sm font-bold text-slate-800">{option.label}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{option.subLabel}</div>
                        <div className="mt-1 text-xs font-semibold text-red-500">
                          Con no: {option.amount ? `${Number(option.amount).toLocaleString()} ₫` : 'Chua co goi y'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedContractOption && (
                <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm md:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Hoc sinh</p>
                    <p className="font-semibold text-slate-800">{selectedContractOption.student?.fullName || 'N/A'}</p>
                    <p className="text-xs text-slate-500">{selectedContractOption.student?.code || ''}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Ma hop dong</p>
                    <p className="font-mono font-semibold text-slate-800">{selectedContractOption.contract?.code || selectedContractOption.id}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Goi hoc</p>
                    <p className="font-semibold text-slate-800">
                      {[selectedContractOption.contract?.productName, selectedContractOption.contract?.productRank, selectedContractOption.contract?.feePackage].filter(Boolean).join(' - ') || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Con no</p>
                    <p className="font-bold text-red-500">
                      {selectedContractOption.amount ? `${Number(selectedContractOption.amount).toLocaleString()} ₫` : 'Chua co goi y'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Trung tam</p>
                    <p className="font-semibold text-slate-800">{selectedContractOption.contract?.center?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Han thu</p>
                    <p className="font-semibold text-slate-800">
                      {selectedContractOption.receivable?.dueDate ? format(new Date(selectedContractOption.receivable.dueDate), 'dd/MM/yyyy') : 'N/A'}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Số tiền thanh toán (VND)</label>
              <Input 
                required
                type="number"
                placeholder="Ví dụ: 5000000"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phương thức</label>
              <select 
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-custom text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                value={formData.method}
                onChange={e => setFormData({...formData, method: e.target.value})}
              >
                <option value="CASH">Tiền mặt</option>
                <option value="TRANSFER">Chuyển khoản</option>
                <option value="CARD">Quẹt thẻ</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nội dung</label>
              <select
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-custom text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
              >
                {accountingNoteOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </form>
        </Modal>
      </div>
    </ModuleBoundary>
  );
}
