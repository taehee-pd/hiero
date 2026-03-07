import type { Metadata } from 'next';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import { IBM_Plex_Mono, Instrument_Sans, Syne } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const sans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-body-source',
  display: 'swap',
});

const display = Syne({
  subsets: ['latin'],
  variable: '--font-display-source',
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono-source',
  weight: ['400', '500'],
  display: 'swap',
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4efe5' },
    { media: '(prefers-color-scheme: dark)', color: '#13100d' },
  ],
};

export const metadata: Metadata = {
  title: 'Icophone',
  description: 'Icon design studio for stateful, animated SVG icons',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="bg-background">
      <body
        className={`${sans.variable} ${display.variable} ${mono.variable} overflow-hidden font-sans antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Analytics />
        </ThemeProvider>
        <Script src="https://mcp.figma.com/mcp/html-to-design/capture.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
