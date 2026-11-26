import 'server-only';
import QRCode from 'qrcode';
import { SITE_URL } from '@/lib/site';

/** The language-free short link for a guide's page: /g/[slug] picks the visitor's language. */
export function bookingLinkUrl(slug: string, source: 'link' | 'qr' = 'link') {
  return `${SITE_URL}/g/${encodeURIComponent(slug)}${source === 'qr' ? '?src=qr' : ''}`;
}

/**
 * A QR code as a small SVG: black squares on white with the standard 4-module quiet zone, one path,
 * so it stays sharp when printed. Error correction M survives a crease or a bit of dirt.
 */
export function qrSvg(text: string, title: string): string {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const size = modules.size;
  const margin = 4;
  let path = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules.get(y, x)) path += `M${x + margin} ${y + margin}h1v1h-1z`;
    }
  }
  const full = size + margin * 2;
  const safeTitle = title.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges" role="img"><title>${safeTitle}</title><rect width="${full}" height="${full}" fill="#ffffff"/><path d="${path}" fill="#000000"/></svg>`;
}
