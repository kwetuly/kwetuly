// Rules the database enforces on traveller group trips
// (supabase/migrations/20261108000000_traveller_groups_call_before_publish.sql), mirrored here so the
// website and the app can say what is wrong before or after the database refuses.

/** The account phone a traveller organiser needs: a full international number, as saved by normalizePhone. */
const ORGANISER_PHONE = /^\+[1-9][0-9]{7,14}$/;

/** True when the account phone is good enough to submit a traveller group trip. */
export function isOrganiserPhone(phone: string | null | undefined): boolean {
  return !!phone && ORGANISER_PHONE.test(phone);
}

/** The database's error message when a traveller has too many open or new group trips. */
export const GROUP_TRIP_LIMIT = 'group_trip_limit';

/** True when a Supabase error is the traveller group trip limit (3 open, 5 new in 24 hours). */
export function isGroupTripLimitError(error: { message?: string } | null | undefined): boolean {
  return Boolean(error?.message?.includes(GROUP_TRIP_LIMIT));
}
