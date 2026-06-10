/**
 * A2 — degraded-storage banner (docs_canonical/IMPROVEMENT_BACKLOG.md).
 *
 * The banner is invisible while persistence is durable and becomes a
 * persistent, non-dismissable warning the moment the ResilientAdapter
 * falls back to in-memory storage.
 */
import './setup/happy-dom';
import './setup/react';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { act, cleanup, render } from '@testing-library/react';

import { StorageStatusBanner } from '@/components/persistence/StorageStatusBanner';
import {
  markStorageDegraded,
  resetStorageStatusForTests,
} from '@/lib/persistence/storage-status';

beforeEach(() => {
  resetStorageStatusForTests();
});

afterEach(() => {
  cleanup();
  resetStorageStatusForTests();
});

test('renders nothing while storage is durable', () => {
  const { container } = render(<StorageStatusBanner />);
  expect(container.innerHTML).toBe('');
});

test('shows the warning once storage degrades', () => {
  const { getByRole } = render(<StorageStatusBanner />);
  act(() => {
    markStorageDegraded();
  });
  const banner = getByRole('alert');
  expect(banner).toBeInTheDocument();
  expect(banner.textContent).toContain('Browser storage is unavailable');
  expect(banner.textContent).toContain('Export your project file');
});
