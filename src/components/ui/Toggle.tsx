import * as React from 'react';
import { cn } from '../../utils/helpers';
import { motion } from 'framer-motion';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  size = 'md',
  className
}) => {
  const sizes = {
    sm: { container: 'w-8 h-5', knob: 'w-3 h-3', translate: 'translate-x-3' },
    md: { container: 'w-12 h-7', knob: 'w-5 h-5', translate: 'translate-x-5' },
    lg: { container: 'w-16 h-9', knob: 'w-7 h-7', translate: 'translate-x-7' }
  };

  const currentSize = sizes[size];

  return (
    <label
      className={cn(
        'flex items-center gap-3 cursor-pointer select-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          'relative rounded-full p-1 transition-colors',
          currentSize.container,
          checked 
            ? 'bg-indigo-600 dark:bg-indigo-500' 
            : 'bg-gray-300 dark:bg-gray-700'
        )}
      >
        <motion.div
          className={cn(
            'rounded-full bg-white shadow-md',
            currentSize.knob
          )}
          animate={{
            x: checked ? currentSize.translate.replace('translate-x-', '') : '0'
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30
          }}
        />
      </button>
      {label && (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {label}
        </span>
      )}
    </label>
  );
};

export { Toggle };
