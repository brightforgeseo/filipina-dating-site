import React from 'react';

type IconProps = { size?: number; filled?: boolean; className?: string };

// FilWest brand mark — two hearts, matching public/favicon.svg and LogoMark.astro.
export const BrandMark = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
    <g transform="translate(-39 26)">
      <path d="M256 444C150 360 84 290 84 208 84 148 130 108 182 108c30 0 58 16 74 46 16-30 44-46 74-46 52 0 98 40 98 100 0 82-66 152-172 236Z" fill="#A01C40"/>
      <g transform="translate(318 16) scale(0.37)">
        <path d="M256 444C150 360 84 290 84 208 84 148 130 108 182 108c30 0 58 16 74 46 16-30 44-46 74-46 52 0 98 40 98 100 0 82-66 152-172 236Z" fill="#D62246"/>
      </g>
    </g>
  </svg>
);

export const Icon = {
  Heart: ({ size=16, filled=false, className='' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled?'currentColor':'none'} stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 21s-7.5-4.5-9.5-10C1 7 4 4 7.5 4c2 0 3.5 1 4.5 2.5C13 5 14.5 4 16.5 4 20 4 23 7 21.5 11 19.5 16.5 12 21 12 21z"/>
    </svg>
  ),
  X: ({ size=16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>
  ),
  Check: ({ size=16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4L19 6"/></svg>
  ),
  Shield: ({ size=20 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2l8 3v7c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5l8-3z"/><path d="M9 12l2 2 4-4"/></svg>
  ),
  Lock: ({ size=20 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>
  ),
  Eye: ({ size=20 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
  ),
  Pin: ({ size=14 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 22s7-7 7-12a7 7 0 10-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>
  ),
  Send: ({ size=18 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
  ),
  Home: ({ size=18 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 10l9-7 9 7v10a2 2 0 01-2 2h-4v-6h-6v6H5a2 2 0 01-2-2V10z"/></svg>
  ),
  Msg: ({ size=18 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/></svg>
  ),
  Arrow: ({ size=16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
  ),
  Flag: ({ size=16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 22V3h10l1 2h5v10h-7l-1-2H6v9"/></svg>
  ),
  Ban: ({ size=16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M5.5 5.5l13 13"/></svg>
  ),
  Mail: ({ size=16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
  ),
  Star: ({ size=16, filled=false }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled?'currentColor':'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 2l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8L12 17.3 5.9 20.5l1.5-6.8L2.2 9l6.9-.7L12 2z"/></svg>
  ),
  Camera: ({ size=16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 8a2 2 0 012-2h2l2-2h6l2 2h2a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/><circle cx="12" cy="13" r="3.5"/></svg>
  ),
  Users: ({ size=16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15.2c2.4.3 4.4 1.8 5.2 4.3"/></svg>
  ),
  Play: ({ size=16 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M6 4.5v15l13-7.5z"/></svg>
  ),
};
