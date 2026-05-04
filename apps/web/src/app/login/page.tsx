'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { withApiBaseUrl } from '@/lib/config';

export default function LoginPage() {
  const { branding } = useTheme();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('superadmin@example.com');
  const [password, setPassword] = useState('password123');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(withApiBaseUrl('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Đăng nhập thất bại');
      }

      const data = await response.json();
      login(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl mb-6 overflow-hidden group transition-transform hover:scale-105">
            {branding.logoLightUrl ? (
              <img src={branding.logoLightUrl} alt="Logo" className="w-full h-full object-contain p-2" />
            ) : (
              <div className="w-full h-full bg-primary flex items-center justify-center text-white">
                <LogIn size={40} />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {branding.appName}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Hệ thống quản lý đào tạo & vận hành
          </p>
        </div>

        <Card className="p-8 border-none shadow-xl shadow-slate-200/60">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-custom flex items-start gap-3 text-red-600 text-sm">
                <AlertCircle size={18} className="mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-custom text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-custom text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full py-3 text-sm font-bold shadow-lg shadow-primary/20" 
              isLoading={isLoading}
            >
              Đăng nhập
            </Button>
          </form>
        </Card>

        <div className="text-center space-y-4">
          <p className="text-xs text-slate-400">
            Hệ thống bảo mật & giám sát chuyên dụng
            <br />
            &copy; 2026 {branding.shortName}.
          </p>
          <div className="flex gap-2 justify-center">
            {[
              { label: 'SUPER_ADMIN', email: 'superadmin@example.com' },
              { label: 'ADMIN', email: 'admin01@example.com' },
              { label: 'MANAGER', email: 'manager01@example.com' },
              { label: 'SALES', email: 'sales01@example.com' },
            ].map((account) => (
              <button 
                key={account.label}
                onClick={() => {
                  setEmail(account.email);
                  setPassword('password123');
                }}
                className="text-[10px] bg-slate-200 text-slate-600 px-2 py-1 rounded hover:bg-slate-300 transition-colors"
              >
                Mock {account.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
