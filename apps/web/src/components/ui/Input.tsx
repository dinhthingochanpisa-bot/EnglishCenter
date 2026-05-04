'use client';

import React from 'react';
import { clsx } from 'clsx';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={clsx(
          'w-full px-4 py-2 bg-white border border-slate-200 rounded-custom text-sm',
          'focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none',
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';
