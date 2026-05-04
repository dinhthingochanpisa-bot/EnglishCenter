'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ModuleBoundary } from '@/components/common/ModuleBoundary';
import { RefreshCw, Users, Search, Bell, Loader2, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { RenewalsClient } from '@/lib/api/commercial';
import { Badge } from '@/components/ui/Badge';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';

export default function RenewalsPage() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const data = await RenewalsClient.findCandidates();
      setCandidates(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách học sinh sắp hết hạn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const handleCreateRenewal = async (contractId: string) => {
    setProcessingId(contractId);
    setError(null);
    setSuccess(null);
    try {
      await RenewalsClient.createRenewal(contractId);
      setSuccess('Đã tạo bản ghi gia hạn thành công!');
      // Refresh list to remove the candidate (or show updated status)
      await fetchCandidates();
    } catch (err: any) {
      setError(err.message || 'Không thể tạo bản ghi gia hạn');
    } finally {
      setProcessingId(null);
    }
  };

  const urgentCount = candidates.filter(c => {
    const daysLeft = Math.ceil((new Date(c.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 7;
  }).length;

  return (
    <ModuleBoundary moduleCode="RENEWAL_RETENTION">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <RefreshCw className="text-primary" />
              Gia hạn & Tái tục
            </h1>
            <p className="text-slate-500">Danh sách học sinh sắp hết hạn hợp đồng cần tư vấn gia hạn.</p>
          </div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 border-l-4 border-l-warning">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Cần xử lý gấp</p>
                <p className="text-3xl font-black text-slate-900">{urgentCount}</p>
                <p className="text-xs text-slate-400 mt-2">Học sinh sẽ hết hạn trong 7 ngày tới</p>
              </div>
              <div className="p-3 bg-warning/10 text-warning rounded-xl">
                <Bell size={24} />
              </div>
            </div>
          </Card>

          <Card className="p-6 border-l-4 border-l-primary">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Tiềm năng gia hạn</p>
                <p className="text-3xl font-black text-slate-900">{candidates.length}</p>
                <p className="text-xs text-slate-400 mt-2">Học sinh hết hạn trong 30 ngày tới</p>
              </div>
              <div className="p-3 bg-primary/10 text-primary rounded-xl">
                <Users size={24} />
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Tìm học sinh sắp hết hạn..."
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm w-full outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          
          {loading && candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p>Đang tìm kiếm học sinh sắp hết hạn...</p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <RefreshCw size={48} className="mx-auto mb-4 opacity-20" />
              <p>Không có học sinh nào sắp hết hạn trong 30 ngày tới.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {candidates.map(candidate => {
                const daysLeft = Math.ceil((new Date(candidate.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <Card key={candidate.id} className="p-4 border-slate-100 hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-slate-900">{candidate.student.fullName}</h4>
                        <p className="text-xs text-slate-400 font-mono">{candidate.code}</p>
                      </div>
                      <Badge variant={daysLeft <= 7 ? 'warning' : 'outline'} className="text-[10px]">
                        Còn {daysLeft} ngày
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Trung tâm:</span>
                        <span className="font-medium text-slate-700">{candidate.center.name}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Ngày hết hạn:</span>
                        <span className="font-medium text-slate-700">{format(new Date(candidate.endDate), 'dd/MM/yyyy')}</span>
                      </div>
                    </div>

                    <Button 
                      variant="primary" 
                      size="sm" 
                      className="w-full gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleCreateRenewal(candidate.id)}
                      disabled={processingId === candidate.id}
                    >
                      {processingId === candidate.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <>
                          Tạo gia hạn ngay
                          <ArrowRight size={14} />
                        </>
                      )}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </ModuleBoundary>
  );
}
