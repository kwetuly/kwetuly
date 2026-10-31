'use server';

import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { BUSINESS_TYPES, REGIONS, SAMPLE_MEDIA_BUCKET, normaliseWebsite } from '@kwetuly/shared';
import { defaultLocale, hasLocale, type Locale } from '@/i18n/config';
import { getCurrentUser, isAdminSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

async function adminOnly(formData: FormData): Promise<{ locale: Locale; userId: string }> {
  const value = String(formData.get('locale') ?? '');
  const locale = hasLocale(value) ? value : defaultLocale;
  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) redirect(`/${locale}`);
  return { locale, userId: user.id };
}

const text = (formData: FormData, key: string, max: number) => String(formData.get(key) ?? '').trim().slice(0, max);
const https = (value: string) => (/^https:\/\/\S+$/.test(value) ? value : null);

// Create or edit any business listing. Listings Kwetuly adds itself belong to the admin account,
// so enquiries to them arrive in the admin inbox.
export async function saveListing(formData: FormData) {
  const { locale, userId } = await adminOnly(formData);
  const id = text(formData, 'id', 40);
  const type = text(formData, 'business_type', 30);
  const region = text(formData, 'base_region', 80);
  const back = `/${locale}/admin/listings`;
  const websiteInput = text(formData, 'website', 1000);
  const website = websiteInput ? normaliseWebsite(websiteInput) : null;
  if (website && !website.ok) redirect(`${back}?error=website${id ? `#b-${id}` : ''}`);
  const row = {
    business_name: text(formData, 'business_name', 120),
    business_type: type,
    base_region: region,
    location: text(formData, 'location', 160) || null,
    story: text(formData, 'story', 4000) || null,
    website: website?.ok ? website.url : null,
    source_url: https(text(formData, 'source_url', 400)),
    photo_url: https(text(formData, 'photo_url', 400)),
    is_sample: formData.get('is_sample') === 'on',
    verification_status: formData.get('published') === 'on' ? 'approved' : 'pending',
    is_available: true,
  };
  if (row.business_name.length < 2 || !BUSINESS_TYPES.some((b) => b.id === type) || !(REGIONS as readonly string[]).includes(region)) {
    redirect(`${back}?error=1`);
  }
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from('providers').update(row).eq('id', id)
    : await supabase.from('providers').insert({ ...row, owner_id: userId, languages: ['en', 'sw'] });
  revalidateTag('businesses', 'max');
  redirect(`${back}?${error ? 'error' : 'saved'}=1${id ? `#b-${id}` : ''}`);
}

export async function deleteListing(formData: FormData) {
  const { locale } = await adminOnly(formData);
  const supabase = await createClient();
  await supabase.from('providers').delete().eq('id', text(formData, 'id', 40));
  revalidateTag('businesses', 'max');
  redirect(`/${locale}/admin/listings?deleted=1`);
}

// Before launch: remove every sample listing in one go. Each step is checked; on the first failure
// it stops and reports which table failed and what had already been removed.
export async function deleteAllSamples(formData: FormData) {
  const { locale } = await adminOnly(formData);
  const back = `/${locale}/admin/listings`;
  if (formData.get('confirm') !== 'DELETE') redirect(`${back}?error=confirm`);
  // The admin's own session (not the service role): RLS and the storage policies for admins apply.
  const supabase = await createClient();
  const removed = { providers: 0, listings: 0, packages: 0, group_trips: 0, guides: 0, trip_guides: 0, files: 0, credits: 0 };
  const report = (extra: Record<string, string>) =>
    new URLSearchParams({ ...extra, ...Object.fromEntries(Object.entries(removed).map(([k, v]) => [`n_${k}`, String(v)])) }).toString();
  const finish = (failed?: string, message?: string) => {
    revalidateTag('guides', 'max');
    revalidateTag('packages', 'max');
    revalidateTag('groups', 'max');
    revalidateTag('businesses', 'max');
    // Tour pages and lists (tours read their linked guides through trip_guides).
    revalidateTag('trips', 'max');
    revalidateTag('sample-media', 'max');
    if (failed) {
      console.error(`deleteAllSamples: ${failed} failed: ${message ?? 'unknown error'}`);
      redirect(`${back}?${report({ samples_failed: failed })}`);
    }
    redirect(`${back}?${report({ samples_deleted: '1' })}`);
  };

  // Shop items go with their sample businesses (on delete cascade), so they are counted first.
  const listings = await supabase
    .from('listings')
    .select('id, providers!inner(is_sample)', { count: 'exact', head: true })
    .eq('providers.is_sample', true);
  if (listings.error) return finish('listings (count)', listings.error.message);

  const providers = await supabase.from('providers').delete({ count: 'exact' }).eq('is_sample', true);
  if (providers.error) return finish('providers', providers.error.message);
  removed.providers = providers.count ?? 0;
  if (removed.providers) removed.listings = listings.count ?? 0;

  // Sample guides take their packages and tour links with them; their sample group trips go first.
  const guides = await supabase.from('guides').select('id').eq('is_sample', true);
  if (guides.error) return finish('guides (lookup)', guides.error.message);
  const ids = (guides.data ?? []).map((g) => g.id as string);
  if (ids.length) {
    // Counted before the guides go, because the database removes these rows with them.
    const packages = await supabase.from('guide_packages').select('id', { count: 'exact', head: true }).in('guide_id', ids);
    if (packages.error) return finish('packages (count)', packages.error.message);
    const links = await supabase.from('trip_guides').select('guide_id', { count: 'exact', head: true }).in('guide_id', ids);
    if (links.error) return finish('trip_guides (count)', links.error.message);

    const trips = await supabase.from('group_trips').delete({ count: 'exact' }).in('guide_id', ids);
    if (trips.error) return finish('group_trips', trips.error.message);
    removed.group_trips = trips.count ?? 0;

    const deletedGuides = await supabase.from('guides').delete({ count: 'exact' }).in('id', ids);
    if (deletedGuides.error) return finish('guides', deletedGuides.error.message);
    removed.guides = deletedGuides.count ?? 0;
    if (removed.guides) {
      removed.packages = packages.count ?? 0;
      removed.trip_guides = links.count ?? 0;
    }
    if (removed.guides !== ids.length) return finish('guides', `removed ${removed.guides} of ${ids.length}`);
  }

  // Stock photos: SQL cannot delete storage objects, so the files go through the Storage API.
  const bucket = supabase.storage.from(SAMPLE_MEDIA_BUCKET);
  const files: string[] = [];
  // Only the sample/ folder: the bucket is for sample photos, and nothing else in it may be removed here.
  const folders = ['sample'];
  while (folders.length) {
    const prefix = folders.shift()!;
    for (let offset = 0; ; offset += 1000) {
      const page = await bucket.list(prefix, { limit: 1000, offset });
      // A missing bucket means there is nothing to remove.
      if (page.error) {
        if (/not.?found/i.test(page.error.message)) break;
        return finish('sample photos (list)', page.error.message);
      }
      for (const entry of page.data ?? []) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        // Folders come back without an id.
        if (entry.id) files.push(path);
        else folders.push(path);
      }
      if ((page.data?.length ?? 0) < 1000) break;
    }
    if (files.length + folders.length > 5000) return finish('sample photos (list)', 'more than 5000 entries');
  }
  for (let i = 0; i < files.length; i += 100) {
    const batch = await bucket.remove(files.slice(i, i + 100));
    if (batch.error) return finish('sample photos', batch.error.message);
    removed.files += batch.data?.length ?? 0;
  }

  const credits = await supabase.from('sample_media_credits').delete({ count: 'exact' }).like('path', 'sample/%');
  // The credits table only exists once the realistic-samples migration has run.
  if (credits.error && credits.error.code !== '42P01' && credits.error.code !== 'PGRST205') return finish('photo credits', credits.error.message);
  removed.credits = credits.count ?? 0;

  return finish();
}
