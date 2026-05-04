'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useModules } from '@/providers/ModuleProvider';
import { apiFetch } from '@/lib/api';
import { useAppDialog } from '@/providers/AppDialogProvider';
import { 
  ToggleLeft, 
  ToggleRight, 
  ShieldCheck, 
  Search,
  AlertCircle
} from 'lucide-react';

export default function ModuleManagementPage() {
  const { modules, refreshModules, isLoading } = useModules();
  const { notify } = useAppDialog();
  const [toggling, setToggling] = useState<string | null>(null);

  const handleToggle = async (code: string, currentStatus: boolean) => {
    setToggling(code);
    try {
      await apiFetch(`/modules/${code}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: !currentStatus }),
      });
      await refreshModules();
    } catch (error) {
      console.error('Toggle failed:', error);
      notify({
        type: 'error',
        title: 'Không thể cập nhật module',
        message: 'Vui lòng thử lại hoặc kiểm tra quyền thao tác.',
      });
    } finally {
      setToggling(null);
    }
  };

  if (isLoading) return <div className="text-center py-10">Đang tải danh sách module...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý tính năng</h1>
          <p className="text-slate-500 mt-1">Bật/tắt các phân hệ chức năng trên toàn hệ thống.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {modules.map((module) => (
          <Card key={module.code} className="hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={clsx(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                  module.isEnabled ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400"
                )}>
                  {module.isEnabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </div>
                <div>
                   <h3 className="text-sm font-bold text-slate-900 tracking-tight">{module.code}</h3>
                   <p className="text-xs text-slate-500 mt-0.5">Phân hệ {module.code.toLowerCase().replace(/_/g, ' ')}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                 <Badge variant={module.isEnabled ? 'success' : 'default'}>
                   {module.isEnabled ? 'Đang bật' : 'Đã tắt'}
                 </Badge>
                 
                 <button 
                   onClick={() => handleToggle(module.code, module.isEnabled)}
                   disabled={toggling === module.code}
                   className={clsx(
                     "relative inline-flex h-6 w-11 items-center rounded-full transition-colors outline-none ring-offset-2 focus:ring-2 focus:ring-primary/20",
                     module.isEnabled ? "bg-primary" : "bg-slate-200",
                     toggling === module.code && "opacity-50 cursor-not-allowed"
                   )}
                 >
                   <span className={clsx(
                     "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm",
                     module.isEnabled ? "translate-x-6" : "translate-x-1"
                   )} />
                 </button>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
               <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <ShieldCheck size={12} /> Áp dụng toàn hệ thống
               </div>
               {module.code === 'CRM_LEADS' && !module.isEnabled && (
                 <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                    <AlertCircle size={12} /> Đang ẩn menu
                 </div>
               )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function clsx(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

