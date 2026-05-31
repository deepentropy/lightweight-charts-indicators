/**
 * Tests for the 10 built-in studies added from the 2026-05-31 TradingView
 * Desktop catalog capture.
 */
import { describe, it, expect } from 'vitest';
import type { Bar } from 'oakscriptjs';

// 800 bars: enough warmup for Pring's Special K (ROC 530 + SMA 195) and EMA(255).
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

const bars = generateBars(800);
const hasValues = (p: { value: number }[]) => p.some((v) => !isNaN(v.value));

import { AroonOscillator } from '../../src/standard/aroon-oscillator';
describe('Aroon Oscillator', () => {
  it('has a full-length plot with values in [-100, 100]', () => {
    const r = AroonOscillator.calculate(bars);
    expect(r.plots['plot0'].length).toBe(bars.length);
    expect(hasValues(r.plots['plot0'])).toBe(true);
    for (const { value } of r.plots['plot0']) {
      if (!isNaN(value)) expect(value).toBeGreaterThanOrEqual(-100), expect(value).toBeLessThanOrEqual(100);
    }
    expect(AroonOscillator.metadata.overlay).toBe(false);
  });
});

import { NegativeVolumeIndex } from '../../src/standard/nvi';
describe('Negative Volume Index', () => {
  it('produces NVI + EMA seeded at 1000', () => {
    const r = NegativeVolumeIndex.calculate(bars);
    expect(r.plots['plot0'].length).toBe(bars.length);
    expect(r.plots['plot0'][0].value).toBe(1000);
    expect(hasValues(r.plots['plot1'])).toBe(true);
  });
});

import { PositiveVolumeIndex } from '../../src/standard/pvi';
describe('Positive Volume Index', () => {
  it('produces PVI + EMA seeded at 1000', () => {
    const r = PositiveVolumeIndex.calculate(bars);
    expect(r.plots['plot0'][0].value).toBe(1000);
    expect(hasValues(r.plots['plot0'])).toBe(true);
  });
});

import { UlcerIndex } from '../../src/standard/ulcer-index';
describe('Ulcer Index', () => {
  it('produces non-negative values', () => {
    const r = UlcerIndex.calculate(bars);
    expect(r.plots['plot0'].length).toBe(bars.length);
    expect(hasValues(r.plots['plot0'])).toBe(true);
    for (const { value } of r.plots['plot0']) if (!isNaN(value)) expect(value).toBeGreaterThanOrEqual(0);
  });
});

import { PringsSpecialK } from '../../src/standard/prings-special-k';
describe("Pring's Special K", () => {
  it('produces values once warmed up', () => {
    const r = PringsSpecialK.calculate(bars);
    expect(r.plots['plot0'].length).toBe(bars.length);
    expect(hasValues(r.plots['plot0'])).toBe(true);
  });
});

import { VolatilityStop } from '../../src/standard/volatility-stop';
describe('Volatility Stop', () => {
  it('emits exactly one of long/short per bar', () => {
    const r = VolatilityStop.calculate(bars);
    expect(r.plots['plot0'].length).toBe(bars.length);
    for (let i = 0; i < bars.length; i++) {
      const long = r.plots['plot0'][i].value;
      const short = r.plots['plot1'][i].value;
      expect(isNaN(long) !== isNaN(short)).toBe(true);
    }
    expect(VolatilityStop.metadata.overlay).toBe(true);
  });
});

import { VWAP } from '../../src/standard/vwap';
describe('VWAP', () => {
  it('produces a VWAP line; bands off by default', () => {
    const r = VWAP.calculate(bars);
    expect(hasValues(r.plots['plot0'])).toBe(true);
    expect(hasValues(r.plots['plot1'])).toBe(false);
  });
  it('produces bands when enabled', () => {
    const r = VWAP.calculate(bars, { showBands: true, anchor: '1M' });
    expect(hasValues(r.plots['plot1'])).toBe(true);
    expect(hasValues(r.plots['plot2'])).toBe(true);
  });
});

import { UpDownVolume } from '../../src/standard/up-down-volume';
describe('Up/Down Volume', () => {
  it('splits volume into up (>=0) and down (<=0)', () => {
    const r = UpDownVolume.calculate(bars);
    expect(r.plots['plot0'].length).toBe(bars.length);
    for (const { value } of r.plots['plot0']) expect(value).toBeGreaterThanOrEqual(0);
    for (const { value } of r.plots['plot1']) expect(value).toBeLessThanOrEqual(0);
  });
});

import { AutoKeyLevels } from '../../src/standard/auto-key-levels';
describe('Auto Key Levels', () => {
  it('emits horizontal level lines', () => {
    const r = AutoKeyLevels.calculate(bars) as any;
    expect(Array.isArray(r.lines)).toBe(true);
    expect(r.lines.length).toBeGreaterThan(0);
    expect(r.lines.length).toBeLessThanOrEqual(AutoKeyLevels.defaultInputs.maxLevels);
    for (const l of r.lines) expect(l.price1).toBe(l.price2); // horizontal
  });
});

import { AutoTrendDetector } from '../../src/standard/auto-trend-detector';
describe('Auto Trend Detector', () => {
  it('emits trendlines and pivot markers', () => {
    const r = AutoTrendDetector.calculate(bars) as any;
    expect(Array.isArray(r.lines)).toBe(true);
    expect(Array.isArray(r.markers)).toBe(true);
    expect(r.markers.length).toBeGreaterThan(0);
  });
});
