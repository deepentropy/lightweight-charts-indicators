/**
 * Unit tests for Wave 2 community indicators.
 *
 * Uses inline fixture data (250 bars) to accommodate indicators
 * that need long warmup periods (e.g. ATR(100)).
 */

import { describe, it, expect } from 'vitest';
import {
  AlphaTrend,
  HalfTrend,
  QQEMod,
  FollowLine,
  UTBot,
  HullSuite,
  OptimizedTrendTracker,
  TrendMagic,
  SSLChannel,
  MavilimW,
  CDCActionZone,
  TillsonT3,
  WaddahAttarExplosion,
  RipsterEMAClouds,
  PremierRSI,
  LaguerreRSI,
  RSICandles,
  ZeroLagMACD,
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Inline OHLCV fixture – 250 bars of synthetic trending-then-reverting data
// ---------------------------------------------------------------------------
function makeFixture(): Array<{
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> {
  const bars: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }> = [];

  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  let price = 100;
  for (let i = 0; i < 250; i++) {
    const drift = i < 125 ? 0.3 : -0.3;
    const noise = (rand() - 0.5) * 4;
    const open = price;
    const close = price + drift + noise;
    const high = Math.max(open, close) + rand() * 2;
    const low = Math.min(open, close) - rand() * 2;
    const volume = 500 + Math.floor(rand() * 1000);
    bars.push({ time: 1609459200 + i * 86400, open, high, low, close, volume });
    price = close;
  }
  return bars;
}

const bars = makeFixture();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validValues(result: any, plotKey = 'plot0') {
  return result.plots[plotKey]
    .map((p: any) => p.value)
    .filter((v: number) => !isNaN(v));
}

function assertShape(result: any, expectedPlots: string[], overlay: boolean) {
  expect(result.metadata).toBeDefined();
  expect(result.metadata.title).toBeTruthy();
  expect(result.metadata.shorttitle).toBeTruthy();
  expect(result.metadata.overlay).toBe(overlay);
  for (const key of expectedPlots) {
    expect(result.plots).toHaveProperty(key);
    const plot = result.plots[key];
    expect(plot).toHaveLength(bars.length);
    for (const p of plot) {
      expect(typeof p.time).toBe('number');
      expect(typeof p.value).toBe('number');
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AlphaTrend', () => {
  const result = AlphaTrend.calculate(bars) as any;

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });

  it('tracks price level (overlay)', () => {
    const vals = validValues(result);
    const avgClose = bars.reduce((s, b) => s + b.close, 0) / bars.length;
    const avg = vals.reduce((s: number, v: number) => s + v, 0) / vals.length;
    expect(Math.abs(avg - avgClose)).toBeLessThan(avgClose * 0.5);
  });

  it('produces buy/sell markers', () => {
    expect(Array.isArray(result.markers)).toBe(true);
    expect(result.markers.length).toBeGreaterThan(0);
    for (const m of result.markers) {
      expect(['aboveBar', 'belowBar']).toContain(m.position);
      expect(['arrowUp', 'arrowDown', 'labelUp', 'labelDown']).toContain(m.shape);
    }
  });

  it('has fill between plot0 and plot1', () => {
    expect(result.fills).toBeDefined();
    expect(result.fills.length).toBe(1);
    expect(result.fills[0].plot1).toBe('plot0');
    expect(result.fills[0].plot2).toBe('plot1');
  });
});

describe('HalfTrend', () => {
  const result = HalfTrend.calculate(bars) as any;

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });

  it('produces buy/sell markers on trend flips', () => {
    expect(Array.isArray(result.markers)).toBe(true);
    for (const m of result.markers) {
      expect(['aboveBar', 'belowBar']).toContain(m.position);
    }
  });

  it('has fills between HT and ATR bands', () => {
    expect(result.fills).toBeDefined();
    expect(result.fills.length).toBe(2);
  });
});

describe('QQEMod', () => {
  const result = QQEMod.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3'], false);
  });

  it('produces finite values in secondary RSI histogram', () => {
    const vals = validValues(result, 'plot1');
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });

  it('has zero hline', () => {
    expect(result.hlines).toBeDefined();
    expect(result.hlines!.length).toBe(1);
    expect(result.hlines![0].value).toBe(0);
  });
});

describe('FollowLine', () => {
  const result = FollowLine.calculate(bars) as any;

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });

  it('tracks price level (overlay)', () => {
    const vals = validValues(result);
    const avgClose = bars.reduce((s, b) => s + b.close, 0) / bars.length;
    const avg = vals.reduce((s: number, v: number) => s + v, 0) / vals.length;
    expect(Math.abs(avg - avgClose)).toBeLessThan(avgClose * 0.5);
  });

  it('produces buy/sell markers', () => {
    expect(Array.isArray(result.markers)).toBe(true);
    expect(result.markers.length).toBeGreaterThan(0);
    for (const m of result.markers) {
      expect(['aboveBar', 'belowBar']).toContain(m.position);
    }
  });
});

describe('UTBot', () => {
  const result = UTBot.calculate(bars) as any;

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });

  it('trailing stop tracks near price', () => {
    const vals = validValues(result);
    const avgClose = bars.reduce((s, b) => s + b.close, 0) / bars.length;
    const avg = vals.reduce((s: number, v: number) => s + v, 0) / vals.length;
    expect(Math.abs(avg - avgClose)).toBeLessThan(avgClose * 0.5);
  });

  it('produces buy/sell markers on crossover', () => {
    expect(Array.isArray(result.markers)).toBe(true);
    expect(result.markers.length).toBeGreaterThan(0);
    for (const m of result.markers) {
      expect(['aboveBar', 'belowBar']).toContain(m.position);
    }
  });
});

describe('HullSuite', () => {
  const result = HullSuite.calculate(bars);

  it('returns correct shape (MHULL, SHULL)', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });

  it('SHULL is MHULL lagged by 2', () => {
    const mhull = result.plots['plot0'];
    const shull = result.plots['plot1'];
    for (let i = 60; i < bars.length; i++) {
      if (!isNaN(mhull[i - 2].value) && !isNaN(shull[i].value)) {
        expect(shull[i].value).toBeCloseTo(mhull[i - 2].value, 8);
      }
    }
  });

  it('has fill between MHULL and SHULL', () => {
    expect(result.fills).toBeDefined();
    expect(result.fills!.length).toBe(1);
    expect(result.fills![0].plot1).toBe('plot0');
    expect(result.fills![0].plot2).toBe('plot1');
  });
});

describe('OptimizedTrendTracker', () => {
  const result = OptimizedTrendTracker.calculate(bars) as any;

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });

  it('produces buy/sell markers', () => {
    expect(Array.isArray(result.markers)).toBe(true);
    for (const m of result.markers) {
      expect(['aboveBar', 'belowBar']).toContain(m.position);
    }
  });

  it('has fill between support and OTT', () => {
    expect(result.fills).toBeDefined();
    expect(result.fills.length).toBe(1);
    expect(result.fills[0].plot1).toBe('plot0');
    expect(result.fills[0].plot2).toBe('plot1');
  });
});

describe('TrendMagic', () => {
  const result = TrendMagic.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });

  it('tracks price level (overlay)', () => {
    const vals = validValues(result);
    const avgClose = bars.reduce((s, b) => s + b.close, 0) / bars.length;
    const avg = vals.reduce((s: number, v: number) => s + v, 0) / vals.length;
    expect(Math.abs(avg - avgClose)).toBeLessThan(avgClose * 0.5);
  });
});

describe('SSLChannel', () => {
  const result = SSLChannel.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals0 = validValues(result, 'plot0');
    const vals1 = validValues(result, 'plot1');
    expect(vals0.length).toBeGreaterThan(0);
    expect(vals1.length).toBeGreaterThan(0);
    vals0.forEach((v: number) => expect(isFinite(v)).toBe(true));
    vals1.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });
});

describe('MavilimW', () => {
  const result = MavilimW.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });

  it('is a smooth overlay near price', () => {
    const vals = validValues(result);
    const avgClose = bars.reduce((s, b) => s + b.close, 0) / bars.length;
    const avg = vals.reduce((s: number, v: number) => s + v, 0) / vals.length;
    expect(Math.abs(avg - avgClose)).toBeLessThan(avgClose * 0.5);
  });
});

describe('CDCActionZone', () => {
  const result = CDCActionZone.calculate(bars);

  it('returns correct shape (Fast, Slow)', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals0 = validValues(result, 'plot0');
    const vals1 = validValues(result, 'plot1');
    expect(vals0.length).toBeGreaterThan(0);
    expect(vals1.length).toBeGreaterThan(0);
    vals0.forEach((v: number) => expect(isFinite(v)).toBe(true));
    vals1.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });

  it('has fill between Fast and Slow', () => {
    expect(result.fills).toBeDefined();
    expect(result.fills!.length).toBe(1);
    expect(result.fills![0].plot1).toBe('plot0');
    expect(result.fills![0].plot2).toBe('plot1');
  });
});

describe('TillsonT3', () => {
  const result = TillsonT3.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });

  it('is smoother than raw price', () => {
    const vals = validValues(result);
    const closeDiffs: number[] = [];
    const t3Diffs: number[] = [];
    for (let i = 50; i < bars.length - 1; i++) {
      closeDiffs.push(Math.abs(bars[i + 1].close - bars[i].close));
    }
    for (let i = 1; i < vals.length; i++) {
      t3Diffs.push(Math.abs(vals[i] - vals[i - 1]));
    }
    const avgCloseJitter = closeDiffs.reduce((s, v) => s + v, 0) / closeDiffs.length;
    const avgT3Jitter = t3Diffs.reduce((s, v) => s + v, 0) / t3Diffs.length;
    expect(avgT3Jitter).toBeLessThan(avgCloseJitter);
  });
});

describe('WaddahAttarExplosion', () => {
  const result = WaddahAttarExplosion.calculate(bars);

  it('returns correct shape (UpTrend, DownTrend, Explosion, DeadZone)', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3'], false);
  });

  it('up and down are mutually exclusive', () => {
    const up = validValues(result, 'plot0');
    const down = validValues(result, 'plot1');
    expect(up.length).toBeGreaterThan(0);
    expect(down.length).toBeGreaterThan(0);
    // At any bar, at least one should be 0
    for (let i = 0; i < up.length; i++) {
      expect(up[i] === 0 || down[i] === 0).toBe(true);
    }
  });

  it('explosion line is positive', () => {
    const vals = validValues(result, 'plot2');
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(v).toBeGreaterThanOrEqual(0));
  });
});

describe('RipsterEMAClouds', () => {
  const result = RipsterEMAClouds.calculate(bars);

  it('returns correct shape (10 plots)', () => {
    const plotKeys = Array.from({ length: 10 }, (_, i) => `plot${i}`);
    assertShape(result, plotKeys, true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result, 'plot0');
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });

  it('has 5 fills (one per EMA pair)', () => {
    expect(result.fills).toBeDefined();
    expect(result.fills!.length).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(result.fills![i].plot1).toBe(`plot${i * 2}`);
      expect(result.fills![i].plot2).toBe(`plot${i * 2 + 1}`);
    }
  });
});

describe('PremierRSI', () => {
  const result = PremierRSI.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('values are bounded [-1, 1]', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => {
      expect(v).toBeGreaterThanOrEqual(-1.01);
      expect(v).toBeLessThanOrEqual(1.01);
    });
  });

  it('has 5 hlines (zero, ±0.2, ±0.9)', () => {
    expect(result.hlines).toBeDefined();
    expect(result.hlines!.length).toBe(5);
    const values = result.hlines!.map((h: any) => h.value).sort((a: number, b: number) => a - b);
    expect(values).toEqual([-0.9, -0.2, 0, 0.2, 0.9]);
  });
});

describe('LaguerreRSI', () => {
  const result = LaguerreRSI.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('values are bounded [0, 1]', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => {
      expect(v).toBeGreaterThanOrEqual(-0.01);
      expect(v).toBeLessThanOrEqual(1.01);
    });
  });
});

describe('RSICandles', () => {
  const result = RSICandles.calculate(bars) as any;

  it('returns plotCandles with RSI OHLC data', () => {
    expect(result.metadata.overlay).toBe(false);
    expect(result.plotCandles).toHaveProperty('rsi');
    expect(result.plotCandles.rsi).toHaveLength(bars.length);
  });

  it('RSI values are bounded [0, 100]', () => {
    const candles = result.plotCandles.rsi.filter((c: any) => !isNaN(c.close));
    expect(candles.length).toBeGreaterThan(0);
    candles.forEach((c: any) => {
      for (const field of ['open', 'high', 'low', 'close']) {
        expect(c[field]).toBeGreaterThanOrEqual(-0.01);
        expect(c[field]).toBeLessThanOrEqual(100.01);
      }
    });
  });
});

describe('ZeroLagMACD', () => {
  const result = ZeroLagMACD.calculate(bars);

  it('returns correct shape (upHist, downHist, MACD, Signal, EMA, Dots)', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3', 'plot4', 'plot5'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result, 'plot2');
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: number) => expect(isFinite(v)).toBe(true));
  });

  it('has fill between MACD and Signal', () => {
    expect(result.fills).toBeDefined();
    expect(result.fills!.length).toBe(1);
    expect(result.fills![0].plot1).toBe('plot2');
    expect(result.fills![0].plot2).toBe('plot3');
  });
});
