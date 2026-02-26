/**
 * Unit tests for Wave 1 community indicators.
 *
 * These tests use inline fixture data and require no external tokens,
 * so they run reliably in CI without secrets.
 */

import { describe, it, expect } from 'vitest';
import {
  ZLSMA,
  ForecastOscillator,
  CCTBBO,
  MACD4C,
  ColoredVolume,
  KDJ,
  WaveTrend,
  SqueezeMomentum,
  CoralTrend,
  ChandelierExit,
  ImpulseMACD,
  SchaffTrendCycle,
  DonchianTrendRibbon,
  OBVMACD,
  ADXDI,
  AwesomeOscillatorV2,
  CMEMATrendBars,
  BBFibonacciRatios,
  AverageSentimentOscillator,
  ATRTrailingStops,
  AccurateSwingTrading,
  BullBearPowerTrend,
  BBBreakoutOscillator,
  ChandelierStop,
  StochasticMomentumIndex,
  VolumeFlowIndicator,
  EhlersInstantaneousTrend,
  PriceMomentumOscillator,
  FibonacciBollingerBands,
  TrendTriggerFactor,
  ElliottWaveOscillator,
  MadridTrendSqueeze,
  KaufmanAdaptiveMA,
  WilliamsVixFix,
  EhlersMESAMA,
  GannHighLow,
  MACDLeader,
  CMSlingShot,
  RangeIdentifier,
  SlowStochastic,
  IFTStochRSICCI,
  VariableMA,
  SmoothedHeikenAshi,
  OBVOscillator,
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Inline OHLCV fixture – 80 bars of synthetic trending-then-reverting data
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

  // Seed deterministic pseudo-random (simple LCG)
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  let price = 100;
  for (let i = 0; i < 80; i++) {
    // Trend up first 40 bars, down next 40
    const drift = i < 40 ? 0.3 : -0.3;
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

/** Return non-NaN values from plot0 */
function validValues(result: ReturnType<typeof ZLSMA.calculate>, plotKey = 'plot0') {
  return (result.plots as Record<string, Array<{ time: number; value: number }>>)[plotKey]
    .map((p) => p.value)
    .filter((v) => !isNaN(v));
}

/** Assert standard indicator result shape */
function assertShape(
  result: ReturnType<typeof ZLSMA.calculate>,
  expectedPlots: string[],
  overlay: boolean,
) {
  expect(result.metadata).toBeDefined();
  expect(result.metadata.title).toBeTruthy();
  expect(result.metadata.shorttitle).toBeTruthy();
  expect(result.metadata.overlay).toBe(overlay);
  for (const key of expectedPlots) {
    expect(result.plots).toHaveProperty(key);
    const plot = (result.plots as Record<string, Array<{ time: number; value: number }>>)[key];
    expect(plot).toHaveLength(bars.length);
    // Every entry has time and value
    for (const p of plot) {
      expect(typeof p.time).toBe('number');
      expect(typeof p.value).toBe('number');
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ZLSMA', () => {
  const result = ZLSMA.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });

  it('tracks price level (overlay)', () => {
    const vals = validValues(result);
    // ZLSMA should be in same ballpark as close prices
    const avgClose = bars.reduce((s, b) => s + b.close, 0) / bars.length;
    const avgZlsma = vals.reduce((s, v) => s + v, 0) / vals.length;
    expect(Math.abs(avgZlsma - avgClose)).toBeLessThan(avgClose * 0.3);
  });
});

describe('ForecastOscillator', () => {
  const result = ForecastOscillator.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });

  it('oscillates around zero', () => {
    const vals = validValues(result);
    const hasPositive = vals.some((v) => v > 0);
    const hasNegative = vals.some((v) => v < 0);
    expect(hasPositive).toBe(true);
    expect(hasNegative).toBe(true);
  });
});

describe('CCTBBO', () => {
  const result = CCTBBO.calculate(bars);

  it('returns correct shape (2 plots)', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals0 = validValues(result, 'plot0');
    const vals1 = validValues(result, 'plot1');
    expect(vals0.length).toBeGreaterThan(0);
    expect(vals1.length).toBeGreaterThan(0);
    vals0.forEach((v) => expect(isFinite(v)).toBe(true));
    vals1.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});

describe('MACD4C', () => {
  const result = MACD4C.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces values that cross zero (histogram)', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    const hasPositive = vals.some((v) => v > 0);
    const hasNegative = vals.some((v) => v < 0);
    expect(hasPositive).toBe(true);
    expect(hasNegative).toBe(true);
  });
});

describe('ColoredVolume', () => {
  const result = ColoredVolume.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('outputs actual volume values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(v).toBeGreaterThan(0));
  });

  it('NaN for first lookback bars', () => {
    const plot = (result.plots as Record<string, Array<{ value: number }>>)['plot0'];
    for (let i = 0; i < 10; i++) {
      expect(isNaN(plot[i].value)).toBe(true);
    }
    expect(isNaN(plot[10].value)).toBe(false);
  });
});

describe('KDJ', () => {
  const result = KDJ.calculate(bars);

  it('returns correct shape (K, D, J)', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('K and D stay between 0 and 100', () => {
    const kVals = validValues(result, 'plot0');
    const dVals = validValues(result, 'plot1');
    expect(kVals.length).toBeGreaterThan(0);
    kVals.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(-0.01);
      expect(v).toBeLessThanOrEqual(100.01);
    });
    dVals.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(-0.01);
      expect(v).toBeLessThanOrEqual(100.01);
    });
  });

  it('J = 3K - 2D', () => {
    const kPlot = (result.plots as Record<string, Array<{ value: number }>>)['plot0'];
    const dPlot = (result.plots as Record<string, Array<{ value: number }>>)['plot1'];
    const jPlot = (result.plots as Record<string, Array<{ value: number }>>)['plot2'];
    // Check after warmup
    for (let i = 9; i < bars.length; i++) {
      const k = kPlot[i].value;
      const d = dPlot[i].value;
      const j = jPlot[i].value;
      if (!isNaN(k) && !isNaN(d) && !isNaN(j)) {
        expect(j).toBeCloseTo(3 * k - 2 * d, 10);
      }
    }
  });
});

describe('WaveTrend', () => {
  const result = WaveTrend.calculate(bars);

  it('returns correct shape (WT1, WT2, Diff)', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result, 'plot0');
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });

  it('diff = WT1 - WT2', () => {
    const wt1Plot = (result.plots as Record<string, Array<{ value: number }>>)['plot0'];
    const wt2Plot = (result.plots as Record<string, Array<{ value: number }>>)['plot1'];
    const diffPlot = (result.plots as Record<string, Array<{ value: number }>>)['plot2'];
    for (let i = 30; i < bars.length; i++) {
      const wt1 = wt1Plot[i].value;
      const wt2 = wt2Plot[i].value;
      const diff = diffPlot[i].value;
      if (!isNaN(wt1) && !isNaN(wt2) && !isNaN(diff)) {
        expect(diff).toBeCloseTo(wt1 - wt2, 8);
      }
    }
  });
});

describe('SqueezeMomentum', () => {
  const result = SqueezeMomentum.calculate(bars);

  it('returns correct shape (Momentum, Squeeze)', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('momentum oscillates around zero', () => {
    const vals = validValues(result, 'plot0');
    expect(vals.length).toBeGreaterThan(0);
    const hasPositive = vals.some((v) => v > 0);
    const hasNegative = vals.some((v) => v < 0);
    expect(hasPositive).toBe(true);
    expect(hasNegative).toBe(true);
  });
});

describe('CoralTrend', () => {
  const result = CoralTrend.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('tracks price (overlay indicator)', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    const avgClose = bars.reduce((s, b) => s + b.close, 0) / bars.length;
    const avgCoral = vals.reduce((s, v) => s + v, 0) / vals.length;
    expect(Math.abs(avgCoral - avgClose)).toBeLessThan(avgClose * 0.3);
  });

  it('is smoother than raw price', () => {
    const vals = validValues(result);
    // Compare variance of bar-to-bar changes
    const closeDiffs: number[] = [];
    const coralDiffs: number[] = [];
    for (let i = 22; i < bars.length - 1; i++) {
      closeDiffs.push(Math.abs(bars[i + 1].close - bars[i].close));
    }
    for (let i = 1; i < vals.length; i++) {
      coralDiffs.push(Math.abs(vals[i] - vals[i - 1]));
    }
    const avgCloseJitter = closeDiffs.reduce((s, v) => s + v, 0) / closeDiffs.length;
    const avgCoralJitter = coralDiffs.reduce((s, v) => s + v, 0) / coralDiffs.length;
    expect(avgCoralJitter).toBeLessThan(avgCloseJitter);
  });
});

describe('ChandelierExit', () => {
  const result = ChandelierExit.calculate(bars);

  it('returns correct shape (Long Stop, Short Stop)', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('shows only one stop at a time (directional)', () => {
    const longPlot = (result.plots as Record<string, Array<{ value: number }>>)['plot0'];
    const shortPlot = (result.plots as Record<string, Array<{ value: number }>>)['plot1'];
    // After warmup, exactly one of long/short should be visible per bar
    let bothCount = 0;
    let neitherCount = 0;
    for (let i = 22; i < bars.length; i++) {
      const longVisible = !isNaN(longPlot[i].value);
      const shortVisible = !isNaN(shortPlot[i].value);
      if (longVisible && shortVisible) bothCount++;
      if (!longVisible && !shortVisible) neitherCount++;
    }
    expect(bothCount).toBe(0);
    expect(neitherCount).toBe(0);
  });
});

describe('ImpulseMACD', () => {
  const result = ImpulseMACD.calculate(bars);

  it('returns correct shape (MACD, Signal, Histogram)', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('histogram = MACD - Signal', () => {
    const macdPlot = (result.plots as Record<string, Array<{ value: number }>>)['plot0'];
    const sigPlot = (result.plots as Record<string, Array<{ value: number }>>)['plot1'];
    const histPlot = (result.plots as Record<string, Array<{ value: number }>>)['plot2'];
    for (let i = 50; i < bars.length; i++) {
      const m = macdPlot[i].value;
      const s = sigPlot[i].value;
      const h = histPlot[i].value;
      if (!isNaN(m) && !isNaN(s) && !isNaN(h)) {
        expect(h).toBeCloseTo(m - s, 8);
      }
    }
  });
});

describe('SchaffTrendCycle', () => {
  const result = SchaffTrendCycle.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('values are bounded 0-100 after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(-0.01);
      expect(v).toBeLessThanOrEqual(100.01);
    });
  });
});

describe('DonchianTrendRibbon', () => {
  const result = DonchianTrendRibbon.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('values are integers in [-10, 10]', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(-10);
      expect(v).toBeLessThanOrEqual(10);
      expect(Number.isInteger(v)).toBe(true);
    });
  });
});

describe('OBVMACD', () => {
  const result = OBVMACD.calculate(bars);

  it('returns correct shape (Trend, Up Signal, Down Signal)', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result, 'plot0');
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});

describe('ADXDI', () => {
  const result = ADXDI.calculate(bars);

  it('returns correct shape (DI+, DI-, ADX)', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('DI+ and DI- are non-negative', () => {
    const diPlus = validValues(result, 'plot0');
    const diMinus = validValues(result, 'plot1');
    expect(diPlus.length).toBeGreaterThan(0);
    diPlus.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
    diMinus.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });

  it('ADX is non-negative', () => {
    const adx = validValues(result, 'plot2');
    expect(adx.length).toBeGreaterThan(0);
    adx.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });
});

describe('AwesomeOscillatorV2', () => {
  const result = AwesomeOscillatorV2.calculate(bars);

  it('returns correct shape (AO, Signal)', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('AO oscillates around zero', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    const hasPositive = vals.some((v) => v > 0);
    const hasNegative = vals.some((v) => v < 0);
    expect(hasPositive).toBe(true);
    expect(hasNegative).toBe(true);
  });
});

describe('CMEMATrendBars', () => {
  const result = CMEMATrendBars.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('tracks price (overlay)', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    const avgClose = bars.reduce((s, b) => s + b.close, 0) / bars.length;
    const avgEma = vals.reduce((s, v) => s + v, 0) / vals.length;
    expect(Math.abs(avgEma - avgClose)).toBeLessThan(avgClose * 0.3);
  });
});

describe('BBFibonacciRatios', () => {
  const result = BBFibonacciRatios.calculate(bars);

  it('returns correct shape (7 plots)', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3', 'plot4', 'plot5', 'plot6'], true);
  });

  it('upper bands above basis, lower bands below', () => {
    const basis = validValues(result, 'plot0');
    const upper1 = validValues(result, 'plot1');
    const lower1 = validValues(result, 'plot2');
    expect(basis.length).toBeGreaterThan(0);
    for (let i = 0; i < basis.length; i++) {
      expect(upper1[i]).toBeGreaterThanOrEqual(basis[i]);
      expect(lower1[i]).toBeLessThanOrEqual(basis[i]);
    }
  });
});

describe('AverageSentimentOscillator', () => {
  const result = AverageSentimentOscillator.calculate(bars);

  it('returns correct shape (Bulls, Bears)', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('values are between 0 and 100', () => {
    const bulls = validValues(result, 'plot0');
    const bears = validValues(result, 'plot1');
    expect(bulls.length).toBeGreaterThan(0);
    bulls.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
    bears.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});

describe('ATRTrailingStops', () => {
  const result = ATRTrailingStops.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});

describe('AccurateSwingTrading', () => {
  const result = AccurateSwingTrading.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});

describe('BullBearPowerTrend', () => {
  const result = BullBearPowerTrend.calculate(bars);

  it('returns correct shape (5 plots)', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3', 'plot4'], false);
  });

  it('bull power is non-negative, bear power is non-positive', () => {
    const bullHist = validValues(result, 'plot3');
    const bearHist = validValues(result, 'plot4');
    expect(bullHist.length).toBeGreaterThan(0);
    bullHist.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
    bearHist.forEach((v) => expect(v).toBeLessThanOrEqual(0));
  });
});

describe('BBBreakoutOscillator', () => {
  const result = BBBreakoutOscillator.calculate(bars);

  it('returns correct shape (Bull, Bear)', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('values are between 0 and 100', () => {
    const bull = validValues(result, 'plot0');
    const bear = validValues(result, 'plot1');
    expect(bull.length).toBeGreaterThan(0);
    bull.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
    bear.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});

describe('ChandelierStop', () => {
  const result = ChandelierStop.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});

describe('StochasticMomentumIndex', () => {
  const result = StochasticMomentumIndex.calculate(bars);

  it('returns correct shape (SMI, Signal, Histogram)', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('SMI oscillates around zero', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    const hasPositive = vals.some((v) => v > 0);
    const hasNegative = vals.some((v) => v < 0);
    expect(hasPositive).toBe(true);
    expect(hasNegative).toBe(true);
  });
});

describe('VolumeFlowIndicator', () => {
  const result = VolumeFlowIndicator.calculate(bars, { length: 20 });

  it('returns correct shape (VFI, Signal)', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});

describe('EhlersInstantaneousTrend', () => {
  const result = EhlersInstantaneousTrend.calculate(bars);

  it('returns correct shape (Trigger, ITrend)', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('tracks price (overlay)', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    const avgClose = bars.reduce((s, b) => s + b.close, 0) / bars.length;
    const avgIT = vals.reduce((s, v) => s + v, 0) / vals.length;
    expect(Math.abs(avgIT - avgClose)).toBeLessThan(avgClose * 0.3);
  });
});

describe('PriceMomentumOscillator', () => {
  const result = PriceMomentumOscillator.calculate(bars);

  it('returns correct shape (PMO, Signal)', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('oscillates around zero', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    const hasPositive = vals.some((v) => v > 0);
    const hasNegative = vals.some((v) => v < 0);
    expect(hasPositive).toBe(true);
    expect(hasNegative).toBe(true);
  });
});

describe('FibonacciBollingerBands', () => {
  const result = FibonacciBollingerBands.calculate(bars, { length: 20 });

  it('returns correct shape (13 plots)', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3', 'plot4', 'plot5', 'plot6', 'plot7', 'plot8', 'plot9', 'plot10', 'plot11', 'plot12'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});

describe('TrendTriggerFactor', () => {
  const result = TrendTriggerFactor.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});

describe('ElliottWaveOscillator', () => {
  const result = ElliottWaveOscillator.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('oscillates around zero', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    const hasPositive = vals.some((v) => v > 0);
    const hasNegative = vals.some((v) => v < 0);
    expect(hasPositive).toBe(true);
    expect(hasNegative).toBe(true);
  });
});

describe('MadridTrendSqueeze', () => {
  const result = MadridTrendSqueeze.calculate(bars);

  it('returns correct shape (3 histograms)', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});

describe('KaufmanAdaptiveMA', () => {
  const result = KaufmanAdaptiveMA.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('tracks price (overlay)', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    const avgClose = bars.reduce((s, b) => s + b.close, 0) / bars.length;
    const avgKama = vals.reduce((s, v) => s + v, 0) / vals.length;
    expect(Math.abs(avgKama - avgClose)).toBeLessThan(avgClose * 0.3);
  });
});

describe('WilliamsVixFix', () => {
  const result = WilliamsVixFix.calculate(bars);

  it('returns correct shape (WVF, Upper Band)', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('WVF values are non-negative', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });
});

describe('EhlersMESAMA', () => {
  const result = EhlersMESAMA.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });

  it('tracks price level (overlay)', () => {
    const vals = validValues(result);
    const avgClose = bars.reduce((s, b) => s + b.close, 0) / bars.length;
    const avgMama = vals.reduce((s, v) => s + v, 0) / vals.length;
    expect(Math.abs(avgMama - avgClose)).toBeLessThan(avgClose * 0.3);
  });
});

describe('GannHighLow', () => {
  const result = GannHighLow.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });

  it('tracks price level (overlay)', () => {
    const vals = validValues(result);
    const avgClose = bars.reduce((s, b) => s + b.close, 0) / bars.length;
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    expect(Math.abs(avg - avgClose)).toBeLessThan(avgClose * 0.3);
  });
});

describe('MACDLeader', () => {
  const result = MACDLeader.calculate(bars);

  it('returns correct shape (4 plots)', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3'], false);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });

  it('histogram crosses zero', () => {
    const vals = validValues(result, 'plot3');
    const hasPositive = vals.some((v) => v > 0);
    const hasNegative = vals.some((v) => v < 0);
    expect(hasPositive).toBe(true);
    expect(hasNegative).toBe(true);
  });
});

describe('CMSlingShot', () => {
  const result = CMSlingShot.calculate(bars);

  it('returns correct shape (2 EMA plots)', () => {
    assertShape(result, ['plot0', 'plot1'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});

describe('RangeIdentifier', () => {
  const result = RangeIdentifier.calculate(bars);

  it('returns correct shape (3 plots)', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2'], true);
  });

  it('produces finite values after warmup', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });

  it('upper >= lower', () => {
    const upper = validValues(result, 'plot0');
    const lower = validValues(result, 'plot1');
    const len = Math.min(upper.length, lower.length);
    for (let i = 0; i < len; i++) {
      expect(upper[i]).toBeGreaterThanOrEqual(lower[i]);
    }
  });
});

describe('SlowStochastic', () => {
  const result = SlowStochastic.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0', 'plot1'], false);
  });

  it('values in 0-100 range', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});

describe('IFTStochRSICCI', () => {
  const result = IFTStochRSICCI.calculate(bars);

  it('returns correct shape (4 plots)', () => {
    assertShape(result, ['plot0', 'plot1', 'plot2', 'plot3'], false);
  });

  it('IFT values in -1 to 1 range', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    });
  });
});

describe('VariableMA', () => {
  const result = VariableMA.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], true);
  });

  it('tracks price level (overlay)', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    const avgClose = bars.reduce((s, b) => s + b.close, 0) / bars.length;
    const avgVma = vals.reduce((s, v) => s + v, 0) / vals.length;
    expect(Math.abs(avgVma - avgClose)).toBeLessThan(avgClose * 0.3);
  });
});

describe('SmoothedHeikenAshi', () => {
  const result = SmoothedHeikenAshi.calculate(bars);

  it('returns metadata', () => {
    expect(result.metadata).toBeDefined();
    expect(result.metadata.title).toBeTruthy();
    expect(result.metadata.overlay).toBe(true);
  });

  it('returns plotCandles with valid OHLC after warmup', () => {
    const candles = (result as any).plotCandles?.sha;
    expect(candles).toBeDefined();
    expect(candles.length).toBe(bars.length);
    const valid = candles.filter((c: any) => !isNaN(c.close));
    expect(valid.length).toBeGreaterThan(0);
    valid.forEach((c: any) => {
      expect(isFinite(c.open)).toBe(true);
      expect(isFinite(c.high)).toBe(true);
      expect(isFinite(c.low)).toBe(true);
      expect(isFinite(c.close)).toBe(true);
    });
  });
});

describe('OBVOscillator', () => {
  const result = OBVOscillator.calculate(bars);

  it('returns correct shape', () => {
    assertShape(result, ['plot0'], false);
  });

  it('oscillates around zero', () => {
    const vals = validValues(result);
    expect(vals.length).toBeGreaterThan(0);
    const hasPositive = vals.some((v) => v > 0);
    const hasNegative = vals.some((v) => v < 0);
    expect(hasPositive).toBe(true);
    expect(hasNegative).toBe(true);
  });
});
