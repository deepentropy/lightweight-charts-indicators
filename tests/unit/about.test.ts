/**
 * The help texts (src/about.json, the `./about` entry): one for every registry entry, short, plain text, no colour
 * codes. scripts/about/check.mjs also checks the names and numbers they give against the entry's code.
 */
import { describe, it, expect } from 'vitest';
import about from '../../src/about.json';
import { indicatorRegistry } from '../../src/index';

const texts = about as Record<string, { text: string; names: string[] }>;

describe('help texts', () => {
  it('every registry entry has one, and no other id does', () => {
    const ids = new Set(indicatorRegistry.map((e) => e.id));
    expect(indicatorRegistry.filter((e) => !texts[e.id]).map((e) => e.id)).toEqual([]);
    expect(Object.keys(texts).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('are 80 to 500 characters of plain text without colour codes', () => {
    const bad = Object.entries(texts).filter(([, a]) => a.text.length < 80 || a.text.length > 500 || /\*\*|`|#{2,}|#[0-9a-f]{6}\b/i.test(a.text));
    expect(bad.map(([id]) => id)).toEqual([]);
  });

});
