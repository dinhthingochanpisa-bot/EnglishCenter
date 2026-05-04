'use client';

import React, { useEffect, useState } from 'react';
import { 
  Bell, 
  X, 
  AlertTriangle, 
  Clock, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { reportingApi, NotificationData, NotificationItem } from '@/lib/api/reporting';
import { clsx } from 'clsx';
import Link from 'next/link';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<NotificationData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchNotifications = async () => {
        setLoading(true);
        try {
          const result = await reportingApi.getNotifications();
          setData(result);
        } catch (error) {
          console.error('Failed to fetch notifications:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchNotifications();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-screen w-full max-w-md bg-white shadow-2xl z-[60] flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Bell size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Thông báo vận hành</h2>
              <p className="text-xs text-slate-500 font-medium">Các vấn đề cần xử lý ngay</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : data?.items && data.items.length > 0 ? (
            data.items.map((item, index) => (
              <NotificationCard key={index} item={item} onClose={onClose} />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                <Bell size={32} className="text-slate-200" />
              </div>
              <p className="text-slate-500 font-bold">Tuyệt vời!</p>
              <p className="text-xs text-slate-400 mt-1">Hệ thống hiện không có cảnh báo nào.</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <Button variant="ghost" className="w-full text-slate-500 hover:text-slate-700" onClick={onClose}>
            Đóng bảng thông báo
          </Button>
        </div>
      </div>
    </>
  );
};

const NotificationCard: React.FC<{ item: NotificationItem; onClose: () => void }> = ({ item, onClose }) => {
  const isHigh = item.priority === 'HIGH';
  
  return (
    <div className={clsx(
      "p-4 rounded-2xl border transition-all hover:shadow-md group relative overflow-hidden",
      isHigh ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"
    )}>
      <div className="flex gap-4 relative z-10">
        <div className={clsx(
          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm",
          isHigh ? "bg-white text-red-500" : "bg-white text-amber-500"
        )}>
          {isHigh ? <AlertTriangle size={20} /> : <Clock size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
             <span className={clsx(
               "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
               isHigh ? "bg-red-200/50 text-red-700" : "bg-amber-200/50 text-amber-700"
             )}>
               {item.priority === 'HIGH' ? 'Khẩn cấp' : 'Cảnh báo'}
             </span>
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
               {item.centerName}
             </span>
          </div>
          <h4 className="text-sm font-bold text-slate-900 mt-2">{item.title}</h4>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.body}</p>
          
          <div className="mt-4 flex items-center justify-between border-t border-slate-200/50 pt-3">
            <span className="text-[10px] font-medium text-slate-400 italic">
               Hạn: {new Date(item.dueDate).toLocaleDateString('vi-VN')}
            </span>
            <Link 
              href={`/academic/contracts?id=${item.contractId}`}
              onClick={onClose}
              className="flex items-center gap-1 text-[10px] font-black text-primary uppercase hover:underline"
            >
              Xử lý ngay <ExternalLink size={10} />
            </Link>
          </div>
        </div>
      </div>
      
      {/* Background decoration */}
      <div className={clsx(
        "absolute -right-4 -top-4 w-16 h-16 rounded-full opacity-[0.03]",
        isHigh ? "bg-red-500" : "bg-amber-500"
      )} />
    </div>
  );
};
