import { describe, it, expect } from 'vitest';
import type { Bar } from 'oakscriptjs';
import { indicatorRegistry } from '../../src/index';
import { loadIndicator } from '../../src/loader';

function generateBars(count: number): Bar[] {
  const bars: Bar[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    price = Math.max(10, price + (Math.sin(i * 0.1) + Math.cos(i * 0.07)) * 2 + Math.sin(i * 1.7) * 3);
    bars.push({ time: 1700000000 + i * 60, open: price + (Math.sin(i * 0.5) > 0 ? 1 : -1), high: price + 2, low: price - 2, close: price, volume: 1000 + i });
  }
  return bars;
}

const json = (f: () => unknown): string => {
  try {
    return JSON.stringify(f());
  } catch (e) {
    return `throws ${String(e)}`;
  }
};

describe('loader', () => {
  it('gives every registry study, calculating as the registry does (src/indicator-modules.ts up to date)', async () => {
    const bars = generateBars(250);
    const differs: string[] = [];
    let compared = 0;
    for (const e of indicatorRegistry) {
      const l = await loadIndicator(e.id);
      if (!l) {
        differs.push(`${e.id}: not loaded`);
        continue;
      }
      if (!!l.createRun !== !!e.createRun) differs.push(`${e.id}: createRun`);
      const inputs = e.defaultInputs ?? {};
      const want = json(() => e.calculate(bars, inputs, {}));
      // a study whose result changes from one call to the next (clock-stamped) is not compared
      if (json(() => e.calculate(bars, inputs, {})) !== want) continue;
      compared++;
      if (json(() => l.calculate(bars, inputs, {})) !== want) differs.push(`${e.id}: calculate`);
      if (e.createRun && l.createRun) {
        const a = json(() => e.createRun!(inputs, {}).update(bars, {}));
        if (json(() => l.createRun!(inputs, {}).update(bars, {})) !== a) differs.push(`${e.id}: createRun result`);
      }
    }
    expect(differs).toEqual([]);
    expect(compared).toBeGreaterThan(1800);
    expect(await loadIndicator('no-such-study')).toBeNull();
  }, 600_000);
});
