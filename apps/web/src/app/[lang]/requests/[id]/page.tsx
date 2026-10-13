import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, CalendarDays, Languages, MapPin, MessageCircle, Users, Wallet } from 'lucide-react';
import { GUIDE_EXPERTISE } from '@rafrika/shared';
import { getDictionary, getLocale, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { getCurrentUser, type CurrentUser } from '@/lib/auth';
import { getRequest, listOffers, offerName, paidDeposits, today, type TripOffer, type TripRequest } from '@/lib/requests';
import { createClient } from '@/lib/supabase/server';
import { languageName, specialtyName } from '@/components/guide-card';
import { RatingSummary } from '@/components/stars';
import { PayDeposit } from '@/components/pay-deposit';
import { answerOffer, sendOffer, setRequestOpen, withdrawOffer } from '../actions';

type Search = Record<string, string | string[] | undefined>;

export const metadata: Metadata = { title: 'Trip request', robots: { index: false } };

export default async function RequestPage({ params, searchParams }: PageProps<'/[lang]/requests/[id]'>) {
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-surface" />}>
        <View params={params} searchParams={searchParams} t={t} locale={locale} />
      </Suspense>
    </div>
  );
}

async function View({ params, searchParams, t, locale }: { params: Promise<{ id: string }>; searchParams: Promise<Search>; t: Dictionary; locale: Locale }) {
  const { id } = await params;
  const [user, request, status] = await Promise.all([getCurrentUser(), getRequest(id), searchParams]);
  if (!user) {
    return <Link href={`/${locale}/login?next=/${locale}/requests/${id}`} className="btn-outline">{t.nav.signIn}</Link>;
  }
  if (!request) notFound();

  const r = t.requests;
  const isOwner = request.traveler_id === user.id;
  const offers = await listOffers(request.id);
  const myOffer = offers.find((o) => o.offered_by === user.id) ?? null;
  const canOffer = !isOwner && (user.role === 'admin' || user.role === 'provider' || user.guide?.status === 'approved');

  return (
    <>
      <Link href={`/${locale}/requests`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-sunset">
        <ArrowLeft className="size-4" aria-hidden /> {r.title}
      </Link>
      {status.posted && <p className="mt-4 rounded-2xl bg-mint p-4 font-semibold text-forest">✓ {r.posted}</p>}
      {status.error && <p className="mt-4 rounded-2xl bg-red-50 p-4 text-red-800">{r.error}</p>}

      <RequestSummary request={request} isOwner={isOwner} t={t} locale={locale} />

      {isOwner ? (
        <OffersForTraveller request={request} offers={offers} status={status} t={t} locale={locale} />
      ) : (
        (canOffer || myOffer) && <MyOffer request={request} offer={myOffer} user={user} status={status} canOffer={canOffer} t={t} locale={locale} />
      )}
    </>
  );
}

function RequestSummary({ request, isOwner, t, locale }: { request: TripRequest; isOwner: boolean; t: Dictionary; locale: Locale }) {
  const r = t.requests;
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const dates = request.start_date
    ? `${date.format(new Date(request.start_date))}${request.end_date ? ` – ${date.format(new Date(request.end_date))}` : ''}`
    : r.datesFlexible;
  return (
    <section className="card mt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-sunset-dark">{specialtyName(request.specialty, locale)}</p>
          <h1 className="mt-1 text-3xl font-extrabold">{request.title}</h1>
          {!isOwner && <p className="mt-1 text-muted">{t.offers.from} {request.traveler_name}</p>}
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${request.status === 'open' ? 'bg-mint text-forest' : 'bg-surface text-muted'}`}>
          {r.status[request.status]}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
        <span className="flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden /> {dates}{request.start_date && request.flexible_dates ? ` (${r.datesFlexible})` : ''}</span>
        <span className="flex items-center gap-1.5"><Users className="size-4" aria-hidden /> {request.adults} {r.adults}{request.children ? ` · ${request.children} ${r.children}` : ''}</span>
        {request.regions.length > 0 && <span className="flex items-center gap-1.5"><MapPin className="size-4" aria-hidden /> {request.regions.join(', ')}</span>}
        {request.budget_per_person_usd && <span className="flex items-center gap-1.5"><Wallet className="size-4" aria-hidden /> {r.budgetLabel}: ${request.budget_per_person_usd.toLocaleString(locale)} {r.perPerson}</span>}
        {request.languages.length > 0 && <span className="flex items-center gap-1.5"><Languages className="size-4" aria-hidden /> {request.languages.map(languageName).join(' · ')}</span>}
      </div>
      <p className="mt-5 whitespace-pre-line leading-relaxed">{request.details}</p>
      {(request.expertise.length > 0 || request.female_guide) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {request.female_guide && <span className="rounded-full bg-sand px-3 py-1 text-xs font-bold text-sunset-dark">{r.femaleGuide}</span>}
          {request.expertise.map((id) => (
            <span key={id} className="rounded-full bg-sand px-3 py-1 text-xs font-bold text-sunset-dark">
              {GUIDE_EXPERTISE.find((e) => e.id === id)?.label[locale] ?? id}
            </span>
          ))}
        </div>
      )}
      {isOwner && request.status !== 'booked' && (
        <form action={setRequestOpen} className="mt-5">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="request_id" value={request.id} />
          <input type="hidden" name="open" value={request.status === 'open' ? 'false' : 'true'} />
          <button className="text-sm font-semibold text-muted underline hover:text-sunset">{request.status === 'open' ? r.close : r.reopen}</button>
        </form>
      )}
    </section>
  );
}

function OfferDetails({ offer, t, locale }: { offer: TripOffer; t: Dictionary; locale: Locale }) {
  const r = t.requests;
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-3xl font-extrabold">${offer.price_total_usd.toLocaleString(locale)}</p>
        <p className="text-sm font-semibold text-muted">{r.total}</p>
        {offer.deposit_percent > 0 && <p className="text-sm font-semibold text-muted">· {r.deposit}: {offer.deposit_percent}%</p>}
      </div>
      <p className="mt-3 text-sm font-bold text-muted">{r.itinerary}</p>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{offer.itinerary}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {offer.includes && (<div><p className="text-sm font-bold text-muted">{r.includes}</p><p className="whitespace-pre-line text-sm">{offer.includes}</p></div>)}
        {offer.excludes && (<div><p className="text-sm font-bold text-muted">{r.excludes}</p><p className="whitespace-pre-line text-sm">{offer.excludes}</p></div>)}
      </div>
      {offer.valid_until && (
        <p className={`mt-3 text-xs font-semibold ${offer.valid_until < today() ? 'text-red-700' : 'text-muted'}`}>
          {offer.valid_until < today() ? r.expired : `${r.validUntil} ${date.format(new Date(offer.valid_until))}`}
        </p>
      )}
    </>
  );
}

async function Contacts({ offer, traveller, t, locale }: { offer: TripOffer; traveller: string; t: Dictionary; locale: Locale }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc('offer_contacts', { p_offer: offer.id });
  const c = (data as { traveler_email: string | null; traveler_phone: string | null; offerer_email: string | null; offerer_phone: string | null }[] | null)?.[0];
  return (
    <div className="mt-4 grid gap-3 rounded-2xl bg-mint p-4 text-forest sm:grid-cols-[1fr_auto] sm:items-center">
      {c && (
        <div className="text-sm">
          <p className="font-bold">{t.requests.contactTitle}</p>
          <p>{offerName(offer)}: {[c.offerer_phone, c.offerer_email].filter(Boolean).join(' · ')}</p>
          <p>{traveller}: {[c.traveler_phone, c.traveler_email].filter(Boolean).join(' · ')}</p>
        </div>
      )}
      {offer.chat_id && (
        <Link href={`/${locale}/chats/${offer.chat_id}`} className="btn"><MessageCircle className="size-4" aria-hidden /> {t.requests.openChat}</Link>
      )}
    </div>
  );
}

async function OffersForTraveller({ request, offers, status, t, locale }: { request: TripRequest; offers: TripOffer[]; status: Search; t: Dictionary; locale: Locale }) {
  const r = t.requests;
  const paid = await paidDeposits('trip_offer_id', offers.filter((o) => o.status === 'accepted').map((o) => o.id));
  const payError = typeof status.payError === 'string' ? status.payError : undefined;
  // Accepted offer first, then the rest by price.
  const sorted = [...offers].sort((a, b) => Number(b.status === 'accepted') - Number(a.status === 'accepted') || a.price_total_usd - b.price_total_usd);

  return (
    <section id="offers" className="mt-8 scroll-mt-28">
      <h2 className="text-2xl font-bold">{r.offersTitle} ({offers.length})</h2>
      {offers.length === 0 && <p className="mt-3 text-muted">{r.noOffers}</p>}
      <ul className="mt-4 space-y-4">
        {sorted.map((offer) => (
          <li key={offer.id} className={`card ${offer.status === 'accepted' ? 'ring-2 ring-forest' : ''} ${offer.status === 'declined' ? 'opacity-60' : ''}`}>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-muted">{r.by}</p>
                {offer.guides ? (
                  <Link href={`/${locale}/guides/${offer.guides.slug}`} className="text-xl font-bold hover:text-sunset">{offer.guides.display_name}</Link>
                ) : (
                  <p className="text-xl font-bold">{offer.company_name}</p>
                )}
                {offer.guides && <RatingSummary avg={offer.guides.rating_avg} count={offer.guides.rating_count} labels={t.reviews} />}
              </div>
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold">{r.offerStatus[offer.status]}</span>
            </div>
            <OfferDetails offer={offer} t={t} locale={locale} />

            {offer.status === 'sent' && request.status === 'open' && (!offer.valid_until || offer.valid_until >= today()) && (
              <form action={answerOffer} className="mt-5 space-y-2">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="request_id" value={request.id} />
                <input type="hidden" name="offer_id" value={offer.id} />
                <div className="flex flex-wrap gap-2">
                  <button name="decision" value="accept" className="btn">{r.accept}</button>
                  <button name="decision" value="decline" className="btn-outline">{r.decline}</button>
                </div>
                <p className="text-xs text-muted">{r.acceptNote}</p>
              </form>
            )}

            {offer.status === 'accepted' && (
              <>
                <Contacts offer={offer} traveller={request.traveler_name} t={t} locale={locale} />
                <div className="mt-4">
                  <PayDeposit
                    kind="offer"
                    id={offer.id}
                    totalUsd={offer.price_total_usd}
                    percent={offer.deposit_percent}
                    paid={paid.has(offer.id)}
                    back={`/${locale}/requests/${request.id}`}
                    error={payError}
                    t={t}
                    locale={locale}
                  />
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

async function MyOffer({ request, offer, user, status, canOffer, t, locale }: { request: TripRequest; offer: TripOffer | null; user: CurrentUser; status: Search; canOffer: boolean; t: Dictionary; locale: Locale }) {
  const o = t.offers;
  const asGuide = user.guide?.status === 'approved';
  const editable = canOffer && request.status === 'open' && (!offer || offer.status === 'sent' || offer.status === 'withdrawn');
  const paid = offer?.status === 'accepted' ? await paidDeposits('trip_offer_id', [offer.id]) : new Set<string>();
  const banner = offer && { accepted: o.accepted, declined: o.declined, withdrawn: o.withdrawn, sent: '' }[offer.status];

  return (
    <section id="offer" className="mt-8 scroll-mt-28">
      <h2 className="text-2xl font-bold">{offer ? o.yourOffer : o.makeOffer}</h2>
      <p className="mt-1 text-sm text-muted">{request.offers_count} {o.competing}</p>
      {status.offerSent && <p className="mt-3 rounded-2xl bg-mint p-4 font-semibold text-forest">✓ {o.sent}</p>}
      {status.offerError && <p className="mt-3 rounded-2xl bg-red-50 p-4 text-red-800">{t.requests.error}</p>}
      {banner && <p className="mt-3 rounded-2xl bg-surface p-4 font-semibold">{banner}</p>}

      {offer && (offer.status === 'accepted' || offer.status === 'declined') && (
        <div className="card mt-4">
          <OfferDetails offer={offer} t={t} locale={locale} />
          {offer.status === 'accepted' && (
            <>
              <Contacts offer={offer} traveller={request.traveler_name} t={t} locale={locale} />
              {paid.has(offer.id) && <p className="mt-4 rounded-2xl bg-mint p-4 font-semibold text-forest">✓ {t.payments.paid}</p>}
            </>
          )}
        </div>
      )}

      {editable && (
        <form action={sendOffer} className="card mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="request_id" value={request.id} />
          {!asGuide && (
            <label className="block sm:col-span-2">
              <span className="label">{o.companyName}</span>
              <input name="company_name" className="field" required maxLength={120} defaultValue={offer?.company_name ?? ''} />
            </label>
          )}
          <label className="block">
            <span className="label">{o.price}</span>
            <input name="price" type="number" min={1} max={1000000} className="field" required defaultValue={offer?.price_total_usd} />
          </label>
          <label className="block">
            <span className="label">{o.deposit}</span>
            <input name="deposit" type="number" min={0} max={100} className="field" defaultValue={offer?.deposit_percent ?? 30} />
            <span className="mt-1 block text-xs text-muted">{o.depositHint}</span>
          </label>
          <label className="block sm:col-span-2">
            <span className="label">{o.itinerary}</span>
            <textarea name="itinerary" className="field min-h-40" required minLength={20} maxLength={6000} placeholder={o.itineraryPlaceholder} defaultValue={offer?.itinerary} />
          </label>
          <label className="block">
            <span className="label">{o.includes}</span>
            <textarea name="includes" className="field min-h-24" maxLength={1500} defaultValue={offer?.includes ?? ''} />
          </label>
          <label className="block">
            <span className="label">{o.excludes}</span>
            <textarea name="excludes" className="field min-h-24" maxLength={1500} defaultValue={offer?.excludes ?? ''} />
          </label>
          <label className="block">
            <span className="label">{o.validUntil}</span>
            <input name="valid_until" type="date" min={today()} className="field" defaultValue={offer?.valid_until ?? ''} />
          </label>
          <div className="flex items-end">
            <button className="btn w-full">{offer ? o.update : o.send}</button>
          </div>
        </form>
      )}
      {offer?.status === 'sent' && (
        <form action={withdrawOffer} className="mt-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="request_id" value={request.id} />
          <button className="text-sm font-semibold text-muted underline hover:text-red-700">{o.withdraw}</button>
        </form>
      )}
      {!canOffer && !offer && <p className="mt-3 text-muted">{o.whoCan}</p>}
    </section>
  );
}
