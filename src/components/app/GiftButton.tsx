import React from 'react';

export type GiftCatalogItem = {
  type: string;
  name: string;
  emoji: string;
  coins?: number;
  gradient: string;
  glow: string;
  tier: string;
};

export const GIFT_CATALOG: Record<string, GiftCatalogItem> = {
  rose: {
    type: 'rose',
    name: 'Rose Glow',
    emoji: '🌹',
    coins: 5,
    gradient: 'linear-gradient(145deg, #fff1f4 0%, #ff6b9d 55%, #ff1744 100%)',
    glow: 'rgba(255, 23, 68, 0.32)',
    tier: 'Sweet',
  },
  heart: {
    type: 'heart',
    name: 'Pulse Heart',
    emoji: '💖',
    coins: 10,
    gradient: 'linear-gradient(145deg, #fff7fb 0%, #ff4fb8 48%, #b517ff 100%)',
    glow: 'rgba(181, 23, 255, 0.30)',
    tier: 'Flirty',
  },
  kiss: {
    type: 'kiss',
    name: 'Flying Kiss',
    emoji: '😘',
    coins: 25,
    gradient: 'linear-gradient(145deg, #fff0de 0%, #ff7a45 52%, #ff2d75 100%)',
    glow: 'rgba(255, 122, 69, 0.32)',
    tier: 'Warm',
  },
  crown: {
    type: 'crown',
    name: 'Queen Crown',
    emoji: '👑',
    coins: 50,
    gradient: 'linear-gradient(145deg, #fff8d9 0%, #ffce3a 48%, #ff7a00 100%)',
    glow: 'rgba(255, 206, 58, 0.36)',
    tier: 'Premium',
  },
  diamond: {
    type: 'diamond',
    name: 'Diamond Shine',
    emoji: '💎',
    coins: 100,
    gradient: 'linear-gradient(145deg, #ecfeff 0%, #38bdf8 45%, #6366f1 100%)',
    glow: 'rgba(56, 189, 248, 0.34)',
    tier: 'Luxury',
  },
  castle: {
    type: 'castle',
    name: 'Dream Castle',
    emoji: '🏰',
    coins: 500,
    gradient: 'linear-gradient(145deg, #fff7ed 0%, #fb7185 38%, #7c3aed 100%)',
    glow: 'rgba(124, 58, 237, 0.34)',
    tier: 'Legendary',
  },
};

export function giftCatalogItem(type: string, coins?: number): GiftCatalogItem {
  const item = GIFT_CATALOG[type] ?? {
    type,
    name: type.charAt(0).toUpperCase() + type.slice(1),
    emoji: '🎁',
    gradient: 'linear-gradient(145deg, #fff7ed 0%, #fb7185 50%, #f97316 100%)',
    glow: 'rgba(249, 115, 22, 0.30)',
    tier: 'Gift',
  };
  return coins == null ? item : { ...item, coins };
}

type GiftButtonProps = {
  type: string;
  coins?: number;
  onClick: () => void;
  compact?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
};

export function GiftButton({ type, coins, onClick, compact = false, disabled = false, ariaLabel }: GiftButtonProps) {
  const gift = giftCatalogItem(type, coins);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? gift.name}
      title={coins ? `${gift.name} · ${coins} coins` : gift.name}
      className={`group relative overflow-hidden border border-white/70 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.03] active:scale-95 disabled:opacity-55 disabled:hover:translate-y-0 ${compact ? 'rounded-2xl px-2.5 py-2' : 'rounded-[20px] px-3 py-2.5 min-w-[86px]'}`}
      style={{ boxShadow: `0 12px 30px ${gift.glow}` }}
    >
      <span className="absolute inset-0 opacity-95" style={{ background: gift.gradient }} />
      <span className="absolute -top-7 -right-6 h-14 w-14 rounded-full bg-white/35 blur-md transition-transform duration-300 group-hover:translate-y-2" />
      <span className="relative flex flex-col items-center gap-0.5 text-white drop-shadow-sm">
        <span className={`${compact ? 'text-[23px]' : 'text-[28px]'} leading-none transition-transform duration-200 group-hover:scale-110`}>{gift.emoji}</span>
        {!compact && <span className="text-[10px] font-bold leading-tight">{gift.name}</span>}
        <span className="rounded-full bg-black/18 px-1.5 py-0.5 text-[9px] font-semibold leading-none backdrop-blur-sm">
          {coins ? `${coins} 🪙` : gift.tier}
        </span>
      </span>
    </button>
  );
}

export function GiftInline({ type }: { type: string }) {
  const gift = giftCatalogItem(type);
  return (
    <span
      title={gift.name}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full align-middle text-[16px] shadow-sm"
      style={{ background: gift.gradient, boxShadow: `0 6px 16px ${gift.glow}` }}
    >
      {gift.emoji}
    </span>
  );
}
