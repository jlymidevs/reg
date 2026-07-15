import type { Metadata, Viewport } from 'next';
import { Lexend, Source_Sans_3 } from 'next/font/google';
import { Shell } from './components/shell';
import './globals.css';

const headingFont = Lexend({
  subsets: ['latin'],
  variable: '--font-heading',
});

const bodyFont = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'JLYCC PCM Portal',
  description: 'Pastoral Care Ministry — member monitoring & D-Journey tracking',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${bodyFont.variable} min-h-screen`}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
