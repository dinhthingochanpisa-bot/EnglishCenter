import React from 'react';
import { clsx } from 'clsx';

type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'secondary'
  | 'outline';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  error: 'bg-rose-100 text-rose-700',
  info: 'bg-sky-100 text-sky-700',
  secondary: 'bg-slate-100 text-slate-700',
  outline: 'bg-white text-slate-700 border border-slate-200',
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className }) => {
  return (
    <span className={clsx(
      "px-2.5 py-0.5 rounded-full text-xs font-semibold inline-flex items-center",
      variantStyles[variant],
      className
    )}>
      {children}
    </span>
  );
};
