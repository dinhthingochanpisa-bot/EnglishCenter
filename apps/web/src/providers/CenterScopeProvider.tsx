'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getStoredCenterId, setCurrentCenterId, setStoredCenterId } from '@/lib/center-scope';
import { useAuth } from './AuthProvider';
import { apiFetch } from '@/lib/api';

type CenterOption = {
  id: string;
  code?: string;
  name?: string;
};

type CenterScopeContextType = {
  selectedCenterId: string;
  setSelectedCenterId: (centerId: string) => void;
  centerOptions: CenterOption[];
  selectedCenterLabel: string;
};

const CenterScopeContext = createContext<CenterScopeContextType | undefined>(undefined);

export const CenterScopeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [fallbackCenters, setFallbackCenters] = useState<CenterOption[]>([]);
  const centerOptions = useMemo(
    () => (user?.centers?.length ? user.centers : fallbackCenters),
    [fallbackCenters, user?.centers],
  );
  const [selectedCenterId, setSelectedCenterIdState] = useState('all');

  useEffect(() => {
    if (!user) return;
    if (user.centers?.length && user.role !== 'SUPER_ADMIN') return;
    apiFetch<CenterOption[]>('/centers')
      .then(setFallbackCenters)
      .catch(() => setFallbackCenters([]));
  }, [user]);

  useEffect(() => {
    const stored = getStoredCenterId();
    const allowedIds = centerOptions.map((item) => item.id);
    const nextCenterId = stored === 'all' || allowedIds.includes(stored) ? stored : 'all';
    setSelectedCenterIdState(nextCenterId);
    setCurrentCenterId(nextCenterId);
    setStoredCenterId(nextCenterId);
  }, [centerOptions]);

  const setSelectedCenterId = (centerId: string) => {
    const nextCenterId = centerId || 'all';
    setSelectedCenterIdState(nextCenterId);
    setCurrentCenterId(nextCenterId);
    setStoredCenterId(nextCenterId);
  };

  const selectedCenterLabel =
    selectedCenterId === 'all'
      ? 'Tất cả trung tâm'
      : centerOptions.find((item) => item.id === selectedCenterId)?.name || 'Trung tâm';

  return (
    <CenterScopeContext.Provider
      value={{ selectedCenterId, setSelectedCenterId, centerOptions, selectedCenterLabel }}
    >
      {children}
    </CenterScopeContext.Provider>
  );
};

export const useCenterScope = () => {
  const context = useContext(CenterScopeContext);
  if (!context) {
    throw new Error('useCenterScope must be used within CenterScopeProvider');
  }
  return context;
};
