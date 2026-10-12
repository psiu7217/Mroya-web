import React from 'react';

interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Mroya Brand Emblem:
 * A calm, architectural interwoven knot/lattice representing connected long-term memory,
 * rendered in warm honey (#B88536) and deep wood/gold tones per MROYA Brandbook.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ size = 'md', className = '' }) => {
  const dimensions = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
    lg: 'w-9 h-9',
  }[size];

  return (
    <div
      className={`inline-flex items-center justify-center rounded-lg bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] shrink-0 select-none ${dimensions} ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[72%] h-[72%]"
      >
        {/* Outer memory ring / warm honey arch */}
        <path
          d="M6.5 19.5V10.75C6.5 8.67893 8.17893 7 10.25 7C11.9645 7 13.4106 8.15064 13.8588 9.7224L14 10.2177L14.1412 9.7224C14.5894 8.15064 16.0355 7 17.75 7C19.8211 7 21.5 8.67893 21.5 10.75V19.5"
          stroke="var(--mroya-primary)"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Connected memory node bridge in decorative honey */}
        <path
          d="M10.25 15.5C11.8 17.1 16.2 17.1 17.75 15.5"
          stroke="var(--mroya-brand-honey)"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <circle cx="14" cy="19.5" r="1.8" fill="var(--mroya-brand-honey)" />
      </svg>
    </div>
  );
};
