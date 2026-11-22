/**
 * Open Interest (standard) and the "Open Interest" profile of Market sessions and Volume profile: both read the
 * <SYMBOL>_OI series from the chart context.
 */
import { describe, it, expect } from 'vitest';
import type { Bar } from 'oakscriptjs';
import { MissingSymbolDataError } from 'oakscriptjs/script';
import { OpenInterest, requiredSymbols } from '../../src/standard/open-interest';
import { MarketSessionsVolumeProfile } from '../../src/community/market-sessions-volume-profile';
import type { ChartContext } from '../../src/chart-context';

const DAY = 86400;
const T0 = 1_700_006_400; // 15/11/2023 00:00 UTC

function days(n: number, f: (i: number) => [number, number, number, number]): Bar[] {
  return Array.from({ length: n }, (_, i) => {
    const [open, high, low, close] = f(i);
    return { time: T0 + i * DAY, open, high, low, close, volume: 100 };
  });
}

const price = days(10, (i) => [100 + i, 102 + i, 99 + i, 101 + i]);
const context = (series: Record<string, Bar[]>, extra: Partial<ChartContext> = {}): ChartContext => ({
  tickerid: 'NFO:NIFTYFUT', timeframe: '1D', timezone: 'Etc/UTC', session: '24x7', symbolType: 'futures',
  bars: (symbol, tf) => series[`${symbol}|${tf}`],
  symbolInfo: () => ({ timezone: 'Etc/UTC', session: '24x7' }),
  ...extra,
});

describe('Open Interest', () => {
  it('asks the <SYMBOL>_OI series on the chart timeframe', () => {
    expect(requiredSymbols({}, context({}))).toEqual([{ symbol: 'NFO:NIFTYFUT_OI', timeframe: '1D' }]);
    expect(() => OpenInterest.calculate(price, {}, context({}))).toThrow(MissingSymbolDataError);
  });

  it('draws a single-valued series as a step line coloured by its direction', () => {
    const oi = days(10, (i) => { const v = 1000 + (i % 3 === 2 ? -50 : 50) * i; return [v, v, v, v]; });
    const r = OpenInterest.calculate(price, {}, context({ 'NFO:NIFTYFUT_OI|1D': oi }));
    expect(r.plots.plot0.map((p) => p.value)).toEqual(oi.map((b) => b.close));
    expect(r.plots.plot0[1].color).toBe('#089981');
    expect(r.plots.plot0[2].color).toBe('#F23645');
    expect(r.plotCandles.oi).toEqual([]);
  });

  it('draws a series with open, high, low and close as candles', () => {
    const oi = days(10, (i) => [1000 + i, 1010 + i, 995 + i, 1005 + i]);
    const r = OpenInterest.calculate(price, {}, context({ 'NFO:NIFTYFUT_OI|1D': oi }));
    expect(r.plots.plot0.every((p) => isNaN(p.value))).toBe(true);
    expect(r.plotCandles.oi).toHaveLength(10);
    expect(r.plotCandles.oi[3]).toMatchObject({ open: 1003, high: 1013, low: 998, close: 1008, color: '#089981' });
  });

  it('reads a series without intraday bars on the daily timeframe', () => {
    const intraday = Array.from({ length: 48 }, (_, i) => {
      const t = T0 + 2 * DAY + i * 3600;
      return { time: t, open: 100, high: 101, low: 99, close: 100, volume: 1 };
    });
    const oi = days(5, (i) => { const v = 500 + i * 10; return [v, v, v, v]; });
    const ctx = context({ 'NFO:NIFTYFUT_OI|60': [] }, { timeframe: '60' });
    expect(() => OpenInterest.calculate(intraday, {}, ctx)).toThrow(MissingSymbolDataError);
    const r = OpenInterest.calculate(intraday, {}, context({ 'NFO:NIFTYFUT_OI|60': [], 'NFO:NIFTYFUT_OI|1D': oi }, { timeframe: '60' }));
    const values = r.plots.plot0.map((p) => p.value).filter((v) => !isNaN(v));
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((v) => oi.some((b) => b.close === v))).toBe(true);
  });

  it('stops with an error when the symbol has no open interest', () => {
    expect(() => OpenInterest.calculate(price, {}, context({ 'NFO:NIFTYFUT_OI|1D': [] }))).toThrow(/No open interest data for NFO:NIFTYFUT_OI/);
  });
});

describe('Market sessions and Volume profile: Open Interest', () => {
  it('asks the open interest series only for that data type, daily for a future on an intraday chart', () => {
    expect(MarketSessionsVolumeProfile.requiredSymbols({}, context({}))).toEqual([]);
    expect(MarketSessionsVolumeProfile.requiredSymbols({ volType: 'Open Interest' }, context({}, { timeframe: '5' })))
      .toEqual([{ symbol: 'NFO:NIFTYFUT_OI', timeframe: '1D' }]);
    expect(MarketSessionsVolumeProfile.requiredSymbols({ volType: 'Open Interest' }, context({}, { symbolType: 'crypto', timeframe: '5' })))
      .toEqual([{ symbol: 'NFO:NIFTYFUT_OI', timeframe: '5' }]);
  });

  it('builds the profile from the changes of the open interest', () => {
    const bars = days(60, (i) => [100 + (i % 5), 106 + (i % 5), 98 + (i % 5), 103 + (i % 5)]);
    const oi = days(60, (i) => { const v = 1000 + (i % 4 < 2 ? 1 : -1) * i; return [v, v, v, v]; });
    const ctx = context({ 'NFO:NIFTYFUT_OI|1D': oi }, { timeframe: '1D' });
    const r = MarketSessionsVolumeProfile.calculate(bars, { volType: 'Open Interest', sessionType: 'Weekly' }, ctx);
    expect(r.boxes.length).toBeGreaterThan(0);
    // Without the series (ignore_invalid_symbol): no rows
    const empty = MarketSessionsVolumeProfile.calculate(bars, { volType: 'Open Interest', sessionType: 'Weekly' }, context({ 'NFO:NIFTYFUT_OI|1D': [] }));
    expect(empty.boxes.length).toBeLessThan(r.boxes.length);
  });
});
