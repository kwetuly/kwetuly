import { headers } from 'next/headers';
import { phoneCountryOrDefault, resolvePhone } from '@kwetuly/shared';

// The phone-number cleaner lives in @kwetuly/shared so the website and app agree.
export { normalizePhone } from '@kwetuly/shared';

// The number typed in a phone field and the country picked next to it (`phone_country`, else
// Tanzania), read the same way by every server action. `stored` is the number saved before: when the
// person did not change it, it is kept exactly as it was (see resolvePhone).
export function phoneFromForm(
  formData: FormData,
  name = 'phone',
  countryName = 'phone_country',
  stored?: string | null,
): { input: string; country: string; phone: string | null } {
  const input = String(formData.get(name) ?? '').trim().slice(0, 60);
  const country = phoneCountryOrDefault(String(formData.get(countryName) ?? ''));
  return { input, country, phone: resolvePhone(input, country, stored) };
}

// The visitor's country from Vercel's geo header, only as a first guess for the phone field.
// Falls back to Tanzania (no header locally or outside Vercel). Never stored.
export async function phoneCountryHint(): Promise<string> {
  return phoneCountryOrDefault((await headers()).get('x-vercel-ip-country'));
}
