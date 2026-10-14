import Image from 'next/image';
import type { ReactNode } from 'react';
import { PHOTOS, photoUrl, type PhotoKey } from '@/lib/photos';

// Dark page header with a full-bleed photo behind the content.
export function PhotoHero({ photo, children, className = '' }: { photo: PhotoKey; children: ReactNode; className?: string }) {
  const p = PHOTOS[photo];
  return (
    <section className={`relative isolate overflow-hidden bg-night text-white ${className}`}>
      <Image src={photoUrl(p, 2000)} alt={p.alt} fill priority sizes="100vw" className="-z-10 object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-shade/90 via-shade/60 to-shade/10" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-shade/80 via-transparent to-transparent" />
      {children}
    </section>
  );
}
