'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Building2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { withApiBaseUrl } from '@/lib/config';
import { useAuth } from '@/providers/AuthProvider';

type RoleOption = {
  userRoleId: string;
  role: string;
  roleName: string;
  centers?: Array<{ id: string; code?: string; name?: string }>;
  isDefault?: boolean;
};

export default function SelectRolePage() {
  const router = useRouter();
  const { login } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState('');

  useEffect(() => {
    const raw = window.sessionStorage.getItem('roleSelection');
    if (!raw) {
      router.replace('/login');
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setUser(parsed.user);
      setRoles(parsed.availableRoles || []);
    } catch {
      router.replace('/login');
    }
  }, [router]);

  const handleSelectRole = async (userRoleId: string) => {
    setIsLoading(userRoleId);
    setError(null);
    try {
      const response = await fetch(withApiBaseUrl('/auth/select-role'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userRoleId }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Không thể chọn vai trò');
      }
      const data = await response.json();
      window.sessionStorage.removeItem('roleSelection');
      login(data.user);
    } catch (err: any) {
      setError(err.message || 'Không thể chọn vai trò');
    } finally {
      setIsLoading('');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white">
            <Shield size={30} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Chọn vai trò làm việc</h1>
          <p className="mt-2 text-sm text-slate-500">
            {user?.fullName || user?.email || 'Tài khoản này'} có nhiều vai trò. Chọn một vai trò để vào hệ thống.
          </p>
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
            <AlertCircle size={18} /> {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {roles.map((role) => (
            <Card key={role.userRoleId} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-slate-900">{role.roleName}</p>
                  <p className="mt-1 text-xs font-semibold uppercase text-slate-400">{role.role}</p>
                </div>
                {role.isDefault ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                    Mặc định
                  </span>
                ) : null}
              </div>
              <div className="mt-4 space-y-2">
                <p className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
                  <Building2 size={14} /> Trung tâm
                </p>
                {role.centers?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {role.centers.map((center) => (
                      <span key={center.id} className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">
                        {center.code ? `${center.code} - ` : ''}{center.name || center.id}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Toàn hệ thống</p>
                )}
              </div>
              <Button
                className="mt-5 w-full"
                isLoading={isLoading === role.userRoleId}
                onClick={() => handleSelectRole(role.userRoleId)}
              >
                Tiếp tục với vai trò này
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
