import React from 'react';
import { StudioCloseButton } from '../common/StudioCloseButton';

export type MenuTheme = 'light' | 'dark';

export interface MenuShelfProps {
  theme?: MenuTheme;
  padding?: 'tight' | 'standard' | 'roomy' | 'none';
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  as?: React.ElementType;
}

export function getMenuSurfaceClasses(isLight: boolean): string {
  return isLight
    ? 'border-black/15 bg-[#FAF9F5] shadow-[0_20px_50px_rgba(35,28,20,0.16)] text-neutral-900'
    : 'border-white/[0.08] bg-[#131518]/96 shadow-2xl text-white';
}

export function getMenuDividerClasses(isLight: boolean): string {
  return isLight ? 'border-black/10' : 'border-white/[0.08]';
}

/**
 * MenuShelf: The standard window frame for all floating drawers, shelves, and popouts.
 * Enforces unified corner radius (2xl / 16px), 1px hairline border, theme colors, and standardized padding.
 */
export const MenuShelf: React.FC<MenuShelfProps> = ({
  theme = 'dark',
  padding = 'standard',
  className = '',
  style,
  children,
  as: Component = 'div',
}) => {
  const isLight = theme === 'light';

  const paddingClass =
    padding === 'tight'
      ? 'p-2.5'
      : padding === 'standard'
      ? 'p-3'
      : padding === 'roomy'
      ? 'p-4'
      : 'p-0';

  return (
    <Component
      className={`rounded-2xl border select-none transition-colors ${getMenuSurfaceClasses(
        isLight
      )} ${paddingClass} ${className}`}
      style={style}
    >
      {children}
    </Component>
  );
};

export interface MenuHeaderProps {
  title: string;
  theme?: MenuTheme;
  subtitle?: string;
  onClose?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * MenuHeader: The standard top header for all panels and drawers.
 * Guaranteed zero grab-handle lines and zero wasted top space.
 */
export const MenuHeader: React.FC<MenuHeaderProps> = ({
  title,
  theme = 'dark',
  subtitle,
  onClose,
  actions,
  className = '',
}) => {
  const isLight = theme === 'light';

  return (
    <div
      className={`flex items-center justify-between pb-2 min-h-[32px] shrink-0 ${className}`}
    >
      <div className="flex flex-col min-w-0 pr-2">
        <h3
          className={`text-sm font-bold tracking-tight truncate ${
            isLight ? 'text-neutral-900' : 'text-white/95'
          }`}
        >
          {title}
        </h3>
        {subtitle && (
          <span
            className={`text-[10px] leading-tight truncate ${
              isLight ? 'text-neutral-500' : 'text-white/50'
            }`}
          >
            {subtitle}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {actions}
        {onClose && (
          <StudioCloseButton
            onClick={onClose}
            ariaLabel={`Close ${title}`}
            title="Close"
            theme={theme}
            className="w-7 h-7 min-w-[28px] min-h-[28px] rounded-lg"
          />
        )}
      </div>
    </div>
  );
};

export interface SegmentedOption<T extends string = string> {
  id: T;
  label?: string;
  icon?: React.FC<{ className?: string; strokeWidth?: number }>;
  disabled?: boolean;
  title?: string;
}

export interface MenuSegmentedToggleProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (id: T) => void;
  theme?: MenuTheme;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * MenuSegmentedToggle: Unified compact switch (e.g. Brush vs Model, Conformal vs Spatial).
 * Standardizes 28px height, inline icons, and clean high-contrast selection.
 */
export function MenuSegmentedToggle<T extends string = string>({
  options,
  value,
  onChange,
  theme = 'dark',
  size = 'sm',
  className = '',
}: MenuSegmentedToggleProps<T>) {
  const isLight = theme === 'light';
  const heightClass = size === 'sm' ? 'h-7' : 'h-8';
  const iconSizeClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`inline-flex items-center p-0.5 rounded-lg border ${
          isLight
            ? 'border-black/10 bg-black/[0.03]'
            : 'border-white/10 bg-white/[0.03]'
        }`}
      >
        {options.map((opt) => {
          const isSelected = value === opt.id;
          const Icon = opt.icon;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              disabled={opt.disabled}
              title={opt.title || opt.label || opt.id}
              className={`${heightClass} px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                isSelected
                  ? isLight
                    ? 'bg-white text-sky-700 shadow-xs border border-black/10'
                    : 'bg-white/15 text-sky-300 shadow-xs border border-white/10'
                  : isLight
                  ? 'text-neutral-600 hover:text-neutral-900 hover:bg-black/5'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              } disabled:opacity-30 disabled:pointer-events-none`}
            >
              {Icon && <Icon className={`${iconSizeClass} shrink-0`} />}
              {opt.label && <span>{opt.label}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface MenuGridItemProps {
  selected?: boolean;
  onClick?: () => void;
  title?: string;
  label?: string;
  badge?: React.ReactNode;
  thumbnail?: React.ReactNode;
  theme?: MenuTheme;
  className?: string;
  aspect?: string;
}

/**
 * MenuGridItem: Unified grid tile for brush presets, shader balls, and tools.
 * Standardizes aspect ratio, border, active selection outline, and label typography.
 */
export const MenuGridItem: React.FC<MenuGridItemProps> = ({
  selected = false,
  onClick,
  title,
  label,
  badge,
  thumbnail,
  theme = 'dark',
  className = '',
  aspect = 'aspect-square',
}) => {
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={onClick}
      title={title || label}
      className={`relative rounded-xl p-1 flex flex-col items-center justify-between transition-all active:scale-95 border ${aspect} ${
        selected
          ? 'border-sky-500 dark:border-sky-400/90 bg-sky-500/[0.12] shadow-[0_0_12px_rgba(56,189,248,0.25)] ring-1 ring-sky-400/70'
          : isLight
          ? 'border-black/10 bg-black/[0.03] hover:border-black/20 hover:bg-black/[0.06]'
          : 'border-white/[0.06] bg-[#18191e] hover:border-white/20 hover:bg-[#1f2127]'
      } ${className}`}
    >
      {badge && <div className="absolute top-1 right-1 z-10">{badge}</div>}

      <div className="w-full flex-1 flex items-center justify-center overflow-hidden p-0.5">
        {thumbnail}
      </div>

      {label && (
        <span
          className={`text-[9.5px] truncate w-full text-center leading-tight pb-0.5 ${
            selected
              ? isLight
                ? 'text-neutral-950 font-bold'
                : 'text-white font-semibold'
              : isLight
              ? 'text-neutral-700 font-medium'
              : 'text-white/70 font-medium'
          }`}
        >
          {label}
        </span>
      )}
    </button>
  );
};

export interface MenuSliderControlProps {
  label: string;
  value: number;
  displayValue?: string | number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  theme?: MenuTheme;
  className?: string;
}

/**
 * MenuSliderControl: Unified slider track, label, and numeric value readout.
 */
export const MenuSliderControl: React.FC<MenuSliderControlProps> = ({
  label,
  value,
  displayValue,
  min,
  max,
  step = 0.01,
  onChange,
  theme = 'dark',
  className = '',
}) => {
  const isLight = theme === 'light';

  return (
    <div className={`flex flex-col gap-1.5 w-full select-none ${className}`}>
      <div className="flex items-center justify-between text-[11px] font-semibold">
        <span className={isLight ? 'text-neutral-700' : 'text-neutral-300'}>
          {label}
        </span>
        <span
          className={`font-mono font-bold text-[10px] ${
            isLight ? 'text-neutral-900' : 'text-neutral-100'
          }`}
        >
          {displayValue !== undefined ? displayValue : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`w-full h-2 rounded-full appearance-none cursor-pointer accent-sky-500 ${
          isLight ? 'bg-black/10' : 'bg-white/15'
        }`}
      />
    </div>
  );
};
