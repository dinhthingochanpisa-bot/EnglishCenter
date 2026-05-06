'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell, Globe } from 'lucide-react';
import { NotificationsDrawer } from '../dashboard/NotificationsDrawer';
import { useCenterScope } from '@/providers/CenterScopeProvider';
import { useAuth } from '@/providers/AuthProvider';

export const Header: React.FC = () => {
  const router = useRouter();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);
  const { selectedCenterId, setSelectedCenterId, centerOptions, selectedCenterLabel } = useCenterScope();
  const { user, switchRole } = useAuth();
  const roleOptions = user?.availableRoles || [];

  const handleRoleChange = async (userRoleId: string) => {
    if (!userRoleId || userRoleId === user?.userRoleId) return;
    setIsSwitchingRole(true);
    try {
      await switchRole(userRoleId);
    } finally {
      setIsSwitchingRole(false);
      router.refresh();
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
        <div className="flex flex-1 items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm nhanh..."
              className="w-full rounded-custom border-none bg-slate-100 py-2 pl-10 pr-4 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {roleOptions.length > 1 ? (
            <select
              className="max-w-48 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              value={user?.userRoleId || ''}
              onChange={(event) => handleRoleChange(event.target.value)}
              disabled={isSwitchingRole}
              title="Đổi vai trò làm việc"
            >
              {roleOptions.map((role) => (
                <option key={role.userRoleId} value={role.userRoleId}>
                  {role.roleName || role.role}
                </option>
              ))}
            </select>
          ) : null}
          <button
            onClick={() => setIsNotifOpen(true)}
            className="relative rounded-custom p-2 text-slate-500 transition-colors hover:bg-slate-100"
          >
            <Bell size={20} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
          </button>
          <div className="mx-2 h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <Globe size={18} />
            <select
              className="max-w-56 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
              value={selectedCenterId}
              onChange={(event) => setSelectedCenterId(event.target.value)}
              title={selectedCenterLabel}
            >
              <option value="all">Tất cả trung tâm</option>
              {centerOptions.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.code ? `${center.code} - ` : ''}
                  {center.name || center.id}
                </option>
              ))}
            </select>
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
