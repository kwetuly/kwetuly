import { cacheLife } from 'next/cache';

async function todayIso(): Promise<string> {
  'use cache';
  cacheLife('hours');
  return new Date().toISOString().slice(0, 10);
}

/** Today's date at midnight UTC, cached for an hour so pages that compare dates can still be prerendered. */
export async function today(): Promise<Date> {
  return new Date(await todayIso());
}
