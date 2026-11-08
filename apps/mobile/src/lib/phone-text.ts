import { formatPhone } from '@kwetuly/shared';

/**
 * A sentence with a {phone} placeholder, filled with the formatted number held on one line: its
 * spaces become non-breaking spaces (and any hyphen a non-breaking hyphen), so a narrow screen never
 * splits +255 712 345 678 between its digit groups. formatPhone itself is unchanged, because form
 * fields use its plain string as their starting value.
 */
export function phoneSentence(template: string, phone: string | null | undefined): string {
  const unbroken = formatPhone(phone).replace(/ /g, ' ').replace(/-/g, '‑');
  return template.replace('{phone}', () => unbroken);
}
