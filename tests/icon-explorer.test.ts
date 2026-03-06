import { describe, expect, test } from 'bun:test';
import { filterIconsByQuery } from '../components/explorer/ExplorerShell';

const icons = [
  { id: 'icon-chevron', name: 'Chevron Right', category: 'navigation', tags: ['arrow', 'right'] },
  { id: 'icon-play', name: 'Play', category: 'media', tags: ['video'] },
];

describe('icon explorer filtering', () => {
  test('matches by name/id/category/tag', () => {
    expect(filterIconsByQuery(icons, 'chev')).toHaveLength(1);
    expect(filterIconsByQuery(icons, 'icon-play')).toHaveLength(1);
    expect(filterIconsByQuery(icons, 'media')).toHaveLength(1);
    expect(filterIconsByQuery(icons, 'arrow')).toHaveLength(1);
  });

  test('returns all icons for empty query', () => {
    expect(filterIconsByQuery(icons, '   ')).toHaveLength(2);
  });
});
