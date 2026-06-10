/**
 * A4 — structured Figma import error codes
 * (docs_canonical/IMPROVEMENT_BACKLOG.md).
 *
 * The import dialog distinguishes "fix your token" from "wait and
 * retry" via the `code` field the proxy route forwards. These tests pin
 * the upstream-status → code classification.
 */
import { describe, expect, test } from 'bun:test';

import {
  FigmaApiError,
  figmaErrorFromStatus,
} from '../lib/import/adapters/figma-source';

describe('figmaErrorFromStatus', () => {
  test('401 and 403 classify as auth_invalid', () => {
    for (const status of [401, 403]) {
      const error = figmaErrorFromStatus(status, 'denied');
      expect(error).toBeInstanceOf(FigmaApiError);
      expect(error.code).toBe('auth_invalid');
      expect(error.upstreamStatus).toBe(status);
    }
  });

  test('429 classifies as rate_limited', () => {
    const error = figmaErrorFromStatus(429, 'slow down');
    expect(error.code).toBe('rate_limited');
    expect(error.upstreamStatus).toBe(429);
  });

  test('other statuses classify as upstream_error and keep the detail', () => {
    for (const status of [400, 404, 500, 502]) {
      const error = figmaErrorFromStatus(status, 'detail text');
      expect(error.code).toBe('upstream_error');
      expect(error.message).toContain(String(status));
      expect(error.message).toContain('detail text');
    }
  });
});
