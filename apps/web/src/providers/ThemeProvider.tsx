'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE_URL, withApiBaseUrl } from '@/lib/config';

interface BrandingConfig {
  appName: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  borderRadius: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
}

const defaultBranding: BrandingConfig = {
  appName: 'English Center CRM',
  shortName: 'EC CRM',
  primaryColor: '#2563eb',
  secondaryColor: '#475569',
  accentColor: '#10b981',
  headingFont: 'Inter',
  bodyFont: 'Inter',
  borderRadius: '8px',
};

interface ThemeContextType {
  branding: BrandingConfig;
  setBranding: (config: BrandingConfig) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [branding, setBranding] = useState<BrandingConfig>(defaultBranding);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBranding();
  }, []);

  const fetchBranding = async () => {
    try {
      const response = await fetch(withApiBaseUrl('/branding'), {
        credentials: 'include',
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        
        setBranding({
          ...defaultBranding,
          ...data,
          logoLightUrl: data.logoLightUrl 
            ? (data.logoLightUrl.startsWith('http') ? data.logoLightUrl : `${API_BASE_URL}${data.logoLightUrl}`) 
            : undefined,
          logoDarkUrl: data.logoDarkUrl 
            ? (data.logoDarkUrl.startsWith('http') ? data.logoDarkUrl : `${API_BASE_URL}${data.logoDarkUrl}`) 
            : undefined,
        });
      }
    } catch (error) {
      console.error('Failed to fetch branding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Apply branding to CSS variables
    const root = document.documentElement;
    root.style.setProperty('--primary-color', branding.primaryColor);
    root.style.setProperty('--secondary-color', branding.secondaryColor);
    root.style.setProperty('--accent-color', branding.accentColor);
    root.style.setProperty('--heading-font', `"${branding.headingFont}", sans-serif`);
    root.style.setProperty('--body-font', `"${branding.bodyFont}", sans-serif`);
    root.style.setProperty('--border-radius', branding.borderRadius);

    // Load Google Fonts
    const fonts = Array.from(new Set([branding.headingFont, branding.bodyFont]));
    const linkId = 'dynamic-google-fonts';
    let link = document.getElementById(linkId) as HTMLLinkElement;
    
    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }

    const fontQuery = fonts.map(f => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700&`).join('');
    link.href = `https://fonts.googleapis.com/css2?${fontQuery}display=swap`;
  }, [branding]);

  return (
    <ThemeContext.Provider value={{ branding, setBranding, isLoading }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
