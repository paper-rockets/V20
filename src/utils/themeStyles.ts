/**
 * Shared Theme Tokens & Style Helpers
 * 
 * Provides consistent styling classes across all components, panels, toolbars,
 * and modals for both Light Mode and Dark Mode.
 */

export interface SurfaceTokens {
  panel: string;
  popover: string;
  dialog: string;
  sheet: string;
  toolbar: string;
}

export interface ThemeClasses {
  // Shell containers & modal windows
  shell: string;
  header: string;
  content: string;
  footer: string;
  
  // Inner cards & sub-sections
  innerCard: string;
  innerCardMuted: string;
  
  // Inputs & controls
  input: string;
  rangeSlider: string;
  
  // Buttons & pills
  btnPrimary: string;
  btnSecondary: string;
  btnGhost: string;
  btnDanger: string;
  activePill: string;
  inactivePill: string;
  
  // Typography & accents
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderSubtle: string;

  // Explicit surface variants
  surfaces: SurfaceTokens;
  scrollTrack: string;
}

export function getThemeClasses(theme?: 'light' | 'dark' | string): ThemeClasses {
  const isLight = theme === 'light';

  return {
    shell: isLight
      ? 'bg-[#f7f4ee] text-neutral-900 border-black/15 shadow-[0_20px_50px_rgba(35,28,20,0.14)]'
      : 'bg-[#14161a] text-neutral-100 border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.65)]',
    header: isLight
      ? 'bg-neutral-100/80 border-b border-black/10 text-neutral-900'
      : 'bg-[#101215]/80 border-b border-white/10 text-white',
    content: isLight ? 'text-neutral-800' : 'text-neutral-200',
    footer: isLight
      ? 'bg-neutral-100/80 border-t border-black/10'
      : 'bg-[#101215]/80 border-t border-white/10',
    innerCard: isLight
      ? 'bg-white/80 border border-black/10 text-neutral-900'
      : 'bg-white/[0.04] border border-white/10 text-neutral-100',
    innerCardMuted: isLight
      ? 'bg-neutral-100/70 border border-black/5 text-neutral-700'
      : 'bg-white/[0.02] border border-white/5 text-neutral-300',
    input: isLight
      ? 'bg-white border border-black/15 text-neutral-900 placeholder:text-neutral-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30'
      : 'bg-black/30 border border-white/15 text-white placeholder:text-neutral-500 focus:border-sky-400 focus:ring-1 focus:ring-sky-400/30',
    rangeSlider: 'accent-sky-400 cursor-pointer',
    btnPrimary: isLight
      ? 'bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white font-semibold transition-all shadow-xs'
      : 'bg-white hover:bg-neutral-100 active:scale-95 text-zinc-950 font-semibold transition-all shadow-xs',
    btnSecondary: isLight
      ? 'bg-neutral-100 hover:bg-neutral-200 active:scale-95 text-neutral-800 border border-black/10 transition-all'
      : 'bg-white/10 hover:bg-white/15 active:scale-95 text-neutral-100 border border-white/10 transition-all',
    btnGhost: isLight
      ? 'hover:bg-black/5 active:scale-95 text-neutral-600 hover:text-neutral-900 transition-all'
      : 'hover:bg-white/10 active:scale-95 text-neutral-400 hover:text-white transition-all',
    btnDanger: isLight
      ? 'bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-600 border border-rose-200 transition-all'
      : 'bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-400 border border-rose-500/20 transition-all',
    activePill: isLight
      ? 'bg-sky-600/15 border border-sky-600/70 text-sky-950 font-semibold shadow-xs'
      : 'bg-sky-400/15 border border-sky-400/70 text-sky-300 font-semibold shadow-xs',
    inactivePill: isLight
      ? 'border border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-black/[0.03]'
      : 'border border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.04]',
    textPrimary: isLight ? 'text-neutral-900' : 'text-neutral-100',
    textSecondary: isLight ? 'text-neutral-600' : 'text-neutral-400',
    textMuted: isLight ? 'text-neutral-400' : 'text-neutral-500',
    borderSubtle: isLight ? 'border-black/10' : 'border-white/10',

    surfaces: {
      panel: isLight
        ? 'w-[280px] sm:w-[300px] rounded-2xl bg-[#f7f4ee]/98 border border-black/15 shadow-[0_20px_50px_rgba(35,28,20,0.14)] text-neutral-800'
        : 'w-[280px] sm:w-[300px] rounded-2xl bg-[#14161a]/98 border border-white/15 shadow-[0_24px_70px_rgba(0,0,0,0.6)] text-neutral-200',
      popover: isLight
        ? 'rounded-2xl bg-[#f7f4ee]/98 border border-black/15 shadow-[0_16px_40px_rgba(35,28,20,0.16)] text-neutral-800'
        : 'rounded-2xl bg-[#14161a]/98 border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.65)] text-neutral-200',
      dialog: isLight
        ? 'rounded-2xl bg-[#f7f4ee] border border-black/15 shadow-[0_25px_60px_rgba(35,28,20,0.22)] text-neutral-900'
        : 'rounded-2xl bg-[#14161a] border border-white/15 shadow-[0_30px_80px_rgba(0,0,0,0.75)] text-neutral-100',
      sheet: isLight
        ? 'rounded-t-2xl border-t border-x border-black/15 bg-[#f7f4ee]/98 shadow-[0_-10px_35px_rgba(35,28,20,0.12)] text-neutral-800'
        : 'rounded-t-2xl border-t border-x border-white/15 bg-[#14161a]/98 shadow-[0_-15px_45px_rgba(0,0,0,0.65)] text-neutral-200',
      toolbar: isLight
        ? 'rounded-2xl border border-black/10 bg-[#f7f4ee]/90 shadow-[0_8px_30px_rgba(35,28,20,0.12)] text-neutral-800'
        : 'rounded-2xl border border-white/10 bg-[#121316]/90 shadow-[0_12px_36px_rgba(0,0,0,0.55)] text-white',
    },
    scrollTrack: 'scrollbar-thin scrollbar-thumb-zinc-400/40 dark:scrollbar-thumb-zinc-600/40 scrollbar-track-transparent',
  };
}
