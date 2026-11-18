import React from 'react';
import {tr} from '../i18n';

interface BrandMarkProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  glow?: boolean;
}

/**
 * Mroya Brand Emblem (Знак «Мроя»):
 * 
 * 3D Golden Network with Nodes (Залатая 3D-сець з вузламі)
 * Interconnected constellation of golden neural nodes and luminous filaments,
 * reflecting the architecture of personal long-term memory, wisdom, and reverie.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({
  size = 'md',
  className = '',
  glow = false,
}) => {
  const sizeMap = {
    xs: { box: 'w-5 h-5 rounded-[6px]', img: 'w-4 h-4' },
    sm: { box: 'w-6 h-6 rounded-[8px]', img: 'w-5 h-5' },
    md: { box: 'w-8 h-8 rounded-[10px]', img: 'w-6.5 h-6.5' },
    lg: { box: 'w-12 h-12 rounded-[14px]', img: 'w-10 h-10' },
    xl: { box: 'w-16 h-16 rounded-[18px]', img: 'w-13.5 h-13.5' },
  }[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none transition-all duration-200 group-hover:scale-[1.03] ${sizeMap.box} bg-gradient-to-br from-[var(--mroya-surface)] via-[var(--mroya-surface)] to-[var(--mroya-surface-active)] border border-[var(--mroya-brand-honey)]/35 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden ${className}`}
      aria-label={tr('brandEmblem',{ns:'common'})}
    >
      {/* Subtle ambient dream halo behind the emblem */}
      {glow && (
        <span
          className="absolute -inset-1 rounded-full bg-[var(--mroya-brand-honey)]/25 blur-md pointer-events-none -z-10 animate-pulse"
          aria-hidden="true"
        />
      )}

      <img
        src="/brand/mroya-golden-network.png"
        alt={tr('brandEmblem',{ns:'common'})}
        className={`${sizeMap.img} object-contain select-none pointer-events-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]`}
        referrerPolicy="no-referrer"
        loading="eager"
        decoding="async"
      />
    </div>
  );
};
