/**
 * Storybook story generator — creates .stories.tsx files for each icon
 * component so they can be browsed and tested in Storybook.
 *
 * Pure transform, no I/O.
 *
 * @module
 */

import type { RuntimeIconMeta } from '@/lib/export/export-runtime-json';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type StorybookIconInput = {
  meta: RuntimeIconMeta;
  componentName: string;
  stateIds: string[];
  variantIds: string[];
  effectIds: string[];
  defaultSize: number;
};

export type StorybookGeneratorOptions = {
  /** Import path prefix for the component. Default: '../' */
  componentImportPrefix?: string;
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Generate Storybook stories for a list of icons.
 *
 * Returns one `stories/{ComponentName}.stories.tsx` per icon.
 */
export function generateStorybookStories(
  icons: StorybookIconInput[],
  options?: StorybookGeneratorOptions,
): Array<{ path: string; contents: string }> {
  const prefix = options?.componentImportPrefix ?? '../';

  return icons.map((icon) => ({
    path: `stories/${icon.componentName}.stories.tsx`,
    contents: generateStory(icon, prefix),
  }));
}

// ---------------------------------------------------------------------------
// Story code generation
// ---------------------------------------------------------------------------

function generateStory(icon: StorybookIconInput, prefix: string): string {
  const {
    componentName,
    stateIds,
    effectIds,
    defaultSize,
  } = icon;

  const stateOptions = stateIds.map((s) => JSON.stringify(s)).join(', ');
  const effectOptions = effectIds.map((e) => JSON.stringify(e)).join(', ');

  const lines: string[] = [];

  lines.push("import type { Meta, StoryObj } from '@storybook/react';");
  lines.push(
    `import { ${componentName} } from '${prefix}${componentName}/${componentName}';`,
  );
  lines.push('');

  lines.push(`const meta: Meta<typeof ${componentName}> = {`);
  lines.push(`  title: 'Icons/${componentName}',`);
  lines.push(`  component: ${componentName},`);
  lines.push('  argTypes: {');
  lines.push(
    `    size: { control: { type: 'number' }, defaultValue: ${defaultSize} },`,
  );
  lines.push("    color: { control: 'color' },");
  lines.push(
    `    state: { control: 'select', options: [${stateOptions}] },`,
  );

  if (effectIds.length > 0) {
    lines.push(
      `    effect: { control: 'select', options: [${effectOptions}] },`,
    );
  }

  lines.push("    animate: { control: 'boolean' },");
  lines.push('  },');
  lines.push('};');
  lines.push('');

  lines.push('export default meta;');
  lines.push(`type Story = StoryObj<typeof ${componentName}>;`);
  lines.push('');

  lines.push('export const Default: Story = {};');

  return `${lines.join('\n')}\n`;
}
