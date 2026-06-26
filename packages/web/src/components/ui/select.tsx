import { forwardRef, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'min-h-[44px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-grena focus:ring-1 focus:ring-grena',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';
