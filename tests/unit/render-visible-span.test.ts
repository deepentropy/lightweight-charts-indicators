import { describe, expect, it } from 'vitest';
import { visibleSpan } from '../../src/render/primitives';

const scale = (range: { from: unknown; to: unknown } | null) => ({ getVisibleRange: () => range }) as never;
const data = Array.from({ length: 100 }, (_, i) => ({ time: 1000 + i * 10 }));

describe('visibleSpan', () => {
  it('gives the points of the visible bars with two more on each side', () => {
    expect(visibleSpan(data, scale({ from: 1200, to: 1300 }))).toEqual([18, 33]);
  });

  it('stops at the ends of the data', () => {
    expect(visibleSpan(data, scale({ from: 900, to: 1010 }))).toEqual([0, 4]);
    expect(visibleSpan(data, scale({ from: 1950, to: 2500 }))).toEqual([93, 100]);
  });

  it('gives every point when the range is not known or not in seconds', () => {
    expect(visibleSpan(data, scale(null))).toEqual([0, 100]);
    expect(visibleSpan(data, scale({ from: '2026-01-01', to: '2026-02-01' }))).toEqual([0, 100]);
  });
});
