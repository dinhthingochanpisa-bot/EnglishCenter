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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    contractId: '',
    amount: '',
    method: 'TRANSFER',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [paymentsData, receivablesData] = await Promise.all([
        PaymentsClient.findAll(),
        PaymentsClient.getReceivables(),
      ]);
      setPayments(paymentsData);
      setReceivables(receivablesData);
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
        notes: '',
      });
    } catch (err: any) {
      setError(err.message || 'Không thể ghi nhận thanh toán');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalOutstanding = receivables.reduce((sum, r) => sum + Number(r.remainingAmount || r.amount), 0);

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
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hợp đồng (ID)</label>
              <Input 
                required
                placeholder="Nhập hoặc chọn contractId..."
                value={formData.contractId}
                onChange={e => setFormData({...formData, contractId: e.target.value})}
              />
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
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ghi chú</label>
              <Input 
                placeholder="Lý do, mã tham chiếu..."
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
              />
            </div>
          </form>
        </Modal>
      </div>
    </ModuleBoundary>
  );
}
