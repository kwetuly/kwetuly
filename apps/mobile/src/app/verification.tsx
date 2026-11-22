import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  datedDocumentKinds,
  documentSlots,
  fillText,
  slotStatus,
  tanzaniaToday,
  verificationSummary,
  verificationText,
  type DocumentSlot,
  type MemberCheck,
  type PersonDocumentKind,
  type VerificationText,
} from '@kwetuly/shared';
import { GLYPHS } from '@/components/glyph';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { Badge, Button, Card, Chip, EmptyState, ErrorText, Field, FormMessage, FormScreen, IconSquare, Muted, ScreenState, Toggle } from '@/components/ui';
import { getMyGuide } from '@/lib/api-more';
import { useProfile, useSession } from '@/lib/auth';
import { cleanPhoto } from '@/lib/clean-photo';
import { useI18n } from '@/lib/i18n';
import { SITE_URL } from '@/lib/supabase';
import { openExternal } from '@/lib/open-external';
import { loadMyVerification, setIdentifier, uploadDocument, withdrawDocument, type IdentifierField, type OwnDocument, type OwnIdentifiers, type UploadError } from '@/lib/verification';
import { useType } from '@/lib/use-type';
import { brand, colors, layout, radius, space } from '@/theme';

type Photo = { uri: string; mimeType: 'image/jpeg' };
type Data = Awaited<ReturnType<typeof loadMyVerification>>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const BUSINESS_KINDS: readonly PersonDocumentKind[] = ['business_licence', 'tin_certificate', 'operator_licence'];

// Photos only in the app (PDFs can be sent on the website). Shrunk to 2000px and saved as a new JPEG,
// which drops the camera's location data; never fall back to the original.
async function pickDocumentPhoto(): Promise<Photo | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled) return null;
  try {
    return await cleanPhoto(result.assets[0], { maxSide: 2000 });
  } catch {
    return null;
  }
}

function formatDay(iso: string | null | undefined, locale: string) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: iso.length === 10 ? 'UTC' : 'Africa/Dar_es_Salaam' });
}

// Member verification, the same as /dashboard/verification on the website: the status worked out from
// the person's documents and checks, one upload card per paper the role needs, identity numbers, and
// the paid verification buttons (shown, not working yet). Guides and business owners only.
// Admin review stays on the website only (two-step sign-in, short file links); see the account screen.
export default function VerificationScreen() {
  const { locale } = useI18n();
  const v = verificationText(locale);
  const { session } = useSession();
  const userId = session?.user.id;
  const profile = useProfile();
  const guide = useQuery({ queryKey: ['my-guide', userId], queryFn: () => getMyGuide(userId!), enabled: !!userId });
  const data = useQuery({ queryKey: ['my-verification', userId], queryFn: () => loadMyVerification(userId!), enabled: !!userId });

  if (!session) {
    return (
      <FormScreen>
        <Stack.Screen options={{ title: v.title }} />
        <SignInPrompt />
      </FormScreen>
    );
  }
  if (!data.data || !profile.data) {
    return (
      <>
        <Stack.Screen options={{ title: v.title }} />
        <ScreenState screen loading={data.isLoading || profile.isLoading} error={data.error ?? profile.error} onRetry={() => data.refetch()} retryLabel={v.retry} />
      </>
    );
  }
  const role = profile.data.role;
  const isGuide = role === 'guide' || role === 'admin' || Boolean(guide.data?.guide);
  const isBusiness = role === 'provider' || data.data.providers.length > 0;
  if (!isGuide && !isBusiness) {
    return (
      <FormScreen>
        <Stack.Screen options={{ title: v.title }} />
        <EmptyState glyph={GLYPHS.document} text={v.forMembersOnly} />
      </FormScreen>
    );
  }
  return <Member v={v} locale={locale} userId={userId!} data={data.data} guide={isGuide} business={isBusiness} />;
}

function Member({ v, locale, userId, data, guide, business }: { v: VerificationText; locale: string; userId: string; data: Data; guide: boolean; business: boolean }) {
  const { type, font } = useType();
  const [consent, setConsent] = useState(false);
  const [tanzanian, setTanzanian] = useState(guide || !data.identifiers?.passport_last3);
  const today = tanzaniaToday();
  const summary = verificationSummary(data.documents, data.checks, today);
  const slots = documentSlots({ guide, business, tanzanian });
  const s = v.status[summary.state];
  const date = formatDay(summary.activeUntil, locale);
  let body = s.body;
  if (summary.state === 'waiting') body = fillText(s.body, { count: summary.waiting });
  if (summary.state === 'checked') body = summary.activeUntil ? fillText(s.body, { date }) : v.checkedNoDate;
  if (summary.state === 'expiring' || summary.state === 'expired') body = fillText(s.body, { date });
  if (summary.state === 'rejected' && summary.rejected) {
    body = fillText(s.body, { kind: summary.rejected.title ?? v.kinds[summary.rejected.kind], reason: summary.rejected.review_reason ? v.reasons[summary.rejected.review_reason] : v.reasons.other });
  }
  const statusBg = summary.state === 'checked' ? brand.mint : summary.state === 'rejected' || summary.state === 'expired' ? brand.dangerSoft : summary.state === 'none' ? colors.card : brand.sand;
  const statusFg = summary.state === 'checked' ? brand.forest : summary.state === 'rejected' || summary.state === 'expired' ? brand.danger : brand.ink;

  return (
    <FormScreen>
      <Stack.Screen options={{ title: v.title }} />
      <Muted>{v.intro}</Muted>

      <Card style={{ backgroundColor: statusBg }}>
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
          <IconSquare glyph={summary.state === 'checked' ? GLYPHS.shield : GLYPHS.document} />
          <View style={{ flex: 1, gap: space.xxs }}>
            <Text accessibilityRole="header" style={{ ...type.cardTitle, color: statusFg }}>{s.title}</Text>
            <Text selectable style={{ ...type.callout, color: statusFg }}>{body}</Text>
            {summary.lastChecked && summary.state !== 'none' ? <Text style={type.caption}>{fillText(v.lastChecked, { date: formatDay(summary.lastChecked, locale) })}</Text> : null}
          </View>
        </View>
      </Card>

      <Card>
        <Text accessibilityRole="header" style={type.cardTitle}>{v.noticeTitle}</Text>
        <Muted>{v.noticeBody}</Muted>
        <View style={{ alignItems: 'flex-start' }}>
          <Button title={v.noticeLink} variant="text" size="md" onPress={() => openExternal(`${SITE_URL}/${locale}/privacy`, { inApp: true })} />
        </View>
        <Toggle label={v.noticeAgree} value={consent} onChange={setConsent} />
      </Card>

      {!guide && business && (
        <Card>
          <Text style={{ ...type.body, ...font.bold }}>{v.citizenQuestion}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: layout.inlineGap }}>
            <Chip label={v.citizenYes} active={tanzanian} onPress={() => setTanzanian(true)} />
            <Chip label={v.citizenNo} active={!tanzanian} onPress={() => setTanzanian(false)} />
          </View>
        </Card>
      )}

      {slots.flatMap((slot) => {
        if (!BUSINESS_KINDS.includes(slot.kind)) return [<DocumentCard key={slot.kind} slot={slot} providerId={null} providerName={null} v={v} locale={locale} userId={userId} data={data} consent={consent} today={today} />];
        if (data.providers.length === 0) {
          return [
            <Card key={slot.kind}>
              <SlotHeader slot={slot} v={v} providerName={null} />
              <Muted>{v.errors.noBusiness}</Muted>
            </Card>,
          ];
        }
        return data.providers.map((p) => (
          <DocumentCard key={`${slot.kind}-${p.id}`} slot={slot} providerId={p.id} providerName={data.providers.length > 1 ? p.name : null} v={v} locale={locale} userId={userId} data={data} consent={consent} today={today} />
        ));
      })}

      <Card>
        <Text accessibilityRole="header" style={type.cardTitle}>{v.idTitle}</Text>
        <Muted>{v.idBody}</Muted>
        {tanzanian ? (
          <NumberForm field="nida" label={v.nida} hint={v.nidaHint} last3={data.identifiers?.nida_last3 ?? null} v={v} consent={consent} />
        ) : (
          <NumberForm field="passport" label={v.passport} last3={data.identifiers?.passport_last3 ?? null} v={v} consent={consent} identifiers={data.identifiers} locale={locale} />
        )}
        {business &&
          data.providers.map((p) => (
            <NumberForm key={p.id} field="business_tin" providerId={p.id} label={fillText(v.tin, { business: p.name })} hint={v.tinHint} last3={data.businessTins[p.id] ?? null} v={v} consent={consent} />
          ))}
      </Card>

      {/* Always shown, never working yet: no price exists and payments are switched off. */}
      <Card>
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <IconSquare glyph={GLYPHS.card} />
          <Text accessibilityRole="header" style={{ ...type.cardTitle, flex: 1 }}>{v.payTitle}</Text>
        </View>
        <Muted>{v.payBody}</Muted>
        <Button title={v.payMonthly} onPress={() => undefined} disabled accessibilityLabel={`${v.payMonthly}. ${v.paySoon}`} />
        <Button title={v.payYearly} variant="outline" onPress={() => undefined} disabled accessibilityLabel={`${v.payYearly}. ${v.paySoon}`} />
        <Text style={{ ...type.callout, ...font.semibold, color: brand.ink, backgroundColor: brand.sand, padding: space.md, borderRadius: radius.button, overflow: 'hidden' }}>{v.paySoon}</Text>
      </Card>
    </FormScreen>
  );
}

function SlotHeader({ slot, v, providerName }: { slot: DocumentSlot; v: VerificationText; providerName: string | null }) {
  const { type } = useType();
  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <IconSquare glyph={GLYPHS.document} />
        <Text accessibilityRole="header" style={{ ...type.cardTitle, flex: 1 }}>{v.kinds[slot.kind]}</Text>
        <Badge label={slot.required ? v.required : v.optional} tone={slot.required ? 'sand' : 'neutral'} />
      </View>
      {providerName ? <Text style={type.label}>{providerName}</Text> : null}
      <Muted>{v.kindHints[slot.kind]}</Muted>
    </View>
  );
}

function DocumentCard({
  slot,
  providerId,
  providerName,
  v,
  locale,
  userId,
  data,
  consent,
  today,
}: {
  slot: DocumentSlot;
  providerId: string | null;
  providerName: string | null;
  v: VerificationText;
  locale: string;
  userId: string;
  data: Data;
  consent: boolean;
  today: string;
}) {
  const { type, font } = useType();
  const { latest, all, check } = slotStatus(slot.kind, providerId, data.documents, data.checks as MemberCheck[]);
  const other = slot.kind === 'other';
  const waiting = !other && latest?.review_state === 'waiting';
  return (
    <Card>
      <SlotHeader slot={slot} v={v} providerName={providerName} />
      {!other && check ? (
        <View style={{ backgroundColor: brand.mint, padding: space.md, borderRadius: radius.button, gap: space.xxs }}>
          <Text style={{ ...type.callout, ...font.semibold, color: brand.forest }}>{fillText(v.checkedOn, { date: formatDay(check.checked_at, locale) })}</Text>
          {check.valid_until ? <Text style={{ ...type.callout, color: brand.forest }}>{fillText(v.validUntil, { date: formatDay(check.valid_until, locale) })}</Text> : null}
        </View>
      ) : null}
      {(other ? all : latest ? [latest] : []).map((doc) => (
        <DocumentLine key={doc.id} doc={doc as OwnDocument} v={v} locale={locale} userId={userId} />
      ))}
      {!waiting && <UploadForm slot={slot} providerId={providerId} again={Boolean(latest) && !other} v={v} userId={userId} consent={consent} today={today} />}
    </Card>
  );
}

function DocumentLine({ doc, v, locale, userId }: { doc: OwnDocument; v: VerificationText; locale: string; userId: string }) {
  const { type, font } = useType();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bg = doc.review_state === 'accepted' ? brand.mint : doc.review_state === 'rejected' ? brand.dangerSoft : colors.background;
  const fg = doc.review_state === 'accepted' ? brand.forest : doc.review_state === 'rejected' ? brand.danger : colors.label;

  async function run() {
    setBusy(true);
    setError('');
    try {
      await withdrawDocument(doc);
      await queryClient.invalidateQueries({ queryKey: ['my-verification', userId] });
    } catch {
      setError(v.errors.generic);
    }
    setBusy(false);
  }
  function withdraw() {
    // The web build of the app has no native alert buttons.
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(v.withdrawConfirm)) run();
      return;
    }
    Alert.alert(v.withdraw, v.withdrawConfirm, [
      { text: t.ux.cancel, style: 'cancel' },
      { text: v.withdraw, style: 'destructive', onPress: run },
    ]);
  }

  return (
    <View style={{ backgroundColor: bg, padding: space.md, borderRadius: radius.button, gap: space.xxs }}>
      {doc.title ? <Text style={{ ...type.body, ...font.bold, color: fg }}>{doc.title}</Text> : null}
      <Text style={{ ...type.callout, ...font.semibold, color: fg }}>{v.states[doc.review_state]}</Text>
      <Text style={{ ...type.caption, color: fg }}>
        {fillText(v.sentOn, { date: formatDay(doc.uploaded_at, locale) })}
        {doc.stated_valid_until ? ` · ${fillText(v.validUntil, { date: formatDay(doc.stated_valid_until, locale) })}` : ''}
      </Text>
      {doc.review_state === 'rejected' && doc.review_reason ? <Text style={{ ...type.callout, color: fg }}>{v.reasons[doc.review_reason]}</Text> : null}
      {doc.review_state === 'waiting' && (
        <View style={{ alignItems: 'flex-start' }}>
          <Button title={v.withdraw} variant="text" size="md" onPress={withdraw} loading={busy} />
        </View>
      )}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

function UploadForm({ slot, providerId, again, v, userId, consent, today }: { slot: DocumentSlot; providerId: string | null; again: boolean; v: VerificationText; userId: string; consent: boolean; today: string }) {
  const queryClient = useQueryClient();
  const dated = (datedDocumentKinds as readonly PersonDocumentKind[]).includes(slot.kind);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [title, setTitle] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function choose() {
    const picked = await pickDocumentPhoto();
    if (picked) setPhoto(picked);
  }

  async function send() {
    setMessage(null);
    const fail = (text: string) => setMessage({ tone: 'error', text });
    if (!consent) return fail(v.errors.consent);
    if (!photo) return fail(v.errors.file);
    const cleanTitle = title.trim();
    if (slot.kind === 'other' && (cleanTitle.length < 2 || cleanTitle.length > 80)) return fail(v.errors.title);
    if (dated && !DATE.test(validUntil.trim())) return fail(v.errors.date);
    if (dated && validUntil.trim() < today) return fail(v.errors.datePast);
    setBusy(true);
    let result: UploadError | null = 'upload';
    try {
      result = await uploadDocument({ userId, kind: slot.kind, providerId, title: slot.kind === 'other' ? cleanTitle : null, validUntil: dated ? validUntil.trim() : null, file: photo });
    } catch {
      result = 'upload';
    }
    setBusy(false);
    if (result) {
      return fail({ too_many: v.errors.tooMany, not_onboarded: v.errors.notOnboarded, upload: v.errors.upload, generic: v.errors.generic }[result]);
    }
    setPhoto(null);
    setTitle('');
    setValidUntil('');
    setMessage({ tone: 'ok', text: v.sent });
    queryClient.invalidateQueries({ queryKey: ['my-verification', userId] });
  }

  return (
    <View style={{ gap: space.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md }}>
      <Button title={photo ? v.changePhoto : v.choosePhoto} variant="outline" size="md" icon={GLYPHS.attach} onPress={choose} accessibilityLabel={`${v.fileApp}: ${photo ? v.photoChosen : v.choosePhoto}`} />
      {photo ? <Muted>{v.photoChosen}</Muted> : null}
      {slot.kind === 'other' && <Field label={v.titleLabel} value={title} onChangeText={setTitle} placeholder={v.titleHint} maxLength={80} />}
      {dated && <Field label={v.validUntilLabel} value={validUntil} onChangeText={setValidUntil} hint={v.dateHint} placeholder="2027-06-30" keyboardType="numbers-and-punctuation" maxLength={10} autoCorrect={false} />}
      <FormMessage message={message} />
      <Button title={again ? v.sendAgain : v.send} variant="outline" onPress={send} loading={busy} />
    </View>
  );
}

function NumberForm({
  field,
  providerId,
  label,
  hint,
  last3,
  v,
  consent,
  identifiers,
  locale,
}: {
  field: IdentifierField;
  providerId?: string;
  label: string;
  hint?: string;
  last3: string | null;
  v: VerificationText;
  consent: boolean;
  identifiers?: OwnIdentifiers | null;
  locale?: string;
}) {
  const { type, font } = useType();
  const queryClient = useQueryClient();
  const [value, setValue] = useState('');
  const [country, setCountry] = useState(identifiers?.passport_country ?? '');
  const [validUntil, setValidUntil] = useState(identifiers?.passport_valid_until ?? '');
  const [saved, setSaved] = useState(last3);
  const [busy, setBusy] = useState(false);
  const [soon, setSoon] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function run(action: 'set' | 'clear') {
    setMessage(null);
    setSoon(false);
    if (!consent) return setMessage({ tone: 'error', text: v.errors.consent });
    if (action === 'set' && !value.trim()) return setMessage({ tone: 'error', text: v.numberErrors.empty });
    setBusy(true);
    const result = await setIdentifier(action, field, { value, country, validUntil, providerId }).catch(() => ({ error: 'failed' }) as { error?: string; last3?: string });
    setBusy(false);
    if (result.error === 'not_configured') return setSoon(true);
    if (result.error) return setMessage({ tone: 'error', text: (v.numberErrors as Record<string, string>)[result.error] ?? v.errors.generic });
    setValue('');
    setSaved(action === 'clear' ? null : (result.last3 ?? saved));
    setMessage({ tone: 'ok', text: action === 'clear' ? v.numberRemoved : v.numberSaved });
    queryClient.invalidateQueries({ queryKey: ['my-verification'] });
  }

  return (
    <View style={{ gap: space.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md }}>
      {/* Never prefilled and not remembered by the keyboard: the number is sent once and not kept. */}
      <Field label={label} value={value} onChangeText={setValue} hint={hint} keyboardType={field === 'passport' ? 'default' : 'number-pad'} autoCapitalize="characters" autoCorrect={false} autoComplete="off" maxLength={40} />
      {field === 'passport' && (
        <>
          <Field label={v.passportCountry} value={country} onChangeText={(text) => setCountry(text.toUpperCase())} hint={v.passportCountryHint} autoCapitalize="characters" autoCorrect={false} maxLength={2} />
          <Field label={v.passportExpiry} value={validUntil} onChangeText={setValidUntil} hint={v.dateHint} placeholder="2030-01-31" keyboardType="numbers-and-punctuation" maxLength={10} autoCorrect={false} />
          {identifiers?.passport_valid_until && locale ? <Text style={type.caption}>{fillText(v.validUntil, { date: formatDay(identifiers.passport_valid_until, locale) })}</Text> : null}
        </>
      )}
      {saved ? <Text style={{ ...type.callout, ...font.semibold, color: brand.forest }}>{fillText(v.savedEnding, { last3: saved })}</Text> : null}
      {soon ? <Text accessibilityRole="alert" style={{ ...type.callout, ...font.semibold, color: brand.ink, backgroundColor: brand.sand, padding: space.md, borderRadius: radius.button, overflow: 'hidden' }}>{v.numbersSoon}</Text> : null}
      <FormMessage message={message} />
      <Button title={v.save} variant="outline" size="md" onPress={() => run('set')} loading={busy} />
      {saved ? (
        <View style={{ alignItems: 'flex-start' }}>
          <Button title={v.remove} variant="text" size="md" onPress={() => run('clear')} disabled={busy} />
        </View>
      ) : null}
    </View>
  );
}
