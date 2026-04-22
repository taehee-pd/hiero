import type { Preview } from '@storybook/nextjs-vite';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { resetToastStateForTest } from '@/components/ui/use-toast';
import '@fontsource-variable/spline-sans';
import '@fontsource-variable/spline-sans-mono';
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
      // Runs axe-core on every story render. Phase 8: flipped from 'todo'
      // to 'error' so a11y violations break the Storybook Vitest build.
      test: 'error',
      config: {},
    },
  },
  decorators: [
    (Story, context) => {
      const theme = (context.globals.theme as string | undefined) ?? 'light';
      // Reset the toast store before each story render so module-level
      // memoryState from the previous story doesn't leak into this one.
      // Codex adversarial review (Phase 4 finding #8): TOAST_REMOVE_DELAY
      // is ~infinite (1M ms), so without an explicit reset, a story
      // that fires a toast would leave it in the store for every
      // subsequent story until the process exits.
      resetToastStateForTest();
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
