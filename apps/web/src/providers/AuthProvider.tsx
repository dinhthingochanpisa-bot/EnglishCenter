'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getDefaultWorkspacePath, hasPermission } from '@/lib/role-routing';

interface User {
  userId?: string;
  id?: string;
  email: string;
  fullName?: string;
  role: string;
  roleId?: string;
  userRoleId?: string;
  roleName?: string;
  permissions: string[];
  allowedCenterIds?: string[];
  centers?: Array<{ id: string; code?: string; name?: string }>;
  availableRoles?: Array<{
    userRoleId: string;
    roleId: string;
    role: string;
    roleName: string;
    centers?: Array<{ id: string; code?: string; name?: string }>;
    isDefault?: boolean;
  }>;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (userData: User) => void;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchRole: (userRoleId: string) => Promise<void>;
  checkPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshProfile = async () => {
    try {
      const profile = await apiFetch('/auth/me');
      setUser(profile);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshProfile().finally(() => setIsLoading(false));
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    router.push(getDefaultWorkspacePath(userData));
  };

  const switchRole = async (userRoleId: string) => {
    const result = await apiFetch('/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ userRoleId }),
    });
    setUser(result.user);
    router.push(getDefaultWorkspacePath(result.user));
  };

  const logout = async () => {
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
      });
    } catch {
      // Ignore logout transport errors and force local sign out.
    } finally {
      setUser(null);
      router.push('/login');
    }
  };

  const checkPermission = (permission: string) => {
    return hasPermission(user, permission);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshProfile, switchRole, checkPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
