'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PREVIEW_COOKIE, PREVIEW_COOKIE_MAX_AGE, previewToken, safeEqual } from '@/lib/coming-soon';

export async function openTeamPreview(formData: FormData) {
  const expected = process.env.PREVIEW_PASSWORD;
  const given = String(formData.get('password') ?? '');
  if (!expected || !safeEqual(await previewToken(given), await previewToken(expected))) {
    // Slows down guessing.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    redirect('/team-access?wrong=1');
  }
  (await cookies()).set(PREVIEW_COOKIE, await previewToken(expected), {
    path: '/',
    maxAge: PREVIEW_COOKIE_MAX_AGE,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  redirect('/');
}
