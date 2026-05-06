'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { apiFetch } from '@/lib/api';
import { 
  History, 
  Activity, 
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  Database,
  Terminal
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const LIMIT = 20;

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = `/admin/audit-logs?limit=${LIMIT}&skip=${page * LIMIT}`;
      if (entity) url += `&entity=${entity}`;
      if (action) url += `&action=${action}`;
      if (from) url += `&from=${from}`;
      if (to) url += `&to=${to}`;

      const data = await apiFetch(url);
      setLogs(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, entity, action, from, to]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionVariant = (action: string) => {
    switch (action) {
      case 'CREATE':
      case 'POST': return 'success';
      case 'UPDATE':
      case 'PATCH':
      case 'PUT': return 'warning';
      case 'DELETE': return 'error';
      default: return 'default';
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Nhật ký hệ thống</h1>
          <p className="text-slate-500 mt-1">Dấu vết hoạt động và thay đổi dữ liệu chi tiết.</p>
        </div>
        <div className="flex gap-2">
           <Badge variant="outline" className="h-8 px-3 flex items-center gap-1.5 border-slate-200 text-slate-500 bg-white shadow-sm">
             <Database size={14} /> {total.toLocaleString()} bản ghi
           </Badge>
        </div>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 border-none shadow-sm ring-1 ring-slate-100 bg-white/80 backdrop-blur-sm sticky top-20 z-10">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-widest flex items-center gap-1">
              <Database size={10} /> Thực thể
            </label>
            <select 
              value={entity}
              onChange={(e) => { setEntity(e.target.value); setPage(0); }}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700"
            >
              <option value="">Tất cả thực thể</option>
              <option value="Lead">Tiềm năng</option>
              <option value="Contract">Hợp đồng</option>
              <option value="Payment">Thanh toán</option>
              <option value="Student">Học sinh</option>
              <option value="Class">Lớp học</option>
              <option value="User">Người dùng</option>
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-widest flex items-center gap-1">
              <Terminal size={10} /> Hành động
            </label>
            <select 
              value={action}
              onChange={(e) => { setAction(e.target.value); setPage(0); }}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700"
            >
              <option value="">Tất cả hành động</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="LOGIN">LOGIN</option>
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-widest flex items-center gap-1">
              <Calendar size={10} /> Từ ngày
            </label>
            <input 
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(0); }}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700"
            />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-1.5 tracking-widest flex items-center gap-1">
              <Calendar size={10} /> Đến ngày
            </label>
            <input 
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(0); }}
              className="w-full h-10 px-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-700"
            />
          </div>

          <Button 
            variant="ghost" 
            className="h-10 px-4 rounded-xl text-slate-400 hover:text-slate-600 font-bold"
            onClick={() => { setEntity(''); setAction(''); setFrom(''); setTo(''); setPage(0); }}
          >
            Xóa lọc
          </Button>
        </div>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium flex items-center gap-2">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      {/* Log List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            <p className="text-slate-400 font-medium text-sm">Đang truy vấn nhật ký...</p>
          </div>
        ) : logs.map((log) => (
          <Card key={log.id} className="p-5 hover:shadow-xl hover:translate-x-1 transition-all duration-300 border-none bg-white shadow-sm ring-1 ring-slate-100 group relative overflow-hidden">
            <div className="flex items-start gap-6 relative z-10">
              <div className={clsx(
                "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner",
                log.action === 'CREATE' && "bg-emerald-50 text-emerald-600",
                log.action === 'DELETE' && "bg-rose-50 text-rose-600",
                log.action === 'UPDATE' && "bg-amber-50 text-amber-600",
                !['CREATE', 'DELETE', 'UPDATE'].includes(log.action) && "bg-slate-50 text-slate-600"
              )}>
                <Activity size={24} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-base">{log.actor?.fullName}</span>
                    <Badge variant={getActionVariant(log.action)} className="text-[10px] px-2 py-0.5 font-black uppercase">
                      {log.action}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-bold border-slate-200 text-slate-500 bg-slate-50">
                      {log.entityType}
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full ring-1 ring-slate-100">
                    <Calendar size={12} className="text-slate-300" /> {new Date(log.timestamp).toLocaleString('vi-VN')}
                  </span>
                </div>
                
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  Đã thực hiện thao tác trên <span className="text-slate-400 font-bold">ID:</span> <code className="bg-slate-100 px-2 py-0.5 rounded-lg text-xs font-mono text-primary select-all">{log.entityId}</code>
                </p>
                
                {log.afterData && Object.keys(log.afterData).length > 0 && (
                  <details className="mt-4 group/detail">
                    <summary className="text-[10px] text-slate-400 font-black uppercase tracking-widest cursor-pointer hover:text-primary transition-colors list-none flex items-center gap-1.5">
                      <ChevronRight size={12} className="group-open/detail:rotate-90 transition-transform" />
                      <span>Xem chi tiết Payload</span>
                    </summary>
                    <div className="mt-3 relative">
                      <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
                      <pre className="ml-8 p-4 bg-slate-900 text-emerald-400 text-[11px] rounded-2xl overflow-x-auto shadow-2xl font-mono leading-relaxed">
                        {JSON.stringify(log.afterData, null, 2)}
                      </pre>
                    </div>
                  </details>
                )}
              </div>
            </div>
            {/* Action intensity background icon */}
            <Activity size={80} className="absolute -right-8 -bottom-8 text-slate-100 opacity-5 group-hover:scale-125 transition-transform duration-700" />
          </Card>
        ))}

        {logs.length === 0 && !isLoading && (
          <div className="text-center py-24 bg-white rounded-3xl ring-1 ring-slate-100 shadow-sm border-2 border-dashed border-slate-100">
            <History size={64} className="mx-auto text-slate-100 mb-6" />
            <p className="text-slate-500 font-bold text-lg">Không tìm thấy dữ liệu</p>
            <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">Vui lòng điều chỉnh bộ lọc để tìm kiếm kết quả khác.</p>
            <Button variant="outline" className="mt-8 rounded-xl" onClick={() => { setEntity(''); setAction(''); setFrom(''); setTo(''); setPage(0); }}>Xóa tất cả bộ lọc</Button>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-8">
          <Button 
            variant="outline" 
            className="rounded-xl h-10 w-10 p-0 shadow-sm"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft size={20} />
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-slate-900 px-3 py-1.5 bg-white rounded-lg shadow-sm ring-1 ring-slate-200">
              {page + 1}
            </span>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-widest px-2">trên</span>
            <span className="text-sm font-black text-slate-500">
              {totalPages}
            </span>
          </div>
          <Button 
            variant="outline" 
            className="rounded-xl h-10 w-10 p-0 shadow-sm"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            <ChevronRight size={20} />
          </Button>
        </div>
      )}
    </div>
  );
}

const AlertCircle = ({ size, className }: { size: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

function clsx(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
