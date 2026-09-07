import React from 'react';

interface StudioIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  theme?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'surface' | 'accent';
  icon?: React.ReactNode;
}

export const StudioIconButton: React.FC<StudioIconButtonProps> = ({
  active = false,
  theme = 'dark',
  size = 'md',
  variant = 'ghost',
  icon,
  children,
  className = '',
  disabled = false,
  ...rest
}) => {
  const isLight = theme === 'light';

  const sizeClasses = {
    sm: 'w-8 h-8 min-w-[32px] min-h-[32px] rounded-lg',
    md: 'w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl',
    lg: 'w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl',
  }[size];

  let variantClasses = '';
  if (active) {
    variantClasses = isLight
      ? 'border border-sky-600/70 bg-black/[0.04] text-neutral-950 shadow-xs'
      : 'border border-sky-400/70 bg-white/[0.06] text-white shadow-xs';
  } else if (variant === 'surface') {
    variantClasses = isLight
      ? 'border border-black/10 bg-white text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
      : 'border border-white/10 bg-white/[0.04] text-neutral-300 hover:bg-white/[0.08] hover:text-white';
  } else if (variant === 'accent') {
    variantClasses = isLight
      ? 'border border-sky-600 bg-sky-600 text-white hover:bg-sky-700'
      : 'border border-sky-500 bg-sky-500 text-white hover:bg-sky-400';
  } else {
    // ghost
    variantClasses = isLight
      ? 'border border-transparent text-neutral-600 hover:text-neutral-950 hover:bg-black/5'
      : 'border border-transparent text-neutral-400 hover:text-white hover:bg-white/10';
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex items-center justify-center transition-all active:scale-95 cursor-pointer disabled:opacity-30 disabled:pointer-events-none ${sizeClasses} ${variantClasses} ${className}`}
      {...rest}
    >
      {icon || children}
    </button>
  );
};
