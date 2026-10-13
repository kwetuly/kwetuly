// Rafrika design tokens: the only source of colours, type, radius and spacing for the
// marketplace UI. The website and the app both import this file. Do not add values here
// without a reason written next to them.

export const color = {
  paper: '#F3EFE6', // page background (never pure white)
  sheet: '#FBF8F3', // cards
  fill: '#E7E1D6', // inputs
  ink: '#1C1915', // text
  inkSoft: '#5C564C', // secondary text; nothing lighter is allowed
  rule: '#DDD6C8', // 1px borders
  forest: '#1E3A2F', // primary button and wordmark only
  forestPressed: '#14281F',
  onForest: '#F3EFE6', // text on the primary button
  mint: '#D5E4D8', // the "Verified" chip only
  clay: '#9C4A28', // cancel, refund, errors only
} as const;

export const space = { s4: 4, s8: 8, s12: 12, s16: 16, s24: 24, s32: 32, s48: 48 } as const;

export const radius = { card: 12, input: 8, button: 8, chip: 4 } as const;

export const border = { width: 1, color: color.rule } as const;

/** Primary button: one per screen, 48px tall, full width on phones. */
export const button = { height: 48, radius: radius.button, background: color.forest, pressed: color.forestPressed, text: color.onForest } as const;

// Atkinson Hyperlegible (400/700) for the interface; Fraunces for places, prices and headlines.
// Fraunces never goes on a button.
export const font = {
  ui: 'Atkinson Hyperlegible',
  display: 'Fraunces',
  weights: { regular: 400, bold: 700 },
} as const;

export const type = {
  body: 16,
  small: 14,
  label: 12, // tier labels, column labels (uppercase, tracked)
  title: 22, // Fraunces: routes, provider names
  price: 20, // Fraunces, tabular figures
  headline: 40, // Fraunces: public site headline
} as const;

// ---------------------------------------------------------------------------
// Formatting shared by both clients
// ---------------------------------------------------------------------------

/** "TSh 610,000" — always whole shillings, comma thousands. */
export function formatTSh(amount: number): string {
  return `TSh ${Math.round(amount).toLocaleString('en-US')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "14–16 Oct", "30 Oct – 2 Nov", "14 Oct". Dates are YYYY-MM-DD. */
export function formatDateSpan(start: string, end?: string | null): string {
  const [, sm, sd] = start.split('-').map(Number);
  if (!end || end === start) return `${sd} ${MONTHS[sm - 1]}`;
  const [, em, ed] = end.split('-').map(Number);
  return sm === em ? `${sd}–${ed} ${MONTHS[sm - 1]}` : `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]}`;
}

export type Tier = 'regular' | 'premium' | 'vip';
export type EscrowStatus = 'held' | 'released' | 'refunded';
