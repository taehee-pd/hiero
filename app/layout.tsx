import type { Metadata } from 'next';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/geist-mono';
import { AutoSaveProvider } from '@/components/persistence/AutoSaveProvider';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { BUILD_VERSION } from '@/lib/build-version';
import { themeBootScript } from '@/lib/theme';
import './globals.css';

// Inlined into the HTML so Playwright smoke tests + bug-report tooling
// can read the version without scraping the DOM and without waiting for
// React hydration. Static-export mode (which can't set HTTP response
// headers) relies on this + the <meta> tag below as the introspection
// surface.
const buildVersionScript = `window.__HIERO_BUILD__ = Object.freeze(${JSON.stringify(BUILD_VERSION)});`;

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // No maximumScale: locking zoom at 1 blocks pinch-to-zoom, a WCAG 1.4.4
  // failure. Users must be able to zoom.
  themeColor: [
    // Match the real shell surfaces (--background): white in light, near-black
    // in dark. The previous #f4efe5 / #13100d were stale and off-brand.
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0A' },
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
        url: '/hiero.svg?v=5',
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
      <head>
        {/* Static-export-safe build identification surface — survives
            even when next.config.mjs's headers() block can't run. */}
        <meta name="hiero-build-channel" content={BUILD_VERSION.channel} />
        <meta name="hiero-app-version" content={BUILD_VERSION.app} />
        <meta name="hiero-build-commit" content={BUILD_VERSION.commit} />
      </head>
      <body
        className="overflow-hidden antialiased"
        style={{ fontFamily: 'var(--font-system)' }}
      >
        <Script
          id="hiero-build-version"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: buildVersionScript }}
        />
        <Script
          id="hiero-theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeBootScript }}
        />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
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
