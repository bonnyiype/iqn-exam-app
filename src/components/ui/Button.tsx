import * as React from 'react';
import { cn } from '../../utils/helpers';
import { motion } from 'framer-motion';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', animated = true, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variants = {
      primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 shadow-md hover:shadow-lg',
      secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600',
      ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 focus:ring-gray-500',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-md hover:shadow-lg',
      success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 shadow-md hover:shadow-lg'
    };
    
    const sizes = {
      sm: 'px-3 py-1.5 text-sm gap-1.5',
      md: 'px-4 py-2 text-base gap-2',
      lg: 'px-6 py-3 text-lg gap-2.5'
    };

    const MotionButton = animated ? motion.button : 'button';
    const animationProps = animated ? {
      whileHover: { scale: 1.02 },
      whileTap: { scale: 0.98 },
      transition: { duration: 0.2 }
    } : {};

    return (
      <MotionButton
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...animationProps}
        {...props}
      >
        {children}
      </MotionButton>
    );
  }
);

Button.displayName = 'Button';

export { Button };
