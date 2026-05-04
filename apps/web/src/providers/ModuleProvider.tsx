'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { withApiBaseUrl } from '@/lib/config';

export type ModuleCode = 
  | 'CRM_LEADS'
  | 'SALES_PIPELINE'
  | 'FAMILY_PARENT'
  | 'STUDENT'
  | 'PROGRAM_PRODUCT'
  | 'CLASS_ACADEMIC'
  | 'CONTRACT'
  | 'PAYMENT_RECEIVABLE'
  | 'RENEWAL_RETENTION'
  | 'REPORTING'
  | 'NOTIFICATION'
  | 'AUDIT_LOG'
  | 'SETTINGS_ADMIN';

interface ModuleState {
  code: string;
  isEnabled: boolean;
}

interface ModuleContextType {
  modules: ModuleState[];
  isModuleEnabled: (code: string) => boolean;
  isLoading: boolean;
  refreshModules: () => Promise<void>;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export const ModuleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modules, setModules] = useState<ModuleState[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchModules = async () => {
    try {
      const response = await fetch(withApiBaseUrl('/modules'), {
        credentials: 'include',
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        const simplified = data.map((m: any) => ({
          code: m.code,
          isEnabled: m.settings && m.settings.length > 0 ? m.settings[0].isEnabled : true,
        }));
        setModules(simplified);
      }
    } catch (error) {
      console.error('Failed to fetch modules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, []);

  const isModuleEnabled = (code: string) => {
    if (isLoading) return true; // Default to true while loading
    const module = modules.find(m => m.code === code);
    return module ? module.isEnabled : true;
  };

  return (
    <ModuleContext.Provider value={{ modules, isModuleEnabled, isLoading, refreshModules: fetchModules }}>
      {children}
    </ModuleContext.Provider>
  );
};

export const useModules = () => {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useModules must be used within a ModuleProvider');
  }
  return context;
};
