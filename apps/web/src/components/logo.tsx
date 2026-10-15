// The Rafrika wordmark: "rafrika" in lowercase, with the dot of the i drawn as a rising sun.
// Sizes with the surrounding font size, so set `className` with a text size.
export function Logo({ tone = 'dark', className = '' }: { tone?: 'dark' | 'light'; className?: string }) {
  const text = tone === 'dark' ? 'text-leaf' : 'text-white';
  const sun = 'bg-gold';
  return (
    <span className={`inline-block font-extrabold leading-none tracking-[-0.04em] ${text} ${className}`} aria-label="Rafrika">
      <span aria-hidden>
        rafr
        <span className="relative">
          ı
          <span className={`absolute left-1/2 top-[0.02em] size-[0.27em] -translate-x-1/2 rounded-full ${sun}`} />
        </span>
        ka
      </span>
    </span>
  );
}
