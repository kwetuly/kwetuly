import { Pressable, Text, View } from 'react-native';
import { isPunycodeHost, profileLinkLabel, profileLinksShownText, type ShownProfileLink } from '@kwetuly/shared';
import { GLYPHS, Glyph } from '@/components/glyph';
import { ListGroup, ListRow, SectionTitle } from '@/components/ui';
import { openExternal } from '@/lib/open-external';
import { useType } from '@/lib/use-type';
import { brand, control, space } from '@/theme';

// Links a guide added to their page (slice S5). The links passed in come from shownProfileLinks(),
// which cleans each stored value again; openExternal opens only plain https links in the browser.

/** "Find {name} online": the guide's profile links, each row opens the link in the browser. */
export function ProfileLinks({ links, name, locale }: { links: ShownProfileLink[]; name: string; locale: string }) {
  const { type } = useType();
  if (links.length === 0) return null;
  const t = profileLinksShownText(locale);
  return (
    <View style={{ gap: space.sm }}>
      <SectionTitle>{t.title.replace('{name}', () => name)}</SectionTitle>
      <ListGroup>
        {links.map((link) => (
          <ListRow
            key={link.kind}
            accessibilityRole="link"
            title={profileLinkLabel(link.kind, locale)}
            subtitle={link.handle ? `@${link.handle}` : isPunycodeHost(link.host) ? `${link.host} ${t.punycode}` : link.host}
            onPress={() => openExternal(link.url)}
          />
        ))}
      </ListGroup>
      <Text style={type.caption}>{t.note}</Text>
    </View>
  );
}

/** The guide's own website as a small link under the "Ask" buttons. */
export function ProfileWebsite({ link, name, locale }: { link: ShownProfileLink | undefined; name: string; locale: string }) {
  const { type, font } = useType();
  if (!link || link.kind !== 'website') return null;
  const t = profileLinksShownText(locale);
  // A punycode host is shown as it is, with a note, so a lookalike address is noticed (review L2).
  const label = `${t.website.replace('{name}', () => name)}: ${link.host}${isPunycodeHost(link.host) ? ` ${t.punycode}` : ''}`;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => openExternal(link.url)}
      style={({ pressed }) => ({ minHeight: control.touch, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.6 : 1 })}
    >
      <Glyph name={GLYPHS.globe} size={16} color={brand.forest} />
      <Text style={{ ...type.callout, ...font.semibold, color: brand.forest, textDecorationLine: 'underline', flexShrink: 1 }}>{label}</Text>
    </Pressable>
  );
}
