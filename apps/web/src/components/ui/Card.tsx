import React from 'react';
import { clsx } from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  title, 
  subtitle, 
  className, 
  footer, 
  ...props 
}) => {
  const hasHeader = title || subtitle;
  
  return (
    <div 
      className={clsx("bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden", className)} 
      {...props}
    >
      {hasHeader && (
        <div className="px-6 py-4 border-b border-slate-100">
          {title && <h3 className="text-lg font-semibold text-slate-900">{title}</h3>}
          {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
        </div>
      )}
      <div className={clsx(hasHeader || footer ? "px-6 py-4" : "")}>
        {children}
      </div>
      {footer && (
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
          {footer}
        </div>
      )}
    </div>
  );
};
