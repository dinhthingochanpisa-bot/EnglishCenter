import React from 'react';
import { LucideIcon, Search } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = Search,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 w-full animate-in fade-in duration-500">
      <div className="w-16 h-16 bg-white shadow-sm rounded-2xl flex items-center justify-center text-slate-300 mb-6 ring-1 ring-slate-100">
        <Icon size={32} />
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 max-w-xs mb-8">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="shadow-lg shadow-primary/20">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
