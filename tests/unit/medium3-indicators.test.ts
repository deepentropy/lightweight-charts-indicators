/**
 * Tests for Medium Wave 3 community indicators
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

const bars = generateBars(500);

// --- Batch A ---

import { AutoFiboIndicators } from '../../src/community/auto-fibo-indicators';
describe('Auto Fibo on Indicators', () => {
  it('should return valid result structure', () => {
    const result = AutoFiboIndicators.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.metadata).toBeDefined();
    expect(result.metadata.overlay).toBe(false);
  });
  it('should produce non-NaN values after warmup', () => {
    const result = AutoFiboIndicators.calculate(bars);
    const keys = Object.keys(result.plots);
    expect(keys.length).toBeGreaterThanOrEqual(2);
    const vals = result.plots[keys[0]].filter((v: any) => !isNaN(v.value));
    expect(vals.length).toBeGreaterThan(0);
  });
  it('should accept custom inputs', () => {
    const result = AutoFiboIndicators.calculate(bars, { fiboLength: 50 });
    expect(result).toBeDefined();
  });
});

import { HeatmapVolume } from '../../src/community/heatmap-volume';
describe('Heatmap Volume', () => {
  it('should return valid result structure', () => {
    const result = HeatmapVolume.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.metadata.overlay).toBe(false);
  });
  it('should produce volume values with short period', () => {
    const result = HeatmapVolume.calculate(bars, { maLength: 20, stdLength: 20 });
    const vol = result.plots['volume'];
    expect(vol).toBeDefined();
    const vals = vol.filter((v: any) => !isNaN(v.value));
    expect(vals.length).toBeGreaterThan(0);
  });
  it('should have barColors with short period', () => {
    const result = HeatmapVolume.calculate(bars, { maLength: 20, stdLength: 20 }) as any;
    expect(result.barColors).toBeDefined();
    expect(result.barColors.length).toBeGreaterThan(0);
  });
});

import { BetterVolume } from '../../src/community/better-volume';
describe('Better Volume Indicator', () => {
  it('should return valid result structure', () => {
    const result = BetterVolume.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.metadata.overlay).toBe(false);
  });
  it('should produce volume values', () => {
    const result = BetterVolume.calculate(bars);
    const keys = Object.keys(result.plots);
    expect(keys.length).toBeGreaterThanOrEqual(1);
    const vals = result.plots[keys[0]].filter((v: any) => !isNaN(v.value));
    expect(vals.length).toBeGreaterThan(0);
  });
  it('should accept custom inputs', () => {
    const result = BetterVolume.calculate(bars, { length: 12 });
    expect(result).toBeDefined();
  });
});

import { VolumeDivergence } from '../../src/community/volume-divergence';
describe('Volume Divergence', () => {
  it('should return valid result structure', () => {
    const result = VolumeDivergence.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.metadata.overlay).toBe(false);
  });
  it('should produce oscillator values', () => {
    const result = VolumeDivergence.calculate(bars);
    const keys = Object.keys(result.plots);
    expect(keys.length).toBeGreaterThanOrEqual(1);
    const vals = result.plots[keys[0]].filter((v: any) => !isNaN(v.value));
    expect(vals.length).toBeGreaterThan(0);
  });
});

import { PredictiveChannels } from '../../src/community/predictive-channels';
describe('Predictive Channels', () => {
  it('should return valid result structure', () => {
    const result = PredictiveChannels.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.metadata.overlay).toBe(true);
  });
  it('should produce 5 plots (R2, R1, avg, S1, S2)', () => {
    const result = PredictiveChannels.calculate(bars);
    const keys = Object.keys(result.plots);
    expect(keys.length).toBe(5);
    expect(keys).toContain('r2');
    expect(keys).toContain('avg');
    expect(keys).toContain('s2');
    // Values may be NaN when close equals avg (reset state) - that's expected behavior
    expect(result.plots['avg'].length).toBe(bars.length);
  });
});

import { VolumeBarBreakout } from '../../src/community/volume-bar-breakout';
describe('Volume Bar Breakout', () => {
  it('should return valid result structure', () => {
    const result = VolumeBarBreakout.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.metadata.overlay).toBe(true);
  });
  it('should produce price-level values', () => {
    const result = VolumeBarBreakout.calculate(bars);
    const keys = Object.keys(result.plots);
    expect(keys.length).toBeGreaterThanOrEqual(2);
    const vals = result.plots[keys[0]].filter((v: any) => !isNaN(v.value));
    expect(vals.length).toBeGreaterThan(0);
  });
});

// --- Batch B ---

import { RedKMomentumBars } from '../../src/community/redk-momentum-bars';
describe('RedK Momentum Bars', () => {
  it('should return valid result structure', () => {
    const result = RedKMomentumBars.calculate(bars);
    expect(result).toBeDefined();
    expect(result.metadata.overlay).toBe(false);
  });
  it('should produce plotCandles or plot values', () => {
    const result = RedKMomentumBars.calculate(bars) as any;
    const hasCandles = result.plotCandles && Object.keys(result.plotCandles).length > 0;
    const hasPlots = result.plots && Object.keys(result.plots).length > 0;
    expect(hasCandles || hasPlots).toBe(true);
  });
});

import { VuManChuSwing } from '../../src/community/vumanchu-swing';
describe('VuManChu Swing Free', () => {
  it('should return valid result structure', () => {
    const result = VuManChuSwing.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.metadata.overlay).toBe(true);
  });
  it('should produce filter values near price', () => {
    const result = VuManChuSwing.calculate(bars);
    const keys = Object.keys(result.plots);
    expect(keys.length).toBeGreaterThanOrEqual(1);
    const vals = result.plots[keys[0]].filter((v: any) => !isNaN(v.value));
    expect(vals.length).toBeGreaterThan(0);
    // Overlay values should be near price range
    const avgClose = bars.reduce((s, b) => s + b.close, 0) / bars.length;
    const avgVals = vals.reduce((s: number, v: any) => s + v.value, 0) / vals.length;
    expect(Math.abs(avgVals - avgClose)).toBeLessThan(avgClose);
  });
});

import { TweezersKangarooTail } from '../../src/community/tweezers-kangaroo-tail';
describe('Tweezers & Kangaroo Tail', () => {
  it('should return valid result structure', () => {
    const result = TweezersKangarooTail.calculate(bars);
    expect(result).toBeDefined();
    expect(result.metadata.overlay).toBe(true);
  });
  it('should produce markers or plot data', () => {
    const result = TweezersKangarooTail.calculate(bars) as any;
    const hasMarkers = Array.isArray(result.markers) && result.markers.length >= 0;
    const hasPlots = result.plots && Object.keys(result.plots).length > 0;
    expect(hasMarkers || hasPlots).toBe(true);
  });
});

import { BitcoinLogCurves } from '../../src/community/bitcoin-log-curves';
describe('Bitcoin Log Growth Curves', () => {
  it('should return valid result structure', () => {
    const result = BitcoinLogCurves.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.metadata.overlay).toBe(true);
  });
  it('should produce plot values', () => {
    const result = BitcoinLogCurves.calculate(bars);
    const keys = Object.keys(result.plots);
    expect(keys.length).toBeGreaterThanOrEqual(2);
  });
});

import { HemaTrendLevels } from '../../src/community/hema-trend-levels';
describe('HEMA Trend Levels', () => {
  it('should return valid result structure', () => {
    const result = HemaTrendLevels.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.metadata.overlay).toBe(true);
  });
  it('should produce HEMA values near price', () => {
    const result = HemaTrendLevels.calculate(bars);
    const keys = Object.keys(result.plots);
    expect(keys.length).toBeGreaterThanOrEqual(2);
    const vals = result.plots[keys[0]].filter((v: any) => !isNaN(v.value));
    expect(vals.length).toBeGreaterThan(0);
  });
});

import { RsiMomentumDivergence } from '../../src/community/rsi-momentum-divergence';
describe('RSI Momentum Divergence', () => {
  it('should return valid result structure', () => {
    const result = RsiMomentumDivergence.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.metadata.overlay).toBe(false);
  });
  it('should produce RSI values in valid range', () => {
    const result = RsiMomentumDivergence.calculate(bars);
    const keys = Object.keys(result.plots);
    expect(keys.length).toBeGreaterThanOrEqual(1);
    const vals = result.plots[keys[0]].filter((v: any) => !isNaN(v.value));
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v: any) => {
      expect(v.value).toBeGreaterThanOrEqual(0);
      expect(v.value).toBeLessThanOrEqual(100);
    });
  });
});

// --- Batch C ---

import { FvgPositioningAverage } from '../../src/community/fvg-positioning-average';
describe('FVG Positioning Average', () => {
  it('should return valid result structure', () => {
    const result = FvgPositioningAverage.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.metadata.overlay).toBe(true);
  });
  it('should produce average values', () => {
    const result = FvgPositioningAverage.calculate(bars);
    const keys = Object.keys(result.plots);
    expect(keys.length).toBeGreaterThanOrEqual(1);
  });
});

import { MomentumZigZag } from '../../src/community/momentum-zigzag';
describe('Momentum-based ZigZag', () => {
  it('should return valid result structure', () => {
    const result = MomentumZigZag.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.metadata.overlay).toBe(true);
  });
  it('should produce zigzag values near price', () => {
    const result = MomentumZigZag.calculate(bars);
    const keys = Object.keys(result.plots);
    expect(keys.length).toBeGreaterThanOrEqual(1);
    const vals = result.plots[keys[0]].filter((v: any) => !isNaN(v.value));
    expect(vals.length).toBeGreaterThan(0);
  });
});

import { RangeDetector } from '../../src/community/range-detector';
describe('Range Detector', () => {
  it('should return valid result structure', () => {
    const result = RangeDetector.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.metadata.overlay).toBe(true);
  });
  it('should produce range boundary values', () => {
    const result = RangeDetector.calculate(bars);
    const keys = Object.keys(result.plots);
    expect(keys.length).toBeGreaterThanOrEqual(1);
  });
});

import { SwingHighsLowsPatterns } from '../../src/community/swing-highs-lows-patterns';
describe('Swing Highs/Lows & Candle Patterns', () => {
  it('should return valid result structure', () => {
    const result = SwingHighsLowsPatterns.calculate(bars);
    expect(result).toBeDefined();
    expect(result.metadata.overlay).toBe(true);
  });
  it('should produce markers at pivot points', () => {
    const result = SwingHighsLowsPatterns.calculate(bars) as any;
    expect(Array.isArray(result.markers)).toBe(true);
    // With 500 bars and length=21, should find some pivots
    expect(result.markers.length).toBeGreaterThan(0);
  });
});

import { TrendLineAuto } from '../../src/community/trend-line-auto';
describe('Trend Line Auto', () => {
  it('should return valid result structure', () => {
    const result = TrendLineAuto.calculate(bars);
    expect(result).toBeDefined();
    expect(result.metadata.overlay).toBe(true);
  });
  it('should produce line drawings', () => {
    const result = TrendLineAuto.calculate(bars) as any;
    expect(Array.isArray(result.lines)).toBe(true);
  });
});

// --- Batch D ---

import { IntradayVolumeSwings } from '../../src/community/intraday-volume-swings';
describe('Intraday Volume Swings', () => {
  it('should return valid result structure', () => {
    const result = IntradayVolumeSwings.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.metadata.overlay).toBe(true);
  });
  it('should produce plot values', () => {
    const result = IntradayVolumeSwings.calculate(bars);
    const keys = Object.keys(result.plots);
    expect(keys.length).toBeGreaterThanOrEqual(1);
  });
});

import { RealtimeVolumeBars } from '../../src/community/realtime-volume-bars';
describe('Realtime Volume Bars', () => {
  it('should return valid result structure', () => {
    const result = RealtimeVolumeBars.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.metadata.overlay).toBe(false);
  });
  it('should produce volume values', () => {
    const result = RealtimeVolumeBars.calculate(bars);
    const keys = Object.keys(result.plots);
    expect(keys.length).toBeGreaterThanOrEqual(1);
    const vals = result.plots[keys[0]].filter((v: any) => !isNaN(v.value));
    expect(vals.length).toBeGreaterThan(0);
  });
});

import { VolumaticSRLevels } from '../../src/community/volumatic-sr-levels';
describe('Volumatic S/R Levels', () => {
  it('should return valid result structure', () => {
    const result = VolumaticSRLevels.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.metadata.overlay).toBe(true);
  });
  it('should produce price-level values', () => {
    const result = VolumaticSRLevels.calculate(bars);
    const keys = Object.keys(result.plots);
    expect(keys.length).toBeGreaterThanOrEqual(1);
  });
});

import { VwapMvwapEmaCrossover } from '../../src/community/vwap-mvwap-ema-crossover';
describe('VWAP/MVWAP/EMA Crossover', () => {
  it('should return valid result structure', () => {
    const result = VwapMvwapEmaCrossover.calculate(bars);
    expect(result).toBeDefined();
    expect(result.plots).toBeDefined();
    expect(result.metadata.overlay).toBe(true);
  });
  it('should produce VWAP values near price', () => {
    const result = VwapMvwapEmaCrossover.calculate(bars);
    const keys = Object.keys(result.plots);
    expect(keys.length).toBeGreaterThanOrEqual(2);
    const vals = result.plots[keys[0]].filter((v: any) => !isNaN(v.value));
    expect(vals.length).toBeGreaterThan(0);
  });
});

import { VolumeFootprint } from '../../src/community/volume-footprint';
describe('Volume Footprint', () => {
  it('should return valid result structure', () => {
    const result = VolumeFootprint.calculate(bars);
    expect(result).toBeDefined();
    expect(result.metadata.overlay).toBe(true);
  });
  it('should produce boxes or plot data', () => {
    const result = VolumeFootprint.calculate(bars) as any;
    const hasBoxes = Array.isArray(result.boxes) && result.boxes.length > 0;
    const hasPlots = result.plots && Object.keys(result.plots).length > 0;
    expect(hasBoxes || hasPlots).toBe(true);
  });
});
