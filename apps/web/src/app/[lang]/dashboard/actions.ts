'use server';

import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { CALL_TOPICS, GUIDE_EXPERTISE, GUIDE_LANGUAGES, GUIDE_SPECIALTIES, REGIONS, isDisplayNameReservedError } from '@kwetuly/shared';
import { linkErrorCode, normaliseSocial, type SocialPlatform } from '@kwetuly/shared';
import { defaultLocale, hasLocale } from '@/i18n/config';
import { GUIDE_STEPS, isGuideStep, type GuideStep } from '@/lib/guide-steps';
import { requireOnboarded } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { phoneFromForm } from '@/lib/phone';

/** A path the browser uploaded into this user's own storage folder, e.g. "<user id>/avatar-1791234567890.jpg". */
function ownPath(formData: FormData, key: string, userId: string, prefix: string, extensions: string[]) {
  const value = String(formData.get(key) ?? '');
  const match = value.match(/^([0-9a-f-]{36})\/([a-z-]+)-\d{10,16}\.([a-z]+)$/);
  return match && match[1] === userId && match[2] === prefix && extensions.includes(match[3]) ? value : null;
}

const text = (formData: FormData, key: string, max = 500) => {
  const value = String(formData.get(key) ?? '').trim().slice(0, max);
  return value || null;
};

const int = (formData: FormData, key: string) => {
  const n = Number.parseInt(String(formData.get(key) ?? ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** A social profile link, cleaned to the platform's own profile address; empty clears it. */
const socialLink = (formData: FormData, platform: SocialPlatform): { ok: true; url: string | null } | { ok: false } => {
  const value = String(formData.get(`${platform}_url`) ?? '').trim();
  if (!value) return { ok: true, url: null };
  const result = normaliseSocial(platform, value);
  return result.ok ? { ok: true, url: result.url } : { ok: false };
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Saves one step of the guide profile (or every part, when no step is given) and moves on to the next step.
export async function saveGuideProfile(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const stepValue = formData.get('step');
  const step: GuideStep | null = isGuideStep(stepValue) ? stepValue : null;
  const back = `/${locale}/dashboard`;
  const fail = (code: string) => redirect(step ? `${back}?step=${step}&error=${code}` : `${back}?error=${code}`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  await requireOnboarded(user.id, locale, back);

  const allowed = <T extends string>(values: FormDataEntryValue[], list: readonly T[]) =>
    values.map(String).filter((v): v is T => (list as readonly string[]).includes(v));

  // Only the fields of the parts this form carries are written, so other steps keep their answers.
  const has = (part: GuideStep) => !step || step === part;
  const patch: Record<string, unknown> = {};
  let badLink: string | null = null;

  // Phone and WhatsApp (documents step) are optional; when given they are saved as international
  // numbers. Checked before anything is written, against what was saved before, so an unchanged
  // number is kept as it was. Each field has its own error, so only that field is marked.
  let phone: string | null = null;
  let whatsapp: string | null = null;
  if (has('documents')) {
    const { data: saved } = await supabase
      .from('guides')
      .select('guide_private(phone, whatsapp_number)')
      .eq('owner_id', user.id)
      .maybeSingle<{ guide_private: { phone: string | null; whatsapp_number: string | null } | null }>();
    const phoneField = phoneFromForm(formData, 'phone', 'phone_country', saved?.guide_private?.phone);
    const whatsappField = phoneFromForm(formData, 'whatsapp_number', 'whatsapp_country', saved?.guide_private?.whatsapp_number);
    if (phoneField.input && !phoneField.phone) fail('phone');
    if (whatsappField.input && !whatsappField.phone) fail('whatsapp');
    phone = phoneField.phone;
    whatsapp = whatsappField.phone;
  }

  if (has('basics')) {
    const displayName = text(formData, 'display_name', 80);
    const baseRegion = text(formData, 'base_region', 60);
    if (!displayName || !baseRegion || !(REGIONS as readonly string[]).includes(baseRegion)) fail('missing');
    Object.assign(patch, {
      display_name: displayName,
      base_region: baseRegion,
      languages: allowed(formData.getAll('languages'), GUIDE_LANGUAGES.map((l) => l.code)),
    });
    // The browser uploads the photo straight into the user's folder in the avatars bucket and sends
    // only its path here (phone photos are too big to pass through a Server Action).
    const photoPath = ownPath(formData, 'photo_path', user.id, 'avatar', ['jpg', 'png', 'webp']);
    if (photoPath) patch.photo_url = supabase.storage.from('avatars').getPublicUrl(photoPath).data.publicUrl;
  }
  if (has('work')) {
    Object.assign(patch, {
      headline: text(formData, 'headline', 140),
      regions: allowed(formData.getAll('regions'), REGIONS),
      specialties: allowed(formData.getAll('specialties'), GUIDE_SPECIALTIES.map((s) => s.id)),
      expertise: allowed(formData.getAll('expertise'), GUIDE_EXPERTISE.map((e) => e.id)),
      female_guide: formData.get('female_guide') === 'on',
      max_group_size: Math.min(Math.max(int(formData, 'max_group_size') ?? 8, 1), 60),
      years_experience: int(formData, 'years_experience'),
      summits: int(formData, 'summits'),
    });
  }
  if (has('story')) {
    // Profile links: only the guide's own Instagram, Facebook or TikTok profile, stored in one fixed
    // form. A link that is not one is not saved (the saved one stays), but the rest of the step is,
    // and the step comes back with that link's message.
    for (const platform of ['facebook', 'instagram', 'tiktok'] as const) {
      const link = socialLink(formData, platform);
      if (!link.ok) badLink ??= linkErrorCode(platform);
      else patch[`${platform}_url`] = link.url;
    }
    const slug = slugify(text(formData, 'slug', 60) ?? '');
    Object.assign(patch, {
      bio: text(formData, 'bio', 4000),
      certifications: (text(formData, 'certifications', 300) ?? '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 10),
      association: text(formData, 'association', 80),
      has_vehicle: formData.get('has_vehicle') === 'on',
      open_to_partners: formData.get('open_to_partners') === 'on',
      visibility: formData.get('visibility') === 'link_only' ? 'link_only' : 'public',
      ...(slug ? { slug } : {}),
    });
  }
  if (has('calls')) {
    Object.assign(patch, {
      call_enabled: formData.get('call_enabled') === 'on',
      call_price_usd: int(formData, 'call_price_usd'),
      call_minutes: Math.min(Math.max(int(formData, 'call_minutes') ?? 45, 15), 180),
      call_topics: allowed(formData.getAll('call_topics'), CALL_TOPICS.map((c) => c.id)),
    });
  }

  const { data: existing } = await supabase.from('guides').select('id').eq('owner_id', user.id).maybeSingle<{ id: string }>();
  let guideId = existing?.id;
  if (!guideId) {
    // A new profile always starts with the first step, which carries the name and region.
    if (!patch.display_name) redirect(`${back}?step=basics`);
    const base = slugify(String(patch.display_name)) || 'guide';
    // The profile link comes from the name; if someone already has it, add a few digits.
    for (const slug of [String(patch.slug ?? base), `${base}-${Math.floor(1000 + Math.random() * 9000)}`]) {
      const { data, error } = await supabase.from('guides').insert({ ...patch, owner_id: user.id, slug }).select('id').single<{ id: string }>();
      if (data) {
        guideId = data.id;
        break;
      }
      if (isDisplayNameReservedError(error)) fail('name');
      if (error?.code !== '23505') break;
    }
    if (!guideId) fail('save');
  } else if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('guides').update(patch).eq('id', guideId);
    // 23514: a database check refused the row, which on guides means a profile link (e.g. one saved before the checks).
    if (error) fail(error.code === '23505' ? 'slug' : error.code === '23514' ? 'links' : isDisplayNameReservedError(error) ? 'name' : 'save');
  }

  if (has('documents')) {
    // Private details and documents, in the private verification bucket (numbers checked above).
    const privateData: Record<string, string | null> = {
      guide_id: guideId!,
      phone,
      whatsapp_number: whatsapp,
      registration_number: text(formData, 'registration_number', 60),
      kinapa_tanapa_id: text(formData, 'kinapa_tanapa_id', 60),
    };
    const idPath = ownPath(formData, 'id_document_path', user.id, 'guide-id', ['jpg', 'png', 'webp', 'pdf']);
    if (idPath) privateData.id_document_path = idPath;
    const licencePath = ownPath(formData, 'license_document_path', user.id, 'guide-licence', ['jpg', 'png', 'webp', 'pdf']);
    if (licencePath) privateData.license_document_path = licencePath;
    const firstAidPath = ownPath(formData, 'first_aid_document_path', user.id, 'guide-first-aid', ['jpg', 'png', 'webp', 'pdf']);
    if (firstAidPath) privateData.first_aid_document_path = firstAidPath;

    const { error: privateError } = await supabase.from('guide_private').upsert(privateData);
    if (privateError) fail('save');

    // A new document has not been looked at yet, so its public check comes off until an admin checks it again.
    const cleared = {
      ...(idPath ? { identity_checked_at: null } : {}),
      ...(licencePath ? { licence_checked_at: null } : {}),
      ...(firstAidPath ? { first_aid_checked_at: null } : {}),
    };
    if (Object.keys(cleared).length > 0) await supabase.from('guides').update(cleared).eq('id', guideId!);
  }

  revalidateTag('guides', 'max');
  // A refused profile link: everything else is saved; stay on the step and say which link.
  if (badLink) redirect(`${back}?step=${step ?? 'story'}&error=${badLink}`);
  // On to the next step, or back to the overview after the last one.
  const next = step ? GUIDE_STEPS[GUIDE_STEPS.indexOf(step) + 1] : undefined;
  redirect(next ? `${back}?step=${next}` : `${back}?saved=1`);
}

// A traveller's own name and phone. Changing the phone clears its "confirmed" mark (database guard).
export async function saveMyDetails(formData: FormData) {
  const localeValue = String(formData.get('locale') ?? '');
  const locale = hasLocale(localeValue) ? localeValue : defaultLocale;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  // An unchanged number is kept exactly as saved, so its "confirmed" mark stays.
  const { data: current } = await supabase.from('profiles').select('phone').eq('id', user.id).maybeSingle<{ phone: string | null }>();
  const { phone } = phoneFromForm(formData, 'phone', 'phone_country', current?.phone);
  const back = String(formData.get('back') ?? '');
  const next = back.startsWith(`/${locale}/`) && /^[/a-z0-9?=&-]+$/.test(back) ? back : `/${locale}/dashboard`;
  if (!phone) redirect(`/${locale}/dashboard?details=invalid#details`);
  const fullName = text(formData, 'full_name', 120);
  // Names that look like Kwetuly are refused by the database unless the account is an admin (the
  // browser normally stops them first); the form comes back with the return page kept.
  const keepBack = next === `/${locale}/dashboard` ? '' : `&back=${encodeURIComponent(next)}`;
  const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', user.id);
  if (isDisplayNameReservedError(error)) redirect(`/${locale}/dashboard?details=name${keepBack}#details`);
  redirect(next === `/${locale}/dashboard` ? `${next}?details=saved#details` : next);
}
