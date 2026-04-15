// Type augmentation for bun:test's `expect` so tests can use jest-dom
// matchers (toBeInTheDocument, toHaveTextContent, toHaveAttribute, etc.)
// without TypeScript crying.
//
// Runtime setup lives in `tests/setup/react.ts` which calls
// `expect.extend(matchers)` from `@testing-library/jest-dom/matchers`.
// That makes the matchers work at runtime, but bun's `Matchers<T>`
// interface is strict so tsc doesn't know about them.
//
// This file teaches tsc about the runtime extension. It's a .d.ts so it
// participates in type checking for every file under the `tests/`
// directory (included via tsconfig.json's `include: ["**/*.ts"]`).

import 'bun:test';

declare module 'bun:test' {
  interface Matchers<T> {
    // Presence
    toBeInTheDocument(): T;
    toBeVisible(): T;
    toBeEmptyDOMElement(): T;

    // Attributes / DOM state
    toHaveAttribute(attr: string, value?: string | RegExp): T;
    toHaveClass(...classNames: Array<string | RegExp>): T;
    toHaveStyle(css: Record<string, unknown> | string): T;
    toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace: boolean }): T;
    toHaveValue(value?: string | string[] | number | null): T;
    toHaveDisplayValue(value: string | RegExp | Array<string | RegExp>): T;
    toHaveFocus(): T;
    toHaveAccessibleName(name?: string | RegExp): T;
    toHaveAccessibleDescription(description?: string | RegExp): T;
    toHaveRole(role: string): T;

    // Form / interactive state
    toBeChecked(): T;
    toBeDisabled(): T;
    toBeEnabled(): T;
    toBeInvalid(): T;
    toBeRequired(): T;
    toBeValid(): T;
    toBePartiallyChecked(): T;

    // Containment
    toContainElement(element: Element | null): T;
    toContainHTML(htmlText: string): T;
  }

  // Async counterparts — jest-dom matchers are sync under the hood but
  // bun:test's AsyncMatchers is a separate type, and tests that do
  // `await expect(...).toBeInTheDocument()` (via findBy* awaited patterns)
  // read through the async interface.
  interface AsyncMatchers<T> {
    toBeInTheDocument(): Promise<T>;
    toBeVisible(): Promise<T>;
    toHaveAttribute(attr: string, value?: string | RegExp): Promise<T>;
    toHaveClass(...classNames: Array<string | RegExp>): Promise<T>;
    toHaveTextContent(text: string | RegExp): Promise<T>;
    toHaveValue(value?: string | string[] | number | null): Promise<T>;
    toHaveFocus(): Promise<T>;
    toBeChecked(): Promise<T>;
    toBeDisabled(): Promise<T>;
    toBeEnabled(): Promise<T>;
  }
}
