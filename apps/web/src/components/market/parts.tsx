import type { CSSProperties, ReactNode } from 'react';
import { ds } from '@rafrika/shared';
import { DISPLAY, UI } from './fonts';

const { color, space, radius, type } = ds;

/** Card surface: sheet colour, 1px rule, 12px radius, no shadow. */
export const sheet: CSSProperties = {
  background: color.sheet,
  border: `1px solid ${color.rule}`,
  borderRadius: radius.card,
  fontFamily: UI,
  color: color.ink,
};

export const tabular: CSSProperties = { fontVariantNumeric: 'tabular-nums' };

/** Fraunces for places, provider names and prices. Never on a button. */
export function Display({ size = type.title, children, style }: { size?: number; children: ReactNode; style?: CSSProperties }) {
  return <span style={{ fontFamily: DISPLAY, fontSize: size, fontWeight: 600, lineHeight: 1.15, ...style }}>{children}</span>;
}

/** Quiet uppercase label: tiers, column labels. */
export function Label({ children, tone = color.inkSoft }: { children: ReactNode; tone?: string }) {
  return (
    <span style={{ fontSize: type.label, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tone }}>{children}</span>
  );
}

/** The only mint on a screen. */
export function VerifiedChip({ label }: { label: string }) {
  return (
    <span style={{ display: 'inline-block', background: color.mint, color: color.ink, borderRadius: radius.chip, padding: `2px ${space.s8}px`, fontSize: type.label, fontWeight: 700 }}>
      {label}
    </span>
  );
}

export function Price({ amount, size = type.price }: { amount: string; size?: number }) {
  return <Display size={size} style={{ ...tabular, whiteSpace: 'nowrap' }}>{amount}</Display>;
}
