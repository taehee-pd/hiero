/**
 * Standardized category taxonomy aligned with Apple SF Symbols categories.
 *
 * These categories are suggestions for organizing icons; the `Icon.category`
 * field remains a free-form `string` for backward compatibility.
 */
export const SF_SYMBOL_CATEGORIES = [
  'general',
  'communication',
  'weather',
  'objectsAndTools',
  'devices',
  'gaming',
  'connectivity',
  'transportation',
  'automotive',
  'accessibility',
  'privacyAndSecurity',
  'human',
  'home',
  'fitness',
  'nature',
  'editing',
  'textFormatting',
  'media',
  'keyboard',
  'commerce',
  'time',
  'health',
  'shapes',
  'arrows',
  'indices',
  'math',
  'custom',
] as const;

export type SFSymbolCategory = (typeof SF_SYMBOL_CATEGORIES)[number];

/** Keyword-to-category mapping for common free-text strings. */
const KEYWORD_MAP: Array<{ keywords: string[]; category: SFSymbolCategory }> = [
  { keywords: ['general', 'misc', 'other'], category: 'general' },
  { keywords: ['communication', 'chat', 'message', 'mail', 'email', 'phone', 'call'], category: 'communication' },
  { keywords: ['weather', 'cloud', 'sun', 'rain', 'snow', 'wind', 'temperature'], category: 'weather' },
  { keywords: ['object', 'tool', 'wrench', 'hammer', 'scissors', 'pen', 'pencil'], category: 'objectsAndTools' },
  { keywords: ['device', 'computer', 'laptop', 'desktop', 'monitor', 'phone', 'tablet', 'watch', 'tv'], category: 'devices' },
  { keywords: ['gaming', 'game', 'controller', 'joystick'], category: 'gaming' },
  { keywords: ['connectivity', 'wifi', 'bluetooth', 'network', 'signal', 'antenna'], category: 'connectivity' },
  { keywords: ['transportation', 'transport', 'car', 'bus', 'train', 'airplane', 'plane', 'bicycle', 'bike'], category: 'transportation' },
  { keywords: ['automotive', 'vehicle', 'engine', 'fuel', 'gauge'], category: 'automotive' },
  { keywords: ['accessibility', 'accessible', 'a11y'], category: 'accessibility' },
  { keywords: ['privacy', 'security', 'lock', 'shield', 'key', 'password'], category: 'privacyAndSecurity' },
  { keywords: ['human', 'person', 'people', 'user', 'body', 'hand', 'figure'], category: 'human' },
  { keywords: ['home', 'house', 'building', 'room'], category: 'home' },
  { keywords: ['fitness', 'sport', 'exercise', 'workout', 'run', 'walk'], category: 'fitness' },
  { keywords: ['nature', 'leaf', 'tree', 'flower', 'plant', 'animal', 'water', 'mountain'], category: 'nature' },
  { keywords: ['editing', 'edit', 'crop', 'rotate', 'filter', 'adjust', 'slider'], category: 'editing' },
  { keywords: ['text', 'formatting', 'font', 'bold', 'italic', 'underline', 'paragraph', 'alignment'], category: 'textFormatting' },
  { keywords: ['media', 'play', 'pause', 'stop', 'record', 'video', 'audio', 'music', 'camera', 'photo', 'image', 'speaker', 'mic', 'microphone'], category: 'media' },
  { keywords: ['keyboard', 'key', 'type', 'input'], category: 'keyboard' },
  { keywords: ['commerce', 'cart', 'bag', 'shop', 'store', 'purchase', 'payment', 'money', 'dollar', 'credit'], category: 'commerce' },
  { keywords: ['time', 'clock', 'timer', 'calendar', 'date', 'schedule', 'alarm'], category: 'time' },
  { keywords: ['health', 'medical', 'heart', 'pulse', 'pill', 'hospital', 'cross'], category: 'health' },
  { keywords: ['shape', 'circle', 'square', 'rectangle', 'triangle', 'star', 'polygon', 'hexagon'], category: 'shapes' },
  { keywords: ['arrow', 'direction', 'chevron', 'caret', 'pointer', 'cursor'], category: 'arrows' },
  { keywords: ['index', 'number', 'letter', 'character', 'alphabet'], category: 'indices' },
  { keywords: ['math', 'plus', 'minus', 'multiply', 'divide', 'equal', 'percent', 'calculator'], category: 'math' },
];

/**
 * Map a free-text category string to the closest standardized SF Symbol category.
 *
 * Uses simple lowercase keyword matching. Returns `'custom'` if no match is found.
 *
 * @example
 * ```ts
 * suggestCategory('shopping cart')   // 'commerce'
 * suggestCategory('Weather Icons')   // 'weather'
 * suggestCategory('my-custom-set')   // 'custom'
 * ```
 */
export function suggestCategory(input: string): SFSymbolCategory {
  const lower = input.toLowerCase();

  // Direct match against category names
  for (const cat of SF_SYMBOL_CATEGORIES) {
    if (lower === cat.toLowerCase()) return cat;
  }

  // Keyword match
  for (const { keywords, category } of KEYWORD_MAP) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) return category;
    }
  }

  return 'custom';
}
