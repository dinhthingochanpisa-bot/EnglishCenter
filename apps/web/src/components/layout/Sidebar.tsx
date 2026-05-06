'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users,
  UserCircle,
  User,
  LayoutDashboard,
  History,
  Target,
  GraduationCap,
  Building2,
  Palette,
  ToggleLeft,
  LogOut,
  Search,
  BookOpen,
  FileText,
  Wallet,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import { useModules, ModuleCode } from '@/providers/ModuleProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { clsx } from 'clsx';

interface MenuItem {
  title: string;
  href: string;
  icon: React.ElementType;
  moduleCode?: ModuleCode;
  permission?: string;
}

const academicMenuItems: MenuItem[] = [
  {
    title: 'Sản phẩm & CT',
    href: '/academic/products',
    icon: BookOpen,
    moduleCode: 'PROGRAM_PRODUCT',
    permission: 'PROGRAM_PRODUCT.VIEW',
  },
  {
    title: 'Quản lý lớp học',
    href: '/academic/classes',
    icon: GraduationCap,
    moduleCode: 'CLASS_ACADEMIC',
    permission: 'CLASS_ACADEMIC.VIEW',
  },
];

const commercialMenuItems: MenuItem[] = [
  {
    title: 'Hợp đồng',
    href: '/academic/contracts',
    icon: FileText,
    moduleCode: 'CONTRACT',
    permission: 'CONTRACT.VIEW',
  },
  {
    title: 'Thanh toán & Nợ',
    href: '/academic/payments',
    icon: Wallet,
    moduleCode: 'PAYMENT_RECEIVABLE',
    permission: 'PAYMENT_RECEIVABLE.VIEW',
  },
  {
    title: 'Gia hạn & Tái tục',
    href: '/academic/renewals',
    icon: RefreshCw,
    moduleCode: 'RENEWAL_RETENTION',
    permission: 'RENEWAL_RETENTION.VIEW',
  },
];


const businessMenuItems: MenuItem[] = [
  { 
    title: 'Dashboard', 
    href: '/dashboard', 
    icon: LayoutDashboard,
    moduleCode: 'REPORTING',
    permission: 'REPORTING.VIEW'
  },
  {
    title: 'Leads',
    href: '/leads',
    icon: Target,
    moduleCode: 'CRM_LEADS',
    permission: 'CRM_LEADS.VIEW',
  },
  {
    title: 'Học sinh',
    href: '/students',
    icon: GraduationCap,
    moduleCode: 'STUDENT',
    permission: 'STUDENT.VIEW',
  },
  // Temporarily hidden. Parent/student relationships are managed from parent and student profiles.
  // {
  //   title: 'Gia đình',
  //   href: '/families',
  //   icon: Users,
  //   moduleCode: 'FAMILY_PARENT',
  //   permission: 'FAMILY_PARENT.VIEW',
  // },
  {
    title: 'Phụ huynh',
    href: '/parents',
    icon: User,
    moduleCode: 'FAMILY_PARENT',
    permission: 'FAMILY_PARENT.VIEW',
  },
];

const adminMenuItems: MenuItem[] = [
  {
    title: 'Người dùng',
    href: '/admin/users',
    icon: Users,
    moduleCode: 'SETTINGS_ADMIN',
    permission: 'SETTINGS_ADMIN.VIEW',
  },
  {
    title: 'Trung tâm',
    href: '/admin/centers',
    icon: Building2,
    moduleCode: 'SETTINGS_ADMIN',
    permission: 'SETTINGS_ADMIN.VIEW',
  },
  {
    title: 'Thương hiệu',
    href: '/admin/branding',
    icon: Palette,
    moduleCode: 'SETTINGS_ADMIN',
    permission: 'SETTINGS_ADMIN.VIEW',
  },
  {
    title: 'Phân hệ',
    href: '/admin/modules',
    icon: ToggleLeft,
    moduleCode: 'SETTINGS_ADMIN',
    permission: 'SETTINGS_ADMIN.VIEW',
  },
  {
    title: 'Cấu hình nghiệp vụ',
    href: '/admin/config',
    icon: Settings2,
    moduleCode: 'SETTINGS_ADMIN',
    permission: 'SETTINGS_ADMIN.VIEW',
  },
  {
    title: 'Nhật ký hệ thống',
    href: '/admin/audit-logs',
    icon: History,
    moduleCode: 'AUDIT_LOG',
    permission: 'AUDIT_LOG.VIEW',
  },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { isModuleEnabled } = useModules();
  const { branding } = useTheme();
  const { user, logout, checkPermission } = useAuth();

  const canShowAdminSection = adminMenuItems.some((item) => {
    if (item.permission && !checkPermission(item.permission)) return false;
    if (item.moduleCode && !isModuleEnabled(item.moduleCode)) return false;
    return true;
  });

  const renderLink = (item: MenuItem) => {
    if (item.permission && !checkPermission(item.permission)) return null;
    if (item.moduleCode && !isModuleEnabled(item.moduleCode)) return null;

    const isActive =
      pathname === item.href ||
      (item.href !== '/dashboard' && pathname.startsWith(item.href));
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={clsx(
          'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100',
        )}
      >
        {isActive && (
          <div className="absolute left-0 w-1 h-5 bg-primary rounded-r-full" />
        )}
        <Icon
          size={18}
          className={clsx(
            'transition-colors',
            isActive ? 'text-primary' : 'text-slate-500 group-hover:text-slate-300',
          )}
        />
        <span className={clsx('text-sm font-medium', isActive ? 'font-semibold' : '')}>
          {item.title}
        </span>
      </Link>
    );
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-slate-800/50 bg-slate-950 text-white">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20 overflow-hidden ring-1 ring-white/10">
            {branding.logoLightUrl ? (
              <img src={branding.logoLightUrl} alt="Logo" className="w-full h-full object-contain p-1.5" />
            ) : (
              <GraduationCap size={24} className="text-white" />
            )}
          </div>
          <div className="overflow-hidden">
            <h1 className="text-lg font-bold tracking-tight text-white truncate leading-tight">
              {branding.shortName}
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black opacity-80 truncate">
              Hệ thống CRM
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 mb-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/50 border border-slate-800 rounded-md text-slate-500 group hover:border-slate-700 transition-colors cursor-pointer">
          <Search size={14} className="group-hover:text-slate-400" />
          <span className="text-[11px] font-medium">Quick search...</span>
          <span className="ml-auto text-[9px] bg-slate-800 px-1 rounded border border-slate-700 font-mono">/</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-6 overflow-y-auto sidebar-scrollbar">
        <div className="space-y-1">{businessMenuItems.map(renderLink)}</div>

        <div className="pt-4 border-t border-slate-800/30">
          <p className="px-3 mb-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
            Kinh doanh & Tài chính
          </p>
          <div className="space-y-1">{commercialMenuItems.map(renderLink)}</div>
        </div>

        <div className="pt-4 border-t border-slate-800/30">
          <p className="px-3 mb-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
            Học thuật & Đào tạo
          </p>
          <div className="space-y-1">{academicMenuItems.map(renderLink)}</div>
        </div>

        {canShowAdminSection && (
          <div className="pt-4 border-t border-slate-800/30">
            <p className="px-3 mb-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
              Quản trị hệ thống
            </p>
            <div className="space-y-1">{adminMenuItems.map(renderLink)}</div>
          </div>
        )}
      </nav>

      <div className="p-4 bg-slate-900/40 border-t border-slate-800/50">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:bg-slate-900/80 transition-all group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-xs font-bold ring-1 ring-white/5 border border-white/5">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold truncate text-slate-200">
              {user?.fullName || 'User'}
            </p>
            <p className="text-[10px] text-slate-500 truncate uppercase font-bold tracking-tighter">
              {user?.role?.replace('_', ' ') || 'Guest'}
            </p>
          </div>
          <button
            onClick={() => logout()}
            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};
