import 'server-only';
import { BUSINESS_TYPES, GUIDE_EXPERTISE, PACKAGE_COLUMNS, PACKAGE_KINDS, normaliseWebsite, type GuidePackage } from '@kwetuly/shared';
import type { createClient } from '@/lib/supabase/server';
import { darToday } from '@/lib/admin-format';

// The review queues on /admin and /admin/review, and the "ready" rule per kind
// (docs/operations/admin-queues.md section 3). The same rules run again on the server for every
// item at the moment of a batch approval (approveBatch in app/[lang]/admin/actions.ts).

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type ReviewKind = 'guide' | 'package' | 'business' | 'group' | 'job';
export const REVIEW_KINDS: ReviewKind[] = ['guide', 'package', 'business', 'group', 'job'];
export const KIND_NAME: Record<ReviewKind, { one: string; many: string }> = {
  guide: { one: 'Guide', many: 'Guides' },
  package: { one: 'Package', many: 'Packages' },
  business: { one: 'Business', many: 'Businesses' },
  group: { one: 'Group trip', many: 'Group trips' },
  job: { one: 'Job', many: 'Jobs' },
};

/** Target time per queue in hours (docs/operations/admin-queues.md section 6; working days counted as calendar days). */
export const TARGET_HOURS: Record<ReviewKind | 'documents' | 'badges' | 'reports', number> = {
  guide: 48,
  documents: 48,
  business: 48,
  badges: 48,
  package: 24,
  job: 24,
  group: 24,
  reports: 4,
};

/** At most this many items are approved in one batch (and shown on one review page). */
export const BATCH_MAX = 50;

/**
 * ready: passes every check, may be ticked and batch-approved.
 * single: may be approved, but only one by one (the reasons say why).
 * blocked: Approve is not possible until the missing step is done (the reasons say what to do).
 */
export type Readiness = { state: 'ready' | 'single' | 'blocked'; passed: string[]; missing: string[] };

const SIMPLE_PACKAGE_KINDS = ['cultural', 'one_on_one', 'day_trip', 'food', 'city', 'nature'];

export type GuideRow = {
  id: string;
  slug: string;
  display_name: string;
  headline: string | null;
  base_region: string;
  specialties: string[];
  languages: string[];
  expertise: string[];
  female_guide: boolean;
  association: string | null;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
  verification_status: string;
  identity_checked_at: string | null;
  licence_checked_at: string | null;
  first_aid_checked_at: string | null;
  first_aid_valid_until: string | null;
  guide_private: {
    phone: string | null;
    whatsapp_number: string | null;
    registration_number: string | null;
    kinapa_tanapa_id: string | null;
    id_document_path: string | null;
    license_document_path: string | null;
    first_aid_document_path: string | null;
  } | null;
};
export const GUIDE_COLUMNS =
  'id, slug, display_name, headline, base_region, specialties, languages, expertise, female_guide, association, is_sample, created_at, updated_at, verification_status, identity_checked_at, licence_checked_at, first_aid_checked_at, first_aid_valid_until, guide_private(phone, whatsapp_number, registration_number, kinapa_tanapa_id, id_document_path, license_document_path, first_aid_document_path)';

export type PackageRow = GuidePackage & {
  updated_at: string;
  guides: { display_name: string; slug: string; verification_status: string; licence_checked_at: string | null; is_sample: boolean } | null;
};
const PACKAGE_SELECT = `${PACKAGE_COLUMNS}, updated_at, guides(display_name, slug, verification_status, licence_checked_at, is_sample)`;

export type BusinessRow = {
  id: string;
  business_name: string;
  business_type: string;
  base_region: string;
  location: string | null;
  story: string | null;
  website: string | null;
  photo_url: string | null;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
  verification_status: string;
  provider_private: { whatsapp_number: string | null; licence_document_path: string | null } | null;
};
const BUSINESS_SELECT =
  'id, business_name, business_type, base_region, location, story, website, photo_url, is_sample, created_at, updated_at, verification_status, provider_private(whatsapp_number, licence_document_path)';

export type GroupRow = {
  id: string;
  organizer_id: string;
  organizer_kind: 'guide' | 'business' | 'traveller';
  already_going: number;
  title: string;
  description: string;
  company_name: string | null;
  region: string;
  start_date: string;
  end_date: string;
  price_per_person_usd: number;
  min_people: number;
  max_people: number;
  includes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  guides: { display_name: string; slug: string; verification_status: string; is_sample: boolean } | null;
  group_trip_private: { contact: string } | null;
  organiser?: { full_name: string | null; phone: string | null; phone_verified_at: string | null } | null;
};
const GROUP_SELECT =
  'id, organizer_id, organizer_kind, already_going, title, description, company_name, region, start_date, end_date, price_per_person_usd, min_people, max_people, includes, status, created_at, updated_at, guides(display_name, slug, verification_status, is_sample), group_trip_private(contact)';

export type JobRow = {
  id: string;
  company_name: string;
  role_needed: string;
  title: string;
  kind: 'crew' | 'handover';
  location: string;
  pay: string | null;
  how_to_apply: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};
const JOB_SELECT = 'id, company_name, role_needed, title, kind, location, pay, how_to_apply, description, status, created_at, updated_at';

export type ReviewItem =
  | { kind: 'guide'; row: GuideRow }
  | { kind: 'package'; row: PackageRow }
  | { kind: 'business'; row: BusinessRow }
  | { kind: 'group'; row: GroupRow }
  | { kind: 'job'; row: JobRow };

export type QueueItem = ReviewItem & {
  id: string;
  updatedAt: string;
  /** When it started waiting (packages: last change, since an edit sends them back). */
  since: string;
  name: string;
  sample: boolean;
  readiness: Readiness;
};

// --- Ready rules -----------------------------------------------------------------------------

function readiness(passed: string[], blocked: string[], single: string[]): Readiness {
  if (blocked.length) return { state: 'blocked', passed, missing: [...blocked, ...single] };
  if (single.length) return { state: 'single', passed, missing: single };
  return { state: 'ready', passed, missing: [] };
}

export function guideReadiness(g: GuideRow): Readiness {
  const passed: string[] = [];
  const blocked: string[] = [];
  const single: string[] = [];
  if (g.is_sample) single.push('Sample (test data): approve one by one, or delete it before launch.');
  if (g.identity_checked_at) passed.push('ID checked');
  else blocked.push('ID not checked yet. Open details, look at the ID, tick it and press "Save checks".');
  if (g.licence_checked_at) passed.push('Licence checked');
  else blocked.push('Licence not checked yet. Open details, look at the licence, tick it and press "Save checks".');
  if (g.guide_private?.registration_number?.trim()) passed.push('Registration number given');
  else single.push('No registration number given.');
  const skills = [...(g.female_guide ? ['Female guide'] : []), ...GUIDE_EXPERTISE.filter((e) => g.expertise.includes(e.id)).map((e) => e.label.en)];
  if (skills.length) single.push(`Self-declared skills to prove: ${skills.join(', ')}. Approve one by one after you have seen the proof.`);
  return readiness(passed, blocked, single);
}

export function packageReadiness(p: PackageRow): Readiness {
  const passed: string[] = [];
  const single: string[] = [];
  if (p.guides?.is_sample) single.push('Sample (test data): approve one by one, or delete it before launch.');
  if (p.guides?.verification_status === 'approved' && p.guides.licence_checked_at) passed.push('Guide approved, licence checked');
  else single.push('The guide is not approved yet, or their licence is not checked.');
  if (p.price_usd != null && p.price_usd > 0) passed.push('Price given');
  else single.push('No price given ("price on request").');
  if (p.duration_days || p.duration_hours) passed.push('Length given');
  else single.push('No length given.');
  const kind = PACKAGE_KINDS.find((k) => k.id === p.kind)?.en ?? p.kind;
  if (SIMPLE_PACKAGE_KINDS.includes(p.kind)) passed.push(`${kind} (simple package)`);
  else single.push(`${kind}: multi-day and "Other" packages are approved one by one.`);
  return readiness(passed, [], single);
}

export function businessReadiness(b: BusinessRow): Readiness {
  const passed: string[] = [];
  const single = ['Businesses are approved one by one: open the licence and check the listing.'];
  if (b.is_sample) single.unshift('Sample (test data): approve one by one, or delete it before launch.');
  if (b.provider_private?.licence_document_path) passed.push('Business licence uploaded');
  else single.push('No business licence uploaded.');
  const website = b.website ? normaliseWebsite(b.website) : null;
  if (website && !website.ok) single.push('Website link is not valid (not shown to travellers).');
  if (b.provider_private?.whatsapp_number) passed.push('WhatsApp number given');
  else single.push('No WhatsApp number given.');
  return readiness(passed, [], single);
}

export function groupReadiness(g: GroupRow, today: string): Readiness {
  const passed: string[] = [];
  const blocked: string[] = [];
  const single: string[] = [];
  if (g.guides?.is_sample) single.push('Sample (test data): approve one by one, or delete it before launch.');
  if (g.organizer_kind === 'traveller') {
    if (g.organiser?.phone_verified_at) passed.push('Organiser’s phone confirmed');
    else blocked.push('Phone not confirmed yet. Call the organiser, then press "Phone confirmed".');
  } else if (g.organizer_kind === 'guide') {
    if (g.guides?.verification_status === 'approved') passed.push('Guide organiser approved');
    else single.push('The guide organiser is not approved.');
  } else {
    single.push('Company organisers are approved one by one (Kwetuly has no company check yet).');
  }
  if (g.start_date > today) passed.push('Starts in the future');
  else single.push('The start date is today or in the past.');
  if (g.price_per_person_usd > 0) passed.push('Price given');
  else single.push('The price is 0.');
  return readiness(passed, blocked, single);
}

export function jobReadiness(): Readiness {
  return readiness([], [], ['Jobs are approved one by one: check the role, place and that the pay follows the minimum wage.']);
}

// --- Loading -------------------------------------------------------------------------------

function toItem(item: ReviewItem, today: string): QueueItem {
  switch (item.kind) {
    case 'guide':
      return { ...item, id: item.row.id, updatedAt: item.row.updated_at, since: item.row.created_at, name: item.row.display_name, sample: item.row.is_sample, readiness: guideReadiness(item.row) };
    case 'package':
      return { ...item, id: item.row.id, updatedAt: item.row.updated_at, since: item.row.updated_at, name: item.row.title, sample: !!item.row.guides?.is_sample, readiness: packageReadiness(item.row) };
    case 'business':
      return { ...item, id: item.row.id, updatedAt: item.row.updated_at, since: item.row.created_at, name: item.row.business_name, sample: item.row.is_sample, readiness: businessReadiness(item.row) };
    case 'group':
      return { ...item, id: item.row.id, updatedAt: item.row.updated_at, since: item.row.created_at, name: item.row.title, sample: !!item.row.guides?.is_sample, readiness: groupReadiness(item.row, today) };
    case 'job':
      return { ...item, id: item.row.id, updatedAt: item.row.updated_at, since: item.row.created_at, name: item.row.title, sample: false, readiness: jobReadiness() };
  }
}

async function withOrganisers(supabase: Supabase, groups: GroupRow[]) {
  const ids = [...new Set(groups.filter((g) => g.organizer_kind === 'traveller').map((g) => g.organizer_id))];
  if (!ids.length) return groups;
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, phone, phone_verified_at')
    .in('id', ids)
    .returns<{ id: string; full_name: string | null; phone: string | null; phone_verified_at: string | null }[]>();
  const byId = new Map((data ?? []).map((p) => [p.id, p]));
  return groups.map((g) => ({ ...g, organiser: byId.get(g.organizer_id) ?? null }));
}

export type Queue = { items: QueueItem[]; failed: ReviewKind[] };

/** Everything pending in the five review queues, oldest first, with the ready rule worked out. */
export async function loadQueue(supabase: Supabase): Promise<Queue> {
  const [guides, packages, businesses, groups, jobs] = await Promise.all([
    supabase.from('guides').select(GUIDE_COLUMNS).eq('verification_status', 'pending').order('created_at').returns<GuideRow[]>(),
    supabase.from('guide_packages').select(PACKAGE_SELECT).eq('status', 'pending').order('updated_at').returns<PackageRow[]>(),
    supabase.from('providers').select(BUSINESS_SELECT).eq('verification_status', 'pending').order('created_at').returns<BusinessRow[]>(),
    supabase.from('group_trips').select(GROUP_SELECT).eq('status', 'pending').eq('cancelled', false).order('created_at').returns<GroupRow[]>(),
    supabase.from('jobs').select(JOB_SELECT).eq('status', 'pending').order('created_at').returns<JobRow[]>(),
  ]);
  const failed: ReviewKind[] = [];
  if (guides.error) failed.push('guide');
  if (packages.error) failed.push('package');
  if (businesses.error) failed.push('business');
  if (groups.error) failed.push('group');
  if (jobs.error) failed.push('job');
  const groupRows = await withOrganisers(supabase, groups.data ?? []);
  const today = darToday();
  const items: QueueItem[] = [
    ...(guides.data ?? []).map((row) => toItem({ kind: 'guide', row }, today)),
    ...(packages.data ?? []).map((row) => toItem({ kind: 'package', row }, today)),
    ...(businesses.data ?? []).map((row) => toItem({ kind: 'business', row }, today)),
    ...groupRows.map((row) => toItem({ kind: 'group', row }, today)),
    ...(jobs.data ?? []).map((row) => toItem({ kind: 'job', row }, today)),
  ];
  return { items, failed };
}

/** One item, read fresh (any status), with the ready rule worked out; null if it no longer exists. */
export async function loadOne(supabase: Supabase, kind: ReviewKind, id: string): Promise<(QueueItem & { status: string }) | null> {
  const today = darToday();
  switch (kind) {
    case 'guide': {
      const { data } = await supabase.from('guides').select(GUIDE_COLUMNS).eq('id', id).maybeSingle<GuideRow>();
      return data ? { ...toItem({ kind, row: data }, today), status: data.verification_status } : null;
    }
    case 'package': {
      const { data } = await supabase.from('guide_packages').select(PACKAGE_SELECT).eq('id', id).maybeSingle<PackageRow>();
      return data ? { ...toItem({ kind, row: data }, today), status: data.status } : null;
    }
    case 'business': {
      const { data } = await supabase.from('providers').select(BUSINESS_SELECT).eq('id', id).maybeSingle<BusinessRow>();
      return data ? { ...toItem({ kind, row: data }, today), status: data.verification_status } : null;
    }
    case 'group': {
      const { data } = await supabase.from('group_trips').select(`${GROUP_SELECT}, cancelled`).eq('id', id).maybeSingle<GroupRow & { cancelled: boolean }>();
      if (!data) return null;
      const [row] = await withOrganisers(supabase, [data]);
      return { ...toItem({ kind, row }, today), status: data.cancelled ? 'cancelled' : data.status };
    }
    case 'job': {
      const { data } = await supabase.from('jobs').select(JOB_SELECT).eq('id', id).maybeSingle<JobRow>();
      return data ? { ...toItem({ kind, row: data }, today), status: data.status } : null;
    }
  }
}

/** One summary line under the name on a review card. */
export function summaryLine(item: QueueItem, specialty: (id: string) => string): string {
  switch (item.kind) {
    case 'guide':
      return [item.row.base_region, item.row.specialties.map(specialty).join(', ')].filter(Boolean).join(' · ');
    case 'package': {
      const kind = PACKAGE_KINDS.find((k) => k.id === item.row.kind)?.en;
      return [kind, item.row.guides?.display_name, item.row.price_usd ? `$${item.row.price_usd}` : null].filter(Boolean).join(' · ');
    }
    case 'business':
      return [BUSINESS_TYPES.find((x) => x.id === item.row.business_type)?.en, item.row.location, item.row.base_region].filter(Boolean).join(' · ');
    case 'group': {
      const g = item.row;
      const who = g.organizer_kind === 'traveller' ? 'Traveller organiser' : g.organizer_kind === 'guide' ? `Guide: ${g.guides?.display_name ?? 'unknown'}` : `Company: ${g.company_name ?? 'unknown'}`;
      return [who, g.region].join(' · ');
    }
    case 'job':
      return [item.row.company_name, item.row.location].filter(Boolean).join(' · ');
  }
}

// --- Picks (what the review page sends to the batch action) ----------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KIND_CODE: Record<ReviewKind, string> = { guide: 'g', package: 'p', business: 'b', group: 't', job: 'j' };
const CODE_KIND = new Map<string, ReviewKind>(Object.entries(KIND_CODE).map(([k, v]) => [v, k as ReviewKind]));

export type Pick = { kind: ReviewKind; id: string; updatedAt: string };

/** "g|<uuid>|<updated_at as the page showed it>" */
export function encodePick(item: Pick) {
  return `${KIND_CODE[item.kind]}|${item.id}|${item.updatedAt}`;
}

export function decodePick(value: string): Pick | null {
  const [code, id, updatedAt, ...rest] = value.split('|');
  const kind = CODE_KIND.get(code ?? '');
  if (!kind || rest.length || !id || !UUID.test(id) || !updatedAt || updatedAt.length > 40 || Number.isNaN(Date.parse(updatedAt))) return null;
  return { kind, id: id.toLowerCase(), updatedAt };
}

/** Result codes for items that were not approved, and the words shown for them. */
export const SKIP_REASON = {
  gone: 'no longer waiting',
  changed: 'changed since you opened the page',
  notready: 'no longer passes the checks',
  phone: 'phone not confirmed',
  sample: 'sample (test data)',
  error: 'could not save, try again',
} as const;
export type SkipCode = keyof typeof SKIP_REASON;

export function encodeSkip(kind: ReviewKind, id: string, code: SkipCode) {
  return `${KIND_CODE[kind]}.${id}.${code}`;
}

export function decodeSkip(value: string): { kind: ReviewKind; id: string; code: SkipCode } | null {
  const [k, id, code] = value.split('.');
  const kind = CODE_KIND.get(k ?? '');
  if (!kind || !id || !UUID.test(id) || !code || !Object.hasOwn(SKIP_REASON, code)) return null;
  return { kind, id, code: code as SkipCode };
}
