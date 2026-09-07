import React from 'react';
import { X } from 'lucide-react';

interface StudioCloseButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  ariaLabel?: string;
  className?: string;
  theme?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
}

export const StudioCloseButton: React.FC<StudioCloseButtonProps> = ({
  onClick,
  title = 'Close',
  ariaLabel = 'Close',
  className = '',
  theme = 'dark',
  size = 'md',
}) => {
  const isLight = theme === 'light';

  const sizeClasses =
    size === 'sm'
      ? 'w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg'
      : size === 'lg'
      ? 'w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl'
      : 'w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl';

  const iconSize =
    size === 'sm'
      ? 'w-3.5 h-3.5'
      : size === 'lg'
      ? 'w-[18px] h-[18px]'
      : 'w-4 h-4';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className={`${sizeClasses} flex items-center justify-center transition-colors active:scale-95 cursor-pointer ${
        isLight
          ? 'text-neutral-600 hover:text-neutral-950 hover:bg-black/5 active:bg-black/10'
          : 'text-neutral-400 hover:text-white hover:bg-white/10 active:bg-white/15'
      } ${className}`}
    >
      <X className={`${iconSize} shrink-0`} strokeWidth={1.5} />
    </button>
  );
};
