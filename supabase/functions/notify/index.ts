// Sends queued Rafrika alerts by email (Resend) and WhatsApp (Meta WhatsApp Cloud API).
// Triggered by the database whenever alerts are queued, and every 5 minutes by pg_cron for retries.
//
// Secrets (Supabase dashboard → Edge Functions → Secrets). Channels without secrets are skipped:
//   RESEND_API_KEY            email provider key
//   EMAIL_FROM                e.g. "Rafrika <alerts@rafrika.com>" (domain must be verified in Resend)
//   WHATSAPP_TOKEN            permanent access token from Meta Business
//   WHATSAPP_PHONE_NUMBER_ID  the sending number's ID from WhatsApp Manager
//   WHATSAPP_TEMPLATE         approved template name (default "rafrika_alert": body "{{1}} {{2}}")
//   SITE_URL                  e.g. "https://rafrika.com" (default)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

type Outbox = {
  id: string;
  event: string;
  channel: 'email' | 'whatsapp';
  recipient: string;
  locale: string;
  payload: Record<string, string | null>;
  attempts: number;
};

const env = (key: string, fallback = '') => Deno.env.get(key) ?? fallback;
const SITE_URL = env('SITE_URL', 'https://rafrika.com').replace(/\/$/, '');
const MAX_ATTEMPTS = 5;

// ---------------------------------------------------------------------------
// Message texts (English / Swahili)
// ---------------------------------------------------------------------------
type Text = { subject: string; body: string };

function render(event: string, locale: string, p: Record<string, string | null>): Text {
  const sw = locale === 'sw';
  const v = (key: string) => p[key] ?? '';
  const when = p.when ? new Date(p.when).toLocaleString(sw ? 'sw-TZ' : 'en-GB', { timeZone: 'Africa/Dar_es_Salaam', dateStyle: 'medium', timeStyle: 'short' }) : '';

  switch (event) {
    case 'lead_for_guide':
      return sw
        ? { subject: `Ombi jipya kutoka kwa ${v('name')}`, body: `${v('name')} anataka safari nawe. Mawasiliano: ${v('contact')}. Ujumbe: ${v('message')}` }
        : { subject: `New request from ${v('name')}`, body: `${v('name')} would like a trip with you. Contact: ${v('contact')}. Message: ${v('message')}` };
    case 'lead_for_admin':
      return sw
        ? { subject: `Ombi jipya${p.trip ? `: ${v('trip')}` : ''}`, body: `${v('name')} (${v('contact')}) ${p.trip ? `kuhusu ${v('trip')}. ` : ''}${v('message')}` }
        : { subject: `New enquiry${p.trip ? `: ${v('trip')}` : ''}`, body: `${v('name')} (${v('contact')}) ${p.trip ? `about ${v('trip')}. ` : ''}${v('message')}` };
    case 'call_requested':
      return sw
        ? { subject: 'Ombi jipya la simu ya maandalizi', body: `Msafiri ameomba simu (${v('topic')}). Muda anaopendelea: ${v('times')}. Kubali au kataa kwenye Kituo cha Waongozaji.` }
        : { subject: 'New prep call request', body: `A traveller requested a call (${v('topic')}). Preferred times: ${v('times')}. Accept or decline in the Guide Hub.` };
    case 'call_accepted':
      return sw
        ? { subject: `${v('guide')} amekubali simu yako`, body: `Simu yako na ${v('guide')} imethibitishwa${when ? ` kwa ${when} (saa za Tanzania)` : ''}.${p.meeting_link ? ` Kiungo: ${v('meeting_link')}` : ''}` }
        : { subject: `${v('guide')} accepted your call`, body: `Your call with ${v('guide')} is confirmed${when ? ` for ${when} (Tanzania time)` : ''}.${p.meeting_link ? ` Join here: ${v('meeting_link')}` : ''}` };
    case 'call_declined':
      return sw
        ? { subject: `${v('guide')} hakuweza kukubali simu`, body: `Samahani, ${v('guide')} hapatikani kwa muda huo. Chagua mwongozaji mwingine kwenye Rafrika.` }
        : { subject: `${v('guide')} couldn't take your call`, body: `Sorry, ${v('guide')} isn't available then. You can choose another guide on Rafrika.` };
    case 'guide_pending':
      return { subject: `Guide waiting for approval: ${v('guide')}`, body: `${v('guide')} (${v('region')}) has submitted a profile. Check their registration and approve or reject.` };
    case 'guide_approved':
      return sw
        ? { subject: 'Hongera! Wasifu wako umeidhinishwa', body: `Karibu Rafrika, ${v('guide')}! Wasifu wako uko hewani na sasa unaweza kuingia Kituo cha Waongozaji.` }
        : { subject: 'Congratulations! Your profile is approved', body: `Karibu to Rafrika, ${v('guide')}! Your profile is live and the Guide Hub is now open to you.` };
    case 'job_pending':
      return { subject: `Job waiting for review: ${v('title')}`, body: `${v('company')} posted "${v('title')}". Review it in the admin page.` };
    case 'job_approved':
      return sw
        ? { subject: 'Kazi yako imeidhinishwa', body: `"${v('title')}" sasa inaonekana kwa waongozaji waliothibitishwa kwenye Rafrika.` }
        : { subject: 'Your job is live', body: `"${v('title')}" is now visible to verified guides on Rafrika.` };
    case 'message_new':
      return sw
        ? { subject: `Ujumbe mpya kutoka kwa ${v('sender')}`, body: `${v('sender')}: "${v('preview')}". Jibu kwenye Rafrika.` }
        : { subject: `New message from ${v('sender')}`, body: `${v('sender')}: "${v('preview')}". Reply on Rafrika.` };
    case 'interest_traveler':
      return { subject: `Traveller interest: ${v('section')} / ${v('item')}`, body: `${v('name')} (${v('contact')}) wants ${v('item')}. ${v('message')}` };
    case 'interest_business':
      return { subject: `Business wants to list: ${v('business') || v('name')}`, body: `${v('name')} (${v('contact')}) wants to be listed under ${v('section')} / ${v('item')}. ${v('message')}` };
    default:
      return { subject: 'Rafrika update', body: v('message') };
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function emailHtml(text: Text, link: string, locale: string) {
  const button = locale === 'sw' ? 'Fungua Rafrika' : 'Open Rafrika';
  return `<!doctype html><html><body style="margin:0;background:#f7f6f3;font-family:Arial,sans-serif;color:#16211c">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
    <tr><td style="background:#0a1f17;padding:20px 28px;color:#ffb627;font-size:22px;font-weight:bold">Rafrika</td></tr>
    <tr><td style="padding:28px">
      <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(text.subject)}</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px">${escapeHtml(text.body)}</p>
      <a href="${link}" style="display:inline-block;background:#ff6a2b;color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:15px">${button}</a>
    </td></tr>
    <tr><td style="padding:16px 28px;font-size:12px;color:#5f6b66;border-top:1px solid #e7e5e0">Rafrika: the home of Tanzanian guides.</td></tr>
  </table></td></tr></table></body></html>`;
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------
class NotConfigured extends Error {}

async function sendEmail(to: string, text: Text, link: string, locale: string) {
  const key = env('RESEND_API_KEY');
  if (!key) throw new NotConfigured('RESEND_API_KEY not set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env('EMAIL_FROM', 'Rafrika <alerts@rafrika.com>'),
      to: [to],
      subject: text.subject,
      html: emailHtml(text, link, locale),
      text: `${text.body}\n\n${link}`,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

// WhatsApp needs international format without "+"; Tanzanian local numbers (07xx / 06xx) get 255.
function toWhatsAppNumber(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (/^0[67]\d{8}$/.test(digits)) return `255${digits.slice(1)}`;
  return digits;
}

async function sendWhatsApp(to: string, text: Text, link: string, locale: string) {
  const token = env('WHATSAPP_TOKEN');
  const phoneId = env('WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !phoneId) throw new NotConfigured('WhatsApp secrets not set');
  // Template parameters may not contain new lines or long runs of spaces.
  const clean = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 900);
  const res = await fetch(`https://graph.facebook.com/${env('WHATSAPP_API_VERSION', 'v23.0')}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toWhatsAppNumber(to),
      type: 'template',
      template: {
        name: env('WHATSAPP_TEMPLATE', 'rafrika_alert'),
        language: { code: locale === 'sw' ? 'sw' : 'en' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: clean(`${text.subject}: ${text.body}`) }, { type: 'text', text: link }] },
        ],
      },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------
Deno.serve(async () => {
  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const { data: batch, error } = await supabase.rpc('claim_notifications', { p_limit: 50 });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const results = { sent: 0, failed: 0, skipped: 0, retry: 0 };
  for (const row of (batch ?? []) as Outbox[]) {
    const locale = row.locale === 'sw' ? 'sw' : 'en';
    const text = render(row.event, locale, row.payload ?? {});
    const link = `${SITE_URL}/${locale}${row.payload?.link ?? ''}`;
    try {
      if (row.channel === 'email') await sendEmail(row.recipient, text, link, locale);
      else await sendWhatsApp(row.recipient, text, link, locale);
      await supabase.from('notification_outbox').update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null }).eq('id', row.id);
      results.sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // A channel that isn't set up yet is skipped rather than retried forever.
      const status = err instanceof NotConfigured ? 'skipped' : row.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
      await supabase.from('notification_outbox').update({ status, last_error: message.slice(0, 500), locked_until: null }).eq('id', row.id);
      results[status === 'pending' ? 'retry' : status]++;
    }
  }
  return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
});
