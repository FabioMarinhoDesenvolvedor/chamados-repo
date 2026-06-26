import { forwardRef, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-grena focus:ring-1 focus:ring-grena',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
