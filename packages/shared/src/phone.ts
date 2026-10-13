// Turns what people type into an international number like +255712345678, or null if it can't.
// Tanzanian local numbers (07xx / 06xx) get +255 added, since most users are in Tanzania.
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (/^0[67]\d{8}$/.test(digits)) return `+255${digits.slice(1)}`;
  if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
    const international = trimmed.startsWith('00') ? digits.slice(2) : digits;
    return /^[1-9]\d{7,14}$/.test(international) ? `+${international}` : null;
  }
  return null;
}
