import Anthropic from '@anthropic-ai/sdk';
import { CONCIERGE_SYSTEM_PROMPT } from '@/lib/concierge-prompt';

const MAX_MESSAGES = 20;

const VOICE_INSTRUCTIONS =
  'The traveller is talking to you by voice and your reply will be read aloud. Answer in two to four short, friendly spoken sentences. No lists, headings, emojis or markdown. If a page on the site helps, mention at most one path, at the very end.';
const MAX_CHARS = 2000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

// Best-effort per-IP limit so the public chat cannot run up the API bill.
// In-memory, so it resets on deploy and is per server instance.
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}

function parseMessages(body: unknown): Anthropic.MessageParam[] | null {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { messages?: unknown }).messages)) return null;
  const raw = (body as { messages: unknown[] }).messages.slice(-MAX_MESSAGES);
  const messages: Anthropic.MessageParam[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') return null;
    const { role, content } = m as { role?: unknown; content?: unknown };
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string' || !content.trim()) return null;
    messages.push({ role, content: content.slice(0, MAX_CHARS) });
  }
  // The conversation must start with the traveller and end with their new question.
  while (messages.length && messages[0].role !== 'user') messages.shift();
  return messages.length && messages[messages.length - 1].role === 'user' ? messages : null;
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (rateLimited(ip)) return new Response('Too many requests', { status: 429 });

  const body = await request.json().catch(() => null);
  const messages = parseMessages(body);
  const voice = (body as { voice?: unknown } | null)?.voice === true;
  if (!messages) return new Response('Bad request', { status: 400 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response('The concierge is not configured yet.', { status: 503 });
  }

  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: 'claude-opus-5-5',
    max_tokens: 4000,
    // Chat is latency-sensitive and simple, so low effort keeps replies fast and cheap.
    output_config: { effort: 'low' },
    system: [
      { type: 'text', text: CONCIERGE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      // Spoken conversations get short, plain answers that sound natural when read aloud.
      ...(voice ? [{ type: 'text' as const, text: VOICE_INSTRUCTIONS }] : []),
    ],
    messages,
    // If a safety classifier declines, the API retries on the recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  });

  const encoder = new TextEncoder();
  const replyStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === 'refusal') {
          controller.enqueue(encoder.encode('\n\nI can’t help with that here. A Kwetuly guide can: /en/calls'));
        }
      } catch (error) {
        console.error('Concierge error', error instanceof Anthropic.APIError ? error.status : error);
        controller.enqueue(encoder.encode('\n\n[error]'));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(replyStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
