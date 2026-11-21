import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import '../globals.css';

const jakarta = Plus_Jakarta_Sans({ variable: '--font-jakarta', subsets: ['latin', 'latin-ext'] });

// Pages shown while the site is closed before launch (see src/lib/coming-soon.ts).
export const metadata: Metadata = {
  title: 'Kwetuly — coming soon',
  description: 'Travel with the people of Tanzania. We are getting ready.',
  appleWebApp: { capable: true, title: 'Kwetuly', statusBarStyle: 'default' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#1D951A' };

export default function ClosedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col items-center justify-center px-4 py-12">{children}</body>
    </html>
  );
}
