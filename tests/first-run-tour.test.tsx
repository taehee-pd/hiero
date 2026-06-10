/**
 * B2 — first-run walkthrough (docs_canonical/IMPROVEMENT_BACKLOG.md).
 *
 * Contract: shows once for a fresh profile, Esc (or Skip/Done/×)
 * dismisses permanently via localStorage, and stepping reaches the end.
 */
import './setup/happy-dom';
import './setup/react';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';

import { FirstRunTour, TOUR_DISMISSED_KEY } from '@/components/editor/FirstRunTour';

beforeEach(() => {
  window.localStorage.removeItem(TOUR_DISMISSED_KEY);
});

afterEach(() => {
  cleanup();
  window.localStorage.removeItem(TOUR_DISMISSED_KEY);
});

test('shows for a fresh profile', async () => {
  const { findByTestId } = render(<FirstRunTour />);
  expect(await findByTestId('first-run-tour')).toBeInTheDocument();
});

test('does not show when previously dismissed', () => {
  window.localStorage.setItem(TOUR_DISMISSED_KEY, '1');
  const { queryByTestId } = render(<FirstRunTour />);
  expect(queryByTestId('first-run-tour')).toBeNull();
});

test('Escape dismisses and persists', async () => {
  const { findByTestId, queryByTestId } = render(<FirstRunTour />);
  await findByTestId('first-run-tour');
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });
  expect(queryByTestId('first-run-tour')).toBeNull();
  expect(window.localStorage.getItem(TOUR_DISMISSED_KEY)).toBe('1');
});

test('Next steps through to Done, which dismisses permanently', async () => {
  const { findByTestId, getByRole, queryByRole, queryByTestId } = render(<FirstRunTour />);
  await findByTestId('first-run-tour');
  // Walk the steps: Next until the label flips to Done, then Done.
  let guard = 0;
  while (queryByRole('button', { name: 'Next' }) && guard < 10) {
    fireEvent.click(getByRole('button', { name: 'Next' }));
    guard += 1;
  }
  fireEvent.click(getByRole('button', { name: 'Done' }));
  expect(queryByTestId('first-run-tour')).toBeNull();
  expect(window.localStorage.getItem(TOUR_DISMISSED_KEY)).toBe('1');
});
