import { detectDocumentFileType } from '@kwetuly/shared';
import { hasLocale, defaultLocale } from '@/i18n/config';
import { getCurrentUser, isAdminSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { codeForError } from '../../codes';

// Opens one verification file for an admin (security review L2 and L3). No signed storage link ever
// reaches the browser: this route checks admin with a two-step session, records "document opened"
// FIRST (admin_log_document_opened returns the path), streams the file with the admin's own session
// (the storage policy and its aal2 check decide), checks the first bytes, and sends the file back with
// no-store, inline, nosniff and a strict content security policy.
//
// POST only, from the "Open the file" form on the documents page: a link on another site cannot make an
// admin's browser open (and log) a file, because the session cookies are SameSite=Lax and the Origin is
// checked as well. The proxy has already refused everyone who is not an admin with a two-step session.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// No scripts, no connections, no frames. Images may show (the browser's own image page uses inline
// styles). PDFs need object-src/frame-src 'self' because Chrome shows them through an embedded viewer;
// plugin-types is no longer supported by browsers, so it is not sent.
const IMAGE_CSP = "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
const PDF_CSP = `${IMAGE_CSP}; object-src 'self'; frame-src 'self'`;

function back(lang: string, code: string, id?: string): Response {
  // A relative Location, so the address never depends on the Host header. 303: the browser follows with GET.
  const anchor = id ? `#doc-${id}` : '';
  return new Response(null, {
    status: 303,
    headers: { Location: `/${lang}/admin/documents?${new URLSearchParams({ e: code })}${anchor}`, 'Cache-Control': 'no-store' },
  });
}

function sameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang: rawLang, id } = await params;
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  if (!sameOrigin(request)) return back(lang, 'failed');

  const user = await getCurrentUser();
  if (!user || !(await isAdminSession(user))) return back(lang, 'not_admin');
  if (!UUID.test(id)) return back(lang, 'not_found');

  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc('admin_log_document_opened', { p_document: id });
  if (error || typeof path !== 'string') return back(lang, codeForError(error?.message), id);

  // Streamed, not read whole (security review M2): Vercel limits a buffered function response to about
  // 4.5 MB and uploads may be 15 MB. Only the first bytes are read before answering, so a file that is not
  // JPEG, PNG, WebP or PDF is refused before any of it is sent.
  const { data: stream } = await supabase.storage.from('verification').download(path).asStream();
  if (!stream) return back(lang, 'file_missing', id);
  const head = await readHead(stream.getReader(), HEAD_BYTES);
  if (!head) return back(lang, 'file_missing', id);
  const type = detectDocumentFileType(head.bytes);
  if (!type) {
    await head.reader.cancel().catch(() => {});
    return back(lang, 'bad_file', id);
  }

  return new Response(resume(head), {
    status: 200,
    headers: {
      'Content-Type': type.contentType,
      // Only known when the whole file arrived with its first bytes; otherwise the body is chunked.
      ...(head.done ? { 'Content-Length': String(head.bytes.byteLength) } : {}),
      // A fixed name: nothing about the person goes into the header.
      'Content-Disposition': `inline; filename="document.${type.ext}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': type.ext === 'pdf' ? PDF_CSP : IMAGE_CSP,
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

const HEAD_BYTES = 16;

type Head = { reader: ReadableStreamDefaultReader<Uint8Array>; bytes: Uint8Array; done: boolean };

/** Reads chunks until at least `min` bytes (or the end); null when the file is empty or the read fails. */
async function readHead(reader: ReadableStreamDefaultReader<Uint8Array>, min: number): Promise<Head | null> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  let done = false;
  try {
    while (length < min) {
      const next = await reader.read();
      if (next.done) {
        done = true;
        break;
      }
      chunks.push(next.value);
      length += next.value.byteLength;
    }
  } catch {
    return null;
  }
  if (length === 0) return null;
  const bytes = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  return { reader, bytes, done };
}

/** The first bytes again, then the rest of the file as it arrives. */
function resume({ reader, bytes, done }: Head): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      if (done) controller.close();
    },
    async pull(controller) {
      if (done) return;
      try {
        const next = await reader.read();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      } catch (e) {
        controller.error(e);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

export function GET() {
  return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
}
