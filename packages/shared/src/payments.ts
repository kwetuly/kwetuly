// Which payment page addresses Kwetuly may send a payer to (security-reviewer M-A, 2026-11-07).
// The `payments` Edge Function checks the address Selcom returns before answering with it; the website
// and the app check it again before redirecting or opening it. A copy of this check lives in
// supabase/functions/payments/index.ts (Deno cannot import this package); keep the two the same.
//
// Selcom's public docs show the payment page address only as a placeholder (example.com), so the
// exact payment page host is TO VERIFY IN THE SANDBOX (docs/payments/selcom-sandbox-plan.md, 4.2).
// Allowed: subdomains of Selcom's own domains (selcommobile.com hosts the API and developer site,
// selcom.net is Selcom's website). Narrow this to the exact host once the sandbox shows it.

/** Selcom's domains. Only subdomains of these (e.g. "x.selcommobile.com") are accepted, not the bare domain. */
export const SELCOM_PAYMENT_DOMAINS: readonly string[] = ['selcommobile.com', 'selcom.net'];

const MAX_URL_LENGTH = 2048;
// https, then the host (letters, digits, dots, hyphens only: no userinfo "@", no "%", no "\"), then
// optionally ":443", then nothing or a path, query or fragment of visible ASCII without "\".
const PAYMENT_URL = /^https:\/\/([A-Za-z0-9.-]+)(?::443)?(?:[/?#][\x21-\x5b\x5d-\x7e]*)?$/;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * True only for an https address on a Selcom payment page host, safe to redirect a payer to.
 * Refuses: http and other schemes, userinfo (user@host), ports other than 443, lookalike hosts
 * (selcommobile.com.evil.com, evilselcommobile.com), IP addresses, trailing dots, spaces, control
 * or non-ASCII characters, backslashes, and anything longer than 2048 characters.
 * Pure string check, no URL parser, so it behaves the same in browsers, React Native, Node and Deno.
 */
export function isSelcomPaymentUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length === 0 || url.length > MAX_URL_LENGTH) return false;
  const match = PAYMENT_URL.exec(url);
  if (!match) return false;
  const host = match[1].toLowerCase();
  if (host.length > 253) return false;
  const labels = host.split('.');
  if (!labels.every((label) => LABEL.test(label))) return false;
  return SELCOM_PAYMENT_DOMAINS.some((domain) => host.endsWith(`.${domain}`));
}
