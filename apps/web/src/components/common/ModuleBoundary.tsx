'use client';

import React from 'react';
import { useModules, ModuleCode } from '@/providers/ModuleProvider';
import { Card } from '@/components/ui/Card';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

interface ModuleBoundaryProps {
  moduleCode: ModuleCode;
  children: React.ReactNode;
}

export const ModuleBoundary: React.FC<ModuleBoundaryProps> = ({ moduleCode, children }) => {
  const { isModuleEnabled, isLoading } = useModules();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isModuleEnabled(moduleCode)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-6">
          <ShieldAlert size={40} />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Tính năng này đã bị khóa</h2>
        <p className="text-slate-500 max-w-md mb-8">
          Module <strong>{moduleCode}</strong> hiện đang được quản trị viên tạm dừng hoặc chưa được kích hoạt cho trung tâm của bạn.
        </p>
        <div className="flex gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft size={18} className="mr-2" /> Quay lại
          </Button>
          <Button onClick={() => router.push('/dashboard')}>
            <Home size={18} className="mr-2" /> Về bảng điều khiển
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
