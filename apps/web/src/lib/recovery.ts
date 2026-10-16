// "Set a new password" is allowed only right after a password reset link. /auth/confirm sets this
// short-lived httpOnly cookie (value: the user id the link signed in) and updatePassword checks and
// clears it, so an open session on its own cannot change the password.
export const RECOVERY_COOKIE = 'rafrika_recovery';
export const RECOVERY_COOKIE_MAX_AGE = 15 * 60; // seconds

export const recoveryCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: RECOVERY_COOKIE_MAX_AGE,
};
