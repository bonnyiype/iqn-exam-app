import * as React from 'react';
import { cn } from '../../utils/helpers';
import { motion } from 'framer-motion';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  showValue?: boolean;
  gradient?: boolean;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ 
    className, 
    value, 
    max = 100, 
    variant = 'default', 
    size = 'md', 
    animated = true, 
    showValue = false,
    gradient = false,
    ...props 
  }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    
    const containerStyles = {
      sm: 'h-2',
      md: 'h-3',
      lg: 'h-4'
    };
    
    const barColors = {
      default: gradient 
        ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
        : 'bg-indigo-600',
      success: 'bg-emerald-600',
      warning: 'bg-amber-600',
      error: 'bg-red-600'
    };

    return (
      <div className={cn('relative', className)} {...props}>
        <div
          ref={ref}
          className={cn(
            'w-full rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden',
            containerStyles[size]
          )}
        >
          <motion.div
            className={cn(
              'h-full rounded-full transition-colors',
              barColors[variant],
              animated && 'transition-all duration-500 ease-out'
            )}
            initial={animated ? { width: 0 } : false}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
              {Math.round(percentage)}%
            </span>
          </div>
        )}
      </div>
    );
  }
);

Progress.displayName = 'Progress';

export { Progress };
