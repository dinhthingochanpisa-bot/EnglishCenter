import React from 'react';

interface LoadingStateProps {
  message?: string;
  minHeight?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Đang tải dữ liệu...',
  minHeight = '400px',
}) => {
  return (
    <div 
      className="flex flex-col items-center justify-center w-full animate-in fade-in duration-500"
      style={{ minHeight }}
    >
      <div className="relative w-12 h-12 mb-4">
        <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
      </div>
      <p className="text-sm font-medium text-slate-500 animate-pulse">{message}</p>
    </div>
  );
};
