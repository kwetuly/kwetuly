import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { orderMessage, type OrderMode } from '@rafrika/shared';
import { Button, Card, Chip, Field, FormMessage, Muted, ScreenState, SectionTitle } from '@/components/ui';
import { useProfile, useSession } from '@/lib/auth';
import { askBusiness, listProducts } from '@/lib/businesses';
import { useI18n } from '@/lib/i18n';
import { brand, colors, radius, space, textSize } from '@/theme';

const tzs = (n: number) => `TSh ${n.toLocaleString('en-US')}`;

// Rafrika t-shirts, caps and more, like /merch on the website. Orders go to the Rafrika Shop listing.
export default function MerchScreen() {
  const { t } = useI18n();
  const x = t.extras;
  const bt = t.business;
  const { session } = useSession();
  const profile = useProfile();
  const shop = useQuery({ queryKey: ['merch'], queryFn: listProducts });
  const [product, setProduct] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState('1');
  const [mode, setMode] = useState<OrderMode>('deliver');
  const [where, setWhere] = useState('');
  const [name, setName] = useState(profile.data?.full_name ?? '');
  const [contact, setContact] = useState(profile.data?.phone ?? session?.user.email ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const data = shop.data;
  if (!data) return <ScreenState loading={shop.isLoading} error={shop.error} onRetry={() => shop.refetch()} />;
  const chosen = data.products.find((p) => p.id === product) ?? null;

  async function order() {
    const count = Math.min(Math.max(parseInt(qty, 10) || 1, 1), 50);
    if (!chosen || !data!.shopId || !name.trim() || contact.trim().length < 3) return setMessage({ tone: 'error', text: t.auth.error });
    setBusy(true);
    try {
      const what = [`${count} × ${chosen.name}${size ? ` (size ${size})` : ''}`, note.trim()].filter(Boolean).join('\n');
      await askBusiness({ providerId: data!.shopId, userId: session?.user.id, name, contact, message: orderMessage(mode, where.trim(), what) });
      setNote('');
      setMessage({ tone: 'ok', text: bt.sent });
    } catch {
      setMessage({ tone: 'error', text: t.auth.error });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.huge }}>
      <Stack.Title>{x.merchTitle}</Stack.Title>
      <Muted>{x.merchSubtitle}</Muted>
      {(data.products.length === 0 || !data.shopId) && <Muted>{x.merchNone}</Muted>}
      {data.products.map((p) => (
        <Card key={p.id}>
          {p.photo_url && <Image source={{ uri: p.photo_url }} style={{ height: 200, borderRadius: radius.button }} contentFit="cover" />}
          <Text style={{ color: colors.label, fontWeight: '800', fontSize: textSize.headline }}>{p.name}</Text>
          <Text style={{ color: brand.leafDark, fontWeight: '700' }}>{p.price_tzs != null ? tzs(p.price_tzs) : x.priceOnRequest}</Text>
          {p.description && <Muted>{p.description}</Muted>}
          <Button title={x.merchOrder} variant={product === p.id ? 'primary' : 'outline'} onPress={() => { setProduct(p.id); setSize(null); }} />
        </Card>
      ))}
      {chosen && data.shopId && (
        <Card>
          <SectionTitle>{`${x.merchOrder}: ${chosen.name}`}</SectionTitle>
          <Muted>{bt.orderBody}</Muted>
          {chosen.sizes.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {chosen.sizes.map((s) => <Chip key={s} label={s} active={size === s} onPress={() => setSize(s)} />)}
            </View>
          )}
          <Field label={x.merchQty} value={qty} onChangeText={setQty} keyboardType="number-pad" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Chip label={bt.orderDeliver} active={mode === 'deliver'} onPress={() => setMode('deliver')} />
            <Chip label={bt.orderCollect} active={mode === 'collect'} onPress={() => setMode('collect')} />
          </View>
          <Field label={bt.orderWhere} value={where} onChangeText={setWhere} />
          <Field label={t.profile.name} value={name} onChangeText={setName} />
          <Field label={t.profile.contact} value={contact} onChangeText={setContact} autoCapitalize="none" />
          <Field label={x.merchNote} value={note} onChangeText={setNote} multiline />
          <FormMessage message={message} />
          <Button title={t.profile.send} onPress={order} loading={busy} />
        </Card>
      )}
    </ScrollView>
  );
}
