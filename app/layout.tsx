import type { Metadata } from 'next';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import '@fontsource-variable/spline-sans';
import '@fontsource-variable/spline-sans-mono';
import { AutoSaveProvider } from '@/components/persistence/AutoSaveProvider';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

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
  title: 'Hiero',
  description: 'Icon design studio for stateful, animated SVG icons',
  icons: {
    icon: [
      {
        url: '/favicon-32x32.png?v=2',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/hiero.svg?v=4',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png?v=2',
  },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="bg-background">
      <body
        className="overflow-hidden antialiased"
        style={{ fontFamily: 'var(--font-system)' }}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AutoSaveProvider />
          {children}
          <Toaster />
          <Analytics />
        </ThemeProvider>
        <Script src="https://mcp.figma.com/mcp/html-to-design/capture.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
