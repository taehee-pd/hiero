// React test setup — imported EXPLICITLY by any test file that renders
// React components. Do NOT make this a bunfig preload: happy-dom's
// DOMParser breaks tests/svg-sanitizer.test.ts and the raw-svg-adapter
// suite. See bunfig.toml.
//
// Ordering is load-bearing. Import `./happy-dom` BEFORE this file (or
// have it side-effect-imported here) so the DOM is wired up before any
// @testing-library/* module evaluates. @testing-library/dom captures
// document.body references at its own init time and will silently fall
// back to throwing helpers if document is undefined then.

import './happy-dom';

import { expect } from 'bun:test';
import * as matchers from '@testing-library/jest-dom/matchers';

// bun:test's expect.extend has a narrower signature than jest-dom ships.
// The matchers themselves are functionally identical at runtime; double-
// casting through `unknown` sidesteps the structural incompatibility
// without violating the repo-wide no-explicit-any rule.
expect.extend(matchers as unknown as Parameters<typeof expect.extend>[0]);
