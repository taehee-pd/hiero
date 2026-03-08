const { parse, HTMLElement } = require('next/dist/compiled/node-html-parser') as {
  parse: (
    input: string,
    options?: Record<string, unknown>,
  ) => {
    querySelector: (selector: string) => unknown;
  };
  HTMLElement: { prototype: Record<string, unknown> };
};

if (!('children' in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, 'children', {
    get(this: { childNodes: Array<{ nodeType?: number }> }) {
      return this.childNodes.filter((child) => child.nodeType === 1);
    },
  });
}

const originalGetAttribute = HTMLElement.prototype.getAttribute as (
  name: string,
) => string | undefined;
HTMLElement.prototype.getAttribute = function getAttribute(
  this: Record<string, unknown>,
  name: string,
): string | null {
  const value = originalGetAttribute.call(this, name);
  return value === undefined ? null : value;
};

if (typeof globalThis.DOMParser === 'undefined') {
  class TestDOMParser {
    parseFromString(svgString: string): {
      documentElement: Element;
      querySelector: (selector: string) => Element | null;
    } {
      const root = parse(svgString, {
        lowerCaseTagName: true,
        comment: true,
      });
      const documentElement = root.querySelector('svg') as Element | null;
      return {
        documentElement: documentElement as Element,
        querySelector: (selector: string) =>
          root.querySelector(selector) as Element | null,
      };
    }
  }

  globalThis.DOMParser = TestDOMParser as unknown as typeof DOMParser;
}

export {};
