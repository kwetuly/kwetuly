import { useState } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BUSINESS_LINK_KINDS,
  GUIDE_LINK_KINDS,
  PROFILE_LINK_COLUMNS,
  SWITCHED_GUIDE_LINK_KINDS,
  normaliseProfileLink,
  profileLinkCheckMessage,
  profileLinkErrorMessage,
  profileLinkFieldLabel,
  profileLinkHint,
  profileLinksText,
  type ProfileLinkKind,
  type ProfileLinksText,
} from '@kwetuly/shared';
import { Button, Card, EmptyState, Field, FormMessage, FormScreen, Muted, ScreenState, SectionTitle } from '@/components/ui';
import { SignInPrompt } from '@/components/sign-in-prompt';
import { useSession } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { useNeedsSetup, welcomeHref } from '@/lib/onboarding';
import { getMyLinks, saveBusinessLinks, saveGuideLinks, type LinkRow, type SaveResult } from '@/lib/profile-links';
import { space } from '@/theme';

// Profile links (slice S5), the same as /dashboard/links on the website: a guide's website, Google
// Business Profile, YouTube, Instagram, Facebook and TikTok, and each business's social links.
// Guide and owner texts, so English and Kiswahili.
export default function ProfileLinksScreen() {
  const { locale } = useI18n();
  const t = profileLinksText(locale);
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const mine = useQuery({ queryKey: ['my-links', userId], queryFn: () => getMyLinks(userId!), enabled: !!userId });
  const needsSetup = useNeedsSetup();

  if (needsSetup) return <Redirect href={welcomeHref('/profile-links')} />;
  if (!userId) return <SignInPrompt screen />;
  if (!mine.data) {
    return (
      <>
        <Stack.Screen options={{ title: t.title }} />
        <ScreenState screen loading={mine.isLoading} error={mine.error} onRetry={() => mine.refetch()} />
      </>
    );
  }
  const { guide, businesses, on } = mine.data;
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['my-links'] });
    queryClient.invalidateQueries({ queryKey: ['guide-links'] });
  };

  return (
    <FormScreen>
      <Stack.Screen options={{ title: t.title }} />
      <Muted>{t.intro}</Muted>
      {!guide && businesses.length === 0 && <EmptyState text={t.notMember} />}
      {guide && (
        <LinksForm
          key={`guide-${guide.id}`}
          heading={t.guideHeading}
          note={on ? null : t.switchedOff}
          kinds={GUIDE_LINK_KINDS}
          disabled={(kind) => !on && SWITCHED_GUIDE_LINK_KINDS.includes(kind)}
          row={guide}
          t={t}
          locale={locale}
          save={(values) => saveGuideLinks(guide.id, values, on)}
          onSaved={refresh}
        />
      )}
      {businesses.map((business) =>
        on ? (
          <LinksForm
            key={`business-${business.id}`}
            heading={t.businessHeading.replace('{business}', () => business.business_name)}
            note={t.businessWebsiteNote}
            kinds={BUSINESS_LINK_KINDS}
            row={business}
            t={t}
            locale={locale}
            save={(values) => saveBusinessLinks(business.id, values, on)}
            onSaved={refresh}
          />
        ) : (
          <Card key={`business-${business.id}`}>
            <SectionTitle>{t.businessHeading.replace('{business}', () => business.business_name)}</SectionTitle>
            <Muted>{t.businessSwitchedOff}</Muted>
          </Card>
        ),
      )}
    </FormScreen>
  );
}

function LinksForm({
  heading,
  note,
  kinds,
  disabled,
  row,
  t,
  locale,
  save,
  onSaved,
}: {
  heading: string;
  note: string | null;
  kinds: readonly ProfileLinkKind[];
  disabled?: (kind: ProfileLinkKind) => boolean;
  row: LinkRow;
  t: ProfileLinksText;
  locale: string;
  save: (values: Partial<Record<ProfileLinkKind, string>>) => Promise<SaveResult>;
  onSaved: () => void;
}) {
  const editable = kinds.filter((kind) => !disabled?.(kind));
  const [values, setValues] = useState<Partial<Record<ProfileLinkKind, string>>>(() =>
    Object.fromEntries(kinds.map((kind) => [kind, row[PROFILE_LINK_COLUMNS[kind]] ?? ''])),
  );
  const [refused, setRefused] = useState<ProfileLinkKind | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // A typed link that the shared rules (and so the server) would refuse, shown under its field.
  const fieldError = (kind: ProfileLinkKind): string | null => {
    const value = (values[kind] ?? '').trim();
    const saved = row[PROFILE_LINK_COLUMNS[kind]] ?? '';
    if (!value || value === saved) return refused === kind ? profileLinkCheckMessage(kind, null, locale) : null;
    const result = normaliseProfileLink(kind, value);
    return result.ok ? null : profileLinkCheckMessage(kind, result.reason, locale);
  };
  const hasError = editable.some((kind) => !!fieldError(kind));

  async function onSave() {
    setSaving(true);
    setMessage(null);
    try {
      const result = await save(Object.fromEntries(editable.map((kind) => [kind, values[kind] ?? ''])));
      if (result.ok) {
        setRefused(null);
        setMessage({ tone: 'ok', text: t.saved });
        onSaved();
      } else {
        setRefused(result.kind ?? null);
        setMessage({ tone: 'error', text: profileLinkErrorMessage(result.error, locale) ?? t.saveError });
      }
    } catch {
      setMessage({ tone: 'error', text: t.saveError });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ gap: space.lg }}>
      <SectionTitle>{heading}</SectionTitle>
      {note ? <Muted>{note}</Muted> : null}
      {/* While the switch is off, switched links are not shown here (the note above says so); nothing is deleted. */}
      {kinds.map((kind) =>
        disabled?.(kind) ? null : (
          <Field
            key={kind}
            label={profileLinkFieldLabel(kind, locale)}
            value={values[kind] ?? ''}
            onChangeText={(value) => {
              setValues((current) => ({ ...current, [kind]: value }));
              if (refused === kind) setRefused(null);
            }}
            hint={profileLinkHint(kind, locale)}
            error={fieldError(kind)}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            maxLength={kind === 'google' ? 2000 : 300}
          />
        ),
      )}
      <Muted>{t.clearNote}</Muted>
      <FormMessage message={message} />
      <Button title={t.save} onPress={onSave} loading={saving} disabled={hasError || saving} />
    </Card>
  );
}
