'use server';

import { redirect } from 'next/navigation';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// Permanently deletes the signed-in person's account after they type their email address.
// Their uploaded files are removed first; the database then removes everything else.
export async function deleteAccount(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const user = await requireUser(locale);
  const typed = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!user.email || typed !== user.email.toLowerCase()) redirect(`/${locale}/security?deleteError=1#delete`);

  const supabase = await createClient();
  const { data: files } = await supabase.rpc('my_uploaded_files');
  const byBucket = new Map<string, string[]>();
  for (const f of (files ?? []) as { bucket_id: string; name: string }[]) {
    byBucket.set(f.bucket_id, [...(byBucket.get(f.bucket_id) ?? []), f.name]);
  }
  for (const [bucket, names] of byBucket) {
    for (let i = 0; i < names.length; i += 100) await supabase.storage.from(bucket).remove(names.slice(i, i + 100));
  }

  const { error } = await supabase.rpc('delete_my_account');
  if (error) redirect(`/${locale}/security?deleteError=2#delete`);
  await supabase.auth.signOut();
  redirect(`/${locale}/login?deleted=1`);
}
