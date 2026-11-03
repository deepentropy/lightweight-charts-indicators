/**
 * Unit tests for the chart context: the optional third argument of calculate(bars, inputs, chart).
 */

import { describe, it, expect } from 'vitest';
import {
  indicatorRegistry, mintickOf, timezoneOf, tickeridOf, tickerOf, symbolTypeOf, currencyOf, foregroundColorOf,
  backgroundColorOf, lastBarConfirmedOf, nowOf, visibleRangeOf, basecurrencyOf, rootOf,
} from '../../src/index';
import { makeBars } from './community-top100.helpers';
import { fixtureContext } from './community-other-symbols.helpers';

describe('chart context helpers', () => {
  it('give the fallbacks without a context', () => {
    expect(mintickOf()).toBe(0.01);
    expect(timezoneOf()).toBe('Etc/UTC');
    expect(tickeridOf()).toBe('');
    expect(tickerOf()).toBe('');
    expect(symbolTypeOf()).toBe('');
    expect(currencyOf()).toBe('USD');
    expect(foregroundColorOf()).toBe('#DBDBDB');
    expect(backgroundColorOf()).toBe('#0F0F0F');
    expect(lastBarConfirmedOf()).toBe(true);
    expect(Math.abs(nowOf() - Date.now())).toBeLessThan(1000);
  });

  it('give the values of the context', () => {
    const chart = {
      mintick: 1, timezone: 'America/New_York', tickerid: 'NASDAQ:AAPL', symbolType: 'stock', currency: 'EUR',
      foregroundColor: '#000000', backgroundColor: '#FFFFFF', lastBarConfirmed: false, now: 123,
    };
    expect(mintickOf(chart)).toBe(1);
    expect(timezoneOf(chart)).toBe('America/New_York');
    expect(tickeridOf(chart)).toBe('NASDAQ:AAPL');
    expect(tickerOf(chart)).toBe('AAPL');
    expect(symbolTypeOf(chart)).toBe('stock');
    expect(currencyOf(chart)).toBe('EUR');
    expect(foregroundColorOf(chart)).toBe('#000000');
    expect(backgroundColorOf(chart)).toBe('#FFFFFF');
    expect(lastBarConfirmedOf(chart)).toBe(false);
    expect(nowOf(chart)).toBe(123);
  });

  it('take the tick from minmove / pricescale', () => {
    expect(mintickOf({ minmove: 25, pricescale: 100 })).toBe(0.25);
  });

  it('give the base currency and root of the context, else derive them from the ticker', () => {
    expect(basecurrencyOf()).toBe('');
    expect(rootOf()).toBe('');
    // the values of the context win (CME:BTC1!: base BTC, root BTC)
    const btcFutures = { tickerid: 'CME:BTC1!', symbolType: 'futures', currency: 'USD', basecurrency: 'BTC', root: 'BTC' };
    expect(basecurrencyOf(btcFutures)).toBe('BTC');
    expect(rootOf(btcFutures)).toBe('BTC');
    expect(basecurrencyOf({ basecurrency: '', tickerid: 'BINANCE:BTCUSDT.P', symbolType: 'crypto', currency: 'USDT' })).toBe('');
    // without them: a crypto or forex pair without ".P" and its quote currency; a futures ticker without its contract
    expect(basecurrencyOf({ tickerid: 'BINANCE:BTCUSDT.P', symbolType: 'crypto', currency: 'USDT' })).toBe('BTC');
    expect(basecurrencyOf({ tickerid: 'FX:EURUSD', symbolType: 'forex', currency: 'USD' })).toBe('EUR');
    expect(basecurrencyOf({ tickerid: 'NASDAQ:AAPL', symbolType: 'stock', currency: 'USD' })).toBe('');
    expect(rootOf({ tickerid: 'CME_MINI:ES1!', symbolType: 'futures' })).toBe('ES');
    expect(rootOf({ tickerid: 'CME_MINI:ESH2025', symbolType: 'futures' })).toBe('ES');
    expect(rootOf({ tickerid: 'NASDAQ:AAPL', symbolType: 'stock' })).toBe('AAPL');
  });
});

describe('calculate(bars, inputs, chart)', () => {
  const bars = makeBars(3200, 86400);
  const entry = indicatorRegistry.find((e) => e.id === 'volume-profile-fixed-range')!;
  const pocText = (result: any): string => result.labels[0].text;

  it('uses the fallback tick without a context, and an empty context changes nothing', () => {
    const plain = entry.calculate(bars, {});
    expect(pocText(plain)).toMatch(/^POC: \d+\.\d\d$/);
    expect(entry.calculate(bars, {}, {})).toEqual(plain);
  });

  it('writes prices with the symbol tick of the context', () => {
    expect(pocText(entry.calculate(bars, {}, { mintick: 1 }))).toMatch(/^POC: \d+$/);
  });

  it('accepts a context in every registry entry (the argument is optional)', () => {
    const sma = indicatorRegistry.find((e) => e.id === 'sma')!;
    expect(sma.calculate(bars, {}, { mintick: 1, timezone: 'America/New_York' })).toEqual(sma.calculate(bars, {}));
  });
});

describe('visible chart range', () => {
  const bars = makeBars(3200, 86400);
  const ms = (i: number) => bars[i].time * 1000;

  it('is all the bars without a context', () => {
    expect(visibleRangeOf(bars)).toEqual({ left: 0, right: 3199, leftTime: ms(0), rightTime: ms(3199) });
  });

  it('gives the bars of the visible times, and takes a time between two bars as the bar inside the range', () => {
    const chart = { leftVisibleBarTime: ms(2900), rightVisibleBarTime: ms(3100) };
    expect(visibleRangeOf(bars, chart)).toMatchObject({ left: 2900, right: 3100 });
    expect(visibleRangeOf(bars, { leftVisibleBarTime: ms(2900) + 1, rightVisibleBarTime: ms(3100) + 1 }))
      .toMatchObject({ left: 2901, right: 3100 });
  });

  const flagged = indicatorRegistry.filter((e) => e.usesVisibleRange).map((e) => e.id).sort();

  it('flags the indicators that read it', () => {
    expect(flagged).toEqual([
      'liquidity-price-depth-chart', 'open-interest-suite-by-leviathan', 'order-blocks-volume-delta-3d-flux-charts',
      'signal-table-autofib-sma-ema-rsi-atr-vol', 'supply-and-demand-visible-range', 'support-resistance-channels-mtf',
      'support-resistance-classification', 'visible-average-price', 'volume-open-interest-footprint-by-leviathan',
      'volume-profile-kv4coins', 'volume-profile-plus',
    ]);
  });

  it.each(flagged)('%s runs with a visible range and its output follows the range', (id) => {
    const entry = indicatorRegistry.find((e) => e.id === id)!;
    const inputs = id === 'volume-profile-kv4coins' ? { ...entry.defaultInputs, ...visibleRangeInput(entry) }
      : id === 'open-interest-suite-by-leviathan' ? { prof: true } : {};
    // the bars of other symbols, for the ports that read them
    const ctx = entry.requiredSymbols ? fixtureContext(bars.length) : {};
    const a = entry.calculate(bars, inputs, { ...ctx, leftVisibleBarTime: ms(2900), rightVisibleBarTime: ms(3199) });
    const b = entry.calculate(bars, inputs, { ...ctx, leftVisibleBarTime: ms(2000), rightVisibleBarTime: ms(2400) });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

/** The bool input that switches the visible range on in an indicator where it is off by default */
function visibleRangeInput(entry: { inputConfig: Array<{ id: string; title?: string; type: string }> }): Record<string, boolean> {
  const input = entry.inputConfig.find((c) => c.type === 'bool' && /visible/i.test(c.title ?? ''));
  return input ? { [input.id]: true } : {};
}
