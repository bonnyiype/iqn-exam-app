import * as React from 'react';
import { cn } from '../../utils/helpers';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', animated = false, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center rounded-full font-medium transition-all';
    
    const variants = {
      default: 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100',
      secondary: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-300',
      success: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-300',
      warning: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300',
      error: 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-300',
      info: 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-300'
    };
    
    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-sm',
      lg: 'px-3 py-1.5 text-base'
    };

    const animationClass = animated ? 'animate-pulse' : '';

    return (
      <span
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], animationClass, className)}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
