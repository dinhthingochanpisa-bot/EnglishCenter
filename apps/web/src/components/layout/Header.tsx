'use client';

import React, { useState } from 'react';
import { Search, Bell, Globe } from 'lucide-react';
import { NotificationsDrawer } from '../dashboard/NotificationsDrawer';

export const Header: React.FC = () => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-40">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm kiếm nhanh..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-custom text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsNotifOpen(true)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-custom relative transition-colors"
          >
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          <div className="h-6 w-px bg-slate-200 mx-2"></div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <Globe size={18} />
            <span>Hệ thống Hà Nội</span>
          </div>
        </div>
      </header>

      <NotificationsDrawer 
        isOpen={isNotifOpen} 
        onClose={() => setIsNotifOpen(false)} 
      />
    </>
  );
};
