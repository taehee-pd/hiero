import { describe, expect, test } from 'bun:test';
import { buildChangelog } from '../lib/integrations/github/sync-icons';

describe('github sync changelog', () => {
  test('formats changelog sections and counts', () => {
    const changelog = buildChangelog({
      added: ['packages/icons/src/NewIcon.tsx'],
      updated: ['packages/icons/src/OldIcon.tsx'],
      removed: ['packages/icons/src/RemovedIcon.tsx'],
    });

    expect(changelog).toContain('## Icon Sync Summary');
    expect(changelog).toContain('- Added: 1');
    expect(changelog).toContain('- Updated: 1');
    expect(changelog).toContain('- Removed: 1');
    expect(changelog).toContain('### Added');
    expect(changelog).toContain('- `packages/icons/src/NewIcon.tsx`');
    expect(changelog).toContain('### Updated');
    expect(changelog).toContain('- `packages/icons/src/OldIcon.tsx`');
    expect(changelog).toContain('### Removed');
    expect(changelog).toContain('- `packages/icons/src/RemovedIcon.tsx`');
  });

  test('renders empty sections with fallback marker', () => {
    const changelog = buildChangelog({ added: [], updated: [], removed: [] });

    expect(changelog).toContain('### Added');
    expect(changelog).toContain('### Updated');
    expect(changelog).toContain('### Removed');
    expect(changelog.match(/- _\(none\)_/g)?.length).toBe(3);
  });
});
