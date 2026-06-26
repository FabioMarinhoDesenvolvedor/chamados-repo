import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'min-h-[44px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-grena focus:ring-1 focus:ring-grena',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
