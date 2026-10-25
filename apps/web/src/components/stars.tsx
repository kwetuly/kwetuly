import { Star } from 'lucide-react';

// Five stars filled to the nearest whole star; the number is shown next to it by the caller.
export function Stars({ value, size = 'size-4', label }: { value: number; size?: string; label: string }) {
  const filled = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${n <= filled ? 'fill-gold text-gold' : 'text-line'}`} aria-hidden />
      ))}
    </span>
  );
}

// Rating line for cards and profile headers: "★★★★★ 4.8 (12 reviews)" or "New on Kwetuly".
export function RatingSummary({
  avg,
  count,
  labels,
}: {
  avg: number | null;
  count: number;
  labels: { newGuide: string; reviews: string; review: string; stars: string };
}) {
  if (!count || avg == null) {
    return <span className="text-xs font-semibold text-leaf-dark">✦ {labels.newGuide}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <Stars value={avg} label={`${avg} / 5 ${labels.stars}`} />
      <strong>{Number(avg).toFixed(1)}</strong>
      <span className="text-muted">
        ({count} {count === 1 ? labels.review : labels.reviews})
      </span>
    </span>
  );
}
