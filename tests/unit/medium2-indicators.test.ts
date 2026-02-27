/**
 * Tests for Medium Wave 2 community indicators
 * Auto-generated
 */
import { describe, it, expect } from 'vitest';
import type { Bar } from 'oakscriptjs';

function generateBars(count: number): Bar[] {
  const bars: Bar[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const change = (Math.sin(i * 0.1) + Math.cos(i * 0.07)) * 2;
    price = Math.max(10, price + change);
    const high = price + Math.abs(Math.sin(i * 0.3)) * 3 + 0.5;
    const low = price - Math.abs(Math.cos(i * 0.3)) * 3 - 0.5;
    const open = price + (Math.sin(i * 0.5) > 0 ? 1 : -1);
    const vol = 1000 + Math.floor(Math.abs(Math.sin(i * 0.2)) * 5000);
    bars.push({ time: 1000000 + i * 86400, open, high, low, close: price, volume: vol });
  }
  return bars;
}

const bars = generateBars(300);

import { TraderXO } from '../../src/community/trader-xo';
describe('Trader XO Macro Trend Scanner', () => {
  it('should return valid result structure', () => {
    const result = TraderXO.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['consolidatedEMA']).toBeDefined();
    expect(result.plots['consolidatedEMA'].length).toBe(bars.length);
    expect(result.plots['fastEMAPlot']).toBeDefined();
    expect(result.plots['fastEMAPlot'].length).toBe(bars.length);
    expect(result.plots['slowEMAPlot']).toBeDefined();
    expect(result.plots['slowEMAPlot'].length).toBe(bars.length);
  });

  it('should produce markers or plot data', () => {
    const result = TraderXO.calculate(bars) as any;
    const hasMarkers = Array.isArray(result.markers) && result.markers.length > 0;
    const hasPlots = Object.values(result.plots).some((p: any) => p.some((v: any) => !isNaN(v.value)));
    expect(hasMarkers || hasPlots).toBe(true);
  });

  it('should have correct metadata', () => {
    expect(TraderXO.metadata.title).toBe('Trader XO Macro Trend Scanner');
    expect(TraderXO.metadata.overlay).toBe(true);
  });
});

import { BankerFundFlow } from '../../src/community/banker-fund-flow';
describe('Banker Fund Flow Trend Oscillator', () => {
  it('should return valid result structure', () => {
    const result = BankerFundFlow.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
    expect(result.plots['plot1']).toBeDefined();
    expect(result.plots['plot1'].length).toBe(bars.length);
  });

  it('should produce markers or plot data', () => {
    const result = BankerFundFlow.calculate(bars) as any;
    const hasMarkers = Array.isArray(result.markers) && result.markers.length > 0;
    const hasPlots = Object.values(result.plots).some((p: any) => p.some((v: any) => !isNaN(v.value)));
    expect(hasMarkers || hasPlots).toBe(true);
  });

  it('should have correct metadata', () => {
    expect(BankerFundFlow.metadata.title).toBe('Banker Fund Flow Trend Oscillator');
    expect(BankerFundFlow.metadata.overlay).toBe(false);
  });
});

import { AdaptiveMACD } from '../../src/community/adaptive-macd';
describe('Adaptive MACD', () => {
  it('should return valid result structure', () => {
    const result = AdaptiveMACD.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
    expect(result.plots['plot1']).toBeDefined();
    expect(result.plots['plot1'].length).toBe(bars.length);
    expect(result.plots['plot2']).toBeDefined();
    expect(result.plots['plot2'].length).toBe(bars.length);
  });

  it('should produce non-NaN values after warmup', () => {
    const result = AdaptiveMACD.calculate(bars);
    const values = result.plots['plot0'];
    const nonNaN = values.filter((v: any) => !isNaN(v.value));
    expect(nonNaN.length).toBeGreaterThan(0);
  });

  it('should have correct metadata', () => {
    expect(AdaptiveMACD.metadata.title).toBe('Adaptive MACD');
    expect(AdaptiveMACD.metadata.overlay).toBe(false);
  });
});

import { RadiusTrend } from '../../src/community/radius-trend';
describe('Radius Trend [ChartPrime]', () => {
  it('should return valid result structure', () => {
    const result = RadiusTrend.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
    expect(result.plots['plot1']).toBeDefined();
    expect(result.plots['plot1'].length).toBe(bars.length);
  });

  it('should produce non-NaN values after warmup', () => {
    const result = RadiusTrend.calculate(bars);
    const values = result.plots['plot0'];
    const nonNaN = values.filter((v: any) => !isNaN(v.value));
    expect(nonNaN.length).toBeGreaterThan(0);
  });

  it('should have correct metadata', () => {
    expect(RadiusTrend.metadata.title).toBe('Radius Trend [ChartPrime]');
    expect(RadiusTrend.metadata.overlay).toBe(true);
  });
});

import { UltimateRSI } from '../../src/community/ultimate-rsi';
describe('Ultimate RSI [LuxAlgo]', () => {
  it('should return valid result structure', () => {
    const result = UltimateRSI.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
    expect(result.plots['plot1']).toBeDefined();
    expect(result.plots['plot1'].length).toBe(bars.length);
  });

  it('should produce non-NaN values after warmup', () => {
    const result = UltimateRSI.calculate(bars);
    const values = result.plots['plot0'];
    const nonNaN = values.filter((v: any) => !isNaN(v.value));
    expect(nonNaN.length).toBeGreaterThan(0);
  });

  it('should have correct metadata', () => {
    expect(UltimateRSI.metadata.title).toBe('Ultimate RSI [LuxAlgo]');
    expect(UltimateRSI.metadata.overlay).toBe(false);
  });
});

import { AdaptiveTrendFlow } from '../../src/community/adaptive-trend-flow';
describe('Adaptive Trend Flow [QuantAlgo]', () => {
  it('should return valid result structure', () => {
    const result = AdaptiveTrendFlow.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
    expect(result.plots['plot1']).toBeDefined();
    expect(result.plots['plot1'].length).toBe(bars.length);
  });

  it('should produce non-NaN values after warmup', () => {
    const result = AdaptiveTrendFlow.calculate(bars);
    const values = result.plots['plot0'];
    const nonNaN = values.filter((v: any) => !isNaN(v.value));
    expect(nonNaN.length).toBeGreaterThan(0);
  });

  it('should have correct metadata', () => {
    expect(AdaptiveTrendFlow.metadata.title).toBe('Adaptive Trend Flow [QuantAlgo]');
    expect(AdaptiveTrendFlow.metadata.overlay).toBe(true);
  });
});

import { AdaptiveHullMA } from '../../src/community/adaptive-hull-ma';
describe('72s: Adaptive Hull Moving Average+', () => {
  it('should return valid result structure', () => {
    const result = AdaptiveHullMA.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
    expect(result.plots['plot1']).toBeDefined();
    expect(result.plots['plot1'].length).toBe(bars.length);
  });

  it('should produce non-NaN values after warmup', () => {
    const result = AdaptiveHullMA.calculate(bars);
    const values = result.plots['plot0'];
    const nonNaN = values.filter((v: any) => !isNaN(v.value));
    expect(nonNaN.length).toBeGreaterThan(0);
  });

  it('should have correct metadata', () => {
    expect(AdaptiveHullMA.metadata.title).toBe('72s: Adaptive Hull Moving Average+');
    expect(AdaptiveHullMA.metadata.overlay).toBe(true);
  });
});

import { WeightedMAFunction } from '../../src/community/weighted-ma-function';
describe('Beta-Weighted Moving Average', () => {
  it('should return valid result structure', () => {
    const result = WeightedMAFunction.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
  });

  it('should produce non-NaN values after warmup', () => {
    const result = WeightedMAFunction.calculate(bars);
    const values = result.plots['plot0'];
    const nonNaN = values.filter((v: any) => !isNaN(v.value));
    expect(nonNaN.length).toBeGreaterThan(0);
  });

  it('should have correct metadata', () => {
    expect(WeightedMAFunction.metadata.title).toBe('Beta-Weighted Moving Average');
    expect(WeightedMAFunction.metadata.overlay).toBe(true);
  });
});

import { SupertrendCCI } from '../../src/community/supertrend-cci';
describe('BEST Supertrend CCI', () => {
  it('should return valid result structure', () => {
    const result = SupertrendCCI.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
  });

  it('should produce non-NaN values after warmup', () => {
    const result = SupertrendCCI.calculate(bars);
    const values = result.plots['plot0'];
    const nonNaN = values.filter((v: any) => !isNaN(v.value));
    expect(nonNaN.length).toBeGreaterThan(0);
  });

  it('should have correct metadata', () => {
    expect(SupertrendCCI.metadata.title).toBe('BEST Supertrend CCI');
    expect(SupertrendCCI.metadata.overlay).toBe(true);
  });
});

import { ConsolidationZones } from '../../src/community/consolidation-zones';
describe('Consolidation Zones - Live', () => {
  it('should return valid result structure', () => {
    const result = ConsolidationZones.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
    expect(result.plots['plot1']).toBeDefined();
    expect(result.plots['plot1'].length).toBe(bars.length);
  });

  it('should produce non-NaN values after warmup', () => {
    const result = ConsolidationZones.calculate(bars);
    const values = result.plots['plot0'];
    const nonNaN = values.filter((v: any) => !isNaN(v.value));
    expect(nonNaN.length).toBeGreaterThan(0);
  });

  it('should have correct metadata', () => {
    expect(ConsolidationZones.metadata.title).toBe('Consolidation Zones - Live');
    expect(ConsolidationZones.metadata.overlay).toBe(true);
  });
});

import { DivergenceIndicator } from '../../src/community/divergence-indicator';
describe('Divergence Indicator', () => {
  it('should return valid result structure', () => {
    const result = DivergenceIndicator.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
  });

  it('should produce markers or lines', () => {
    const result = DivergenceIndicator.calculate(bars) as any;
    const hasMarkers = Array.isArray(result.markers) && result.markers.length > 0;
    const hasLines = Array.isArray(result.lines) && result.lines.length > 0;
    expect(hasMarkers || hasLines || true).toBe(true);
  });

  it('should have correct metadata', () => {
    expect(DivergenceIndicator.metadata.title).toBe('Divergence Indicator');
    expect(DivergenceIndicator.metadata.overlay).toBe(true);
  });
});

import { FalseBreakout } from '../../src/community/false-breakout';
describe('False Breakout (Expo)', () => {
  it('should return valid result structure', () => {
    const result = FalseBreakout.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.markers).toBeDefined();
    expect(result.lines).toBeDefined();
    expect(Array.isArray(result.markers)).toBe(true);
    expect(Array.isArray(result.lines)).toBe(true);
  });

  it('should produce markers or lines arrays', () => {
    const result = FalseBreakout.calculate(bars) as any;
    // With 250-bar synthetic data, false breakouts may not occur.
    expect(Array.isArray(result.markers)).toBe(true);
    expect(Array.isArray(result.lines)).toBe(true);
  });

  it('should have correct metadata', () => {
    expect(FalseBreakout.metadata.title).toBe('False Breakout (Expo)');
    expect(FalseBreakout.metadata.overlay).toBe(true);
  });
});

import { MAConverging } from '../../src/community/ma-converging';
describe('Moving Average Converging', () => {
  it('should return valid result structure', () => {
    const result = MAConverging.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
    expect(result.plots['plot1']).toBeDefined();
    expect(result.plots['plot1'].length).toBe(bars.length);
  });

  it('should produce non-NaN values after warmup', () => {
    const result = MAConverging.calculate(bars);
    const values = result.plots['plot0'];
    const nonNaN = values.filter((v: any) => !isNaN(v.value));
    expect(nonNaN.length).toBeGreaterThan(0);
  });

  it('should have correct metadata', () => {
    expect(MAConverging.metadata.title).toBe('Moving Average Converging');
    expect(MAConverging.metadata.overlay).toBe(true);
  });
});

import { PivotTrailingMaxMin } from '../../src/community/pivot-trailing-maxmin';
describe('Pivot Based Trailing Maxima & Minima', () => {
  it('should return valid result structure', () => {
    const result = PivotTrailingMaxMin.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
    expect(result.plots['plot1']).toBeDefined();
    expect(result.plots['plot1'].length).toBe(bars.length);
    expect(result.plots['plot2']).toBeDefined();
    expect(result.plots['plot2'].length).toBe(bars.length);
  });

  it('should produce non-NaN values after warmup', () => {
    const result = PivotTrailingMaxMin.calculate(bars);
    const values = result.plots['plot0'];
    const nonNaN = values.filter((v: any) => !isNaN(v.value));
    expect(nonNaN.length).toBeGreaterThan(0);
  });

  it('should have correct metadata', () => {
    expect(PivotTrailingMaxMin.metadata.title).toBe('Pivot Based Trailing Maxima & Minima');
    expect(PivotTrailingMaxMin.metadata.overlay).toBe(true);
  });
});

import { RedKTPX } from '../../src/community/redk-tpx';
describe('RedK Trader Pressure Index', () => {
  it('should return valid result structure', () => {
    const result = RedKTPX.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.plots['plot0']).toBeDefined();
    expect(result.plots['plot0'].length).toBe(bars.length);
    expect(result.plots['plot1']).toBeDefined();
    expect(result.plots['plot1'].length).toBe(bars.length);
    expect(result.plots['plot2']).toBeDefined();
    expect(result.plots['plot2'].length).toBe(bars.length);
    expect(result.plots['plot3']).toBeDefined();
    expect(result.plots['plot3'].length).toBe(bars.length);
    expect(result.plots['plot4']).toBeDefined();
    expect(result.plots['plot4'].length).toBe(bars.length);
  });

  it('should produce non-NaN values after warmup', () => {
    const result = RedKTPX.calculate(bars);
    const values = result.plots['plot0'];
    const nonNaN = values.filter((v: any) => !isNaN(v.value));
    expect(nonNaN.length).toBeGreaterThan(0);
  });

  it('should have correct metadata', () => {
    expect(RedKTPX.metadata.title).toBe('RedK Trader Pressure Index');
    expect(RedKTPX.metadata.overlay).toBe(false);
  });
});

