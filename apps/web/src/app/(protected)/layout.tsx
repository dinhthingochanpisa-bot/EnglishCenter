'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/providers/AuthProvider';
import { CenterScopeProvider } from '@/providers/CenterScopeProvider';
import { getDefaultWorkspacePath, hasPermission } from '@/lib/role-routing';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
      return;
    }

    if (!isLoading && user && pathname === '/dashboard' && !hasPermission(user, 'REPORTING.VIEW')) {
      router.replace(getDefaultWorkspacePath(user));
    }
  }, [isLoading, pathname, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <CenterScopeProvider>
      <AppLayout>{children}</AppLayout>
    </CenterScopeProvider>
  );
}
