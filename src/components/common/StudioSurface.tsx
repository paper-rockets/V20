import React, { forwardRef } from 'react';

export type SurfaceVariant = 'panel' | 'popover' | 'dialog' | 'sheet' | 'toolbar';

interface StudioSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant;
  theme?: 'light' | 'dark';
  children?: React.ReactNode;
}

export const StudioSurface = forwardRef<HTMLDivElement, StudioSurfaceProps>(
  ({ variant = 'panel', theme = 'dark', className = '', children, ...rest }, ref) => {
    const isLight = theme === 'light';

    let variantClasses = '';
    switch (variant) {
      case 'panel':
        // Contextual panel beside the rail
        variantClasses = isLight
          ? 'w-[280px] sm:w-[300px] rounded-2xl bg-[#f7f4ee]/98 border border-black/15 shadow-[0_20px_50px_rgba(35,28,20,0.14)] text-neutral-800'
          : 'w-[280px] sm:w-[300px] rounded-2xl bg-[#14161a]/98 border border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.6)] text-neutral-200';
        break;

      case 'popover':
        // Compact popover (e.g. from dock buttons)
        variantClasses = isLight
          ? 'rounded-2xl bg-[#f7f4ee]/98 border border-black/15 shadow-[0_16px_40px_rgba(35,28,20,0.16)] text-neutral-800'
          : 'rounded-2xl bg-[#14161a]/98 border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.65)] text-neutral-200';
        break;

      case 'dialog':
        // Task dialog (e.g. Importer, Converter, Settings)
        variantClasses = isLight
          ? 'rounded-2xl bg-[#f7f4ee] border border-black/15 shadow-[0_25px_60px_rgba(35,28,20,0.22)] text-neutral-900'
          : 'rounded-2xl bg-[#14161a] border border-white/15 shadow-[0_30px_80px_rgba(0,0,0,0.75)] text-neutral-100';
        break;

      case 'sheet':
        // Mobile bottom sheet
        variantClasses = isLight
          ? 'rounded-t-2xl border-t border-x border-black/15 bg-[#f7f4ee]/98 shadow-[0_-10px_35px_rgba(35,28,20,0.12)] text-neutral-800'
          : 'rounded-t-2xl border-t border-x border-white/15 bg-[#14161a]/98 shadow-[0_-15px_45px_rgba(0,0,0,0.65)] text-neutral-200';
        break;

      case 'toolbar':
        // Persistent floating rail/dock
        variantClasses = isLight
          ? 'rounded-2xl border border-black/10 bg-[#f7f4ee]/90 shadow-[0_8px_30px_rgba(35,28,20,0.12)] text-neutral-800'
          : 'rounded-2xl border border-white/10 bg-[#121316]/90 shadow-[0_12px_36px_rgba(0,0,0,0.55)] text-white';
        break;
    }

    return (
      <div
        ref={ref}
        data-theme={theme}
        data-surface-variant={variant}
        className={`pr-surface select-none overflow-hidden ${variantClasses} ${className}`}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

StudioSurface.displayName = 'StudioSurface';
