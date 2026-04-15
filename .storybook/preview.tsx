import type { Preview } from '@storybook/nextjs-vite';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
// NOTE (Phase 1 spike workaround): geist/font/{sans,mono} call next/font/local
// at module eval. @storybook/nextjs-vite does not fully shim next/font yet, so
// importing them here crashes the Vite build ("default is not exported by
// next/font/local"). Drop them in Storybook and fall back to system fonts via
// the --font-system token. The app itself is unaffected.
import '@fontsource/work-sans/400.css';
import '@fontsource/work-sans/500.css';
import '@fontsource/work-sans/600.css';
import '../app/globals.css';
import './preview.css';
import React from 'react';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#0a0a0a' },
      ],
    },
    nextjs: {
      appDirectory: true,
    },
    a11y: {
      // Runs axe-core on every story render and reports violations in the
      // addon panel. Plan §5 specifies this is ON by default from Phase 3
      // onward; Phase 8 flips the mode to 'error' so violations break the
      // build. Until then, violations are informational.
      test: 'todo',
      config: {},
    },
  },
  decorators: [
    (Story, context) => {
      const theme = (context.globals.theme as string | undefined) ?? 'light';
      return (
        <div
          className="sb-root"
          style={{ fontFamily: 'var(--font-system, system-ui, sans-serif)' }}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme={theme}
            forcedTheme={theme}
            enableSystem={false}
            disableTransitionOnChange
          >
            <TooltipProvider>
              <Story />
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </div>
      );
    },
  ],
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'next-themes class on <html>',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        showName: true,
      },
    },
  },
};

export default preview;
