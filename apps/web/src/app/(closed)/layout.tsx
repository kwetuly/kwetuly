import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import '../globals.css';

const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin', 'latin-ext'] });

// Pages shown while the site is closed before launch (see src/lib/coming-soon.ts).
export const metadata: Metadata = {
  title: 'Kwetuly — coming soon',
  description: 'The home of Tanzanian guides. Coming soon.',
  robots: { index: false, follow: false },
};

export default function ClosedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col items-center justify-center px-4 py-12">{children}</body>
    </html>
  );
}
