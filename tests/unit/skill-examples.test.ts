/**
 * The agent guide (skills/lightweight-charts-indicators): every example runs on fixed bars and gives sane output, and
 * every file the guide links to exists. When the API changes, this fails instead of the guide going stale.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import type { Bar, FillData, IndicatorResult, MarkerData } from 'oakscriptjs';
import { indicatorRegistry, type IndicatorRegistryEntry } from '../../src/index';
import { makeBars } from './community-top100.helpers';
import { otherBars } from './community-other-symbols.helpers';
import * as trendEma from '../../skills/lightweight-charts-indicators/examples/trend-ema';
import * as williamsR from '../../skills/lightweight-charts-indicators/examples/smoothed-williams-r';
import * as atrChannel from '../../skills/lightweight-charts-indicators/examples/atr-channel';
import {
  findIndicator,
  lastValues,
  runIndicator,
  runWithOtherSymbols,
  searchIndicators,
  valueAt,
} from '../../skills/lightweight-charts-indicators/examples/call-indicator';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SKILL = join(ROOT, 'skills/lightweight-charts-indicators');
const bars = makeBars(500, 86400) as Bar[];
const finite = (points: { value: number }[]) => points.filter((p) => Number.isFinite(p.value));

const EXAMPLES: Record<string, { registryEntry: IndicatorRegistryEntry; defaultInputs: object }> = {
  'trend-ema': trendEma,
  'smoothed-williams-r': williamsR,
  'atr-channel': atrChannel,
};

describe('skill example indicators', () => {
  it('cover every example file', () => {
    const files = readdirSync(join(SKILL, 'examples')).filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, ''));
    expect(files.sort()).toEqual([...Object.keys(EXAMPLES), 'call-indicator'].sort());
  });

  describe.each(Object.entries(EXAMPLES))('%s', (id, mod) => {
    const entry = mod.registryEntry;

    it('has a registry entry consistent with its module', () => {
      expect(entry.id).toBe(id);
      expect(indicatorRegistry.some((e) => e.id === id), 'id free in the registry').toBe(false);
      expect(entry.overlay).toBe(entry.metadata.overlay);
      expect(entry.inputConfig.map((c) => c.id).sort()).toEqual(Object.keys(mod.defaultInputs).sort());
      for (const c of entry.inputConfig) expect(c.defval, c.id).toEqual(entry.defaultInputs[c.id]);
    });

    it('gives one point per bar for every declared plot', () => {
      const result = entry.calculate(bars, {}) as IndicatorResult;
      expect(Object.keys(result.plots).sort()).toEqual(entry.plotConfig.map((p) => p.id).sort());
      for (const p of entry.plotConfig) {
        const points = result.plots[p.id];
        expect(points.map((x) => x.time), p.id).toEqual(bars.map((b) => b.time));
        expect(finite(points).length, p.id).toBeGreaterThan(bars.length - 50);
      }
    });

    it('fills and markers name declared plots, hlines and shapes', () => {
      const result = entry.calculate(bars, {}) as IndicatorResult;
      const ends = new Set([...entry.plotConfig.map((p) => p.id), ...(entry.hlineConfig ?? []).map((h) => h.id)]);
      for (const f of [...(entry.fillConfig ?? []), ...((result.fills ?? []) as FillData[])]) {
        expect(ends.has(String(f.plot1)) && ends.has(String(f.plot2)), `${f.plot1} / ${f.plot2}`).toBe(true);
      }
      const fillIds = new Set((entry.fillConfig ?? []).map((f) => f.id));
      for (const f of result.fills ?? []) expect(fillIds.has(f.id!), `fill ${f.id}`).toBe(true);
      const shapeIds = new Set((entry.shapeConfig ?? []).map((s) => s.id));
      const times = new Set(bars.map((b) => b.time));
      for (const m of (result.markers ?? []) as MarkerData[]) {
        expect(shapeIds.has(m.id!), `marker ${m.id}`).toBe(true);
        expect(times.has(m.time)).toBe(true);
      }
    });

    it('follows its inputs', () => {
      const [first] = entry.inputConfig.filter((c) => c.type === 'int');
      const a = entry.calculate(bars, {}) as IndicatorResult;
      const b = entry.calculate(bars, { [first.id]: (first.defval as number) + 5 }) as IndicatorResult;
      expect(b.plots.plot0).not.toEqual(a.plots.plot0);
    });
  });

  it('trend-ema stays inside the price range and uses its two colours', () => {
    const points = finite(trendEma.calculate(bars).plots.plot0);
    const lows = Math.min(...bars.map((b) => b.low));
    const highs = Math.max(...bars.map((b) => b.high));
    for (const p of points) expect(p.value).toBeGreaterThanOrEqual(lows), expect(p.value).toBeLessThanOrEqual(highs);
    expect(new Set(points.map((p: { color?: string }) => p.color))).toEqual(new Set(trendEma.plotConfig[0].palette));
  });

  it('smoothed-williams-r stays between -100 and 0', () => {
    const result = williamsR.calculate(bars);
    for (const id of ['plot0', 'plot1']) {
      for (const p of finite(result.plots[id])) {
        expect(p.value).toBeGreaterThanOrEqual(-100);
        expect(p.value).toBeLessThanOrEqual(0);
      }
    }
  });

  it('atr-channel orders its bands, tints one zone per bar and marks breakouts', () => {
    const result = atrChannel.calculate(bars);
    const [basis, upper, lower] = ['plot0', 'plot1', 'plot2'].map((id) => result.plots[id]);
    for (let i = 0; i < bars.length; i++) {
      if (!Number.isFinite(upper[i].value)) continue;
      expect(upper[i].value).toBeGreaterThan(basis[i].value);
      expect(lower[i].value).toBeLessThan(basis[i].value);
    }
    const [up, down] = result.fills!;
    for (let i = 0; i < bars.length; i++) {
      expect(up.colors![i] !== 'transparent' && down.colors![i] !== 'transparent', `bar ${i}`).toBe(false);
    }
    expect(result.markers!.length).toBeGreaterThan(0);
    expect(atrChannel.calculate(bars, { showBreakouts: false }).markers).toEqual([]);
  });
});

describe('skill example: calling indicators', () => {
  it('finds entries by id and by text', () => {
    expect(findIndicator('rsi').overlay).toBe(false);
    expect(() => findIndicator('no-such-indicator')).toThrow();
    expect(searchIndicators('bollinger', 'standard').map((e) => e.id)).toContain('bb');
    expect(searchIndicators('engulfing', 'candlestick').length).toBeGreaterThan(0);
  });

  it('runs an indicator with replaced inputs and reads its plots', () => {
    const rsi = findIndicator('rsi');
    const result = runIndicator(rsi, bars, { length: 7 });
    const values = lastValues(rsi, result);
    expect(Object.keys(values)).toEqual(rsi.plotConfig.map((p) => p.title));
    expect(values.RSI).toBeGreaterThan(0);
    expect(values.RSI).toBeLessThan(100);
    expect(valueAt(result, 'plot0', bars[bars.length - 1].time)).toBe(values.RSI);
    expect(runIndicator(rsi, bars).plots.plot0).not.toEqual(result.plots.plot0);
  });

  it('loads the bars of other symbols an indicator asks for', async () => {
    const entry = findIndicator('correlation-coefficient');
    const loaded: string[] = [];
    const result = await runWithOtherSymbols(entry, bars, {}, async (symbol, timeframe) => {
      loaded.push(`${symbol}|${timeframe}`);
      return otherBars({ symbol, timeframe }, bars.length) as Bar[];
    }, { timeframe: '1D', timezone: 'Etc/UTC', session: '24x7' });
    expect(loaded.length).toBeGreaterThan(0);
    expect(finite(result.plots[entry.plotConfig[0].id]).length).toBeGreaterThan(0);
  });
});

describe('skill documents', () => {
  const docs = [join(SKILL, 'SKILL.md'), ...readdirSync(join(SKILL, 'references')).map((f) => join(SKILL, 'references', f)), join(ROOT, 'AGENTS.md')];

  it('has the Agent Skills frontmatter', () => {
    const text = readFileSync(join(SKILL, 'SKILL.md'), 'utf-8');
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
    expect(front).toMatch(/^name: lightweight-charts-indicators$/m);
    expect(front).toMatch(/^description: .{40,}/m);
  });

  it.each(docs)('links only to files that exist (%s)', (doc) => {
    const text = readFileSync(doc, 'utf-8');
    for (const [, target] of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      if (/^[a-z]+:/i.test(target)) continue;
      expect(existsSync(resolve(dirname(doc), target)), `${doc} -> ${target}`).toBe(true);
    }
  });
});
