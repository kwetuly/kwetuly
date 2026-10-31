import { BUSINESS_COLUMNS, SAMPLE_LISTING_COLUMNS, SHOP_PROVIDER_SETTING, type Business, type BusinessType, type PhotoCredit, type SampleListing } from '@kwetuly/shared';
import { supabase } from '@/lib/supabase';

// Business listings, the same rules as the website: visitors see approved businesses; the owner's
// WhatsApp number and licence live in provider_private, which only the owner and Kwetuly can read.

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function listBusinesses(types: BusinessType[]): Promise<Business[]> {
  const { data, error } = await supabase
    .from('providers')
    .select(BUSINESS_COLUMNS)
    .eq('verification_status', 'approved')
    .eq('is_available', true)
    .in('business_type', types)
    .order('business_name')
    .limit(60);
  check(error);
  return (data ?? []) as Business[];
}

export async function getBusiness(id: string): Promise<Business | null> {
  const { data, error } = await supabase.from('providers').select(BUSINESS_COLUMNS).eq('id', id).maybeSingle();
  check(error);
  return (data as Business | null) ?? null;
}

/**
 * "What they offer": published items of a SAMPLE business only (security finding F1: owners can still
 * publish listings without review, so real owners' items stay hidden until the review rules exist).
 */
export async function getSampleListings(providerId: string): Promise<SampleListing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select(SAMPLE_LISTING_COLUMNS)
    .eq('provider_id', providerId)
    .eq('is_published', true)
    .eq('providers.is_sample', true)
    .order('created_at')
    .limit(30);
  check(error);
  return ((data ?? []) as SampleListing[]).map((x) => ({ id: x.id, title: x.title, description: x.description, photos: x.photos ?? [], price_note: x.price_note }));
}

/** Credit lines for sample photos, by storage path. Empty when the credits table does not exist yet. */
export async function getPhotoCredits(paths: string[]): Promise<PhotoCredit[]> {
  if (paths.length === 0) return [];
  const { data } = await supabase.from('sample_media_credits').select('path, credit, source_url, licence').in('path', paths.slice(0, 100));
  return (data ?? []) as PhotoCredit[];
}

export async function askBusiness(input: { providerId: string; userId?: string; name: string; contact: string; message: string }) {
  const { error } = await supabase.from('leads').insert({
    provider_id: input.providerId,
    traveler_id: input.userId ?? null,
    source: 'contact_form',
    traveler_name: input.name.trim(),
    traveler_contact: input.contact.trim(),
    message: input.message.trim(),
  });
  check(error);
}

export type MyBusiness = Business & { provider_private: { whatsapp_number: string | null; licence_document_path: string | null } | null };

export async function getMyBusiness(userId: string): Promise<MyBusiness | null> {
  const { data, error } = await supabase
    .from('providers')
    .select(`${BUSINESS_COLUMNS}, provider_private(whatsapp_number, licence_document_path)`)
    .eq('owner_id', userId)
    .maybeSingle();
  check(error);
  return (data as unknown as MyBusiness | null) ?? null;
}

/**
 * True when the person owns a listing Kwetuly has approved (not a sample). Anyone may then act as a
 * business, whatever account type they picked at sign-up; the database checks the same.
 */
export async function hasApprovedBusiness(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('providers')
    .select('id')
    .eq('owner_id', userId)
    .eq('verification_status', 'approved')
    .eq('is_sample', false)
    .limit(1);
  check(error);
  return (data ?? []).length > 0;
}

export async function listBusinessEnquiries(providerId: string) {
  const { data, error } = await supabase
    .from('leads')
    .select('id, traveler_name, traveler_contact, message, created_at')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false })
    .limit(30);
  check(error);
  return (data ?? []) as { id: string; traveler_name: string | null; traveler_contact: string | null; message: string | null; created_at: string }[];
}

export async function getBadgeFee(): Promise<number | null> {
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'badge_fee').maybeSingle<{ value: { amount_usd: number | null } }>();
  return data?.value.amount_usd ?? null;
}

type Upload = { uri: string; mimeType: string };

async function upload(bucket: 'avatars' | 'verification', path: string, file: Upload) {
  const body = await (await fetch(file.uri)).arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType: file.mimeType });
  check(error);
}

/** Creates or updates the owner's listing; new listings wait for an admin. */
export async function saveMyBusiness(
  userId: string,
  existing: MyBusiness | null,
  input: { business_name: string; business_type: BusinessType; base_region: string; location: string | null; story: string | null; website: string | null; whatsapp_number: string },
  files: { photo?: Upload; extraPhoto?: Upload; licence?: Upload },
) {
  const { whatsapp_number, ...publicFields } = input;
  const row: Record<string, unknown> = { ...publicFields };
  const avatars = supabase.storage.from('avatars');
  if (files.photo) {
    const path = `${userId}/business-${Date.now()}.jpg`;
    await upload('avatars', path, files.photo);
    row.photo_url = avatars.getPublicUrl(path).data.publicUrl;
  }
  if (files.extraPhoto) {
    const path = `${userId}/business-extra-${Date.now()}.jpg`;
    await upload('avatars', path, files.extraPhoto);
    row.photos = [...(existing?.photos ?? []), avatars.getPublicUrl(path).data.publicUrl].slice(-6);
  }
  const saved = existing
    ? await supabase.from('providers').update(row).eq('id', existing.id).select('id').single()
    : await supabase.from('providers').insert({ ...row, owner_id: userId }).select('id').single();
  check(saved.error);
  const privateRow: Record<string, string> = { provider_id: saved.data!.id, whatsapp_number };
  if (files.licence) {
    const ext = files.licence.mimeType === 'application/pdf' ? 'pdf' : 'jpg';
    const path = `${userId}/business-licence-${Date.now()}.${ext}`;
    await upload('verification', path, files.licence);
    privateRow.licence_document_path = path;
  }
  const { error } = await supabase.from('provider_private').upsert(privateRow);
  check(error);
}

export async function requestBadge(userId: string) {
  const { error } = await supabase.from('providers').update({ badge_requested_at: new Date().toISOString() }).eq('owner_id', userId);
  check(error);
}

export type ReferralSale = { id: string; code: string; guide_id: string | null; sale_date: string; amount_tzs: number; status: 'reported' | 'invoiced' | 'paid'; providers?: { business_name: string } | null };

export async function getMyAgreement(providerId: string) {
  const { data } = await supabase.from('business_agreements').select('kwetuly_pct, guide_pct, active').eq('provider_id', providerId).maybeSingle<{ kwetuly_pct: number; guide_pct: number; active: boolean }>();
  return data ?? null;
}

export async function listBusinessSales(providerId: string): Promise<ReferralSale[]> {
  const { data, error } = await supabase.from('referral_sales').select('id, code, guide_id, sale_date, amount_tzs, status').eq('provider_id', providerId).order('sale_date', { ascending: false }).limit(50);
  check(error);
  return (data ?? []) as ReferralSale[];
}

/** The business records a sale that came with a Kwetuly code; the database fills in the guide. */
export async function reportSale(providerId: string, code: string, amountTzs: number, note: string | null) {
  const { error } = await supabase.from('referral_sales').insert({ provider_id: providerId, code: code.trim().toUpperCase(), amount_tzs: Math.round(amountTzs), note });
  check(error);
}

/** The guide's personal referral code (created on first use), or null until the profile is approved. */
export async function myReferralCode(): Promise<string | null> {
  const { data, error } = await supabase.rpc('my_referral_code');
  check(error);
  return (data as string | null) ?? null;
}

export async function listMyReferralSales(): Promise<ReferralSale[]> {
  const { data, error } = await supabase.from('referral_sales').select('id, code, guide_id, sale_date, amount_tzs, status, providers(business_name)').order('sale_date', { ascending: false }).limit(30);
  check(error);
  return (data ?? []) as unknown as ReferralSale[];
}

// Travel news for travellers (guides read Field news in the Hub).
export type TravelNews = { id: string; title: string; body: string; region: string | null; source_name: string | null; source_url: string | null; published_on: string };

export async function listTravelNews(): Promise<TravelNews[]> {
  const { data, error } = await supabase
    .from('travel_news')
    .select('id, title, body, region, source_name, source_url, published_on')
    .eq('published', true)
    .order('published_on', { ascending: false })
    .limit(50);
  check(error);
  return (data ?? []) as TravelNews[];
}

// Kwetuly merchandise; orders go to the Kwetuly Shop listing as an enquiry.
export type Product = { id: string; name: string; description: string | null; price_tzs: number | null; sizes: string[]; photo_url: string | null };

export async function listProducts(): Promise<{ products: Product[]; shopId: string | null }> {
  const [products, shopId] = await Promise.all([
    supabase.from('shop_products').select('id, name, description, price_tzs, sizes, photo_url').eq('active', true).order('sort_order').order('name'),
    getShopId(),
  ]);
  check(products.error);
  return { products: (products.data ?? []) as Product[], shopId };
}

// The one listing named in site setting 'shop_provider' (admins only), never "any merch listing",
// so no other business can receive shop orders. Null until Kwetuly sets it up.
async function getShopId(): Promise<string | null> {
  const { data: setting } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', SHOP_PROVIDER_SETTING)
    .maybeSingle<{ value: { provider_id?: unknown } }>();
  const id = setting?.value?.provider_id;
  if (typeof id !== 'string' || !id) return null;
  const { data } = await supabase
    .from('providers')
    .select('id')
    .eq('id', id)
    .eq('business_type', 'merch')
    .eq('verification_status', 'approved')
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}
