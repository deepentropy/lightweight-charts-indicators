/**
 * Unit tests for the ports of the most liked community scripts (Pine v1 to v6 sources, most of them with drawings).
 * Each port runs on 3,200 daily bars and on 4,000 15-minute bars: the counts of every output must stay the same,
 * and a port that stops with the runtime error of its original must keep throwing it.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { indicatorRegistry } from '../../src/index';
import { makeBars, summarize, NOW } from './community-top100.helpers';

type Expected = Record<string, Record<'daily' | 'm15', Record<string, unknown>>>;
const expected: Expected = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'community-top100.expected.json'), 'utf-8'),
);
const fixtures = { daily: makeBars(3200, 86400), m15: makeBars(4000, 900) };

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterAll(() => {
  vi.useRealTimers();
});

describe.each(Object.keys(expected))('%s', (id) => {
  const entry = indicatorRegistry.find((e) => e.id === id);

  it('is in the registry with the overlay of its port', () => {
    expect(entry).toBeDefined();
    expect(entry!.group).toBe('community');
    expect(entry!.overlay).toBe(entry!.metadata.overlay);
  });

  it.each(['daily', 'm15'] as const)('gives the same outputs on the %s bars', (name) => {
    const want = expected[id][name];
    const bars = fixtures[name];
    if ('error' in want) {
      expect(() => entry!.calculate(bars as any, {})).toThrow(want.error as string);
      return;
    }
    const result: any = entry!.calculate(bars as any, {});
    expect(summarize(result)).toEqual(want);
    for (const points of Object.values(result.plots as Record<string, Array<{ time: number }>>)) {
      for (let i = 1; i < points.length; i++) expect(points[i].time).toBeGreaterThan(points[i - 1].time);
    }
  });

  it('draws something on at least one of the two fixtures', () => {
    const drawn = (['daily', 'm15'] as const).some((name) => {
      const want = expected[id][name];
      if ('error' in want) return false;
      const { plots, ...others } = want as { plots: Record<string, number> };
      return Object.values(plots).some((n) => n > 0) || Object.keys(others).length > 0;
    });
    expect(drawn).toBe(true);
  });
});
