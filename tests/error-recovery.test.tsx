/**
 * A1 — crash recovery screen (docs_canonical/IMPROVEMENT_BACKLOG.md).
 *
 * `app/error.tsx` / `app/global-error.tsx` render this screen instead
 * of a blank document when a React render crashes. The contract:
 * reassure that auto-saved work survives, offer Try again / Reload,
 * and expose a copyable error digest for bug reports.
 */
import './setup/happy-dom';
import './setup/react';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { ErrorRecoveryScreen } from '@/components/error-recovery';

afterEach(() => {
  cleanup();
});

function makeError(message = 'boom', digest?: string): Error & { digest?: string } {
  const error = new Error(message) as Error & { digest?: string };
  if (digest) error.digest = digest;
  return error;
}

test('renders the crash copy with the auto-save reassurance', () => {
  const { getByRole, getByText } = render(
    <ErrorRecoveryScreen error={makeError()} reset={() => {}} />,
  );
  expect(getByRole('alert')).toBeInTheDocument();
  expect(
    getByRole('heading', { name: /hit an unexpected error/i }),
  ).toBeInTheDocument();
  expect(getByText(/auto-saved to this browser/i)).toBeInTheDocument();
});

test('"Try again" invokes the boundary reset', () => {
  let resetCalls = 0;
  const { getByRole } = render(
    <ErrorRecoveryScreen
      error={makeError()}
      reset={() => {
        resetCalls += 1;
      }}
    />,
  );
  fireEvent.click(getByRole('button', { name: 'Try again' }));
  expect(resetCalls).toBe(1);
});

test('exposes the error message and digest in the details disclosure', () => {
  const { getByText } = render(
    <ErrorRecoveryScreen error={makeError('kaboom', 'abc123')} reset={() => {}} />,
  );
  expect(getByText(/kaboom/)).toBeInTheDocument();
  expect(getByText(/abc123/)).toBeInTheDocument();
});

test('offers a reload action', () => {
  const { getByRole } = render(
    <ErrorRecoveryScreen error={makeError()} reset={() => {}} />,
  );
  expect(getByRole('button', { name: 'Reload Hiero' })).toBeInTheDocument();
});
