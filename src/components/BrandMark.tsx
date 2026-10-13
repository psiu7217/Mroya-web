import React, {useId} from 'react';

interface BrandMarkProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  glow?: boolean;
}

/**
 * Mroya Brand Emblem (Знак «Мроя»):
 * 
 * Inspired by the Belarusian word «мроя» — a poetic dream, reverie, visionary aspiration, 
 * and luminous daydream (светлая мара, летуценне, сновідзелле).
 * 
 * Symbolism:
 * 1. The Soaring "M" (Плынь думак / Крылы) — Two upward-curving arches representing 
 *    the flight of thought and the architecture of long-term memory.
 * 2. The Dream Star / Polaris (Зорка мроі) — A radiant 4-pointed celestial star at the 
 *    apex, symbolizing the guiding beacon of aspirations and clarity.
 * 3. The Central Memory Confluence (Вузел памяці) — A luminous nexus joining thought, 
 *    relationships, and commitments into permanent harmony.
 * 4. The Horizon Crescent (Водбліск летуценняў) — A subtle foundation arc reflecting 
 *    calmness, stability, and peaceful reflection.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({
  size = 'md',
  className = '',
  glow = false,
}) => {
  const gradientId = 'mroya'+useId().replaceAll(':','');
  const sizeMap = {
    xs: { box: 'w-5 h-5 rounded-[6px]', svg: 'w-3.5 h-3.5' },
    sm: { box: 'w-6 h-6 rounded-[8px]', svg: 'w-4.5 h-4.5' },
    md: { box: 'w-8 h-8 rounded-[10px]', svg: 'w-6 h-6' },
    lg: { box: 'w-12 h-12 rounded-[14px]', svg: 'w-8.5 h-8.5' },
    xl: { box: 'w-16 h-16 rounded-[18px]', svg: 'w-11.5 h-11.5' },
  }[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none transition-all duration-200 group-hover:scale-[1.03] ${sizeMap.box} bg-gradient-to-br from-[var(--mroya-surface)] via-[var(--mroya-surface)] to-[var(--mroya-surface-active)] border border-[var(--mroya-brand-honey)]/35 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
      aria-label="Mroya emblem: Belarusian dream star and memory arches"
    >
      {/* Subtle ambient dream halo behind the emblem */}
      {glow && (
        <span
          className="absolute -inset-1 rounded-full bg-[var(--mroya-brand-honey)]/20 blur-md pointer-events-none -z-10 animate-pulse"
          aria-hidden="true"
        />
      )}

      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${sizeMap.svg} overflow-visible`}
        aria-hidden="true"
      >
        <defs>
          {/* Primary ribbon gradient — warm honey gold to deep amber/chestnut */}
          <linearGradient id={`${gradientId}-gold-grad`} x1="6" y1="4" x2="26" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#DF9F35" />
            <stop offset="45%" stopColor="var(--mroya-brand-honey, #B88536)" />
            <stop offset="100%" stopColor="var(--mroya-primary, #7E5301)" />
          </linearGradient>

          {/* Dream Star radiant spark gradient — bright celestial starburst */}
          <linearGradient id={`${gradientId}-star-grad`} x1="16" y1="2.5" x2="16" y2="11.5" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFE08F" />
            <stop offset="50%" stopColor="#E5A73E" />
            <stop offset="100%" stopColor="var(--mroya-brand-honey, #B88536)" />
          </linearGradient>

          {/* Subtle warm center radial ambiance */}
          <radialGradient id={`${gradientId}-ambient`} cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="var(--mroya-brand-honey, #B88536)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient interior dream atmosphere */}
        <circle cx="16" cy="15" r="12" fill={`url(#${gradientId}-ambient)`} />

        {/* 1. Celestial Dream Star (Зорка мроі) — 4-pointed radiant star of inspiration */}
        <path
          d="M 16 2.8 C 16 5.5 17.2 6.7 19.8 6.7 C 17.2 6.7 16 7.9 16 10.6 C 16 7.9 14.8 6.7 12.2 6.7 C 14.8 6.7 16 5.5 16 2.8 Z"
          fill={`url(#${gradientId}-star-grad)`}
        />

        {/* 2. The Soaring Monogram "M" — two fluid arches symbolizing soaring thoughts & permanent memory */}
        <path
          d="M 6.8 23.5 C 6.8 14.8 9.6 9.6 12.4 9.6 C 14.5 9.6 15.5 13.5 16 16.2 C 16.5 13.5 17.5 9.6 19.6 9.6 C 22.4 9.6 25.2 14.8 25.2 23.5"
          stroke={`url(#${gradientId}-gold-grad)`}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 3. Central Confluence Node — nexus where dreams connect with grounded memory */}
        <circle
          cx="16"
          cy="16.2"
          r="1.5"
          fill={`url(#${gradientId}-gold-grad)`}
        />

        {/* 4. Serene Horizon Arc — grounding base reflecting calm stability */}
        <path
          d="M 9.6 22.8 C 13.2 24.5 18.8 24.5 22.4 22.8"
          stroke={`url(#${gradientId}-gold-grad)`}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.75"
        />
      </svg>
    </div>
  );
};
