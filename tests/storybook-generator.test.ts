import { describe, expect, test } from 'bun:test';
import {
  generateStorybookStories,
  type StorybookIconInput,
} from '../lib/export/adapters/storybook-generator';
import type { RuntimeIconMeta } from '../lib/export/export-runtime-json';

function makeIconInput(
  name: string,
  overrides?: Partial<StorybookIconInput>,
): StorybookIconInput {
  const meta: RuntimeIconMeta = {
    id: `icon-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    variants: {
      v24: { size: 24, viewBox: [0, 0, 24, 24], defaultState: 'default' },
    },
  };

  return {
    meta,
    componentName: name.replace(/\s+/g, ''),
    stateIds: ['default', 'active'],
    variantIds: ['v24'],
    effectIds: [],
    defaultSize: 24,
    ...overrides,
  };
}

describe('generateStorybookStories', () => {
  test('generates stories for 2 icons', () => {
    const icons = [
      makeIconInput('ChevronRight'),
      makeIconInput('ArrowDown'),
    ];

    const files = generateStorybookStories(icons);

    expect(files).toHaveLength(2);
    expect(files[0]!.path).toBe('stories/ChevronRight.stories.tsx');
    expect(files[1]!.path).toBe('stories/ArrowDown.stories.tsx');
  });

  test('output contains Meta<typeof ComponentName>', () => {
    const files = generateStorybookStories([makeIconInput('TestIcon')]);
    expect(files[0]!.contents).toContain('Meta<typeof TestIcon>');
  });

  test('argTypes has state options', () => {
    const files = generateStorybookStories([
      makeIconInput('TestIcon', {
        stateIds: ['default', 'hover', 'pressed'],
      }),
    ]);
    const content = files[0]!.contents;
    expect(content).toContain('"default"');
    expect(content).toContain('"hover"');
    expect(content).toContain('"pressed"');
    expect(content).toContain("state: { control: 'select'");
  });

  test('file count matches icon count', () => {
    const icons = [
      makeIconInput('A'),
      makeIconInput('B'),
      makeIconInput('C'),
    ];

    const files = generateStorybookStories(icons);
    expect(files).toHaveLength(icons.length);
  });

  test('uses custom componentImportPrefix', () => {
    const files = generateStorybookStories([makeIconInput('TestIcon')], {
      componentImportPrefix: '../../components/',
    });
    expect(files[0]!.contents).toContain(
      "from '../../components/TestIcon/TestIcon'",
    );
  });

  test('includes effect argType when effectIds present', () => {
    const files = generateStorybookStories([
      makeIconInput('TestIcon', {
        effectIds: ['bounce', 'pulse'],
      }),
    ]);
    const content = files[0]!.contents;
    expect(content).toContain("effect: { control: 'select'");
    expect(content).toContain('"bounce"');
    expect(content).toContain('"pulse"');
  });

  test('omits effect argType when no effectIds', () => {
    const files = generateStorybookStories([
      makeIconInput('TestIcon', { effectIds: [] }),
    ]);
    const content = files[0]!.contents;
    expect(content).not.toContain("effect:");
  });

  test('includes default story export', () => {
    const files = generateStorybookStories([makeIconInput('TestIcon')]);
    expect(files[0]!.contents).toContain('export const Default: Story = {};');
  });
});
