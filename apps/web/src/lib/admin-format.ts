// Small formatting helpers shared by the admin pages (admin texts are English only).

const TZ = 'Africa/Dar_es_Salaam';

// Phone numbers on admin lists are masked (e.g. 2557XX…678): enough to tell people apart,
// not enough to copy. Full numbers stay where a call is needed (group trip organisers, guides under review).
export function maskPhone(phone: string | null | undefined) {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.length < 8 ? '…' : `${digits.slice(0, 4)}XX…${digits.slice(-3)}`;
}

/** "31 Oct 2026" in Dar es Salaam time. */
export function adminDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
}

/** "31 Oct 2026, 09:40" in Dar es Salaam time. */
export function adminDateTime(iso: string | Date) {
  return new Date(iso).toLocaleString('en-GB', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' });
}

/** A date range for date-only values ("2026-11-03"), written "3 Nov to 6 Nov 2026" (no arrows). */
export function dateRange(start: string, end: string) {
  const fmt = (d: string, year: boolean) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
  if (start === end) return fmt(start, true);
  return `${fmt(start, start.slice(0, 4) !== end.slice(0, 4))} to ${fmt(end, true)}`;
}

/** Today's date in Dar es Salaam as "YYYY-MM-DD". Call only at request time. */
export function darToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** How long something has waited, in plain words: "today", "1 day", "3 days", "2 weeks". */
export function waitedFor(iso: string, now = new Date()) {
  const hours = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 24) return 'today';
  const days = Math.floor(hours / 24);
  if (days < 14) return days === 1 ? '1 day' : `${days} days`;
  const weeks = Math.floor(days / 7);
  return `${weeks} weeks`;
}

/** Whole hours since a time. */
export function hoursSince(iso: string, now = new Date()) {
  return (now.getTime() - new Date(iso).getTime()) / 3_600_000;
}
